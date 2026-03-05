import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { AppDispatch, RootState } from "../../store";
import { fetchArtworks, type Artwork } from "../../store/artworksSlice";
import styles from "./Gallery.module.scss";

interface GalleryProps {
    artworks?: Artwork[];
}

gsap.registerPlugin(ScrollTrigger);

function getTransitionDirectionForArtwork(artworkIndex: number): "vertical" | "horizontal" {
    return Math.floor(artworkIndex / 4) % 2 === 0 ? "vertical" : "horizontal";
}

const ImageFullyVisible = "inset(0% 0% 0% 0%)";
const ImageCollapseVertical = "inset(50% 0% 50% 0%)";
const ImageCollapseHorizontal = "inset(0% 50% 0% 50%)";

// ── Scroll timing knobs ───────────────────────────────────────────────────────
const ImageTransitionScrollVh = 80; // vh of scroll to animate in/out an image (clip-path)
const SettleBeforePoemVh = 7; // vh of calm viewing before the poem lines start
const ScrollVhPerPoemLine = 8; // vh of scroll consumed per poem line
const PoemLineHeightPx = 90; // px height per line — must match .poemLine in SCSS
const BlankLinesBeforePoem = 0; // blank spacers before poem text starts (forces scroll delay before content)
const BlankLinesAfterPoem = 2; // blank spacers after poem text ends (allows reading last line before transition)

// ── Paragraph-aware poem parser ───────────────────────────────────────────────
// Collapses 1+ consecutive blank lines into a single visual spacer.
// Only real text lines are scroll steps; spacers are shown but not snapped to.
interface PoemItem {
    type: "line" | "spacer";
    text: string; // display text (or '\u00A0' for spacer)
    scrollIdx: number; // for 'line': 0-based index among real lines; for 'spacer': -1
}
interface ParsedPoem {
    items: PoemItem[];
    realCount: number; // total real (non-blank) lines
    verticalOffsetByLineIndex: number[]; // track Y offset for each real line (used to scroll the track)
}

function splitPoemIntoDisplayLines(description: string): ParsedPoem {
    const raw = description.split("\n");
    const items: PoemItem[] = [];
    let realCount = 0;
    let inBlank = false;

    // Add blank spacer lines at the start for scrollable padding before poem
    for (let i = 0; i < BlankLinesBeforePoem; i++) {
        items.push({ type: "spacer", text: "\u00A0", scrollIdx: -1 });
    }

    for (const line of raw) {
        if (line.trim() === "") {
            // collapse consecutive blanks into one spacer
            if (!inBlank && items.length > BlankLinesBeforePoem) {
                items.push({ type: "spacer", text: "\u00A0", scrollIdx: -1 });
            }
            inBlank = true;
        } else {
            items.push({ type: "line", text: line, scrollIdx: realCount });
            realCount++;
            inBlank = false;
        }
    }

    // Remove trailing spacer if any
    if (items.length > 0 && items[items.length - 1].type === "spacer") {
        items.pop();
    }

    // Add blank spacer lines at the end for scrollable padding after poem
    for (let i = 0; i < BlankLinesAfterPoem; i++) {
        items.push({ type: "spacer", text: "\u00A0", scrollIdx: -1 });
    }

    // Build trackY mapping: for scroll step N, what Y offset centers that line
    const verticalOffsetByLineIndex: number[] = [];
    let displayIdx = 0;
    for (const item of items) {
        if (item.type === "line") {
            verticalOffsetByLineIndex.push(displayIdx * PoemLineHeightPx);
        }
        displayIdx++;
    }

    return { items, realCount, verticalOffsetByLineIndex };
}

interface Positions {
    starts: number[]; // scroll-px where artwork i is fully settled
    poemStarts: number[]; // scroll-px where poem begins
    poemEnds: number[]; // scroll-px where poem finishes
    total: number; // total container height in px
    imageTransitionPx: number;
    settleBeforePoemPx: number;
}

