import { useEffect, useRef, useState } from 'react'
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
  const clippingGridRefs = useRef<HTMLDivElement[]>([])
  const [dominantColors, setDominantColors] = useState<Record<number, string>>({})
  const [selectedClipping, setSelectedClipping] = useState<{ exhibitionId: number; clippingIndex: number } | null>(null)

  useEffect(() => {
    dispatch(fetchExhibitions())
  }, [dispatch])

  useEffect(() => {
    items.forEach((exhibition) => {
      if (exhibition.cover_image && !dominantColors[exhibition.id]) {
        extractDominantColor(exhibition.cover_image).then(color => {
          setDominantColors(prev => ({ ...prev, [exhibition.id]: color }))
        })
      }
    })
  }, [items, dominantColors])

  useEffect(() => {
    if (!items.length) return

    const ctx = gsap.context(() => {
      items.forEach((_, i) => {
        const section = sectionRefs.current[i]
        const image   = imageRefs.current[i]
        const overlay = overlayRefs.current[i]
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
      })

      // Clippings animation: Cards slide in + light up as they scroll into view
      // Each card animates with staggered delay based on its position
      items.forEach((_, i) => {
        const clippingGrid = clippingGridRefs.current[i]
        if (!clippingGrid) return

        const cards = clippingGrid.querySelectorAll('[data-clipping-card]')
        if (!cards.length) return

        // Each card animates individually with staggered viewport positioning
        cards.forEach((card, cardIndex) => {
          const cardCount = cards.length
          // Stagger each card's trigger point: earlier cards trigger higher up in viewport
          const delayPercent = (cardIndex / Math.max(1, cardCount - 1)) * 40  // 0% to 40% stagger
          const startViewportPercent = 75 - delayPercent
          const endViewportPercent = 25 - delayPercent

          gsap.fromTo(card,
            { xPercent: -100, filter: 'brightness(0.4)' },
            {
              xPercent: 0,
              filter: 'brightness(1)',
              ease: 'none',
              scrollTrigger: {
                trigger: card,
                start: `top ${startViewportPercent}%`,
                end: `top ${endViewportPercent}%`,
                scrub: 1,
              },
            }
          )
        })
      })
    })

    return () => ctx.revert()
  }, [items])

  // No exhibitions yet — show the global artworks gallery
  if (!loading && items.length === 0) {
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
      {items.map((exhibition, i) => {
        const dominantColor = dominantColors[exhibition.id] || 'rgb(80, 80, 80)'
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
                    {String(i + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
                  </span>

                  <div className={styles.overlayBottom}>
                    <div className={styles.overlayLeft}>
                      <h2 data-anim="" className={styles.name}>{exhibition.name}</h2>
                      {exhibition.description && (
                        <p data-anim="" className={styles.description}>{shortDesc(exhibition.description)}</p>
                      )}
                    </div>
                    <span data-anim="" className={styles.cta}>Enter</span>
                  </div>
                </div>
              </Link>
            </section>

            {/* ─── Background section ────────────────────────────────────────────────────────────────── */}
            {exhibition.background && (
              <section className={styles.backgroundSection} style={{ backgroundColor: dominantColor }}>
                <h2 className={styles.backgroundTitle}>{exhibition.name}</h2>
                <div className={styles.backgroundLabel}>Background</div>
                <div className={styles.backgroundContent}>
                  <div className={styles.backgroundMasonryGrid}>
                    {exhibition.background.split('\n').filter(line => line.trim()).map((line, idx) => (
                      <div key={idx} className={styles.backgroundMasonryItem}>
                        <p className={styles.backgroundText}>{line}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ─── Press/Clippings section ──────────────────────────────────────────────────────────────── */}
            {exhibition.clippings && exhibition.clippings.length > 0 && (
              <section className={styles.clippingsSection} style={{ backgroundColor: dominantColor }}>
                <h2 className={styles.clippingsTitle}>Check it out where I was!</h2>
                <div className={styles.clippingsLabel}>Press</div>
                <div className={styles.clippingsContent}>
                  <div
                    className={styles.clippingsGrid}
                    ref={el => { if (el) clippingGridRefs.current[i] = el }}
                  >
                    {exhibition.clippings.map((clippingEntry, entryIndex) => (
                      <div
                        key={entryIndex}
                        className={styles.clippingCard}
                        data-clipping-card=""
                        onClick={() => clippingEntry.screenshot_image && setSelectedClipping({ exhibitionId: exhibition.id, clippingIndex: entryIndex })}
                        style={{ cursor: clippingEntry.screenshot_image ? 'pointer' : 'default', filter: 'brightness(0.4)' }}
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
    </div>
  )
}
