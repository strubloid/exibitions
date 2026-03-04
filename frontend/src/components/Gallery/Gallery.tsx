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

function transitionType(i: number): "vertical" | "horizontal" {
    return Math.floor(i / 4) % 2 === 0 ? "vertical" : "horizontal";
}

const CLIP_FULL   = "inset(0% 0% 0% 0%)";
const CLIP_NONE_V = "inset(50% 0% 50% 0%)";
const CLIP_NONE_H = "inset(0% 50% 0% 50%)";

// Variable-scroll architecture
const TRANSITION_VH   = 80   // vh for enter/exit clip-path animation
const SETTLE_VH       = 60   // vh of stable image before poem starts
const SCROLL_PER_LINE = 10   // vh per poem line (snap handles one-at-a-time)
const LINE_H          = 70   // px — must match .poemLine height in SCSS

interface Positions {
    starts:     number[]  // scroll-px where artwork i is fully settled
    poemStarts: number[]  // scroll-px where poem begins
    poemEnds:   number[]  // scroll-px where poem finishes
    total:      number    // total container height in px
    TRANS_PX:   number
    SETTLE_PX:  number
}

function computePositions(items: Artwork[], VH: number): Positions {
    const TRANS_PX  = (TRANSITION_VH   / 100) * VH
    const SETTLE_PX = (SETTLE_VH       / 100) * VH
    const LINE_PX   = (SCROLL_PER_LINE / 100) * VH

    const starts:     number[] = []
    const poemStarts: number[] = []
    const poemEnds:   number[] = []

    let cursor = 0
    for (const artwork of items) {
        starts.push(cursor)
        const nLines = Math.max(1, (artwork.description ?? '').split('\n').length)
        poemStarts.push(cursor + SETTLE_PX)
        poemEnds.push(cursor + SETTLE_PX + nLines * LINE_PX)
        cursor = poemEnds[poemEnds.length - 1] + TRANS_PX
    }

    return { starts, poemStarts, poemEnds, total: cursor + SETTLE_PX, TRANS_PX, SETTLE_PX }
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function lineOpacity(distance: number): number {
    const abs = Math.abs(distance);
    if (abs >= 3) return 0;
    if (abs < 1)  return lerp(1.0, 0.5, abs);
    if (abs < 2)  return lerp(0.5, 0.25, abs - 1);
    return              lerp(0.25, 0.0, abs - 2);
}

function lineScale(distance: number): number {
    const abs = Math.abs(distance);
    if (abs < 1) return lerp(1.8, 0.9, abs);
    if (abs < 2) return lerp(0.9, 0.45, abs - 1);
    return 0.45;
}

export default function Gallery({ artworks: propArtworks }: GalleryProps = {}) {
    const dispatch = useDispatch<AppDispatch>();
    const { items: reduxItems, loading: reduxLoading } = useSelector((state: RootState) => state.artworks);
    const items   = propArtworks ?? reduxItems;
    const loading = propArtworks !== undefined ? false : reduxLoading;

    const containerRef     = useRef<HTMLDivElement>(null);
    const layerRefs        = useRef<HTMLDivElement[]>([]);
    const innerRefs        = useRef<HTMLDivElement[]>([]);
    const infoRefs         = useRef<HTMLDivElement[]>([]);
    const colorFogRef      = useRef<HTMLDivElement>(null);
    const poemTrackRefs    = useRef<HTMLDivElement[]>([]);
    const lineRefs         = useRef<HTMLDivElement[][]>([]);
    const artworkStartsRef = useRef<number[]>([]);

    useEffect(() => {
        if (propArtworks === undefined) dispatch(fetchArtworks());
    }, [dispatch, propArtworks]);

    useEffect(() => {
        if ("ontouchstart" in window) ScrollTrigger.normalizeScroll(true);
    }, []);

    useEffect(() => {
        if (!items.length || !containerRef.current) return;

        const VH  = window.innerHeight;
        const pos = computePositions(items, VH);
        artworkStartsRef.current = pos.starts;

        containerRef.current.style.height = `${pos.total}px`;

        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const ctx = gsap.context(() => {
            ScrollTrigger.getAll().forEach((t) => t.kill());

            items.forEach((artwork, i) => {
                const layer = layerRefs.current[i];
                const inner = innerRefs.current[i];
                const info  = infoRefs.current[i];
                if (!layer || !inner || !info) return;

                const { starts, poemStarts, poemEnds, TRANS_PX } = pos;
                const holdStart = starts[i];
                const holdEnd   = poemEnds[i];

                if (prefersReduced) {
                    // ── REDUCED MOTION: simple opacity cross-fades ─────────────────────
                    gsap.set(layer, { opacity: i === 0 ? 1 : 0, zIndex: i });
                    gsap.set(info,  { opacity: i === 0 ? 1 : 0, y: 0 });

                    if (i > 0) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start:   `${starts[i] - TRANS_PX}px top`,
                                end:     `${starts[i]}px top`,
                                scrub:   1,
                                onEnter:     () => gsap.set(layer, { zIndex: 20 }),
                                onLeaveBack: () => gsap.set(layer, { zIndex: i }),
                            },
                        })
                            .fromTo(layer, { opacity: 0 }, { opacity: 1, ease: "none" })
                            .fromTo(info,  { opacity: 0 }, { opacity: 1, ease: "none" }, ">-0.3");
                    }

                    if (i < items.length - 1) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start:   `${poemEnds[i]}px top`,
                                end:     `${starts[i + 1]}px top`,
                                scrub:   1,
                            },
                        })
                            .fromTo(layer, { opacity: 1 }, { opacity: 0, ease: "none" })
                            .fromTo(info,  { opacity: 1 }, { opacity: 0, ease: "none" }, "<");
                    }
                } else {
                    // ── FULL MOTION: iris clip-path transitions ────────────────────────
                    const tType  = transitionType(i);
                    const noneIn = tType === "vertical" ? CLIP_NONE_V : CLIP_NONE_H;
                    const noneOut= tType === "vertical" ? CLIP_NONE_V : CLIP_NONE_H;

                    if (i === 0) {
                        gsap.set(layer, { clipPath: CLIP_FULL, zIndex: 10 });
                        gsap.set(inner, { scale: 1 });
                        gsap.set(info,  { opacity: 1, y: 0 });
                    } else {
                        gsap.set(layer, { clipPath: noneIn, zIndex: i });
                        gsap.set(info,  { opacity: 0, y: 24 });
                    }

                    // ── ENTER ──────────────────────────────────────────────────────────
                    if (i > 0) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start:   `${starts[i] - TRANS_PX}px top`,
                                end:     `${starts[i]}px top`,
                                scrub:   1,
                                onEnter:     () => gsap.set(layer, { zIndex: 20 }),
                                onLeaveBack: () => gsap.set(layer, { zIndex: i }),
                            },
                        })
                            .fromTo(layer, { clipPath: noneIn }, { clipPath: CLIP_FULL, ease: "none" })
                            .fromTo(inner, { scale: 1.05 }, { scale: 1, ease: "none" }, "<")
                            .fromTo(info,  { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: "none" }, ">-0.3");
                    }

                    // ── EXIT ───────────────────────────────────────────────────────────
                    if (i < items.length - 1) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start:   `${poemEnds[i]}px top`,
                                end:     `${starts[i + 1]}px top`,
                                scrub:   1,
                            },
                        })
                            .fromTo(layer, { clipPath: CLIP_FULL }, { clipPath: noneOut, ease: "none" })
                            .fromTo(inner, { scale: 1 }, { scale: 0.97, ease: "none" }, "<")
                            .fromTo(info,  { opacity: 1, y: 0 }, { opacity: 0, y: -16, ease: "none" }, "<");
                    }

                    // ── PARALLAX during hold + poem ────────────────────────────────────
                    if (holdEnd > holdStart) {
                        gsap.timeline({
                            scrollTrigger: {
                                trigger: containerRef.current,
                                start:   `${holdStart}px top`,
                                end:     `${holdEnd}px top`,
                                scrub:   3,
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
                        start:   `${starts[i]}px top`,
                        end:     `${i < items.length - 1 ? starts[i + 1] : pos.total}px top`,
                        onEnter:     () => gsap.to(colorFogRef.current, { backgroundColor: fogColor, duration: 1.4, ease: "power2.out" }),
                        onEnterBack: () => gsap.to(colorFogRef.current, { backgroundColor: fogColor, duration: 1.4, ease: "power2.out" }),
                    });
                }

                // ── POEM VIEWER ───────────────────────────────────────────────────────
                const lines   = (artwork.description ?? '').split('\n');
                const track   = poemTrackRefs.current[i];
                const lineEls = (lineRefs.current[i] ?? []).slice(0, lines.length);

                if (lines.length > 1 && track && lineEls.length) {
                    gsap.set(track, { xPercent: -50, y: 0 });
                    lineEls.forEach((el) => {
                        if (el) gsap.set(el, { opacity: 0, scale: lineScale(0) });
                    });

                    // quickSetter avoids per-frame GSAP overhead for high-frequency updates
                    const setY       = gsap.quickSetter(track, "y", "px") as (v: number) => void;
                    const qOpacity   = lineEls.map(el => el ? gsap.quickSetter(el, "opacity") as (v: number) => void : null);
                    const qScale     = lineEls.map(el => el ? gsap.quickSetter(el, "scale")   as (v: number) => void : null);

                    const lineCount = Math.max(1, lines.length - 1);
                    ScrollTrigger.create({
                        trigger: containerRef.current,
                        start:   `${poemStarts[i]}px top`,
                        end:     `${poemEnds[i]}px top`,
                        scrub:   0.5,
                        snap: {
                            snapTo:      1 / lineCount,
                            directional: true,
                            duration:    { min: 0.2, max: 0.4 },
                            delay:       0.05,
                            ease:        'power2.inOut',
                        },
                        onUpdate: (self) => {
                            const p = self.progress * lineCount;
                            setY(-p * LINE_H);
                            for (let j = 0; j < lineEls.length; j++) {
                                if (!lineEls[j]) continue;
                                const blank = lines[j]?.trim() === '';
                                qOpacity[j]?.(blank ? 0 : lineOpacity(j - p));
                                qScale[j]?.(blank ? 1 : lineScale(j - p));
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

        let touchStartX  = 0;
        let touchStartY  = 0;
        let touchStartSY = 0;
        let touchStartTime = 0;

        const onTouchStart = (e: TouchEvent) => {
            touchStartX    = e.touches[0].clientX;
            touchStartY    = e.touches[0].clientY;
            touchStartSY   = window.scrollY;
            touchStartTime = Date.now();
        };

        const onTouchEnd = (e: TouchEvent) => {
            const dx   = e.changedTouches[0].clientX - touchStartX;
            const dy   = e.changedTouches[0].clientY - touchStartY;
            const absDx    = Math.abs(dx);
            const absDy    = Math.abs(dy);
            const elapsed  = Date.now() - touchStartTime;

            if (Math.max(absDx, absDy) < 80 || elapsed > 500) return;

            const starts = artworkStartsRef.current;
            if (!starts.length) return;

            // Find which artwork we're currently viewing
            const sy = touchStartSY;
            let currentIndex = 0;
            for (let k = starts.length - 1; k >= 0; k--) {
                if (sy >= starts[k]) { currentIndex = k; break; }
            }

            const goingForward = absDy >= absDx ? dy < 0 : dx < 0;
            let nextIndex = goingForward ? currentIndex + 1 : currentIndex - 1;
            nextIndex = Math.max(0, Math.min(starts.length - 1, nextIndex));

            window.scrollTo({ top: starts[nextIndex], behavior: 'smooth' });
        };

        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchend',   onTouchEnd,   { passive: true });

        return () => {
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchend',   onTouchEnd);
        };
    }, [items.length]);

    // Compute container height for initial render (matches what useEffect sets)
    const initHeight = items.length && typeof window !== 'undefined'
        ? computePositions(items, window.innerHeight).total
        : 0;

    const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

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
                        ref={(el) => { if (el) layerRefs.current[i] = el; }}
                        className={styles.layer}
                    >
                        <div
                            ref={(el) => { if (el) innerRefs.current[i] = el; }}
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
                            ref={(el) => { if (el) infoRefs.current[i] = el; }}
                            className={styles.info}
                        >
                            <span className={styles.index}>
                                {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                            </span>
                            <h2 className={styles.title}>{artwork.title}</h2>
                        </div>

                        {artwork.description && (
                            <div className={styles.poemWindow}>
                                <div
                                    ref={(el) => { if (el) poemTrackRefs.current[i] = el; }}
                                    className={styles.poemTrack}
                                >
                                    {artwork.description.split('\n').map((line, j) => (
                                        <div
                                            key={j}
                                            ref={(el) => {
                                                if (el) {
                                                    lineRefs.current[i] = lineRefs.current[i] ?? [];
                                                    lineRefs.current[i][j] = el;
                                                }
                                            }}
                                            className={line.trim() === '' ? styles.poemSpacer : styles.poemLine}
                                        >
                                            {line.trim() === '' ? '\u00A0' : line}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                <div className={styles.scrollHint} aria-hidden="true">
                    <span>{isTouch ? 'swipe' : 'scroll'}</span>
                    <div className={styles.scrollLine} />
                </div>
            </div>
        </div>
    );
}
