import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../store'
import { fetchArtworks } from '../../store/artworksSlice'
import ArtworkSection from '../ArtworkSection/ArtworkSection'
import styles from './Gallery.module.scss'

export default function Gallery() {
  const dispatch = useDispatch<AppDispatch>()
  const { items, loading, error } = useSelector((s: RootState) => s.artworks)

  useEffect(() => {
    dispatch(fetchArtworks())
  }, [dispatch])

  if (loading) {
    return (
      <div className={styles.state}>
        <span className={styles.stateText}>Loading</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.state}>
        <span className={styles.stateText}>Unable to load gallery</span>
      </div>
    )
  }

  return (
    <main className={styles.gallery}>
      {items.map((artwork, index) => (
        <ArtworkSection key={artwork.id} artwork={artwork} index={index} />
      ))}
    </main>
  )
}
