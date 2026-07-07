import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../store'
import { addItem, selectIsInBasket } from '../../store/basketSlice'
import type { Artwork } from '../../store/artworksSlice'
import styles from './BuyButton.module.scss'

interface Props {
  artwork: Artwork
}

export default function BuyButton({ artwork }: Props) {
  const dispatch = useDispatch<AppDispatch>()
  const isInBasket = useSelector((s: RootState) => selectIsInBasket(s, artwork.id))
  const [justAdded, setJustAdded] = useState(false)

  // If the artwork is not for sale, render nothing — the gallery stays cinematic.
  if (!artwork.is_available || artwork.price_cents == null) {
    return null
  }

  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: artwork.currency ?? 'USD',
  }).format(artwork.price_cents / 100)

  const handleClick = () => {
    if (isInBasket) return
    dispatch(addItem(artwork))
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 2000)
  }

  return (
    <button
      type="button"
      className={`${styles.buyButton} ${justAdded ? styles.added : ''} ${isInBasket ? styles.inBasket : ''}`}
      onClick={handleClick}
      aria-label={`Add ${artwork.title} to basket for ${formatted}`}
    >
      {isInBasket ? 'In basket ✓' : justAdded ? 'Added ✓' : `Buy · ${formatted}`}
    </button>
  )
}