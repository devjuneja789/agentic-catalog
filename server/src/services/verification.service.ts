import { HydratedDocument, Types } from 'mongoose'
import { IProduct, Product } from '../models/Product'

// This is the "the AI buyer picked this a moment ago, is it still true"
// check. An agent's catalog query and its checkout call are never the same
// request, so stock and price can have moved in between — this re-verifies
// against the DB at the moment of checkout, not at the moment of search.

export type VerificationFailureCode = 'INVALID_PRODUCT_ID' | 'PRODUCT_NOT_FOUND' | 'OUT_OF_STOCK' | 'PRICE_MISMATCH'

export interface VerificationSuccess {
  ok: true
  product: HydratedDocument<IProduct>
}

export interface VerificationFailure {
  ok: false
  code: VerificationFailureCode
  message: string
  details?: Record<string, unknown>
}

export type VerificationResult = VerificationSuccess | VerificationFailure

export async function verifyProduct(
  productId: string,
  quantity: number,
  quotedPrice?: number,
): Promise<VerificationResult> {
  if (!Types.ObjectId.isValid(productId)) {
    return { ok: false, code: 'INVALID_PRODUCT_ID', message: 'Invalid product id.' }
  }

  const product = await Product.findById(productId)
  if (!product) {
    return { ok: false, code: 'PRODUCT_NOT_FOUND', message: 'Product not found.', details: { productId } }
  }

  if (product.stock < quantity) {
    return {
      ok: false,
      code: 'OUT_OF_STOCK',
      message: `Only ${product.stock} left in stock, ${quantity} requested.`,
      details: { productId, stock: product.stock, requested: quantity },
    }
  }

  if (quotedPrice !== undefined && quotedPrice !== product.price.amount) {
    return {
      ok: false,
      code: 'PRICE_MISMATCH',
      message: `Quoted price ₹${quotedPrice} no longer matches the current price ₹${product.price.amount}.`,
      details: { productId, quotedPrice, currentPrice: product.price.amount },
    }
  }

  return { ok: true, product }
}
