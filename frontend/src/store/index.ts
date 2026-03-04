import { configureStore } from '@reduxjs/toolkit'
import artworksReducer from './artworksSlice'
import authReducer from './authSlice'
import exhibitionsReducer from './exhibitionsSlice'

export const store = configureStore({
  reducer: {
    artworks: artworksReducer,
    auth: authReducer,
    exhibitions: exhibitionsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
