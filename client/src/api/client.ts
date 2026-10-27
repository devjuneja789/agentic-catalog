// Typed fetch wrappers to the backend API.

import type {
  AuditTrailResponse,
  BuyerAgentResult,
  CatalogListResponse,
  CheckoutRequest,
  CheckoutResponse,
  ProductOffer,
  UpdateProductRequest,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function getHealth(): Promise<{ status: string; service: string; timestamp: string }> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return res.json()
}

export async function getCatalog(): Promise<CatalogListResponse> {
  const res = await fetch(`${API_BASE}/catalog`)
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`)
  return res.json()
}

export async function getProduct(id: string): Promise<ProductOffer> {
  const res = await fetch(`${API_BASE}/catalog/${id}`)
  if (!res.ok) throw new Error(`Failed to load product ${id}: ${res.status}`)
  return res.json()
}

export interface CatalogSearchParams {
  q?: string
  maxPrice?: number
  category?: string
}

export async function searchCatalog(params: CatalogSearchParams): Promise<CatalogListResponse> {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.maxPrice !== undefined) query.set('maxPrice', String(params.maxPrice))
  if (params.category) query.set('category', params.category)

  const res = await fetch(`${API_BASE}/catalog/search?${query.toString()}`)
  if (!res.ok) throw new Error(`Catalog search failed: ${res.status}`)
  return res.json()
}

// checkout() deliberately doesn't throw on non-2xx — pending_approval (202),
// out-of-stock (409), and guardrail rejections (422) are all expected
// outcomes the caller needs to branch on, not exceptions.
export async function checkout(
  productId: string,
  body: CheckoutRequest = {},
): Promise<{ httpStatus: number; data: CheckoutResponse }> {
  const res = await fetch(`${API_BASE}/checkout/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as CheckoutResponse
  return { httpStatus: res.status, data }
}

// Pass orderId for a single order's full chronological trail (what
// Dashboard's live audit view shows during a checkout), or omit it for a
// recent-activity feed across all orders.
export async function getAuditTrail(options: { orderId?: string; limit?: number } = {}): Promise<AuditTrailResponse> {
  const query = new URLSearchParams()
  if (options.orderId) query.set('orderId', options.orderId)
  if (options.limit !== undefined) query.set('limit', String(options.limit))

  const res = await fetch(`${API_BASE}/audit?${query.toString()}`)
  if (!res.ok) throw new Error(`Failed to load audit trail: ${res.status}`)
  return res.json()
}

// --- Catalog admin (Phase 6) ---

export async function updateProduct(id: string, fields: UpdateProductRequest): Promise<ProductOffer> {
  const res = await fetch(`${API_BASE}/catalog/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Actor': 'catalog-admin' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `Failed to update product: ${res.status}`)
  }
  return res.json()
}

// --- Buyer agent (Phase 5, HTTP-triggerable in Phase 6) ---

export async function runBuyerAgent(want: string, customerName: string): Promise<BuyerAgentResult> {
  const res = await fetch(`${API_BASE}/agent/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ want, customerName }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `Buyer agent request failed: ${res.status}`)
  }
  return res.json()
}

// --- Human-in-the-Loop Approval & Order APIs ---

export async function getOrder(orderId: string): Promise<{ order: any }> {
  const res = await fetch(`${API_BASE}/checkout/${orderId}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Failed to fetch order: ${res.status}`)
  }
  return res.json()
}

export interface PendingOrdersResponse {
  count: number
  orders: any[]
}

export interface VerifyPaymentResponse {
  status: string
  orderId: string
  paymentId?: string
  order?: any
  message?: string
}

export async function verifyOrderPayment(
  orderId: string,
  params?: { razorpayPaymentId?: string; razorpayPaymentLinkId?: string; razorpaySignature?: string },
): Promise<VerifyPaymentResponse> {
  const res = await fetch(`${API_BASE}/checkout/${orderId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Failed to verify payment: ${res.status}`)
  }
  return res.json()
}

// Alias for compatibility
export const captureOrder = verifyOrderPayment

export async function cancelOrder(
  orderId: string,
  reason?: string,
): Promise<{
  status: string
  orderId: string
  message: string
  stockReleased?: number
  order?: any
}> {
  const res = await fetch(`${API_BASE}/checkout/${orderId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Failed to cancel order: ${res.status}`)
  }
  return res.json()
}

export async function getPendingOrders(): Promise<PendingOrdersResponse> {
  const res = await fetch(`${API_BASE}/checkout/pending`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Failed to fetch pending orders: ${res.status}`)
  }
  return res.json()
}

export async function approveOrder(orderId: string): Promise<{
  status: string
  orderId: string
  paymentLinkId?: string
  paymentLink?: string
  paymentLinkUrl?: string
  order?: any
}> {
  const res = await fetch(`${API_BASE}/checkout/${orderId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Failed to approve order: ${res.status}`)
  }
  return res.json()
}

export async function denyOrder(orderId: string, reason?: string): Promise<{
  status: string
  orderId: string
  message: string
  stockReleased: number
}> {
  const res = await fetch(`${API_BASE}/checkout/${orderId}/deny`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Failed to deny order: ${res.status}`)
  }
  return res.json()
}

// --- Model Context Protocol (MCP) APIs ---

export async function getMcpManifest(): Promise<any> {
  const res = await fetch(`${API_BASE}/mcp/manifest`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Failed to fetch MCP manifest: ${res.status}`)
  }
  return res.json()
}

export async function executeMcpToolCall(
  toolName: string,
  args: Record<string, any>,
): Promise<{
  tool: string
  content: Array<{ type: string; text: string }>
  isError: boolean
  raw?: any
}> {
  const res = await fetch(`${API_BASE}/mcp/tools/${toolName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ arguments: args }),
  })
  return res.json()
}


