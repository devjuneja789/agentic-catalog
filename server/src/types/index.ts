// Shared server-side types. Phase 2 (Checkout/Order) and Phase 3 (AuditLog)
// add more below.

export type Currency = string // e.g. "INR"

export interface Price {
  amount: number
  currency: Currency
}

export type Availability = 'in_stock' | 'limited_stock' | 'out_of_stock'

export interface ProductVariant {
  name: string
  options: string[]
}

export interface Seller {
  id: string
  name: string
}

// The shape returned by every /api/catalog* endpoint. Loosely aligned with
// ACP / AP2 product & offer objects (id, name, price: {amount, currency},
// availability, seller) — an agent hitting this API sees a shape it likely
// already knows how to parse, even though this isn't a full ACP/AP2 server.
export interface ProductOffer {
  id: string
  sku: string
  name: string
  description: string
  category: string
  price: Price
  availability: Availability
  stock: number
  variants: ProductVariant[]
  imageUrl: string
  seller: Seller
}

export interface CatalogListResponse {
  count: number
  products: ProductOffer[]
}

// Augments Express's Request with the raw body string, captured in index.ts
// during JSON parsing — needed to validate Razorpay's webhook signature,
// which must be computed over the untouched request body, not a re-stringified copy.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: string
    }
  }
}
