import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { AppDispatch, RootState } from '../../store'
import { fetchExhibition, clearCurrent } from '../../store/exhibitionsSlice'
import { extractDominantColor } from '../../utils/extractDominantColor'
import Gallery from '../Gallery/Gallery'
import styles from './ExhibitionView.module.scss'

gsap.registerPlugin(ScrollTrigger)

// ── Scroll timing knobs ───────────────────────────────────────────────────────
const SettleVhBeforeCards = 20   // vh of calm viewing before first card appears
const ScrollVhPerCardSlide = 30  // vh consumed by slide-in animation per card
const ScrollVhPerCardLight = 20  // vh consumed by brightness animation per card
const ScrollVhPerCard = ScrollVhPerCardSlide + ScrollVhPerCardLight

function calculateCardScrollPositions(cardCount: number, viewportHeight: number) {
  const settlePx = (SettleVhBeforeCards / 100) * viewportHeight
  const pxPerCard = (ScrollVhPerCard / 100) * viewportHeight
  const pxPerSlide = (ScrollVhPerCardSlide / 100) * viewportHeight

  const slideStarts: number[] = []
  const slideEnds: number[] = []
  const lightEnds: number[] = []

  for (let cardIndex = 0; cardIndex < cardCount; cardIndex++) {
    const cardStart = settlePx + cardIndex * pxPerCard
    slideStarts.push(cardStart)
    slideEnds.push(cardStart + pxPerSlide)
    lightEnds.push(cardStart + pxPerCard)
  }

  // Total container height: viewport (sticky view) + settle + all cards + one extra vh
  const totalPx = viewportHeight + settlePx + cardCount * pxPerCard + viewportHeight * 0.2
  return { slideStarts, slideEnds, lightEnds, totalPx }
}