function calculateScrollPositions(items: Artwork[], viewportHeight: number): Positions {
    const imageTransitionPx = (ImageTransitionScrollVh / 100) * viewportHeight;
    const settleBeforePoemPx = (SettleBeforePoemVh / 140) * viewportHeight;
    const scrollPxPerPoemLine = (ScrollVhPerPoemLine / 100) * viewportHeight;

    const starts: number[] = [];
    const poemStarts: number[] = [];
    const poemEnds: number[] = [];

    let cursor = 0;
    for (const artwork of items) {
        starts.push(cursor);
        const { items: poemItems } = splitPoemIntoDisplayLines(artwork.description ?? "");
        // Poem trigger starts after initial settle, then scrolls through all items (blanks + text + blanks)
        poemStarts.push(cursor + settleBeforePoemPx);
        // Total scrollable range: all items in poem track (before + text + after)
        const totalScrollableLines = poemItems.length;
        poemEnds.push(cursor + settleBeforePoemPx + totalScrollableLines * scrollPxPerPoemLine);
        cursor = poemEnds[poemEnds.length - 1] + imageTransitionPx;
    }

    // Add enough space so the last line can be centered
    // (viewport height / 2) - (line height / 2)
    const lastLineCenterOffset = viewportHeight / 2 - PoemLineHeightPx / 2;
    return { starts, poemStarts, poemEnds, total: cursor + lastLineCenterOffset, imageTransitionPx, settleBeforePoemPx };
}

function blendBetween(startValue: number, endValue: number, progress: number): number {
    return startValue + (endValue - startValue) * progress;
}

// 0 = active line, 1 = one line away, -2 = two lines above, etc.
function opacityAtDistanceFromActive(distanceInLines: number): number {
    const howFarAway = Math.abs(distanceInLines);
    if (howFarAway >= 3) return 0;
    if (howFarAway < 1) return blendBetween(1.0, 0.5, howFarAway);
    if (howFarAway < 2) return blendBetween(0.5, 0.25, howFarAway - 1);
    return blendBetween(0.25, 0.0, howFarAway - 2);
}

// Active line is scaled up; lines further away shrink proportionally.
// 0 = active (1.3×), 1 = neighbour (0.8×), 2+ = background (0.5×)
function scaleAtDistanceFromActive(distanceInLines: number): number {
    const howFarAway = Math.abs(distanceInLines);
    if (howFarAway < 0.01) return 1.3;
    if (howFarAway < 1) return blendBetween(0.8, 0.75, howFarAway);
    if (howFarAway < 2) return blendBetween(0.65, 0.4, howFarAway - 1);
    return 0.5;
}

