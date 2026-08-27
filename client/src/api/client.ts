// Typed fetch wrappers to the backend API.
// Checkout (Phase 2) and audit (Phase 3) wrappers get added here next.

import type { CatalogListResponse, CheckoutRequest, CheckoutResponse, ProductOffer } from '../types'

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
