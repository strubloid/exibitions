import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import styles from './CustomCursor.module.scss'

export default function CustomCursor() {
  const cursorRef   = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)
  const visible     = useRef(false)

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return

    const onMove = (e: MouseEvent) => {
      if (!visible.current) {
        gsap.set(cursor, { opacity: 1 })
        visible.current = true
      }
      gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0.08, ease: 'power2.out' })
    }

    const onLeave = () => {
      gsap.to(cursor, { opacity: 0, duration: 0.3 })
      visible.current = false
    }

    let scrollTimer: ReturnType<typeof setTimeout>
    const onScroll = () => {
      const vel   = Math.abs(window.scrollY - lastScrollY.current)
      lastScrollY.current = window.scrollY
      const scale = Math.min(1.6, 1 + vel * 0.018)
      gsap.to(cursor, { scale, duration: 0.25, ease: 'power2.out' })
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        gsap.to(cursor, { scale: 1, duration: 0.6, ease: 'power3.out' })
      }, 150)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('scroll', onScroll)
      clearTimeout(scrollTimer)
    }
  }, [])

  return <div ref={cursorRef} className={styles.cursor} aria-hidden="true" />
}
