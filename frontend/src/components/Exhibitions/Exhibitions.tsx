import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { AppDispatch, RootState } from '../../store'
import { fetchExhibitions } from '../../store/exhibitionsSlice'
import { extractDominantColor } from '../../utils/extractDominantColor'
import Gallery from '../Gallery/Gallery'
import styles from './Exhibitions.module.scss'

gsap.registerPlugin(ScrollTrigger)

// ── Scroll timing knobs ───────────────────────────────────────────────────────
const SettleVhBeforeCards = 20     // vh of calm viewing before first card appears
const ScrollVhPerCardSlide = 30    // vh for card to slide in from off-screen
const ScrollVhPerCardShimmer = 30  // vh for golden light sweep + brighten
const ScrollVhPerCard = ScrollVhPerCardSlide + ScrollVhPerCardShimmer

function calculateCardScrollPositions(cardCount: number, viewportHeight: number) {
  const settlePx = (SettleVhBeforeCards / 100) * viewportHeight
  const pxPerCard = (ScrollVhPerCard / 100) * viewportHeight
  const pxPerSlide = (ScrollVhPerCardSlide / 100) * viewportHeight

  const slideStarts: number[] = []
  const slideEnds: number[] = []
  const shimmerEnds: number[] = []

  for (let cardIndex = 0; cardIndex < cardCount; cardIndex++) {
    const cardStart = settlePx + cardIndex * pxPerCard
    slideStarts.push(cardStart)
    slideEnds.push(cardStart + pxPerSlide)
    shimmerEnds.push(cardStart + pxPerCard)
  }

  // Total container height: viewport (sticky view) + settle + all cards + one extra vh
  const totalPx = viewportHeight + settlePx + cardCount * pxPerCard + viewportHeight * 0.2
  return { slideStarts, slideEnds, shimmerEnds, totalPx }
}

const shortDesc = (text: string) => {
  const line = text.split('\n').find(l => l.trim()) ?? ''
  return line.length > 72 ? line.slice(0, 72) + '…' : line
}

