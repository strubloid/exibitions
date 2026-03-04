import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { Artwork } from './artworksSlice'

export interface Exhibition {
  id: number
  name: string
  description: string | null
  slug: string
  cover_image: string | null
  sort_order: number
  artworks?: Artwork[]
  created_at: string
  updated_at: string
}

interface ExhibitionsState {
  items: Exhibition[]
  current: Exhibition | null
  loading: boolean
  error: string | null
}

const initialState: ExhibitionsState = {
  items: [],
  current: null,
  loading: false,
  error: null,
}

export const fetchExhibitions = createAsyncThunk('exhibitions/fetchAll', async () => {
  const res = await fetch('/api/exhibitions')
  if (!res.ok) throw new Error('Failed to fetch exhibitions')
  return res.json() as Promise<Exhibition[]>
})

export const fetchExhibition = createAsyncThunk('exhibitions/fetchOne', async (slug: string) => {
  const res = await fetch(`/api/exhibitions/${slug}`)
  if (!res.ok) throw new Error('Exhibition not found')
  return res.json() as Promise<Exhibition>
})

const exhibitionsSlice = createSlice({
  name: 'exhibitions',
  initialState,
  reducers: {
    clearCurrent(state) {
      state.current = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExhibitions.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchExhibitions.fulfilled, (state, action) => { state.loading = false; state.items = action.payload })
      .addCase(fetchExhibitions.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Unknown error' })
      .addCase(fetchExhibition.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchExhibition.fulfilled, (state, action) => { state.loading = false; state.current = action.payload })
      .addCase(fetchExhibition.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Unknown error' })
  },
})

export const { clearCurrent } = exhibitionsSlice.actions
export default exhibitionsSlice.reducer
