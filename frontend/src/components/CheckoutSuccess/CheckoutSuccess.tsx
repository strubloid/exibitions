import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import type { AppDispatch } from '../../store'
import { clear } from '../../store/basketSlice'
import type { OrderSummary } from '../../types/checkout'
import styles from './CheckoutSuccess.module.scss'

type Phase = 'loading' | 'paid' | 'pending' | 'cancelled'

const MAX_POLLS = 10
const POLL_INTERVAL_MS = 1500

export default function CheckoutSuccess() {
  const dispatch = useDispatch<AppDispatch>()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id') ?? ''
  const [phase, setPhase] = useState<Phase>('loading')
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setPhase('cancelled')
      return
    }

    let polls = 0
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`)
        if (!res.ok) {
          setPhase('pending')
        } else {
          const data = (await res.json()) as OrderSummary
          setOrderNumber(data.order_number)
          if (data.status === 'paid' || data.status === 'fulfilled') {
            setPhase('paid')
            // Clear the basket ONLY after backend confirms paid.
            dispatch(clear())
            return
          }
          if (data.status === 'cancelled' || data.status === 'refunded') {
            setPhase('cancelled')
            return
          }
          setPhase('pending')
        }
      } catch {
        setPhase('pending')
      }

      polls++
      if (polls < MAX_POLLS && !cancelled) {
        window.setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [sessionId, dispatch])

  return (
    <div className={styles.page}>
      <div className={styles.box}>
        {phase === 'loading' && (
          <>
            <div className={styles.spinner} />
            <p className={styles.title}>Confirming your purchase…</p>
          </>
        )}

        {phase === 'pending' && (
          <>
            <div className={styles.spinner} />
            <p className={styles.title}>Your payment is being processed.</p>
            <p className={styles.pending}>You will receive a confirmation email shortly.</p>
            {orderNumber && <p className={styles.order}>Order {orderNumber}</p>}
          </>
        )}

        {phase === 'paid' && (
          <>
            <div className={styles.emoji}>✓</div>
            <h1 className={styles.title}>Thank you. Your order is confirmed.</h1>
            {orderNumber && <p className={styles.order}>Order {orderNumber}</p>}
          </>
        )}

        {phase === 'cancelled' && (
          <>
            <p className={styles.title}>Your checkout was cancelled.</p>
            <p className={styles.pending}>Your basket has been preserved.</p>
          </>
        )}

        <Link to="/" className={styles.backLink}>Return to gallery</Link>
      </div>
    </div>
  )
}