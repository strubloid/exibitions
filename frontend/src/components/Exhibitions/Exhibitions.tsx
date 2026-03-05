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
  const [dominantColors, setDominantColors] = useState<Record<number, string>>({})

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
                <div className={styles.backgroundCard}>
                  <p className={styles.backgroundText}>{exhibition.background}</p>
                </div>
              </section>
            )}

            {/* ─── Press/Clippings section ──────────────────────────────────────────────────────────────── */}
            {exhibition.clippings && exhibition.clippings.length > 0 && (
              <section className={styles.clippingsSection} style={{ backgroundColor: dominantColor }}>
                <h2 className={styles.clippingsSectionHeading}>Press</h2>
                <div className={styles.clippingsGrid}>
                  {exhibition.clippings.map((clippingEntry, entryIndex) => (
                    <div key={entryIndex} className={styles.clippingCard}>
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
              </section>
            )}
          </div>
        )
      })}
    </div>
  )
}
