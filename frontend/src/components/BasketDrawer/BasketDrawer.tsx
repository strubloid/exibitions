import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../store'
import { closeBasketDrawer } from '../../store/uiSlice'
import { removeItem, selectBasketCount, selectBasketSubtotalCents } from '../../store/basketSlice'
import styles from './BasketDrawer.module.scss'

export default function BasketDrawer() {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const open = useSelector((s: RootState) => s.ui.basketDrawerOpen)
  const items = useSelector((s: RootState) => s.basket.items)
  const subtotalCents = useSelector(selectBasketSubtotalCents)
  const count = useSelector(selectBasketCount)
  const currency = items[0]?.currency ?? 'USD'
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(closeBasketDrawer())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dispatch])

  // Focus trap (basic): focus the drawer when it opens
  useEffect(() => {
    if (open && drawerRef.current) {
      drawerRef.current.focus()
    }
  }, [open])

  if (!open) return null

  const subtotalFormatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(subtotalCents / 100)

  const handleCheckout = () => {
    dispatch(closeBasketDrawer())
    navigate('/checkout')
  }

  return (
    <>
      <div className={styles.backdrop} onClick={() => dispatch(closeBasketDrawer())} />
      <aside
        ref={drawerRef}
        tabIndex={-1}
        className={`${styles.drawer} ${styles.open}`}
        role="dialog"
        aria-label="Basket"
      >
        <div className={styles.head}>
          <span className={styles.title}>Basket ({count})</span>
          <button className={styles.closeButton} onClick={() => dispatch(closeBasketDrawer())} aria-label="Close basket">×</button>
        </div>

        <div className={styles.items}>
          {items.length === 0 ? (
            <p className={styles.empty}>Your basket is empty.</p>
          ) : (
            items.map(item => (
              <div key={item.artworkId} className={styles.item}>
                {item.image && (
                  <img src={item.image} alt={item.title} className={styles.thumb} />
                )}
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemPrice}>
                    {new Intl.NumberFormat(undefined, { style: 'currency', currency: item.currency }).format(item.priceCents / 100)}
                  </span>
                </div>
                <button
                  className={styles.removeButton}
                  onClick={() => dispatch(removeItem(item.artworkId))}
                  aria-label={`Remove ${item.title} from basket`}
                >×</button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className={styles.foot}>
            <div className={styles.subtotalRow}>
              <span className={styles.subtotalLabel}>Subtotal</span>
              <span className={styles.subtotalValue}>{subtotalFormatted}</span>
            </div>
            <button className={styles.checkoutButton} onClick={handleCheckout}>Checkout</button>
            <button
              className={styles.continueLink}
              onClick={() => dispatch(closeBasketDrawer())}
              style={{ background: 'transparent', border: 'none', width: '100%', cursor: 'pointer' }}
            >Continue browsing</button>
          </div>
        )}
      </aside>
    </>
  )
}