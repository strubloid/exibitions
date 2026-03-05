import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../store'
import { fetchExhibition, clearCurrent } from '../../store/exhibitionsSlice'
import { extractDominantColor } from '../../utils/extractDominantColor'
import Gallery from '../Gallery/Gallery'
import styles from './ExhibitionView.module.scss'

export default function ExhibitionView() {
  const { slug } = useParams<{ slug: string }>()
  const dispatch = useDispatch<AppDispatch>()
  const { current: exhibition, loading } = useSelector((state: RootState) => state.exhibitions)
  const [dominantColor, setDominantColor] = useState<string>('rgb(80, 80, 80)')
  const [selectedClippingIndex, setSelectedClippingIndex] = useState<number | null>(null)

  useEffect(() => {
    if (slug) dispatch(fetchExhibition(slug))
    return () => {
      dispatch(clearCurrent())
    }
  }, [slug, dispatch])

  useEffect(() => {
    if (exhibition?.cover_image) {
      extractDominantColor(exhibition.cover_image).then(setDominantColor)
    }
  }, [exhibition?.cover_image])

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

      {exhibition.background && (
        <section className={styles.backgroundSection} style={{ backgroundColor: dominantColor }}>
          <h2 className={styles.backgroundTitle}>{exhibition.name}</h2>
          <div className={styles.backgroundLabel}>Background</div>
          <div className={styles.backgroundContent}>
            <div className={styles.backgroundMasonryGrid}>
              {exhibition.background.split('\n').filter(line => line.trim()).map((line, idx) => (
                <div key={idx} className={styles.backgroundMasonryItem}>
                  <p className={styles.backgroundText}>{line}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {exhibition.clippings && exhibition.clippings.length > 0 && (
        <section className={styles.clippingsSection} style={{ backgroundColor: dominantColor }}>
          <h2 className={styles.clippingsTitle}>Check it out where I was!</h2>
          <div className={styles.clippingsLabel}>Press</div>
          <div className={styles.clippingsContent}>
            <div className={styles.clippingsGrid}>
              {exhibition.clippings.map((clippingEntry, entryIndex) => (
                <div
                  key={entryIndex}
                  className={styles.clippingCard}
                  onClick={() => clippingEntry.screenshot_image && setSelectedClippingIndex(entryIndex)}
                  style={{ cursor: clippingEntry.screenshot_image ? 'pointer' : 'default' }}
                >
                  {clippingEntry.screenshot_image && (
                    <div className={styles.clippingImageContainer}>
                      <img
                        src={clippingEntry.screenshot_image}
                        alt={clippingEntry.title}
                        className={styles.clippingImage}
                      />
                    </div>
                  )}
                  <div className={styles.clippingCardDetails}>
                    <span className={styles.clippingTitle}>{clippingEntry.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedClippingIndex !== null && exhibition.clippings?.[selectedClippingIndex]?.screenshot_image && (
        <div className={styles.modal} onClick={() => setSelectedClippingIndex(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedClippingIndex(null)}>✕</button>
            <img
              src={exhibition.clippings[selectedClippingIndex].screenshot_image}
              alt={exhibition.clippings[selectedClippingIndex].title}
              className={styles.modalImage}
            />
          </div>
        </div>
      )}
    </>
  )
}
