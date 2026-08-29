import { useEffect, useMemo, useState } from 'react'
import { getCatalog, updateProduct } from '../api/client'
import type { ProductOffer } from '../types'
import { Badge, availabilityTone } from './ui/Badge'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Spinner } from './ui/Spinner'

export function CatalogTable() {
  const [products, setProducts] = useState<ProductOffer[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [query, setQuery] = useState('')

  async function load() {
    setStatus('loading')
    try {
      const data = await getCatalog()
      setProducts(data.products)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [products, query])

  function handleUpdated(updated: ProductOffer) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter by name, category, or SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="ghost" size="sm" onClick={load}>
          Refresh
        </Button>
        {status === 'ready' && (
          <span className="text-xs text-dust">
            {filtered.length} of {products.length} products
          </span>
        )}
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-dust">
          <Spinner /> Loading catalog...
        </div>
      )}

      {status === 'error' && (
        <div className="py-16 text-center text-sm text-rust">Couldn't load the catalog. Is the server running?</div>
      )}

      {status === 'ready' && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-dust">No products match "{query}".</div>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-dust/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dust/15 bg-surface-raised/50 text-left text-xs uppercase tracking-wide text-dust">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price (₹)</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Availability</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <ProductRow key={p.id} product={p} onUpdated={handleUpdated} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ProductRow({ product, onUpdated }: { product: ProductOffer; onUpdated: (p: ProductOffer) => void }) {
  const [price, setPrice] = useState(String(product.price.amount))
  const [stock, setStock] = useState(String(product.stock))
  const [saving, setSaving] = useState<'price' | 'stock' | null>(null)
  const [justSaved, setJustSaved] = useState<'price' | 'stock' | null>(null)

  useEffect(() => {
    setPrice(String(product.price.amount))
    setStock(String(product.stock))
  }, [product.price.amount, product.stock])

  async function commitValue(field: 'price' | 'stock', num: number) {
    setSaving(field)
    try {
      const updated = await updateProduct(product.id, field === 'price' ? { price: num } : { stock: num })
      onUpdated(updated)
      setJustSaved(field)
      setTimeout(() => setJustSaved(null), 1200)
    } catch {
      if (field === 'price') setPrice(String(product.price.amount))
      else setStock(String(product.stock))
    } finally {
      setSaving(null)
    }
  }

  function handleBlur(field: 'price' | 'stock') {
    const raw = field === 'price' ? price : stock
    const num = Number(raw)
    const current = field === 'price' ? product.price.amount : product.stock

    if (!Number.isFinite(num) || num < 0) {
      if (field === 'price') setPrice(String(product.price.amount))
      else setStock(String(product.stock))
      return
    }
    if (num === current) return
    commitValue(field, num)
  }

  return (
    <tr className="border-b border-dust/10 last:border-0 hover:bg-surface-raised/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-md bg-surface-raised object-cover" />
          <div>
            <div className="font-medium text-linen">{product.name}</div>
            <div className="font-mono text-[11px] text-dust">{product.sku}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-dust">{product.category}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => handleBlur('price')}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="focus-thread w-20 rounded border border-dust/20 bg-surface-raised px-2 py-1 font-mono text-xs text-linen"
          />
          {saving === 'price' && <Spinner size={12} />}
          {justSaved === 'price' && <span className="text-[10px] text-sage">saved</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            onBlur={() => handleBlur('stock')}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="focus-thread w-16 rounded border border-dust/20 bg-surface-raised px-2 py-1 font-mono text-xs text-linen"
          />
          <button
            type="button"
            title="Zero out stock — triggers OUT_OF_STOCK on the next checkout (Phase 4 demo lever)"
            onClick={() => {
              setStock('0')
              commitValue('stock', 0)
            }}
            className="text-[10px] text-dust underline decoration-dotted hover:text-rust"
          >
            zero
          </button>
          {saving === 'stock' && <Spinner size={12} />}
          {justSaved === 'stock' && <span className="text-[10px] text-sage">saved</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge tone={availabilityTone(product.availability)}>{product.availability.replace(/_/g, ' ')}</Badge>
      </td>
    </tr>
  )
}
