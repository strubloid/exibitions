import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

export interface Artwork {
  id: number
  title: string
  description: string | null
  image: string | null
  sort_order: number
  animation_style: string
  metadata: { palette?: string[] } | null
  created_at: string
  updated_at: string
}

interface ArtworksState {
  items: Artwork[]
  loading: boolean
  error: string | null
}

const initialState: ArtworksState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchArtworks = createAsyncThunk('artworks/fetch', async () => {
  const res = await fetch('/api/artworks')
  if (!res.ok) throw new Error('Failed to fetch artworks')
  return res.json() as Promise<Artwork[]>
})

const artworksSlice = createSlice({
  name: 'artworks',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchArtworks.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchArtworks.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchArtworks.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Unknown error'
      })
  },
})

export default artworksSlice.reducer
