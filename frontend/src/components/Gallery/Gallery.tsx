import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { AppDispatch, RootState } from '../../store'
import { fetchArtworks, type Artwork } from '../../store/artworksSlice'
import styles from './Gallery.module.scss'

interface GalleryProps {
  artworks?: Artwork[]
}

gsap.registerPlugin(ScrollTrigger)

/**
 * Returns the transition style for the artwork at index i.
 * Pattern: 4 vertical → 4 horizontal → 4 vertical → repeat
 */
function transitionType(i: number): 'vertical' | 'horizontal' {
  return Math.floor(i / 4) % 2 === 0 ? 'vertical' : 'horizontal'
}

// Clip-path states
const CLIP_FULL   = 'inset(0% 0% 0% 0%)'
const CLIP_NONE_V = 'inset(50% 0% 50% 0%)'   // iris fully closed — vertical (top+bottom)
const CLIP_NONE_H = 'inset(0% 50% 0% 50%)'   // iris fully closed — horizontal (left+right)

// Scroll architecture
const SCROLL_PER_IMAGE_VH = 250   // 250vh of scroll per artwork
const TRANSITION_VH       = 100   // 100vh transition overlap window

export default function Gallery({ artworks: propArtworks }: GalleryProps = {}) {
  const dispatch = useDispatch<AppDispatch>()
  const { items: reduxItems, loading: reduxLoading } = useSelector((state: RootState) => state.artworks)
  const items   = propArtworks ?? reduxItems
  const loading = propArtworks !== undefined ? false : reduxLoading

  const containerRef = useRef<HTMLDivElement>(null)
  const layerRefs    = useRef<HTMLDivElement[]>([])
  const innerRefs    = useRef<HTMLDivElement[]>([])
  const infoRefs     = useRef<HTMLDivElement[]>([])
  const colorFogRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (propArtworks === undefined) dispatch(fetchArtworks())
  }, [dispatch, propArtworks])

  // ── iOS momentum scroll fix — run once on mount ──────────────────────────────
  useEffect(() => {
    if ('ontouchstart' in window) {
      ScrollTrigger.normalizeScroll(true)
    }
  }, [])

  // ── GSAP scroll animations ───────────────────────────────────────────────────
  useEffect(() => {
    if (!items.length || !containerRef.current) return

    const VH     = window.innerHeight
    const SCROLL = (SCROLL_PER_IMAGE_VH / 100) * VH
    const TRANS  = (TRANSITION_VH / 100) * VH

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const ctx = gsap.context(() => {
      ScrollTrigger.getAll().forEach(t => t.kill())

      items.forEach((_, i) => {
        const layer = layerRefs.current[i]
        const inner = innerRefs.current[i]
        const info  = infoRefs.current[i]
        if (!layer || !inner || !info) return

        if (prefersReduced) {
          // ── REDUCED MOTION: simple opacity cross-fades ───────────────────────
          gsap.set(layer, { opacity: i === 0 ? 1 : 0, zIndex: i })
          gsap.set(info,  { opacity: i === 0 ? 1 : 0, y: 0 })

          if (i > 0) {
            const enterStart = i * SCROLL - TRANS
            const enterEnd   = i * SCROLL
            gsap.timeline({
              scrollTrigger: {
                trigger:     containerRef.current,
                start:       `${enterStart}px top`,
                end:         `${enterEnd}px top`,
                scrub:       1,
                onEnter:     () => gsap.set(layer, { zIndex: 20 }),
                onLeaveBack: () => gsap.set(layer, { zIndex: i }),
              },
            })
              .fromTo(layer, { opacity: 0 }, { opacity: 1, ease: 'none' })
              .fromTo(info,  { opacity: 0 }, { opacity: 1, ease: 'none' }, '>-0.3')
          }

          if (i < items.length - 1) {
            const exitStart = (i + 1) * SCROLL - TRANS
            const exitEnd   = (i + 1) * SCROLL
            gsap.timeline({
              scrollTrigger: {
                trigger: containerRef.current,
                start:   `${exitStart}px top`,
                end:     `${exitEnd}px top`,
                scrub:   1,
              },
            })
              .fromTo(layer, { opacity: 1 }, { opacity: 0, ease: 'none' })
              .fromTo(info,  { opacity: 1 }, { opacity: 0, ease: 'none' }, '<')
          }
        } else {
          // ── FULL MOTION: iris clip-path transitions ──────────────────────────
          const tType   = transitionType(i)
          const noneIn  = tType === 'vertical' ? CLIP_NONE_V : CLIP_NONE_H
          const noneOut = tType === 'vertical' ? CLIP_NONE_V : CLIP_NONE_H

          // ── Initial state ────────────────────────────────────────────────────
          gsap.set(inner, { transformPerspective: 1200 })

          if (i === 0) {
            gsap.set(layer, { clipPath: CLIP_FULL, zIndex: 10 })
            gsap.set(inner, { scale: 1, rotateX: 0, rotateY: 0, filter: 'blur(0px)' })
            gsap.set(info,  { opacity: 1, y: 0 })
          } else {
            gsap.set(layer, { clipPath: noneIn, zIndex: i })
            gsap.set(info,  { opacity: 0, y: 24 })
          }

          // ── ENTER ────────────────────────────────────────────────────────────
          if (i > 0) {
            const enterStart = i * SCROLL - TRANS
            const enterEnd   = i * SCROLL

            gsap.timeline({
              scrollTrigger: {
                trigger:     containerRef.current,
                start:       `${enterStart}px top`,
                end:         `${enterEnd}px top`,
                scrub:       1.5,
                onEnter:     () => gsap.set(layer, { zIndex: 20 }),
                onLeaveBack: () => gsap.set(layer, { zIndex: i }),
              },
            })
              .fromTo(layer,
                { clipPath: noneIn },
                { clipPath: CLIP_FULL, ease: 'none' }
              )
              .fromTo(inner,
                {
                  scale:   1.07,
                  filter:  'blur(5px)',
                  rotateX: tType === 'vertical'   ? -6 : 0,
                  rotateY: tType === 'horizontal' ? -6 : 0,
                },
                {
                  scale:   1,
                  filter:  'blur(0px)',
                  rotateX: 0,
                  rotateY: 0,
                  ease:    'none',
                },
                '<'
              )
              .fromTo(info,
                { opacity: 0, y: 24 },
                { opacity: 1, y: 0,  ease: 'none' },
                '>-0.3'
              )
          }

          // ── EXIT ─────────────────────────────────────────────────────────────
          if (i < items.length - 1) {
            const exitStart = (i + 1) * SCROLL - TRANS
            const exitEnd   = (i + 1) * SCROLL

            gsap.timeline({
              scrollTrigger: {
                trigger: containerRef.current,
                start:   `${exitStart}px top`,
                end:     `${exitEnd}px top`,
                scrub:   1.5,
              },
            })
              .fromTo(layer,
                { clipPath: CLIP_FULL },
                { clipPath: noneOut,  ease: 'none' }
              )
              .fromTo(inner,
                {
                  scale:   1,
                  filter:  'blur(0px)',
                  rotateX: 0,
                  rotateY: 0,
                },
                {
                  scale:   0.96,
                  filter:  'blur(3px)',
                  rotateX: tType === 'vertical'   ? 5 : 0,
                  rotateY: tType === 'horizontal' ? 5 : 0,
                  ease:    'none',
                },
                '<'
              )
              .fromTo(info,
                { opacity: 1, y: 0   },
                { opacity: 0, y: -16, ease: 'none' },
                '<'
              )
          }

          // ── PARALLAX HOLD ────────────────────────────────────────────────────
          const holdStart = i * SCROLL
          const holdEnd   = (i + 1) * SCROLL - TRANS
          if (holdEnd > holdStart) {
            gsap.timeline({
              scrollTrigger: {
                trigger: containerRef.current,
                start:   `${holdStart}px top`,
                end:     `${holdEnd}px top`,
                scrub:   3,
              },
            })
              .fromTo(inner,
                { yPercent:  1.5 },
                { yPercent: -1.5, ease: 'none' }
              )
          }
        }

        // ── COLOR FOG (both motion modes) ─────────────────────────────────────
        const fogColor = items[i].metadata?.palette?.[0]
        if (fogColor && colorFogRef.current) {
          if (i === 0) gsap.set(colorFogRef.current, { backgroundColor: fogColor })
          ScrollTrigger.create({
            trigger: containerRef.current,
            start:   `${i * SCROLL}px top`,
            end:     `${(i + 1) * SCROLL}px top`,
            onEnter:     () => gsap.to(colorFogRef.current, { backgroundColor: fogColor, duration: 1.4, ease: 'power2.out' }),
            onEnterBack: () => gsap.to(colorFogRef.current, { backgroundColor: fogColor, duration: 1.4, ease: 'power2.out' }),
          })
        }
      })
    }, containerRef)

    return () => ctx.revert()
  }, [items])

  // ── TOUCH SWIPE — snap to next/prev artwork ──────────────────────────────────
  useEffect(() => {
    if (!items.length) return

    let touchStartX    = 0
    let touchStartY    = 0
    let touchStartTime = 0

    const onTouchStart = (e: TouchEvent) => {
      touchStartX    = e.touches[0].clientX
      touchStartY    = e.touches[0].clientY
      touchStartTime = Date.now()
    }

    const onTouchEnd = (e: TouchEvent) => {
      const dx      = e.changedTouches[0].clientX - touchStartX
      const dy      = e.changedTouches[0].clientY - touchStartY
      const absDx   = Math.abs(dx)
      const absDy   = Math.abs(dy)
      const elapsed = Date.now() - touchStartTime

      // Only snap on quick, intentional swipes (< 500ms, ≥ 80px)
      if (Math.max(absDx, absDy) < 80 || elapsed > 500) return

      const VH           = window.innerHeight
      const SCROLL       = (SCROLL_PER_IMAGE_VH / 100) * VH
      const currentIndex = Math.round(window.scrollY / SCROLL)

      // Vertical swipe: up → next, down → prev
      // Horizontal swipe: left → next, right → prev
      let nextIndex: number
      if (absDy >= absDx) {
        nextIndex = dy < 0 ? currentIndex + 1 : currentIndex - 1
      } else {
        nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1
      }

      nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex))
      window.scrollTo({ top: nextIndex * SCROLL, behavior: 'smooth' })
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [items.length])

  const totalVh = items.length * SCROLL_PER_IMAGE_VH
  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window)

  if (loading && !items.length) {
    return (
      <div className={styles.loading}>
        <span>Loading</span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ height: `${totalVh}vh` }}
    >
      <div className={styles.sticky}>
        <div ref={colorFogRef} className={styles.colorFog} />
        {items.map((artwork, i) => (
          <div
            key={artwork.id}
            ref={el => { if (el) layerRefs.current[i] = el }}
            className={styles.layer}
          >
            <div
              ref={el => { if (el) innerRefs.current[i] = el }}
              className={styles.inner}
            >
              {artwork.image ? (
                <img
                  src={artwork.image}
                  alt={artwork.title}
                  className={styles.image}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  draggable={false}
                />
              ) : (
                <div className={styles.placeholder}>
                  <span>{artwork.title[0]}</span>
                </div>
              )}
            </div>

            <div
              ref={el => { if (el) infoRefs.current[i] = el }}
              className={styles.info}
            >
              <span className={styles.index}>
                {String(i + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
              </span>
              <h2 className={styles.title}>{artwork.title}</h2>
              {artwork.description && (
                <p className={styles.description}>{artwork.description}</p>
              )}
            </div>
          </div>
        ))}

        <div className={styles.scrollHint} aria-hidden="true">
          <span>{isTouch ? 'swipe' : 'scroll'}</span>
          <div className={styles.scrollLine} />
        </div>
      </div>
    </div>
  )
}
