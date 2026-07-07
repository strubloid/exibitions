import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface UIState {
  basketDrawerOpen: boolean
  adminSidebarOpen: boolean
  checkoutInFlight: boolean
}

const initialState: UIState = {
  basketDrawerOpen: false,
  adminSidebarOpen: false,
  checkoutInFlight: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openBasketDrawer: (state) => { state.basketDrawerOpen = true },
    closeBasketDrawer: (state) => { state.basketDrawerOpen = false },
    setCheckoutInFlight: (state, action: PayloadAction<boolean>) => { state.checkoutInFlight = action.payload },
  },
})

export const { openBasketDrawer, closeBasketDrawer, setCheckoutInFlight } = uiSlice.actions
export default uiSlice.reducer