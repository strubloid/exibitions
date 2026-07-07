import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { BasketItem } from '../types/checkout'

const STORAGE_KEY = 'exibitions_basket'

interface BasketState {
  items: BasketItem[]
  updatedAt: string
}

const initialState: BasketState = {
  items: [],
  updatedAt: new Date().toISOString(),
}

function persist(items: BasketItem[]): string {
  if (typeof window !== 'undefined') {
    try {
      const data = JSON.stringify({ items, updatedAt: new Date().toISOString() })
      window.localStorage.setItem(STORAGE_KEY, data)
    } catch {
      // localStorage might be unavailable (private mode) — silently ignore.
    }
  }
  return new Date().toISOString()
}

function upsertItem(items: BasketItem[], artwork: { id: number; title: string; image: string | null; price_cents: number | null; currency: string | null }): BasketItem[] {
  // One physical piece = one row in the basket. Adding the same artwork twice is a no-op.
  if (items.some(i => i.artworkId === artwork.id)) {
    return items
  }
  const newItem: BasketItem = {
    artworkId: artwork.id,
    title: artwork.title,
    image: artwork.image,
    priceCents: artwork.price_cents ?? 0,
    currency: artwork.currency ?? 'USD',
    addedAt: new Date().toISOString(),
  }
  return [...items, newItem]
}

const basketSlice = createSlice({
  name: 'basket',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<{ id: number; title: string; image: string | null; price_cents: number | null; currency: string | null }>) => {
      state.items = upsertItem(state.items, action.payload)
      state.updatedAt = persist(state.items)
    },
    removeItem: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter(i => i.artworkId !== action.payload)
      state.updatedAt = persist(state.items)
    },
    clear: (state) => {
      state.items = []
      state.updatedAt = persist(state.items)
    },
    hydrate: (state, action: PayloadAction<BasketItem[]>) => {
      state.items = action.payload
      state.updatedAt = new Date().toISOString()
    },
  },
})

export const { addItem, removeItem, clear, hydrate } = basketSlice.actions
export default basketSlice.reducer

// ── Selectors (SOLID "small interfaces": keep them colocated, not inlined in useSelector) ──
export const selectBasketCount       = (s: { basket: BasketState }): number => s.basket.items.length
export const selectBasketSubtotalCents = (s: { basket: BasketState }): number => s.basket.items.reduce((sum, i) => sum + i.priceCents, 0)
export const selectIsInBasket = (s: { basket: BasketState }, artworkId: number): boolean => s.basket.items.some(i => i.artworkId === artworkId)

export const readBasketFromStorage = (): BasketItem[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { items?: BasketItem[]; updatedAt?: string }
    if (!parsed || !Array.isArray(parsed.items)) return []
    return parsed.items
  } catch {
    return []
  }
}