import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import type { RootState, AppDispatch } from '../../store'
import { logout } from '../../store/authSlice'
import type { Exhibition } from '../../store/exhibitionsSlice'
import styles from './AdminPanel.module.scss'

const shortDesc = (text: string) => {
  const line = text.split('\n').find(l => l.trim()) ?? ''
  return line.length > 72 ? line.slice(0, 72) + '…' : line
}

interface Artwork {
  id: number
  title: string
  description: string | null
  image: string | null
  sort_order: number
  animation_style: string
  pivot?: { sort_order: number }
}

const EMPTY_ARTWORK_FORM    = { title: '', description: '', sort_order: 0, animation_style: 'fade' }
const EMPTY_EXHIBITION_FORM = { name: '', description: '', slug: '', sort_order: 0 }

export default function AdminPanel() {
  const token    = useSelector((state: RootState) => state.auth.token)
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()

  const [tab, setTab] = useState<'artworks' | 'exhibitions'>('artworks')

  // ── Artworks ───────────────────────────────────────────────────────────────
  const [artworks, setArtworks]   = useState<Artwork[]>([])
  const [editing, setEditing]     = useState<Artwork | null>(null)
  const [form, setForm]           = useState(EMPTY_ARTWORK_FORM)
  const [uploading, setUploading] = useState<number | null>(null)
  const [saving, setSaving]       = useState(false)

  // ── Exhibitions ────────────────────────────────────────────────────────────
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [editingEx, setEditingEx]     = useState<Exhibition | null>(null)
  const [exForm, setExForm]           = useState(EMPTY_EXHIBITION_FORM)
  const [savingEx, setSavingEx]       = useState(false)
  const [uploadingEx, setUploadingEx] = useState<number | null>(null)
  const [managingEx, setManagingEx]   = useState<number | null>(null)
  const [assignments, setAssignments] = useState<Record<number, { checked: boolean; order: number }>>({})
  const [savingAssign, setSavingAssign] = useState(false)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  // ── Artworks CRUD ──────────────────────────────────────────────────────────
  const fetchArtworks = useCallback(async () => {
    const res = await fetch('/api/artworks')
    setArtworks(await res.json())
  }, [])

  useEffect(() => { fetchArtworks() }, [fetchArtworks])

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST', headers: authHeaders })
    dispatch(logout())
    navigate('/')
  }

  const handleEdit = (artwork: Artwork) => {
    setEditing(artwork)
    setForm({ title: artwork.title, description: artwork.description ?? '', sort_order: artwork.sort_order, animation_style: artwork.animation_style })
  }

  const handleCancel = () => { setEditing(null); setForm(EMPTY_ARTWORK_FORM) }

  const handleSave = async () => {
    setSaving(true)
    if (editing) {
      await fetch(`/api/artworks/${editing.id}`, { method: 'PUT', headers: authHeaders, body: JSON.stringify(form) })
    } else {
      await fetch('/api/artworks', { method: 'POST', headers: authHeaders, body: JSON.stringify(form) })
    }
    setSaving(false); handleCancel(); fetchArtworks()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this artwork?')) return
    await fetch(`/api/artworks/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    fetchArtworks()
  }

  const handleImageUpload = async (artwork: Artwork, file: File) => {
    setUploading(artwork.id)
    const fd = new FormData(); fd.append('image', file)
    await fetch(`/api/artworks/${artwork.id}/image`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, body: fd })
    setUploading(null); fetchArtworks()
  }

  // ── Exhibitions CRUD ───────────────────────────────────────────────────────
  const fetchExhibitions = useCallback(async () => {
    const res = await fetch('/api/exhibitions')
    setExhibitions(await res.json())
  }, [])

  useEffect(() => { if (tab === 'exhibitions') fetchExhibitions() }, [tab, fetchExhibitions])

  const handleEditEx = (ex: Exhibition) => {
    setEditingEx(ex)
    setExForm({ name: ex.name, description: ex.description ?? '', slug: ex.slug, sort_order: ex.sort_order })
  }

  const handleCancelEx = () => { setEditingEx(null); setExForm(EMPTY_EXHIBITION_FORM) }

  const handleSaveEx = async () => {
    setSavingEx(true)
    if (editingEx) {
      await fetch(`/api/exhibitions/${editingEx.id}`, { method: 'PUT', headers: authHeaders, body: JSON.stringify(exForm) })
    } else {
      await fetch('/api/exhibitions', { method: 'POST', headers: authHeaders, body: JSON.stringify(exForm) })
    }
    setSavingEx(false); handleCancelEx(); fetchExhibitions()
  }

  const handleDeleteEx = async (id: number) => {
    if (!confirm('Delete this exhibition?')) return
    await fetch(`/api/exhibitions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    fetchExhibitions()
  }

  const handleExCoverUpload = async (ex: Exhibition, file: File) => {
    setUploadingEx(ex.id)
    const fd = new FormData(); fd.append('image', file)
    await fetch(`/api/exhibitions/${ex.id}/image`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, body: fd })
    setUploadingEx(null); fetchExhibitions()
  }

  const handleManage = async (ex: Exhibition) => {
    if (managingEx === ex.id) { setManagingEx(null); return }
    const res  = await fetch(`/api/exhibitions/${ex.slug}`)
    const data = await res.json()
    const assignedMap: Record<number, number> = {}
    ;(data.artworks ?? []).forEach((a: Artwork, idx: number) => {
      assignedMap[a.id] = a.pivot?.sort_order ?? idx
    })
    const init: Record<number, { checked: boolean; order: number }> = {}
    artworks.forEach((a, idx) => {
      init[a.id] = { checked: a.id in assignedMap, order: assignedMap[a.id] ?? idx }
    })
    setAssignments(init)
    setManagingEx(ex.id)
  }

  const handleSaveAssign = async (exId: number) => {
    setSavingAssign(true)
    const payload = Object.entries(assignments)
      .filter(([, v]) => v.checked)
      .map(([id, v]) => ({ id: Number(id), sort_order: v.order }))
    await fetch(`/api/exhibitions/${exId}/artworks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ artworks: payload }) })
    setSavingAssign(false); setManagingEx(null); fetchExhibitions()
  }

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h1>Exibitions Admin</h1>
        <div className={styles.headerActions}>
          <a href="/" className={styles.viewSite}>View Site</a>
          <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <div className={styles.tabs}>
        <button className={tab === 'artworks'    ? styles.tabActive : styles.tab} onClick={() => setTab('artworks')}>Artworks</button>
        <button className={tab === 'exhibitions' ? styles.tabActive : styles.tab} onClick={() => setTab('exhibitions')}>Exhibitions</button>
      </div>

      {/* ── Artworks ─────────────────────────────────────────────────────── */}
      {tab === 'artworks' && (
        <div className={styles.content}>
          <section className={styles.formSection}>
            <h2>{editing ? 'Edit Artwork' : 'New Artwork'}</h2>
            <div className={styles.field}><label>Title</label>
              <input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className={styles.field}><label>Description</label>
              <textarea placeholder="Description" value={form.description} rows={3} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className={styles.row}>
              <div className={styles.field}><label>Sort Order</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: +e.target.value }))} />
              </div>
              <div className={styles.field}><label>Animation</label>
                <select value={form.animation_style} onChange={(e) => setForm((f) => ({ ...f, animation_style: e.target.value }))}>
                  <option value="fade">Fade</option>
                  <option value="mask-reveal">Mask Reveal</option>
                  <option value="parallax">Parallax</option>
                </select>
              </div>
            </div>
            <div className={styles.formActions}>
              <button onClick={handleSave} disabled={saving} className={styles.saveBtn}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
              {editing && <button onClick={handleCancel} className={styles.cancelBtn}>Cancel</button>}
            </div>
          </section>

          <section className={styles.listSection}>
            <h2>Artworks ({artworks.length})</h2>
            {artworks.map((artwork) => (
              <div key={artwork.id} className={styles.item}>
                <div className={styles.thumb}>
                  {artwork.image ? <img src={artwork.image} alt={artwork.title} /> : <span>No image</span>}
                </div>
                <div className={styles.info}>
                  <strong>{artwork.title}</strong>
                  <span>#{artwork.sort_order} · {artwork.animation_style}</span>
                  {artwork.description && <p>{shortDesc(artwork.description)}</p>}
                </div>
                <div className={styles.itemActions}>
                  <label className={styles.uploadBtn}>
                    {uploading === artwork.id ? 'Uploading…' : 'Image'}
                    <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleImageUpload(artwork, e.target.files[0])} />
                  </label>
                  <button onClick={() => handleEdit(artwork)}>Edit</button>
                  <button onClick={() => handleDelete(artwork.id)} className={styles.deleteBtn}>Delete</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* ── Exhibitions ───────────────────────────────────────────────────── */}
      {tab === 'exhibitions' && (
        <div className={styles.content}>
          <section className={styles.formSection}>
            <h2>{editingEx ? 'Edit Exhibition' : 'New Exhibition'}</h2>
            <div className={styles.field}><label>Name</label>
              <input placeholder="Name" value={exForm.name} onChange={(e) => setExForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className={styles.field}><label>Description</label>
              <textarea placeholder="Description" value={exForm.description} rows={3} onChange={(e) => setExForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className={styles.row}>
              <div className={styles.field}><label>Slug (auto if empty)</label>
                <input placeholder="my-exhibition" value={exForm.slug} onChange={(e) => setExForm((f) => ({ ...f, slug: e.target.value }))} />
              </div>
              <div className={styles.field}><label>Sort Order</label>
                <input type="number" value={exForm.sort_order} onChange={(e) => setExForm((f) => ({ ...f, sort_order: +e.target.value }))} />
              </div>
            </div>
            <div className={styles.formActions}>
              <button onClick={handleSaveEx} disabled={savingEx} className={styles.saveBtn}>{savingEx ? 'Saving…' : editingEx ? 'Update' : 'Create'}</button>
              {editingEx && <button onClick={handleCancelEx} className={styles.cancelBtn}>Cancel</button>}
            </div>
          </section>

          <section className={styles.listSection}>
            <h2>Exhibitions ({exhibitions.length})</h2>
            {exhibitions.map((ex) => (
              <div key={ex.id}>
                <div className={styles.item}>
                  <div className={styles.thumb}>
                    {ex.cover_image ? <img src={ex.cover_image} alt={ex.name} /> : <span>No cover</span>}
                  </div>
                  <div className={styles.info}>
                    <strong>{ex.name}</strong>
                    <span>/{ex.slug}</span>
                    {ex.description && <p>{shortDesc(ex.description)}</p>}
                  </div>
                  <div className={styles.itemActions}>
                    <label className={styles.uploadBtn}>
                      {uploadingEx === ex.id ? 'Uploading…' : 'Cover'}
                      <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleExCoverUpload(ex, e.target.files[0])} />
                    </label>
                    <button onClick={() => handleManage(ex)}>{managingEx === ex.id ? 'Close' : 'Artworks'}</button>
                    <button onClick={() => handleEditEx(ex)}>Edit</button>
                    <button onClick={() => handleDeleteEx(ex.id)} className={styles.deleteBtn}>Delete</button>
                  </div>
                </div>

                {managingEx === ex.id && (
                  <div className={styles.assignPanel}>
                    <p className={styles.assignTitle}>Assign Artworks — check to include, set sort order</p>
                    {artworks.map((a) => (
                      <div key={a.id} className={styles.assignRow}>
                        <label className={styles.assignCheck}>
                          <input
                            type="checkbox"
                            checked={assignments[a.id]?.checked ?? false}
                            onChange={(e) => setAssignments((prev) => ({
                              ...prev,
                              [a.id]: { checked: e.target.checked, order: prev[a.id]?.order ?? 0 },
                            }))}
                          />
                          <span>{a.title}</span>
                        </label>
                        {assignments[a.id]?.checked && (
                          <input
                            type="number"
                            className={styles.assignOrder}
                            value={assignments[a.id]?.order ?? 0}
                            onChange={(e) => setAssignments((prev) => ({
                              ...prev,
                              [a.id]: { ...prev[a.id], order: +e.target.value },
                            }))}
                          />
                        )}
                      </div>
                    ))}
                    <div className={styles.formActions} style={{ marginTop: '1rem' }}>
                      <button onClick={() => handleSaveAssign(ex.id)} disabled={savingAssign} className={styles.saveBtn}>
                        {savingAssign ? 'Saving…' : 'Save Assignments'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}
