import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../store'
import { fetchExhibition, clearCurrent } from '../../store/exhibitionsSlice'
import Gallery from '../Gallery/Gallery'
import styles from './ExhibitionView.module.scss'

export default function ExhibitionView() {
  const { slug } = useParams<{ slug: string }>()
  const dispatch  = useDispatch<AppDispatch>()
  const { current: exhibition, loading } = useSelector((state: RootState) => state.exhibitions)

  useEffect(() => {
    if (slug) dispatch(fetchExhibition(slug))
    return () => { dispatch(clearCurrent()) }
  }, [slug, dispatch])

  if (loading || !exhibition) {
    return (
      <div className={styles.loading}>
        <span>Loading</span>
      </div>
    )
  }

  return (
    <>
      <section className={styles.intro}>
        <Link to="/" className={styles.back}>← Exhibitions</Link>

        {exhibition.cover_image && (
          <div className={styles.cover}>
            <img src={exhibition.cover_image} alt={exhibition.name} />
          </div>
        )}

        <div className={styles.overlay} />

        <div className={styles.content}>
          <h1 className={styles.name}>{exhibition.name}</h1>
          {exhibition.description && (
            <p className={styles.desc}>{exhibition.description}</p>
          )}
          <div className={styles.cta}>
            <div className={styles.ctaLine} />
            <span>scroll</span>
          </div>
        </div>
      </section>

      <Gallery artworks={exhibition.artworks ?? []} />
    </>
  )
}
