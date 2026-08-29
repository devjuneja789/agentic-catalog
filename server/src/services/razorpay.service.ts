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

interface RazorpayApiError {
  statusCode?: number
  error?: {
    code?: string
    description?: string
    field?: string
    reason?: string
  }
}

// The Razorpay SDK rejects with a plain object ({ statusCode, error }) rather
// than an Error instance. Convert it once here so retry logs and audit entries
// retain the useful API response instead of becoming "[object Object]".
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message

  if (err && typeof err === 'object') {
    const razorpayError = err as RazorpayApiError
    const details = razorpayError.error
    if (details?.description || details?.code) {
      const status = razorpayError.statusCode ? `HTTP ${razorpayError.statusCode}` : 'Razorpay error'
      const field = details.field ? ` (field: ${details.field})` : ''
      const reason = details.reason ? ` (${details.reason})` : ''
      return `${status}: ${details.code ?? 'UNKNOWN'} — ${details.description ?? 'No description'}${field}${reason}`
    }

    try {
      return JSON.stringify(err)
    } catch {
      // Fall through to the stable generic message below.
    }
  }

  return String(err)
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
  const customer = params.customer
    ? Object.fromEntries(Object.entries(params.customer).filter(([, value]) => value !== undefined && value !== ''))
    : undefined

  // Customer details are optional for a standard Payment Link. In particular,
  // the CLI buyer does not know a real customer's contact information, so do
  // not turn that absence into an empty `customer: {}` object in the API call.
  // Razorpay's published TypeScript definitions mark `customer` as required,
  // although the HTTP API accepts it as optional.
  const payload = {
    amount: Math.round(params.amount * 100), // Razorpay wants the smallest currency unit (paise for INR)
    currency: params.currency,
    description: params.description,
    reference_id: params.referenceId,
    notes: params.notes,
    ...(customer && Object.keys(customer).length > 0 ? { customer } : {}),
    notify: { sms: false, email: false },
    reminder_enable: false,
  }

  const link = await withTimeout(
    razorpay.paymentLink.create(payload as Parameters<typeof razorpay.paymentLink.create>[0]),
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
      const message = errorMessage(err)
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