export default function ExhibitionView() {
  const { slug } = useParams<{ slug: string }>()
  const dispatch = useDispatch<AppDispatch>()
  const { current: exhibition, loading } = useSelector((state: RootState) => state.exhibitions)
  const [dominantColor, setDominantColor] = useState<string>('rgb(80, 80, 80)')
  const [selectedClippingIndex, setSelectedClippingIndex] = useState<number | null>(null)

  // Outer scroll containers (get explicit height set by GSAP effect)
  const bgContainerRef = useRef<HTMLDivElement>(null)
  const clippingContainerRef = useRef<HTMLDivElement>(null)

  // Individual card refs — populated from JSX render
  const bgCardRefs = useRef<HTMLDivElement[]>([])
  const clippingCardRefs = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    if (slug) dispatch(fetchExhibition(slug))
    return () => { dispatch(clearCurrent()) }
  }, [slug, dispatch])

  useEffect(() => {
    if (exhibition?.cover_image) {
      extractDominantColor(exhibition.cover_image).then(setDominantColor)
    }
  }, [exhibition?.cover_image])

  // Scroll-driven card animations — Gallery-style sticky pattern
  useEffect(() => {
    if (!exhibition) return

    const viewportHeight = window.innerHeight

    // Use viewport width for offscreen positions so cards are always truly off-screen
    // regardless of which column they sit in (xPercent only moves by the card's own width)
    const offscreenLeft = -viewportHeight * 1.5   // well off the left edge
    const offscreenRight = viewportHeight * 1.5   // well off the right edge

    const ctx = gsap.context(() => {
      // ── Background section ──────────────────────────────────────────────────
      const bgCards = bgCardRefs.current.filter(Boolean)
      if (bgContainerRef.current && bgCards.length) {
        const pos = calculateCardScrollPositions(bgCards.length, viewportHeight)
        bgContainerRef.current.style.height = `${pos.totalPx}px`

        // Push all cards fully off-screen before any scroll animation begins
        bgCards.forEach((card, idx) => {
          gsap.set(card, { x: idx % 2 === 0 ? offscreenLeft : offscreenRight, filter: 'brightness(0.2)' })
        })

        bgCards.forEach((card, idx) => {
          // Phase 1: slide in from left (even) or right (odd)
          gsap.to(card, {
            x: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: bgContainerRef.current,
              start: `${pos.slideStarts[idx]}px top`,
              end: `${pos.slideEnds[idx]}px top`,
              scrub: 1,
            },
          })

          // Phase 2: light up after card reaches its position
          gsap.to(card, {
            filter: 'brightness(1)',
            ease: 'none',
            scrollTrigger: {
              trigger: bgContainerRef.current,
              start: `${pos.slideEnds[idx]}px top`,
              end: `${pos.lightEnds[idx]}px top`,
              scrub: 1,
            },
          })
        })
      }

      // ── Clippings section ───────────────────────────────────────────────────
      const clippingCards = clippingCardRefs.current.filter(Boolean)
      if (clippingContainerRef.current && clippingCards.length) {
        const pos = calculateCardScrollPositions(clippingCards.length, viewportHeight)
        clippingContainerRef.current.style.height = `${pos.totalPx}px`

        clippingCards.forEach((card, idx) => {
          gsap.set(card, { x: idx % 2 === 0 ? offscreenLeft : offscreenRight, filter: 'brightness(0.2)' })
        })

        clippingCards.forEach((card, idx) => {
          // Phase 1: slide in from left (even) or right (odd)
          gsap.to(card, {
            x: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: clippingContainerRef.current,
              start: `${pos.slideStarts[idx]}px top`,
              end: `${pos.slideEnds[idx]}px top`,
              scrub: 1,
            },
          })

          // Phase 2: light up
          gsap.to(card, {
            filter: 'brightness(1)',
            ease: 'none',
            scrollTrigger: {
              trigger: clippingContainerRef.current,
              start: `${pos.slideEnds[idx]}px top`,
              end: `${pos.lightEnds[idx]}px top`,
              scrub: 1,
            },
          })
        })
      }

      ScrollTrigger.refresh()
    })

    return () => ctx.revert()
  }, [exhibition])

  if (loading || !exhibition) {
    return (
      <div className={styles.loading}>
        <span>Loading</span>
      </div>
    )
  }

  const bgLines = exhibition.background?.split('\n').filter(l => l.trim()) ?? []

  return (
    <>
      <section className={styles.intro}>
        <Link to="/" className={styles.back}>← Exhibitions</Link>

        {exhibition.cover_image && (
          <div className={styles.cover}>
            <img src={exhibition.cover_image} alt={exhibition.name} />
          </div>
        )}

        <div className={styles.overlay} />

        <div className={styles.content}>
          <h1 className={styles.name}>{exhibition.name}</h1>
          {exhibition.description && (
            <p className={styles.desc}>{exhibition.description}</p>
          )}
          <div className={styles.cta}>
            <div className={styles.ctaLine} />
            <span>scroll</span>
          </div>
        </div>
      </section>

      <Gallery artworks={exhibition.artworks ?? []} />

      {bgLines.length > 0 && (
        // Tall outer container — provides the scroll space that locks the section
        <div ref={bgContainerRef}>
          {/* Sticky inner — stays in viewport while outer is scrolled */}
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
                      ref={el => { if (el) bgCardRefs.current[idx] = el }}
                    >
                      <p className={styles.backgroundText}>{line}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {exhibition.clippings && exhibition.clippings.length > 0 && (
        // Same sticky pattern for clippings
        <div ref={clippingContainerRef}>
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
                      ref={el => { if (el) clippingCardRefs.current[entryIndex] = el }}
                      onClick={() => clippingEntry.screenshot_image && setSelectedClippingIndex(entryIndex)}
                      style={{ cursor: clippingEntry.screenshot_image ? 'pointer' : 'default' }}
                    >
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

      {selectedClippingIndex !== null && exhibition.clippings?.[selectedClippingIndex]?.screenshot_image && (
        <div className={styles.modal} onClick={() => setSelectedClippingIndex(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedClippingIndex(null)}>✕</button>
            <img
              src={exhibition.clippings[selectedClippingIndex].screenshot_image}
              alt={exhibition.clippings[selectedClippingIndex].title}
              className={styles.modalImage}
            />
          </div>
        </div>
      )}
    </>
  )
}
