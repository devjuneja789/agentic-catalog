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

  const existing = await Product.findById(productId)
  if (!existing) {
    return { ok: false, code: 'PRODUCT_NOT_FOUND', message: 'Product not found.', details: { productId } }
  }

  if (quotedPrice !== undefined && quotedPrice !== existing.price.amount) {
    return {
      ok: false,
      code: 'PRICE_MISMATCH',
      message: `Quoted price ₹${quotedPrice} no longer matches the current price ₹${existing.price.amount}.`,
      details: { productId, quotedPrice, currentPrice: existing.price.amount },
    }
  }

  // Atomic reserve: the $gte guard and the $inc decrement happen as one
  // MongoDB operation on one document, not a separate read followed by a
  // separate write. Of two requests racing for the last unit, only one can
  // ever have this succeed — the other gets null back, not a stale read of
  // stock that's already gone. This is what actually prevents overselling
  // under a duplicate/simultaneous request, not just the earlier read-check.
  const reserved = await Product.findOneAndUpdate(
    { _id: productId, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true },
  )

  if (!reserved) {
    // Lost the race (or an admin zeroed stock out) — re-read for an
    // accurate count to put in the error.
    const current = await Product.findById(productId)
    const currentStock = current?.stock ?? 0
    return {
      ok: false,
      code: 'OUT_OF_STOCK',
      message: `Only ${currentStock} left in stock, ${quantity} requested.`,
      details: { productId, stock: currentStock, requested: quantity },
    }
  }

  return { ok: true, product: reserved }
}

// Pairs with the reservation above. Called whenever a reserved order doesn't
// end up completing — guardrail rejection, payment-link creation failure, or
// the link later expiring/being cancelled — so stock isn't lost forever.
export async function releaseStock(productId: string | Types.ObjectId, quantity: number): Promise<void> {
  await Product.updateOne({ _id: productId }, { $inc: { stock: quantity } })
}
