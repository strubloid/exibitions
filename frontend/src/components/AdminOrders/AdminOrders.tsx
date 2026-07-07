import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'
import styles from './AdminOrders.module.scss'

interface OrderItem {
  id: number
  artwork_id: number
  title_snapshot: string
  image_snapshot: string | null
  unit_price_cents: number
  currency: string
}

interface Order {
  id: number
  order_number: string
  status: string
  currency: string
  subtotal_cents: number
  total_cents: number
  customer_email: string
  customer_name: string
  shipping_address: { line1: string; city: string; country: string; postal_code: string; state?: string }
  paid_at: string | null
  created_at: string
  items: OrderItem[]
}

interface Paginated {
  data: Order[]
  current_page: number
  last_page: number
}

const STATUS_CLASS: Record<string, string> = {
  pending: styles.badgePending,
  paid: styles.badgePaid,
  fulfilled: styles.badgeFulfilled,
  cancelled: styles.badgeCancelled,
  refunded: styles.badgeRefunded,
}

export default function AdminOrders() {
  const token = useSelector((s: RootState) => s.auth.token)
  const [orders, setOrders] = useState<Order[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async (p: number, status: string) => {
    setLoading(true); setError(null)
    try {
      const url = new URL('/api/orders', window.location.origin)
      url.searchParams.set('page', String(p))
      if (status) url.searchParams.set('status', status)
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to fetch orders')
      const json = (await res.json()) as Paginated
      setOrders(json.data); setPage(json.current_page); setLastPage(json.last_page)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchOrders(1, statusFilter) }, [fetchOrders, statusFilter])

  const openOrder = async (o: Order) => {
    try {
      const res = await fetch(`/api/orders/${o.id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to fetch order')
      setSelected(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  return (
    <div className={styles.wrap}>
      <Link to="/admin" className={styles.backLink}>← Back to admin</Link>
      <h1 className={styles.heading}>Orders</h1>

      <div className={styles.toolbar}>
        <label>
          <span style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginRight: '0.5rem' }}>Status</span>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); }}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Order #</th>
            <th className={styles.th}>Date</th>
            <th className={styles.th}>Customer</th>
            <th className={styles.th}>Items</th>
            <th className={styles.th}>Total</th>
            <th className={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} onClick={() => openOrder(o)} style={{ cursor: 'pointer' }}>
              <td className={styles.td}>{o.order_number}</td>
              <td className={styles.td}>{new Date(o.created_at).toLocaleDateString()}</td>
              <td className={styles.td}>{o.customer_email}</td>
              <td className={styles.td}>{o.items.length}</td>
              <td className={styles.td}>{new Intl.NumberFormat(undefined, { style: 'currency', currency: o.currency }).format(o.total_cents / 100)}</td>
              <td className={styles.td}>
                <span className={`${styles.badge} ${STATUS_CLASS[o.status] ?? ''}`}>{o.status}</span>
              </td>
            </tr>
          ))}
          {!loading && orders.length === 0 && (
            <tr><td colSpan={6} className={styles.td} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No orders.</td></tr>
          )}
        </tbody>
      </table>

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => fetchOrders(page - 1, statusFilter)}>← Prev</button>
        <span style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Page {page} / {lastPage}</span>
        <button disabled={page >= lastPage} onClick={() => fetchOrders(page + 1, statusFilter)}>Next →</button>
      </div>

      {selected && (
        <div className={styles.detail}>
          <h2 style={{ fontSize: '0.8rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem' }}>Order {selected.order_number}</h2>
          <div className={styles.detailRow}><th>Status</th><td>{selected.status}</td></div>
          <div className={styles.detailRow}><th>Customer</th><td>{selected.customer_name} &lt;{selected.customer_email}&gt;</td></div>
          <div className={styles.detailRow}><th>Shipping</th><td>{selected.shipping_address.line1}, {selected.shipping_address.city}, {selected.shipping_address.country} {selected.shipping_address.postal_code}</td></div>
          <div className={styles.detailRow}><th>Paid at</th><td>{selected.paid_at ? new Date(selected.paid_at).toLocaleString() : '—'}</td></div>
          <h3 style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Items</h3>
          {selected.items.map(it => (
            <div className={styles.detailRow} key={it.id}>
              <th>{it.title_snapshot}</th>
              <td>{new Intl.NumberFormat(undefined, { style: 'currency', currency: it.currency }).format(it.unit_price_cents / 100)}</td>
            </div>
          ))}
          <div className={styles.detailRow}><th>Total</th><td>{new Intl.NumberFormat(undefined, { style: 'currency', currency: selected.currency }).format(selected.total_cents / 100)}</td></div>
          <button onClick={() => setSelected(null)} style={{ marginTop: '1rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
        </div>
      )}
    </div>
  )
}