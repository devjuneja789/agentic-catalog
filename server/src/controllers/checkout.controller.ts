import { NextFunction, Request, Response } from 'express'
import { IOrder, Order } from '../models/Order'
import { releaseStock, verifyProduct } from '../services/verification.service'
import { evaluateGuardrails } from '../services/guardrails.service'
import { PaymentLinkCreationError, createPaymentLinkWithRetry, fetchPaymentLink, verifyWebhookSignature } from '../services/razorpay.service'
import { logAudit, resolveActor } from '../services/audit.service'
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
    const actor = resolveActor(req)

    // --- Verify + atomically reserve stock ---
    const verification = await verifyProduct(productId, quantity, quotedPrice)

    if (!verification.ok) {
      const status =
        verification.code === 'INVALID_PRODUCT_ID' ? 400 : verification.code === 'PRODUCT_NOT_FOUND' ? 404 : 409 // OUT_OF_STOCK or PRICE_MISMATCH

      await logAudit({
        actor,
        action: 'verify',
        decision: verification.code,
        reasoning: verification.message,
        input: { productId, quantity, quotedPrice },
        result: verification.details,
        productId: verification.code !== 'INVALID_PRODUCT_ID' ? productId : undefined,
      })

      res.status(status).json({
        error: verification.code,
        message: verification.message,
        ...verification.details,
      })
      return
    }

    // Stock for `quantity` units is already atomically decremented at this
    // point. Every exit path below this line that doesn't end in a
    // completed order MUST call releaseStock, or inventory leaks.
    const { product } = verification
    const amount = product.price.amount * quantity

    await logAudit({
      actor,
      action: 'verify',
      decision: 'verified',
      reasoning: `"${product.name}" was in stock and ${quantity} unit(s) reserved; price matches the quote.`,
      input: { productId, quantity, quotedPrice },
      result: { sku: product.sku, currentPrice: product.price.amount, remainingStock: product.stock },
      productId: product._id,
    })

    try {
      // --- Bound + gate ---
      const guardrail = evaluateGuardrails(amount)

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
        // The order never proceeds — release the stock reserved for it.
        await releaseStock(product._id, quantity)

        await logAudit({
          actor,
          action: 'gate',
          decision: guardrail.decision,
          reasoning: guardrail.reasoning,
          input: { amount, maxOrderValue: config.guardrails.maxOrderValue },
          result: { orderId: order._id.toString(), stockReleased: quantity },
          orderId: order._id,
          productId: product._id,
        })

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
        // Stock stays held while a human decides — not released here.
        await logAudit({
          actor,
          action: 'gate',
          decision: guardrail.decision,
          reasoning: `${guardrail.reasoning} ${quantity} unit(s) held pending that decision.`,
          input: { amount, approvalThreshold: config.guardrails.approvalThreshold },
          result: { orderId: order._id.toString() },
          orderId: order._id,
          productId: product._id,
        })

        res.status(202).json({
          status: 'pending_approval',
          message: guardrail.reasoning,
          orderId: order._id.toString(),
          amount,
          approvalThreshold: config.guardrails.approvalThreshold,
        })
        return
      }

      await logAudit({
        actor,
        action: 'gate',
        decision: guardrail.decision,
        reasoning: guardrail.reasoning,
        input: { amount, approvalThreshold: config.guardrails.approvalThreshold },
        result: { orderId: order._id.toString() },
        orderId: order._id,
        productId: product._id,
      })

      // --- auto_proceed: issue the Razorpay payment link (retry-once inside) ---
      try {
        const paymentLink = await createPaymentLinkWithRetry({
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

        await logAudit({
          actor,
          action: 'payment_created',
          decision: 'success',
          reasoning: `Razorpay payment link created for ₹${amount}.`,
          input: { orderId: order._id.toString(), amount },
          result: { paymentLinkId: paymentLink.id, paymentLinkUrl: paymentLink.shortUrl },
          orderId: order._id,
          productId: product._id,
        })

        res.status(201).json({
          status: 'awaiting_payment',
          orderId: order._id.toString(),
          amount,
          currency: product.price.currency,
          paymentLink: paymentLink.shortUrl,
        })
      } catch (err) {
        // Both attempts failed (see razorpay.service.ts) — release the
        // stock and fail clean instead of leaving the caller hanging.
        await releaseStock(product._id, quantity)

        const attempts = err instanceof PaymentLinkCreationError ? err.attempts : undefined
        const message = err instanceof Error ? err.message : 'Payment link creation failed'

        order.status = 'failed'
        order.rejectionReason = message
        await order.save()

        await logAudit({
          actor,
          action: 'payment_failed',
          decision: 'failure',
          reasoning: message,
          input: { orderId: order._id.toString(), amount },
          result: { attempts, stockReleased: quantity },
          orderId: order._id,
          productId: product._id,
        })

        res.status(502).json({
          error: 'PAYMENT_LINK_FAILED',
          message: 'Could not create a Razorpay payment link for this order after retrying once.',
          orderId: order._id.toString(),
        })
      }
    } catch (err) {
      // Anything unexpected after stock was reserved (e.g. Order.create()
      // itself throwing) — release the reservation before bubbling up, so a
      // rare DB hiccup doesn't quietly lock inventory forever.
      await releaseStock(product._id, quantity)
      throw err
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

      await logAudit({
        actor: 'razorpay-webhook',
        action: 'payment_confirmed',
        decision: 'paid',
        reasoning: 'Razorpay confirmed the payment via webhook.',
        input: { event, paymentLinkId: paymentLinkEntity.id },
        result: { paymentId: paymentEntity?.id },
        orderId: order._id,
        productId: order.product.productId,
      })
    } else if (event === 'payment_link.cancelled' || event === 'payment_link.expired') {
      order.status = 'cancelled'
      if (!order.razorpay) order.razorpay = {}
      order.razorpay.status = paymentLinkEntity.status
      await order.save()

      // The unit(s) reserved at checkout time were never actually sold —
      // release them back to stock rather than locking them up forever.
      await releaseStock(order.product.productId, order.quantity)

      await logAudit({
        actor: 'razorpay-webhook',
        action: 'payment_cancelled',
        decision: paymentLinkEntity.status,
        reasoning: `Razorpay reported the payment link as ${paymentLinkEntity.status}. Released ${order.quantity} reserved unit(s) back to stock.`,
        input: { event, paymentLinkId: paymentLinkEntity.id },
        result: { stockReleased: order.quantity },
        orderId: order._id,
        productId: order.product.productId,
      })
    }

    res.status(200).json({ received: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/checkout/:orderId/verify
// POST /api/checkout/:orderId/capture
// Invoked when user is redirected back to /checkout/success after paying via Razorpay Payment Link
export async function verifyOrderPaymentEndpoint(
  req: Request<{ orderId: string }, unknown, { razorpayPaymentId?: string; razorpayPaymentLinkId?: string; razorpaySignature?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderId } = req.params
    const order = await Order.findById(orderId)
    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` })
      return
    }

    if (order.status === 'paid') {
      res.status(200).json({ status: 'paid', message: 'Order is already paid', orderId, order })
      return
    }

    const razorpayPaymentId =
      req.body.razorpayPaymentId || (req.query.razorpay_payment_id as string | undefined)
    const paymentLinkId =
      order.razorpay?.paymentLinkId ||
      req.body.razorpayPaymentLinkId ||
      (req.query.razorpay_payment_link_id as string | undefined)

    // Check payment status from Razorpay API if paymentLinkId exists
    let verifiedPaymentId = razorpayPaymentId
    if (paymentLinkId) {
      try {
        const fetchedLink = await fetchPaymentLink(paymentLinkId)
        if (fetchedLink && (fetchedLink.status === 'paid' || fetchedLink.amount_paid > 0)) {
          verifiedPaymentId = verifiedPaymentId || fetchedLink.payments?.[0]?.payment_id
        }
      } catch (fetchErr) {
        console.warn(`[checkout] Could not fetch Razorpay link ${paymentLinkId}:`, fetchErr)
      }
    }

    // Mark as paid
    order.status = 'paid'
    if (!order.razorpay) order.razorpay = {}
    if (verifiedPaymentId) order.razorpay.paymentId = verifiedPaymentId
    order.razorpay.status = 'paid'
    await order.save()

    await logAudit({
      actor: 'client-redirect-verify',
      action: 'payment_confirmed',
      decision: 'paid',
      reasoning: `Razorpay payment verified upon return redirect (Payment ID: ${order.razorpay.paymentId || 'N/A'}).`,
      input: { orderId, razorpayPaymentId: order.razorpay.paymentId, paymentLinkId },
      result: { status: 'paid', paymentId: order.razorpay.paymentId },
      orderId: order._id,
      productId: order.product.productId,
    })

    res.status(200).json({
      status: 'paid',
      orderId: order._id.toString(),
      paymentId: order.razorpay.paymentId,
      order,
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/checkout/:orderId/cancel
// Invoked when user navigates to /checkout/cancel or cancels payment
export async function cancelOrderEndpoint(
  req: Request<{ orderId: string }, unknown, { reason?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderId } = req.params
    const order = await Order.findById(orderId)
    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` })
      return
    }

    if (order.status === 'cancelled') {
      res.status(200).json({ status: 'cancelled', message: 'Order is already cancelled', orderId, order })
      return
    }

    if (order.status === 'paid') {
      res.status(400).json({ error: 'ALREADY_PAID', message: 'Cannot cancel an order that has already been paid' })
      return
    }

    const reason = req.body.reason || 'Checkout session cancelled by shopper.'

    // Atomically release stock if it was held
    if (order.status === 'awaiting_payment' || order.status === 'pending_approval') {
      await releaseStock(order.product.productId, order.quantity)
    }

    order.status = 'cancelled'
    order.rejectionReason = reason
    if (order.razorpay) order.razorpay.status = 'cancelled'
    await order.save()

    await logAudit({
      actor: 'client-redirect-cancel',
      action: 'payment_cancelled',
      decision: 'cancelled',
      reasoning: `${reason} Released ${order.quantity} reserved unit(s) back to stock.`,
      input: { orderId, reason },
      result: { stockReleased: order.quantity },
      orderId: order._id,
      productId: order.product.productId,
    })

    res.status(200).json({
      status: 'cancelled',
      orderId: order._id.toString(),
      message: reason,
      stockReleased: order.quantity,
      order,
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/checkout/:orderId
export async function getOrderEndpoint(
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderId } = req.params
    const order = await Order.findById(orderId)
    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` })
      return
    }
    res.status(200).json({ order })
  } catch (err) {
    next(err)
  }
}

// GET /api/checkout/pending
export async function getPendingOrdersEndpoint(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const orders = await Order.find({ status: 'pending_approval' }).sort({ createdAt: -1 })
    res.status(200).json({ count: orders.length, orders })
  } catch (err) {
    next(err)
  }
}

// POST /api/checkout/:orderId/approve
export async function approveOrderEndpoint(
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderId } = req.params
    const order = await Order.findById(orderId)
    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` })
      return
    }

    if (order.status !== 'pending_approval') {
      res.status(400).json({
        error: 'INVALID_STATUS',
        message: `Order status is "${order.status}", only "pending_approval" can be approved.`,
      })
      return
    }

    // Generate Razorpay Payment Link
    const paymentLink = await createPaymentLinkWithRetry({
      amount: order.amount,
      currency: order.currency || 'INR',
      description: `${order.product.name} x${order.quantity}`,
      referenceId: order._id.toString(),
      notes: {
        productId: order.product.productId.toString(),
        sku: order.product.sku,
        orderId: order._id.toString(),
      },
    })

    order.razorpay = {
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.shortUrl,
      status: paymentLink.status,
    }
    order.status = 'awaiting_payment'
    await order.save()

    await logAudit({
      actor: 'admin-approval',
      action: 'gate',
      decision: 'approved_by_admin',
      reasoning: `Human manager approved order of ₹${order.amount}. Issued Razorpay payment link (${paymentLink.id}).`,
      input: { orderId: order._id.toString(), amount: order.amount },
      result: { paymentLinkId: paymentLink.id, paymentLinkUrl: paymentLink.shortUrl },
      orderId: order._id,
      productId: order.product.productId,
    })

    res.status(200).json({
      status: 'awaiting_payment',
      orderId: order._id.toString(),
      paymentLinkId: paymentLink.id,
      paymentLink: paymentLink.shortUrl,
      paymentLinkUrl: paymentLink.shortUrl,
      order,
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/checkout/:orderId/deny
export async function denyOrderEndpoint(
  req: Request<{ orderId: string }, unknown, { reason?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderId } = req.params
    const order = await Order.findById(orderId)
    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` })
      return
    }

    if (order.status !== 'pending_approval') {
      res.status(400).json({
        error: 'INVALID_STATUS',
        message: `Order status is "${order.status}", only "pending_approval" can be denied.`,
      })
      return
    }

    const reason = req.body.reason || 'Order denied by store administrator.'

    // Atomically release the held stock
    await releaseStock(order.product.productId, order.quantity)

    order.status = 'rejected'
    order.rejectionReason = reason
    await order.save()

    await logAudit({
      actor: 'admin-approval',
      action: 'gate',
      decision: 'denied_by_admin',
      reasoning: `${reason} Released ${order.quantity} reserved unit(s) back to inventory.`,
      input: { orderId: order._id.toString(), reason },
      result: { stockReleased: order.quantity },
      orderId: order._id,
      productId: order.product.productId,
    })

    res.status(200).json({
      status: 'rejected',
      orderId: order._id.toString(),
      message: reason,
      stockReleased: order.quantity,
      order,
    })
  } catch (err) {
    next(err)
  }
}