export default function Exhibitions() {
  const dispatch = useDispatch<AppDispatch>()
  const { items, loading } = useSelector((state: RootState) => state.exhibitions)

  const sectionRefs = useRef<HTMLElement[]>([])
  const imageRefs   = useRef<HTMLDivElement[]>([])
  const overlayRefs = useRef<HTMLDivElement[]>([])

  // Outer scroll containers (one per exhibition)
  const bgContainerRefs = useRef<(HTMLDivElement | null)[]>([])
  const clippingContainerRefs = useRef<(HTMLDivElement | null)[]>([])

  // Individual card refs per exhibition
  const bgCardRefs = useRef<HTMLDivElement[][]>([])
  const clippingCardRefs = useRef<HTMLDivElement[][]>([])

  const [dominantColors, setDominantColors] = useState<Record<number, string>>({})
  const [selectedClipping, setSelectedClipping] = useState<{ exhibitionId: number; clippingIndex: number } | null>(null)

  // Stable sorted items reference to prevent spurious re-renders
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [items]
  )

  useEffect(() => {
    dispatch(fetchExhibitions())
  }, [dispatch])

  useEffect(() => {
    sortedItems.forEach((exhibition) => {
      if (exhibition.cover_image && !dominantColors[exhibition.id]) {
        extractDominantColor(exhibition.cover_image).then(color => {
          setDominantColors(prev => ({ ...prev, [exhibition.id]: color }))
        })
      }
    })
  }, [sortedItems, dominantColors])

  useEffect(() => {
    if (!sortedItems.length) return

    const viewportHeight = window.innerHeight
    const offscreenLeft = -viewportHeight * 1.5
    const offscreenRight = viewportHeight * 1.5

    const ctx = gsap.context(() => {
      sortedItems.forEach((_, exhibitionIndex) => {
        const section = sectionRefs.current[exhibitionIndex]
        const image   = imageRefs.current[exhibitionIndex]
        const overlay = overlayRefs.current[exhibitionIndex]
        if (!section || !image || !overlay) return

        // Parallax: image drifts as section scrolls through the viewport
        gsap.fromTo(image,
          { yPercent: -8 },
          {
            yPercent: 8,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start:   'top bottom',
              end:     'bottom top',
              scrub:   true,
            },
          }
        )

        // Entrance: staggered text reveal when section enters viewport
        const animEls = overlay.querySelectorAll('[data-anim]')
        gsap.fromTo(animEls,
          { opacity: 0, y: 22 },
          {
            opacity:  1,
            y:        0,
            duration: 1,
            stagger:  0.1,
            ease:     'power3.out',
            scrollTrigger: {
              trigger: section,
              start:   'top 85%',
              once:    true,
            },
          }
        )

        // ── Background cards — sticky pattern ───────────────────────────────
        const bgContainer = bgContainerRefs.current[exhibitionIndex]
        const bgCards = (bgCardRefs.current[exhibitionIndex] ?? []).filter(Boolean)
        if (bgContainer && bgCards.length) {
          const pos = calculateCardScrollPositions(bgCards.length, viewportHeight)
          bgContainer.style.height = `${pos.totalPx}px`

          bgCards.forEach((card, cardIndex) => {
            gsap.set(card, { x: cardIndex % 2 === 0 ? offscreenLeft : offscreenRight, filter: 'brightness(0.15)' })
            const shimmer = card.querySelector('[data-shimmer]') as HTMLElement | null
            if (shimmer) gsap.set(shimmer, { xPercent: -100 })
          })

          bgCards.forEach((card, cardIndex) => {
            // Phase 1: slide in from left (even) or right (odd)
            gsap.to(card, {
              x: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: bgContainer,
                start: `${pos.slideStarts[cardIndex]}px top`,
                end: `${pos.slideEnds[cardIndex]}px top`,
                scrub: 1,
              },
            })

            // Phase 2: brighten to normal + golden beam sweeps left→right across card
            gsap.to(card, {
              filter: 'brightness(1)',
              ease: 'none',
              scrollTrigger: {
                trigger: bgContainer,
                start: `${pos.slideEnds[cardIndex]}px top`,
                end: `${pos.shimmerEnds[cardIndex]}px top`,
                scrub: 1,
              },
            })
            const shimmer = card.querySelector('[data-shimmer]') as HTMLElement | null
            if (shimmer) {
              gsap.to(shimmer, {
                xPercent: 100,
                ease: 'none',
                scrollTrigger: {
                  trigger: bgContainer,
                  start: `${pos.slideEnds[cardIndex]}px top`,
                  end: `${pos.shimmerEnds[cardIndex]}px top`,
                  scrub: 1,
                },
              })
            }
          })
        }

        // ── Clipping cards — sticky pattern ─────────────────────────────────
        const clippingContainer = clippingContainerRefs.current[exhibitionIndex]
        const clippingCards = (clippingCardRefs.current[exhibitionIndex] ?? []).filter(Boolean)
        if (clippingContainer && clippingCards.length) {
          const pos = calculateCardScrollPositions(clippingCards.length, viewportHeight)
          clippingContainer.style.height = `${pos.totalPx}px`

          clippingCards.forEach((card, cardIndex) => {
            gsap.set(card, { x: cardIndex % 2 === 0 ? offscreenLeft : offscreenRight, filter: 'brightness(0.15)' })
            const shimmer = card.querySelector('[data-shimmer]') as HTMLElement | null
            if (shimmer) gsap.set(shimmer, { xPercent: -100 })
          })

          clippingCards.forEach((card, cardIndex) => {
            // Phase 1: slide in
            gsap.to(card, {
              x: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: clippingContainer,
                start: `${pos.slideStarts[cardIndex]}px top`,
                end: `${pos.slideEnds[cardIndex]}px top`,
                scrub: 1,
              },
            })

            // Phase 2: brighten to normal + golden beam sweeps left→right across card
            gsap.to(card, {
              filter: 'brightness(1)',
              ease: 'none',
              scrollTrigger: {
                trigger: clippingContainer,
                start: `${pos.slideEnds[cardIndex]}px top`,
                end: `${pos.shimmerEnds[cardIndex]}px top`,
                scrub: 1,
              },
            })
            const shimmer = card.querySelector('[data-shimmer]') as HTMLElement | null
            if (shimmer) {
              gsap.to(shimmer, {
                xPercent: 100,
                ease: 'none',
                scrollTrigger: {
                  trigger: clippingContainer,
                  start: `${pos.slideEnds[cardIndex]}px top`,
                  end: `${pos.shimmerEnds[cardIndex]}px top`,
                  scrub: 1,
                },
              })
            }
          })
        }
      })

      ScrollTrigger.refresh()
    })

    return () => ctx.revert()
  }, [sortedItems])

  // No exhibitions yet — show the global artworks gallery
  if (!loading && sortedItems.length === 0) {
    return <Gallery />
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <span>Loading</span>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {sortedItems.map((exhibition, i) => {
        const dominantColor = dominantColors[exhibition.id] || 'rgb(80, 80, 80)'
        const bgLines = exhibition.background?.split('\n').filter(l => l.trim()) ?? []
        return (
          <div key={exhibition.id}>
            {/* ─── Intro section ─────────────────────────────────────────────────────────────── */}
            <section
              ref={el => { if (el) sectionRefs.current[i] = el }}
              className={styles.section}
            >
              <Link
                to={`/exhibition/${exhibition.slug}`}
                className={styles.link}
                aria-label={exhibition.name}
              >
                {/* Cover image with parallax */}
                <div
                  ref={el => { if (el) imageRefs.current[i] = el }}
                  className={styles.imageWrap}
                >
                  {exhibition.cover_image ? (
                    <img
                      src={exhibition.cover_image}
                      alt={exhibition.name}
                      className={styles.image}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      draggable={false}
                    />
                  ) : (
                    <div className={styles.placeholder}>
                      <span>{exhibition.name[0]}</span>
                    </div>
                  )}
                </div>

                {/* Text overlay */}
                <div
                  ref={el => { if (el) overlayRefs.current[i] = el }}
                  className={styles.overlay}
                >
                  <span data-anim="" className={styles.index}>
                    {String(i + 1).padStart(2, '0')} / {String(sortedItems.length).padStart(2, '0')}
                  </span>

                  <div className={styles.overlayBottom}>
                    <div className={styles.overlayLeft}>
                      <h2 data-anim="" className={styles.name}>{exhibition.name}</h2>
                      {exhibition.description && (
                        <p data-anim="" className={styles.description}>{shortDesc(exhibition.description)}</p>
                      )}
                    </div>
                    <div className={styles.overlayActions}>
                      {bgLines.length > 0 && (
                        <button
                          data-anim=""
                          className={styles.sectionBtn}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); bgContainerRefs.current[i]?.scrollIntoView({ behavior: 'smooth' }) }}
                        >
                          Background
                        </button>
                      )}
                      {exhibition.clippings && exhibition.clippings.length > 0 && (
                        <button
                          data-anim=""
                          className={styles.sectionBtn}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); clippingContainerRefs.current[i]?.scrollIntoView({ behavior: 'smooth' }) }}
                        >
                          Press
                        </button>
                      )}
                      <span data-anim="" className={styles.cta}>Enter →</span>
                    </div>
                  </div>
                </div>
              </Link>
            </section>

            {/* ─── Background section — sticky pattern ──────────────────────────────────── */}
            {bgLines.length > 0 && (
              <div ref={el => { bgContainerRefs.current[i] = el }}>
                <div className={styles.bgSticky}>
                  <section className={styles.backgroundSection} style={{ backgroundColor: dominantColor }}>
                    <h2 className={styles.backgroundTitle}>{exhibition.name}</h2>
                    <div className={styles.backgroundLabel}>Background</div>
                    <div className={styles.backgroundContent}>
                      <div className={styles.backgroundMasonryGrid}>
                        {bgLines.map((line, idx) => (
                          <div
                            key={idx}
                            className={styles.backgroundMasonryItem}
                            ref={el => {
                              if (!bgCardRefs.current[i]) bgCardRefs.current[i] = []
                              if (el) bgCardRefs.current[i][idx] = el
                            }}
                          >
                            <div data-shimmer="" className={styles.cardShimmer} />
                            <p className={styles.backgroundText}>{line}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {/* ─── Press/Clippings section — sticky pattern ─────────────────────────────── */}
            {exhibition.clippings && exhibition.clippings.length > 0 && (
              <div ref={el => { clippingContainerRefs.current[i] = el }}>
                <div className={styles.clippingSticky}>
                  <section className={styles.clippingsSection} style={{ backgroundColor: dominantColor }}>
                    <h2 className={styles.clippingsTitle}>Check it out where I was!</h2>
                    <div className={styles.clippingsLabel}>Press</div>
                    <div className={styles.clippingsContent}>
                      <div className={styles.clippingsGrid}>
                        {exhibition.clippings.map((clippingEntry, entryIndex) => (
                          <div
                            key={entryIndex}
                            className={styles.clippingCard}
                            ref={el => {
                              if (!clippingCardRefs.current[i]) clippingCardRefs.current[i] = []
                              if (el) clippingCardRefs.current[i][entryIndex] = el
                            }}
                            onClick={() => clippingEntry.screenshot_image && setSelectedClipping({ exhibitionId: exhibition.id, clippingIndex: entryIndex })}
                            style={{ cursor: clippingEntry.screenshot_image ? 'pointer' : 'default' }}
                          >
                            <div data-shimmer="" className={styles.cardShimmer} />
                            {clippingEntry.screenshot_image && (
                              <div className={styles.clippingImageContainer}>
                                <img
                                  src={clippingEntry.screenshot_image}
                                  alt={clippingEntry.title}
                                  className={styles.clippingImage}
                                />
                              </div>
                            )}
                            <div className={styles.clippingCardDetails}>
                              <span className={styles.clippingTitle}>{clippingEntry.title}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {selectedClipping && items.find(ex => ex.id === selectedClipping.exhibitionId)?.clippings?.[selectedClipping.clippingIndex]?.screenshot_image && (
        <div className={styles.modal} onClick={() => setSelectedClipping(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedClipping(null)}>✕</button>
            <img
              src={items.find(ex => ex.id === selectedClipping.exhibitionId)!.clippings![selectedClipping.clippingIndex].screenshot_image!}
              alt={items.find(ex => ex.id === selectedClipping.exhibitionId)!.clippings![selectedClipping.clippingIndex].title}
              className={styles.modalImage}
            />
          </div>
        </div>
      )}

      <button className={styles.scrollTopBtn} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
    </div>
  )
}
