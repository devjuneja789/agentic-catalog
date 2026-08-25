import dotenv from 'dotenv'

dotenv.config()

function optional(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.warn(`[env] ${name} is not set — features that need it will be skipped until you add it to server/.env`)
    return ''
  }
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',

  mongodbUri: optional('MONGODB_URI'),

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  },

  // Phase 2: bounded + gated checkout thresholds
  guardrails: {
    maxOrderValue: Number(process.env.MAX_ORDER_VALUE ?? 50000),
    approvalThreshold: Number(process.env.APPROVAL_THRESHOLD ?? 10000),
  },

  // Phase 5: simulated AI buyer agent
  llm: {
    apiKey: process.env.LLM_API_KEY ?? '',
    provider: process.env.LLM_PROVIDER ?? 'gemini',
  },

  // Static merchant identity, embedded in every catalog offer's `seller` field
  merchant: {
    id: process.env.MERCHANT_ID ?? 'studio-loom',
    name: process.env.MERCHANT_NAME ?? 'Studio Loom',
  },
}
