import { configureStore } from '@reduxjs/toolkit'
import artworksReducer from './artworksSlice'
import authReducer from './authSlice'

export const store = configureStore({
  reducer: {
    artworks: artworksReducer,
    auth: authReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
