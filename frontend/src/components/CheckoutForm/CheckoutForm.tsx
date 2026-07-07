import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../store'
import { setCheckoutInFlight } from '../../store/uiSlice'
import { selectBasketSubtotalCents } from '../../store/basketSlice'
import type { CheckoutSession } from '../../types/checkout'
import styles from './CheckoutForm.module.scss'

// Node 18+/modern browsers support Intl.supportedValuesOf('region'). TS's older
// lib typings type that parameter more narrowly than the spec, so we cast.
const COUNTRIES: string[] =
  typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
    ? (Intl.supportedValuesOf as (kind: string) => string[])('region')
    : ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BR', 'PT', 'JP']

interface FormState {
  email: string; name: string;
  line1: string; line2: string;
  city: string; postalCode: string; country: string; state: string;
}

const EMPTY: FormState = {
  email: '', name: '', line1: '', line2: '', city: '', postalCode: '', country: 'US', state: '',
}

export default function CheckoutForm() {
  const dispatch = useDispatch<AppDispatch>()
  const items = useSelector((s: RootState) => s.basket.items)
  const subtotal = useSelector(selectBasketSubtotalCents)
  const currency = items[0]?.currency ?? 'USD'
  const [form, setForm] = useState<FormState>(EMPTY)
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({} as Record<keyof FormState, boolean>)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (items.length === 0) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem', opacity: 0.7 }}>Your basket is empty.</p>
          <Link to="/" className={styles.cancel}>Return to gallery</Link>
        </div>
      </div>
    )
  }

  const validators: Partial<Record<keyof FormState, (v: string) => string | null>> = {
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email',
    name: v => v.trim().length >= 1 ? null : 'Required',
    line1: v => v.trim().length >= 1 ? null : 'Required',
    city: v => v.trim().length >= 1 ? null : 'Required',
    postalCode: v => v.trim().length >= 1 ? null : 'Required',
    country: v => v.length === 2 ? null : 'Required',
  }

  const errorFor = (field: keyof FormState): string | null =>
    touched[field] ? (validators[field]?.(form[field]) ?? null) : null

  const allValid = (['email', 'name', 'line1', 'city', 'postalCode', 'country'] as (keyof FormState)[]).every(f => !validators[f]?.(form[f]))

  const onChange = (field: keyof FormState, value: string) => setForm(prev => ({ ...prev, [field]: value }))
  const onBlur = (field: keyof FormState) => setTouched(prev => ({ ...prev, [field]: true }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!allValid || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    dispatch(setCheckoutInFlight(true))

    try {
      const res = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: items.map((i: { artworkId: number }) => ({ artwork_id: i.artworkId })),
          customer: {
            email: form.email,
            name: form.name,
            shipping: {
              line1: form.line1,
              line2: form.line2 || undefined,
              city: form.city,
              postal_code: form.postalCode,
              country: form.country.toUpperCase(),
              state: form.state || undefined,
            },
          },
          success_url: window.location.origin + '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
        }),
      })

      if (!res.ok) {
        let msg = 'Checkout failed. Please try again.'
        try { const j = await res.json(); if (j.message) msg = j.message; } catch { /* ignore */ }
        if (res.status === 409) msg = 'One or more artworks are no longer available. Please return and update your basket.'
        setSubmitError(msg)
        setSubmitting(false)
        dispatch(setCheckoutInFlight(false))
        return
      }

      const session = (await res.json()) as CheckoutSession
      // Redirect to Stripe hosted Checkout
      window.location.href = session.url
    } catch (err) {
      setSubmitError('Network error. Please try again.')
      setSubmitting(false)
      dispatch(setCheckoutInFlight(false))
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={submit}>
        <h1 className={styles.heading}>Checkout</h1>

        <div className={styles.fieldGroup}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={form.email}
            onChange={e => onChange('email', e.target.value)}
            onBlur={() => onBlur('email')}
            className={errorFor('email') ? styles.invalid : ''} />
          {errorFor('email') && <span className={styles.errorText}>{errorFor('email')}</span>}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="name">Full name</label>
          <input id="name" type="text" value={form.name}
            onChange={e => onChange('name', e.target.value)}
            onBlur={() => onBlur('name')}
            className={errorFor('name') ? styles.invalid : ''} />
          {errorFor('name') && <span className={styles.errorText}>{errorFor('name')}</span>}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="line1">Address line 1</label>
          <input id="line1" value={form.line1}
            onChange={e => onChange('line1', e.target.value)}
            onBlur={() => onBlur('line1')}
            className={errorFor('line1') ? styles.invalid : ''} />
          {errorFor('line1') && <span className={styles.errorText}>{errorFor('line1')}</span>}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="line2">Address line 2 (optional)</label>
          <input id="line2" value={form.line2}
            onChange={e => onChange('line2', e.target.value)} />
        </div>

        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label htmlFor="city">City</label>
            <input id="city" value={form.city}
              onChange={e => onChange('city', e.target.value)}
              onBlur={() => onBlur('city')}
              className={errorFor('city') ? styles.invalid : ''} />
            {errorFor('city') && <span className={styles.errorText}>{errorFor('city')}</span>}
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="postal">Postal code</label>
            <input id="postal" value={form.postalCode}
              onChange={e => onChange('postalCode', e.target.value)}
              onBlur={() => onBlur('postalCode')}
              className={errorFor('postalCode') ? styles.invalid : ''} />
            {errorFor('postalCode') && <span className={styles.errorText}>{errorFor('postalCode')}</span>}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label htmlFor="country">Country</label>
            <select id="country" value={form.country}
              onChange={e => onChange('country', e.target.value)}
              onBlur={() => onBlur('country')}>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="state">State / Region (optional)</label>
            <input id="state" value={form.state}
              onChange={e => onChange('state', e.target.value)} />
          </div>
        </div>

        <table className={styles.summary}>
          <tbody>
            <tr><th>Subtotal</th><td>{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(subtotal / 100)}</td></tr>
            <tr><th>Shipping</th><td>—</td></tr>
            <tr><th>Total</th><td>{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(subtotal / 100)}</td></tr>
          </tbody>
        </table>

        {submitError && <div className={styles.errorBanner}>{submitError}</div>}

        <button className={styles.payButton} type="submit" disabled={!allValid || submitting}>
          {submitting ? 'Redirecting…' : 'Pay securely'}
        </button>

        <Link to="/" className={styles.cancel}>Cancel and return to gallery</Link>
      </form>
    </div>
  )
}