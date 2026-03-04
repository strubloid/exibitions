import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../store'
import { fetchExhibitions } from '../../store/exhibitionsSlice'
import Gallery from '../Gallery/Gallery'
import styles from './Exhibitions.module.scss'

export default function Exhibitions() {
  const dispatch = useDispatch<AppDispatch>()
  const { items, loading } = useSelector((state: RootState) => state.exhibitions)

  useEffect(() => {
    dispatch(fetchExhibitions())
  }, [dispatch])

  // No exhibitions yet — show the global artworks gallery
  if (!loading && items.length === 0) {
    return <Gallery />
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <span>Loading</span>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Exhibitions</h1>
      </header>

      <div className={styles.grid}>
        {items.map((exhibition) => (
          <Link
            key={exhibition.id}
            to={`/exhibition/${exhibition.slug}`}
            className={styles.card}
          >
            <div className={styles.cardInner}>
              {exhibition.cover_image ? (
                <img src={exhibition.cover_image} alt={exhibition.name} loading="lazy" />
              ) : (
                <div className={styles.cardPlaceholder}>
                  <span>{exhibition.name[0]}</span>
                </div>
              )}
            </div>
            <div className={styles.cardOverlay}>
              <strong className={styles.cardName}>{exhibition.name}</strong>
              {exhibition.description && (
                <p className={styles.cardDesc}>{exhibition.description}</p>
              )}
              <span className={styles.cardCta}>Enter</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
