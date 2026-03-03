import { useGsapAnimation } from '../../hooks/useGsapAnimation'
import type { Artwork } from '../../store/artworksSlice'
import styles from './ArtworkSection.module.scss'

interface Props {
  artwork: Artwork
  index: number
}

export default function ArtworkSection({ artwork, index }: Props) {
  const palette = artwork.metadata?.palette ?? ['#0a0a0a', '#1a1a1a', '#2a2a2a']
  const bgColor = palette[0] ?? '#0a0a0a'
  const accentColor = palette[1] ?? '#1a1a1a'

  const { sectionRef, imageRef, contentRef, numberRef } = useGsapAnimation(
    artwork.animation_style
  )

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      style={{ '--bg': bgColor, '--accent': accentColor } as React.CSSProperties}
      data-animation={artwork.animation_style}
      data-index={index}
    >
      <div className={styles.inner}>
        <span ref={numberRef} className={styles.number}>
          {String(index + 1).padStart(2, '0')}
        </span>

        <div ref={imageRef} className={styles.imagePlaceholder}>
          {artwork.image ? (
            <img
              src={artwork.image}
              alt={artwork.title}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          ) : (
            <div className={styles.noImage} />
          )}
        </div>

        <div ref={contentRef} className={styles.content}>
          <h2 className={styles.title}>{artwork.title}</h2>
          {artwork.description && (
            <p className={styles.description}>{artwork.description}</p>
          )}
          <div className={styles.palette}>
            {palette.map((color) => (
              <span
                key={color}
                className={styles.swatch}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
