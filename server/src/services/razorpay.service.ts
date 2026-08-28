import Razorpay from 'razorpay'
import { config } from '../config/env'

let client: Razorpay | null = null

function getClient(): Razorpay {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new Error('Razorpay keys are not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env')
  }
  if (!client) {
    client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret })
  }
  return client
}

export interface CreatePaymentLinkParams {
  amount: number // major currency unit (rupees) — converted to paise below
  currency: string
  description: string
  referenceId: string
  notes?: Record<string, string>
  customer?: { name?: string; email?: string; contact?: string }
}

export interface PaymentLinkResult {
  id: string
  shortUrl: string
  status: string
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

// A single attempt at creating a payment link, bounded by a hard timeout so
// a slow or hanging network call can't stall a checkout indefinitely.
export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
  if (config.razorpay.simulateFailure) {
    throw new Error('Simulated Razorpay failure (RAZORPAY_SIMULATE_FAILURE=true in server/.env)')
  }

  const razorpay = getClient()

  const link = await withTimeout(
    razorpay.paymentLink.create({
      amount: Math.round(params.amount * 100), // Razorpay wants the smallest currency unit (paise for INR)
      currency: params.currency,
      description: params.description,
      reference_id: params.referenceId,
      notes: params.notes,
      // No real customer contact exists yet in an agent-driven flow —
      // Razorpay's `customer` object is required, but every field inside it is optional.
      customer: params.customer ?? {},
      notify: { sms: false, email: false },
      reminder_enable: false,
    }),
    config.razorpay.requestTimeoutMs,
    'Razorpay payment link creation',
  )

  return {
    id: link.id,
    shortUrl: link.short_url,
    status: link.status,
  }
}

export class PaymentLinkCreationError extends Error {
  attempts: string[]

  constructor(message: string, attempts: string[]) {
    super(message)
    this.name = 'PaymentLinkCreationError'
    this.attempts = attempts
  }
}

// What the checkout controller actually calls: retries exactly once on any
// failure (network error, timeout, Razorpay error response) before giving up
// with a structured error carrying both attempts' messages, for the audit trail.
export async function createPaymentLinkWithRetry(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
  const attempts: string[] = []

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await createPaymentLink(params)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      attempts.push(`attempt ${attempt}: ${message}`)
      if (attempt === 1) {
        console.warn(`[razorpay] Payment link creation failed (attempt 1) — retrying once. ${message}`)
      }
    }
  }

  throw new PaymentLinkCreationError('Payment link creation failed after 1 retry.', attempts)
}

// Per Razorpay's docs: signature must be validated against the *raw* request
// body string, not a re-serialized copy of the parsed JSON — see index.ts,
// which stashes the raw body during express.json() parsing for this reason.
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!config.razorpay.webhookSecret) return true // not configured yet, see server/.env — dev-only fallback
  return Razorpay.validateWebhookSignature(rawBody, signature, config.razorpay.webhookSecret)
}
