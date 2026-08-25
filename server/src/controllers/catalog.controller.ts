import { NextFunction, Request, Response } from 'express'
import { HydratedDocument, Types } from 'mongoose'
import { IProduct, Product } from '../models/Product'
import { config } from '../config/env'
import type { Availability, ProductOffer } from '../types'

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
export async function listCatalog(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const products = await Product.find().sort({ createdAt: -1 })
    res.json({ count: products.length, products: products.map(toProductOffer) })
  } catch (err) {
    next(err)
  }
}

// GET /api/catalog/:id
export async function getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: { message: 'Invalid product id', code: 'INVALID_ID' } })
      return
    }

    const product = await Product.findById(id)
    if (!product) {
      res.status(404).json({ error: { message: 'Product not found', code: 'NOT_FOUND' } })
      return
    }

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
    res.json({ count: products.length, products: products.map(toProductOffer) })
  } catch (err) {
    next(err)
  }
}
