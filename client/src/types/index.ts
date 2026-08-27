// Shared response types, mirrored from server/src/types.
// Phase 2 (Checkout/Order) and Phase 3 (AuditLog) add more below.

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

// --- Checkout (Phase 2) ---

export type OrderStatus = 'pending_approval' | 'awaiting_payment' | 'paid' | 'failed' | 'rejected' | 'cancelled'

export interface CheckoutRequest {
  quantity?: number
  quotedPrice?: number
  actor?: string
  customerName?: string
  customerEmail?: string
  customerContact?: string
}

export interface CheckoutAwaitingPaymentResponse {
  status: 'awaiting_payment'
  orderId: string
  amount: number
  currency: string
  paymentLink: string
}

export interface CheckoutPendingApprovalResponse {
  status: 'pending_approval'
  message: string
  orderId: string
  amount: number
  approvalThreshold: number
}

// Covers every error shape the checkout/webhook endpoints can return
// (INVALID_PRODUCT_ID, PRODUCT_NOT_FOUND, OUT_OF_STOCK, PRICE_MISMATCH,
// ORDER_VALUE_EXCEEDS_MAX, PAYMENT_LINK_FAILED).
export interface CheckoutErrorResponse {
  error: string
  message: string
  [key: string]: unknown
}

export type CheckoutResponse = CheckoutAwaitingPaymentResponse | CheckoutPendingApprovalResponse | CheckoutErrorResponse
