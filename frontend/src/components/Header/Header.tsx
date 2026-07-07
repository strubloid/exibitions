import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch } from '../../store'
import { openBasketDrawer } from '../../store/uiSlice'
import { selectBasketCount } from '../../store/basketSlice'
import styles from './Header.module.scss'

export default function Header() {
  const dispatch = useDispatch<AppDispatch>()
  const basketCount = useSelector(selectBasketCount)
  const [visible, setVisible] = useState(true)
  const lastScrollY = useRef(0)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastScrollY.current
        if (Math.abs(delta) > 10) {
          setVisible(delta < 0 || y < 80)
          lastScrollY.current = y
        }
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`${styles.header} ${visible ? '' : styles.hidden}`}>
      <Link to="/" className={styles.brand}>Exibitions</Link>
      <div className={styles.right}>
        <button
          type="button"
          className={styles.basketButton}
          onClick={() => dispatch(openBasketDrawer())}
          aria-label={`Open basket, ${basketCount} item${basketCount === 1 ? '' : 's'}`}
        >
          Basket
          {basketCount > 0 && <span className={styles.badge}>{basketCount}</span>}
        </button>
      </div>
    </header>
  )
}