export default function Gallery({ artworks: propArtworks }: GalleryProps = {}) {
    const dispatch = useDispatch<AppDispatch>();
    const { items: reduxItems, loading: reduxLoading } = useSelector((state: RootState) => state.artworks);
    const items = [...(propArtworks ?? reduxItems)].sort((a, b) => a.sort_order - b.sort_order);
    const loading = propArtworks !== undefined ? false : reduxLoading;

    const containerRef = useRef<HTMLDivElement>(null);
    const layerRefs = useRef<HTMLDivElement[]>([]);
    const innerRefs = useRef<HTMLDivElement[]>([]);
    const infoRefs = useRef<HTMLDivElement[]>([]);
    const colorFogRef = useRef<HTMLDivElement>(null);
    const poemTrackRefs = useRef<HTMLDivElement[]>([]);
    const lineRefs = useRef<HTMLDivElement[][]>([]);
    const artworkStartsRef = useRef<number[]>([]);

    useEffect(() => {
        if (propArtworks === undefined) dispatch(fetchArtworks());
    }, [dispatch, propArtworks]);

    useEffect(() => {
        if ("ontouchstart" in window) ScrollTrigger.normalizeScroll(true);
    }, []);

    useEffect(() => {
        if (!items.length || !containerRef.current) return;

        const viewportHeight = window.innerHeight;
        const pos = calculateScrollPositions(items, viewportHeight);
        artworkStartsRef.current = pos.starts;

        containerRef.current.style.height = `${pos.total}px`;

        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const ctx = gsap.context(() => {
            ScrollTrigger.getAll().forEach((t) => t.kill());

            items.forEach((artwork, i) => {
                const layer = layerRefs.current[i];
                const inner = innerRefs.current[i];
                const info = infoRefs.current[i];
                if (!layer || !inner || !info) return;

                const { starts, poemStarts, poemEnds, imageTransitionPx } = pos;
                const imageVisibleStart = starts[i];
                const imageVisibleEnd = poemEnds[i];

                if (prefersReduced) {
                    var zIndexValue = i === 0 ? items.length : i - items.length;

                    // ── REDUCED MOTION: simple opacity cross-fades ─────────────────────
                    gsap.set(layer, { opacity: i === 0 ? 1 : 0, zIndex: zIndexValue });
                    gsap.set(info, { opacity: i === 0 ? 1 : 0, y: 0 });

                    if (i > 0) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start: `${starts[i] - imageTransitionPx}px top`,
                                end: `${starts[i]}px top`,
                                scrub: 1,
                                onEnter: () => gsap.set(layer, { zIndex: 20 }),
                                onLeaveBack: () => gsap.set(layer, { zIndex: i }),
                            },
                        })
                            .fromTo(layer, { opacity: 0 }, { opacity: 1, ease: "none" })
                            .fromTo(info, { opacity: 0 }, { opacity: 1, ease: "none" }, ">-0.3");
                    }

                    if (i < items.length - 1) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start: `${poemEnds[i]}px top`,
                                end: `${starts[i + 1]}px top`,
                                scrub: 0.5,
                            },
                        })
                            .fromTo(layer, { opacity: 1 }, { opacity: 0, ease: "none" })
                            .fromTo(info, { opacity: 1 }, { opacity: 0, ease: "none" }, "<");
                    }
                } else {
                    // ── FULL MOTION: iris clip-path transitions ────────────────────────
                    const tType = getTransitionDirectionForArtwork(i);
                    const collapseClip = tType === "vertical" ? ImageCollapseVertical : ImageCollapseHorizontal;

                    if (i === 0) {
                        gsap.set(layer, { clipPath: ImageFullyVisible, zIndex: 10 });
                        gsap.set(inner, { scale: 1 });
                        gsap.set(info, { opacity: 1, y: 0 });
                    } else {
                        gsap.set(layer, { clipPath: collapseClip, zIndex: i });
                        gsap.set(info, { opacity: 0, y: 24 });
                    }

                    // ── ENTER ──────────────────────────────────────────────────────────
                    if (i > 0) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start: `${starts[i] - imageTransitionPx}px top`,
                                end: `${starts[i]}px top`,
                                scrub: 1,
                                onEnter: () => gsap.set(layer, { zIndex: 20 }),
                                onLeaveBack: () => gsap.set(layer, { zIndex: i }),
                            },
                        })
                            .fromTo(layer, { clipPath: collapseClip }, { clipPath: ImageFullyVisible, ease: "none" })
                            .fromTo(inner, { scale: 1.05 }, { scale: 1, ease: "none" }, "<")
                            .fromTo(info, { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: "none" }, ">-0.3");
                    }

                    // ── EXIT ───────────────────────────────────────────────────────────
                    if (i < items.length - 1) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start: `${poemEnds[i]}px top`,
                                end: `${starts[i + 1]}px top`,
                                scrub: 1,
                            },
                        })
                            .fromTo(layer, { clipPath: ImageFullyVisible }, { clipPath: collapseClip, ease: "none" })
                            .fromTo(inner, { scale: 1 }, { scale: 0.97, ease: "none" }, "<")
                            .fromTo(info, { opacity: 1, y: 0 }, { opacity: 0, y: -16, ease: "none" }, "<");
                    }

                    // ── PARALLAX during hold + poem ────────────────────────────────────
                    if (imageVisibleEnd > imageVisibleStart) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start: `${imageVisibleStart}px top`,
                                end: `${imageVisibleEnd}px top`,
                                scrub: 0.5,
                            },
                        }).fromTo(inner, { yPercent: 1.5 }, { yPercent: -1.5, ease: "none" });
                    }
                }

                // ── COLOR FOG ─────────────────────────────────────────────────────────
                const fogColor = artwork.metadata?.palette?.[0];
                if (fogColor && colorFogRef.current) {
                    if (i === 0) gsap.set(colorFogRef.current, { backgroundColor: fogColor });
                    ScrollTrigger.create({
                        trigger: containerRef.current,
                        start: `${starts[i]}px top`,
                        end: `${i < items.length - 1 ? starts[i + 1] : pos.total}px top`,
                        onEnter: () => gsap.to(colorFogRef.current, { backgroundColor: fogColor, duration: 1.4, ease: "power2.out" }),
                        onEnterBack: () => gsap.to(colorFogRef.current, { backgroundColor: fogColor, duration: 1.4, ease: "power2.out" }),
                    });
                }

                // ── POEM VIEWER ───────────────────────────────────────────────────────
                const poem = splitPoemIntoDisplayLines(artwork.description ?? "");
                const track = poemTrackRefs.current[i];
                const lineEls = (lineRefs.current[i] ?? []).slice(0, poem.items.length);

                if (poem.realCount >= 1 && track && lineEls.length) {
                    gsap.set(track, { xPercent: -50, y: 0 });
                    lineEls.forEach((el) => {
                        if (el) gsap.set(el, { opacity: 0, scale: scaleAtDistanceFromActive(0) });
                    });

                    // quickSetter avoids per-frame GSAP overhead for high-frequency updates
                    const setTrackY = gsap.quickSetter(track, "y", "px") as (v: number) => void;
                    const setLineOpacity = lineEls.map((el) => (el ? (gsap.quickSetter(el, "opacity") as (v: number) => void) : null));
                    const setLineScale = lineEls.map((el) => (el ? (gsap.quickSetter(el, "scale") as (v: number) => void) : null));

                    // Total steps accounts for ALL items (before + text + after spacers)
                    // This ensures scroll range extends to show all spacer elements
                    const totalSteps = Math.max(1, poem.items.length - 1);
                    // But we only snap to real lines, not spacers
                    const realLineSteps = Math.max(1, poem.realCount - 1);

                    ScrollTrigger.create({
                        trigger: containerRef.current,
                        start: `${poemStarts[i]}px top`,
                        end: `${poemEnds[i]}px top`,
                        scrub: 0.5,
                        snap: {
                            snapTo: (progress) => {
                                // Snap only to real line positions, not spacers
                                const snappedStep = Math.round(progress * realLineSteps) / realLineSteps;
                                return snappedStep;
                            },
                            duration: { min: 0.1, max: 0.3 },
                            delay: 0.05,
                            ease: "power2.inOut",
                        },
                        onUpdate: (self) => {
                            // Map progress through ALL items to show spacers
                            const currentStep = self.progress * totalSteps;

                            // Calculate track Y position to show current scroll location
                            // For real lines: interpolate between line positions
                            // For spacers after last line: continue translating
                            let trackY = 0;
                            if (currentStep < poem.realCount - 1) {
                                const stepLow = Math.floor(currentStep);
                                const stepHigh = Math.min(stepLow + 1, poem.verticalOffsetByLineIndex.length - 1);
                                const fraction = currentStep - stepLow;
                                trackY = blendBetween(poem.verticalOffsetByLineIndex[stepLow] ?? 0, poem.verticalOffsetByLineIndex[stepHigh] ?? 0, fraction);
                            } else {
                                // Past the last real line: continue scrolling to show trailing spacers
                                const lastLineOffset = poem.verticalOffsetByLineIndex[poem.verticalOffsetByLineIndex.length - 1] ?? 0;
                                const progressBeyondLastLine = currentStep - (poem.realCount - 1);
                                const extraScroll = progressBeyondLastLine * PoemLineHeightPx;
                                trackY = lastLineOffset + extraScroll;
                            }
                            setTrackY(-trackY);

                            const activeLine = Math.round(currentStep);

                            for (let j = 0; j < lineEls.length; j++) {
                                if (!lineEls[j]) continue;
                                const item = poem.items[j];

                                if (item.type === "spacer") {
                                    setLineOpacity[j]?.(0);
                                    setLineScale[j]?.(1);
                                    lineEls[j].classList.remove(styles.poemLineSelected);
                                } else {
                                    // Distance from this line to the current scroll position
                                    const distanceFromActive = item.scrollIdx - currentStep;
                                    setLineOpacity[j]?.(opacityAtDistanceFromActive(distanceFromActive));
                                    setLineScale[j]?.(scaleAtDistanceFromActive(distanceFromActive));
                                    if (item.scrollIdx === activeLine) {
                                        lineEls[j].classList.add(styles.poemLineSelected);
                                    } else {
                                        lineEls[j].classList.remove(styles.poemLineSelected);
                                    }
                                }
                            }
                        },
                    });
                }
            });
        }, containerRef);

        return () => ctx.revert();
    }, [items]);

    // ── TOUCH SWIPE — jump to nearest artwork ─────────────────────────────────────
    useEffect(() => {
        if (!items.length) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartSY = 0;
        let touchStartTime = 0;

        const onTouchStart = (e: TouchEvent) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartSY = window.scrollY;
            touchStartTime = Date.now();
        };

        const onTouchEnd = (e: TouchEvent) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            const elapsed = Date.now() - touchStartTime;

            if (Math.max(absDx, absDy) < 80 || elapsed > 500) return;

            const starts = artworkStartsRef.current;
            if (!starts.length) return;

            // Find which artwork we're currently viewing
            const sy = touchStartSY;
            let currentIndex = 0;
            for (let k = starts.length - 1; k >= 0; k--) {
                if (sy >= starts[k]) {
                    currentIndex = k;
                    break;
                }
            }

            const goingForward = absDy >= absDx ? dy < 0 : dx < 0;
            let nextIndex = goingForward ? currentIndex + 1 : currentIndex - 1;
            nextIndex = Math.max(0, Math.min(starts.length - 1, nextIndex));

            window.scrollTo({ top: starts[nextIndex], behavior: "smooth" });
        };

        document.addEventListener("touchstart", onTouchStart, { passive: true });
        document.addEventListener("touchend", onTouchEnd, { passive: true });

        return () => {
            document.removeEventListener("touchstart", onTouchStart);
            document.removeEventListener("touchend", onTouchEnd);
        };
    }, [items.length]);

    // Compute container height for initial render (matches what useEffect sets)
    const initHeight = items.length && typeof window !== "undefined" ? calculateScrollPositions(items, window.innerHeight).total : 0;

    const isTouch = typeof window !== "undefined" && "ontouchstart" in window;

    if (loading && !items.length) {
        return (
            <div className={styles.loading}>
                <span>Loading</span>
            </div>
        );
    }

    return (
        <div ref={containerRef} className={styles.container} style={{ height: `${initHeight}px` }}>
            <div className={styles.sticky}>
                <div ref={colorFogRef} className={styles.colorFog} />

                {items.map((artwork, i) => (
                    <div
                        key={artwork.id}
                        ref={(el) => {
                            if (el) layerRefs.current[i] = el;
                        }}
                        className={styles.layer}
                    >
                        <div
                            ref={(el) => {
                                if (el) innerRefs.current[i] = el;
                            }}
                            className={styles.inner}
                        >
                            {artwork.image ? (
                                <img src={artwork.image} alt={artwork.title} className={styles.image} loading={i === 0 ? "eager" : "lazy"} draggable={false} />
                            ) : (
                                <div className={styles.placeholder}>
                                    <span>{artwork.title[0]}</span>
                                </div>
                            )}
                        </div>

                        <div
                            ref={(el) => {
                                if (el) infoRefs.current[i] = el;
                            }}
                            className={styles.info}
                        >
                            <span className={styles.index}>
                                {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                            </span>
                            <h2 className={styles.title}>{artwork.title}</h2>
                        </div>

                        {artwork.description &&
                            (() => {
                                const { items: poemItems } = splitPoemIntoDisplayLines(artwork.description);
                                return (
                                    <div className={styles.poemWindow}>
                                        <div
                                            ref={(el) => {
                                                if (el) poemTrackRefs.current[i] = el;
                                            }}
                                            className={styles.poemTrack}
                                        >
                                            {/* Poem text lines (including trailing spacers for scrollable padding) */}
                                            {poemItems.map((item, j) => (
                                                <>
                                                    <div
                                                        key={j}
                                                        ref={(el) => {
                                                            if (el) {
                                                                lineRefs.current[i] = lineRefs.current[i] ?? [];
                                                                lineRefs.current[i][j] = el;
                                                            }
                                                        }}
                                                        className={item.type === "spacer" ? styles.poemSpacer : styles.poemLine}
                                                    >
                                                        {item.text}
                                                    </div>
                                                </>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                    </div>
                ))}

                <div className={styles.scrollHint} aria-hidden="true">
                    <span>{isTouch ? "swipe" : "scroll"}</span>
                    <div className={styles.scrollLine} />
                </div>
            </div>
        </div>
    );
}
