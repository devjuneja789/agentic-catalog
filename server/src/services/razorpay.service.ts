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

export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
  const razorpay = getClient()

  const link = await razorpay.paymentLink.create({
    amount: Math.round(params.amount * 100), // Razorpay wants the smallest currency unit (paise for INR)
    currency: params.currency,
    description: params.description,
    reference_id: params.referenceId,
    notes: params.notes,
    // No real customer contact exists yet in an agent-driven flow — Razorpay's
    // `customer` object is required, but every field inside it is optional.
    customer: params.customer ?? {},
    notify: { sms: false, email: false },
    reminder_enable: false,
  })

  return {
    id: link.id,
    shortUrl: link.short_url,
    status: link.status,
  }
}

// Per Razorpay's docs: signature must be validated against the *raw* request
// body string, not a re-serialized copy of the parsed JSON — see index.ts,
// which stashes the raw body during express.json() parsing for this reason.
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!config.razorpay.webhookSecret) return true // not configured yet, see server/.env — dev-only fallback
  return Razorpay.validateWebhookSignature(rawBody, signature, config.razorpay.webhookSecret)
}
