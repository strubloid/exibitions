export interface BasketItem {
  artworkId: number
  title: string
  image: string | null
  priceCents: number
  currency: string
  addedAt: string  // ISO
}

export interface Basket {
  items: BasketItem[]
  updatedAt: string
}

export interface CheckoutRequest {
  items: { artwork_id: number }[]
  customer: {
    email: string
    name: string
    shipping: {
      line1: string
      line2?: string
      city: string
      postal_code: string
      country: string  // ISO 3166-1 alpha-2
      state?: string
    }
  }
  success_url: string
}

export interface CheckoutSession {
  session_id: string
  url: string
}

export interface OrderSummary {
  order_number: string
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded'
  paid_at: string | null
}