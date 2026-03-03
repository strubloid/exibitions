import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import type { RootState, AppDispatch } from '../../store'
import { logout } from '../../store/authSlice'
import styles from './AdminPanel.module.scss'

interface Artwork {
  id: number
  title: string
  description: string | null
  image: string | null
  sort_order: number
  animation_style: string
}

const EMPTY_FORM = { title: '', description: '', sort_order: 0, animation_style: 'fade' }

export default function AdminPanel() {
  const token = useSelector((state: RootState) => state.auth.token)
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()

  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [editing, setEditing] = useState<Artwork | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  const fetchArtworks = useCallback(async () => {
    const res = await fetch('/api/artworks')
    setArtworks(await res.json())
  }, [])

  useEffect(() => {
    fetchArtworks()
  }, [fetchArtworks])

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST', headers: authHeaders })
    dispatch(logout())
    navigate('/')
  }

  const handleEdit = (artwork: Artwork) => {
    setEditing(artwork)
    setForm({
      title: artwork.title,
      description: artwork.description ?? '',
      sort_order: artwork.sort_order,
      animation_style: artwork.animation_style,
    })
  }

  const handleCancel = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const handleSave = async () => {
    setSaving(true)
    if (editing) {
      await fetch(`/api/artworks/${editing.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/artworks', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(form),
      })
    }
    setSaving(false)
    handleCancel()
    fetchArtworks()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this artwork?')) return
    await fetch(`/api/artworks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    fetchArtworks()
  }

  const handleImageUpload = async (artwork: Artwork, file: File) => {
    setUploading(artwork.id)
    const formData = new FormData()
    formData.append('image', file)
    await fetch(`/api/artworks/${artwork.id}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: formData,
    })
    setUploading(null)
    fetchArtworks()
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

      <div className={styles.content}>
        <section className={styles.formSection}>
          <h2>{editing ? 'Edit Artwork' : 'New Artwork'}</h2>
          <div className={styles.field}>
            <label>Title</label>
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <textarea
              placeholder="Description"
              value={form.description}
              rows={3}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: +e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label>Animation</label>
              <select
                value={form.animation_style}
                onChange={(e) => setForm((f) => ({ ...f, animation_style: e.target.value }))}
              >
                <option value="fade">Fade</option>
                <option value="mask-reveal">Mask Reveal</option>
                <option value="parallax">Parallax</option>
              </select>
            </div>
          </div>
          <div className={styles.formActions}>
            <button onClick={handleSave} disabled={saving} className={styles.saveBtn}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
            {editing && (
              <button onClick={handleCancel} className={styles.cancelBtn}>
                Cancel
              </button>
            )}
          </div>
        </section>

        <section className={styles.listSection}>
          <h2>Artworks ({artworks.length})</h2>
          {artworks.map((artwork) => (
            <div key={artwork.id} className={styles.item}>
              <div className={styles.thumb}>
                {artwork.image ? (
                  <img src={artwork.image} alt={artwork.title} />
                ) : (
                  <span>No image</span>
                )}
              </div>
              <div className={styles.info}>
                <strong>{artwork.title}</strong>
                <span>#{artwork.sort_order} · {artwork.animation_style}</span>
                {artwork.description && <p>{artwork.description}</p>}
              </div>
              <div className={styles.itemActions}>
                <label className={styles.uploadBtn}>
                  {uploading === artwork.id ? 'Uploading…' : 'Image'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) =>
                      e.target.files?.[0] && handleImageUpload(artwork, e.target.files[0])
                    }
                  />
                </label>
                <button onClick={() => handleEdit(artwork)}>Edit</button>
                <button onClick={() => handleDelete(artwork.id)} className={styles.deleteBtn}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
