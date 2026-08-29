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

// --- Audit trail (Phase 3) ---

export type AuditAction =
  | 'query'
  | 'verify'
  | 'gate'
  | 'payment_created'
  | 'payment_failed'
  | 'payment_confirmed'
  | 'payment_cancelled'
  | 'catalog_update'

export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string
  action: AuditAction
  decision: string
  reasoning: string
  input?: Record<string, unknown>
  result?: Record<string, unknown>
  orderId?: string
  productId?: string
}

export interface AuditTrailResponse {
  orderId?: string
  count: number
  logs: AuditLogEntry[]
}

// --- Catalog admin (Phase 6) ---

export interface UpdateProductRequest {
  name?: string
  description?: string
  category?: string
  price?: number
  stock?: number
}

// --- Buyer agent (Phase 5, HTTP-triggerable in Phase 6) ---

export interface BuyerAgentIntent {
  query: string
  maxPrice?: number
}

export interface BuyerAgentPick {
  productId: string
  reasoning: string
  fellBack: boolean
}

export type BuyerAgentStoppedAt = 'parse_intent' | 'search' | 'no_matches' | 'pick_match'

export interface BuyerAgentResult {
  want: string
  intent?: BuyerAgentIntent
  offers?: ProductOffer[]
  picked?: BuyerAgentPick
  checkout?: { status: number; body: Record<string, unknown> }
  error?: string
  stoppedAt?: BuyerAgentStoppedAt
}
