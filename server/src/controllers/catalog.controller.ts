import { NextFunction, Request, Response } from 'express'
import { HydratedDocument, Types } from 'mongoose'
import { IProduct, Product } from '../models/Product'
import { config } from '../config/env'
import { logAudit, resolveActor } from '../services/audit.service'
import type { Availability, ProductOffer, UpdateProductRequest } from '../types'

// Below this stock count a product is "limited_stock" instead of "in_stock".
const LOW_STOCK_THRESHOLD = 5

function getAvailability(stock: number): Availability {
  if (stock <= 0) return 'out_of_stock'
  if (stock <= LOW_STOCK_THRESHOLD) return 'limited_stock'
  return 'in_stock'
}

function toProductOffer(doc: HydratedDocument<IProduct>): ProductOffer {
  return {
    id: doc._id.toString(),
    sku: doc.sku,
    name: doc.name,
    description: doc.description,
    category: doc.category,
    price: { amount: doc.price.amount, currency: doc.price.currency },
    availability: getAvailability(doc.stock),
    stock: doc.stock,
    variants: doc.variants,
    imageUrl: doc.imageUrl,
    seller: config.merchant,
  }
}

// GET /api/catalog
export async function listCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const products = await Product.find().sort({ createdAt: -1 })

    await logAudit({
      actor: resolveActor(req),
      action: 'query',
      decision: `${products.length}_results`,
      reasoning: `Listed the full catalog — ${products.length} products.`,
      input: { endpoint: 'GET /api/catalog' },
      result: { count: products.length },
    })

    res.json({ count: products.length, products: products.map(toProductOffer) })
  } catch (err) {
    next(err)
  }
}

// GET /api/catalog/:id
export async function getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const actor = resolveActor(req)

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: { message: 'Invalid product id', code: 'INVALID_ID' } })
      return
    }

    const product = await Product.findById(id)

    if (!product) {
      await logAudit({
        actor,
        action: 'query',
        decision: 'not_found',
        reasoning: `Looked up product ${id} — no match.`,
        input: { endpoint: 'GET /api/catalog/:id', productId: id },
        productId: id,
      })
      res.status(404).json({ error: { message: 'Product not found', code: 'NOT_FOUND' } })
      return
    }

    await logAudit({
      actor,
      action: 'query',
      decision: 'found',
      reasoning: `Looked up product ${id} — matched "${product.name}".`,
      input: { endpoint: 'GET /api/catalog/:id', productId: id },
      result: { name: product.name, sku: product.sku, price: product.price.amount },
      productId: product._id,
    })

    res.json(toProductOffer(product))
  } catch (err) {
    next(err)
  }
}

// GET /api/catalog/search?q=&maxPrice=&category=
export async function searchCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, maxPrice, category } = req.query
    const filter: Record<string, unknown> = {}

    if (typeof q === 'string' && q.trim()) {
      const regex = new RegExp(q.trim(), 'i')
      filter.$or = [{ name: regex }, { description: regex }, { category: regex }]
    }

    if (typeof category === 'string' && category.trim()) {
      filter.category = new RegExp(`^${category.trim()}$`, 'i')
    }

    if (typeof maxPrice === 'string' && maxPrice.trim()) {
      const max = Number(maxPrice)
      if (!Number.isNaN(max)) {
        filter['price.amount'] = { $lte: max }
      }
    }

    const products = await Product.find(filter).sort({ createdAt: -1 })

    await logAudit({
      actor: resolveActor(req),
      action: 'query',
      decision: `${products.length}_results`,
      reasoning: `Searched the catalog (q="${q ?? ''}", maxPrice=${maxPrice ?? 'none'}, category=${category ?? 'any'}) — ${products.length} matches.`,
      input: { endpoint: 'GET /api/catalog/search', q, maxPrice, category },
      result: { count: products.length },
    })

    res.json({ count: products.length, products: products.map(toProductOffer) })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/catalog/:id
// The dashboard's edit form (and the Phase 4 "make it go out of stock" demo
// lever) both go through here.
export async function updateProduct(
  req: Request<{ id: string }, unknown, UpdateProductRequest>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params
    const actor = resolveActor(req)

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: { message: 'Invalid product id', code: 'INVALID_ID' } })
      return
    }

    const { name, description, category, price, stock } = req.body
    const updates: Record<string, unknown> = {}

    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ error: { message: 'name cannot be empty', code: 'INVALID_FIELD' } })
        return
      }
      updates.name = name.trim()
    }
    if (description !== undefined) updates.description = description
    if (category !== undefined) {
      if (!category.trim()) {
        res.status(400).json({ error: { message: 'category cannot be empty', code: 'INVALID_FIELD' } })
        return
      }
      updates.category = category.trim()
    }
    if (price !== undefined) {
      if (!Number.isFinite(price) || price < 0) {
        res.status(400).json({ error: { message: 'price must be a non-negative number', code: 'INVALID_FIELD' } })
        return
      }
      updates['price.amount'] = price
    }
    if (stock !== undefined) {
      if (!Number.isInteger(stock) || stock < 0) {
        res.status(400).json({ error: { message: 'stock must be a non-negative integer', code: 'INVALID_FIELD' } })
        return
      }
      updates.stock = stock
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: { message: 'No editable fields provided', code: 'NO_UPDATES' } })
      return
    }

    const product = await Product.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true })

    if (!product) {
      res.status(404).json({ error: { message: 'Product not found', code: 'NOT_FOUND' } })
      return
    }

    await logAudit({
      actor,
      action: 'catalog_update',
      decision: 'updated',
      reasoning: `${actor} updated "${product.name}": ${Object.keys(updates).join(', ')}.`,
      input: { productId: id, fields: req.body },
      result: { sku: product.sku, stock: product.stock, price: product.price.amount },
      productId: product._id,
    })

    res.json(toProductOffer(product))
  } catch (err) {
    next(err)
  }
}
