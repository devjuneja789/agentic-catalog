// Typed fetch wrappers to the backend API.
// Checkout (Phase 2) and audit (Phase 3) wrappers get added here next.

import type { CatalogListResponse, ProductOffer } from '../types'

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
