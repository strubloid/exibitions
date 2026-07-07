import { configureStore } from '@reduxjs/toolkit'
import artworksReducer from './artworksSlice'
import authReducer from './authSlice'
import exhibitionsReducer from './exhibitionsSlice'
import basketReducer from './basketSlice'
import uiReducer from './uiSlice'

export const store = configureStore({
  reducer: {
    artworks: artworksReducer,
    auth: authReducer,
    exhibitions: exhibitionsReducer,
    basket: basketReducer,
    ui: uiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch