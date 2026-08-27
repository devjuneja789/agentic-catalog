import { NextFunction, Request, Response } from 'express'
import { IOrder, Order } from '../models/Order'
import { verifyProduct } from '../services/verification.service'
import { evaluateGuardrails } from '../services/guardrails.service'
import { createPaymentLink, verifyWebhookSignature } from '../services/razorpay.service'
import { config } from '../config/env'

interface CheckoutRequestBody {
  quantity?: number
  quotedPrice?: number
  actor?: string
  customerName?: string
  customerEmail?: string
  customerContact?: string
}

// POST /api/checkout/:productId
// The moment "the AI buyer picked this" becomes a real payment attempt.
export async function createCheckout(
  req: Request<{ productId: string }, unknown, CheckoutRequestBody>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { productId } = req.params
    const rawQuantity = req.body.quantity
    const quantity = rawQuantity && rawQuantity > 0 ? Math.floor(rawQuantity) : 1
    const quotedPrice = req.body.quotedPrice
    const actor = req.body.actor?.trim() || 'unknown-agent'

    // --- Verify: does this order still make sense right now? ---
    const verification = await verifyProduct(productId, quantity, quotedPrice)

    if (!verification.ok) {
      const status =
        verification.code === 'INVALID_PRODUCT_ID' ? 400 : verification.code === 'PRODUCT_NOT_FOUND' ? 404 : 409 // OUT_OF_STOCK or PRICE_MISMATCH

      res.status(status).json({
        error: verification.code,
        message: verification.message,
        ...verification.details,
      })
      return
    }

    const { product } = verification
    const amount = product.price.amount * quantity

    // --- Bound + gate: is this order allowed to proceed, and does it need a human? ---
    const guardrail = evaluateGuardrails(amount)

    // An Order record is created regardless of outcome — rejections and
    // approvals waiting on a human still need a paper trail.
    const order = await Order.create({
      product: {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        imageUrl: product.imageUrl,
        unitPrice: { amount: product.price.amount, currency: product.price.currency },
      },
      quantity,
      amount,
      currency: product.price.currency,
      actor,
      guardrailDecision: guardrail.decision,
      guardrailReasoning: guardrail.reasoning,
      status:
        guardrail.decision === 'rejected'
          ? 'rejected'
          : guardrail.decision === 'pending_approval'
            ? 'pending_approval'
            : 'awaiting_payment',
    } satisfies Omit<IOrder, 'razorpay' | 'rejectionReason'>)

    if (guardrail.decision === 'rejected') {
      res.status(422).json({
        error: 'ORDER_VALUE_EXCEEDS_MAX',
        message: guardrail.reasoning,
        orderId: order._id.toString(),
        amount,
        maxOrderValue: config.guardrails.maxOrderValue,
      })
      return
    }

    if (guardrail.decision === 'pending_approval') {
      res.status(202).json({
        status: 'pending_approval',
        message: guardrail.reasoning,
        orderId: order._id.toString(),
        amount,
        approvalThreshold: config.guardrails.approvalThreshold,
      })
      return
    }

    // --- auto_proceed: issue the Razorpay payment link ---
    try {
      const paymentLink = await createPaymentLink({
        amount,
        currency: product.price.currency,
        description: `${product.name} x${quantity}`,
        referenceId: order._id.toString(),
        notes: { productId: product._id.toString(), sku: product.sku, orderId: order._id.toString() },
        customer: {
          name: req.body.customerName,
          email: req.body.customerEmail,
          contact: req.body.customerContact,
        },
      })

      order.razorpay = {
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.shortUrl,
        status: paymentLink.status,
      }
      await order.save()

      res.status(201).json({
        status: 'awaiting_payment',
        orderId: order._id.toString(),
        amount,
        currency: product.price.currency,
        paymentLink: paymentLink.shortUrl,
      })
    } catch (err) {
      // Phase 4 adds a retry-once + structured fallback here. For now: fail
      // clean, mark the order, and don't leave the caller hanging.
      order.status = 'failed'
      order.rejectionReason = err instanceof Error ? err.message : 'Payment link creation failed'
      await order.save()

      res.status(502).json({
        error: 'PAYMENT_LINK_FAILED',
        message: 'Could not create a Razorpay payment link for this order.',
        orderId: order._id.toString(),
      })
    }
  } catch (err) {
    next(err)
  }
}

// POST /api/webhooks/razorpay
// Razorpay calls this when a payment link's status changes.
export async function handleRazorpayWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature']

    if (config.razorpay.webhookSecret) {
      if (!req.rawBody || typeof signature !== 'string' || !verifyWebhookSignature(req.rawBody, signature)) {
        res.status(400).json({ error: 'INVALID_SIGNATURE' })
        return
      }
    } else {
      // No public URL registered yet (see Phase 2 setup notes) — accept
      // unverified for local testing only. Set RAZORPAY_WEBHOOK_SECRET once
      // you've registered a webhook URL in the Razorpay Dashboard.
      console.warn('[webhook] RAZORPAY_WEBHOOK_SECRET not set — accepting webhook without signature verification.')
    }

    const event = req.body?.event as string | undefined
    const paymentLinkEntity = req.body?.payload?.payment_link?.entity
    const paymentEntity = req.body?.payload?.payment?.entity

    if (!event || !paymentLinkEntity?.id) {
      // Not an event shape we recognize — ack anyway so Razorpay doesn't retry forever.
      res.status(200).json({ received: true })
      return
    }

    const order = await Order.findOne({ 'razorpay.paymentLinkId': paymentLinkEntity.id })
    if (!order) {
      res.status(200).json({ received: true })
      return
    }

    if (event === 'payment_link.paid') {
      order.status = 'paid'
      if (!order.razorpay) order.razorpay = {}
      order.razorpay.paymentId = paymentEntity?.id
      order.razorpay.status = 'paid'
      await order.save()
    } else if (event === 'payment_link.cancelled' || event === 'payment_link.expired') {
      order.status = 'cancelled'
      if (!order.razorpay) order.razorpay = {}
      order.razorpay.status = paymentLinkEntity.status
      await order.save()
    }

    res.status(200).json({ received: true })
  } catch (err) {
    next(err)
  }
}
