import { Schema, Types, model } from 'mongoose'

// Deliberately a flat, small taxonomy rather than one action per possible
// outcome — 'gate' covers auto_proceed/pending_approval/rejected alike (the
// *decision* field carries which one), same for 'query' across list/get/search.
export type AuditAction =
  | 'query' // Phase 1: GET /api/catalog, /:id, /search
  | 'verify' // Phase 2: stock + price re-check at checkout time
  | 'gate' // Phase 2: bound + gate guardrail decision
  | 'payment_created' // Phase 2: Razorpay payment link created
  | 'payment_failed' // Phase 2: Razorpay call itself failed
  | 'payment_confirmed' // Phase 2 webhook: payment_link.paid
  | 'payment_cancelled' // Phase 2 webhook: payment_link.cancelled / expired

export interface IAuditLog {
  timestamp: Date
  actor: string
  action: AuditAction
  input?: Record<string, unknown>
  decision: string
  reasoning: string
  result?: Record<string, unknown>
  orderId?: Types.ObjectId
  productId?: Types.ObjectId
}

const auditLogSchema = new Schema<IAuditLog>({
  timestamp: { type: Date, required: true, default: Date.now },
  actor: { type: String, required: true },
  action: {
    type: String,
    required: true,
    enum: ['query', 'verify', 'gate', 'payment_created', 'payment_failed', 'payment_confirmed', 'payment_cancelled'],
  },
  input: { type: Schema.Types.Mixed },
  decision: { type: String, required: true },
  reasoning: { type: String, required: true },
  result: { type: Schema.Types.Mixed },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
})

// Backs GET /api/audit?orderId= (chronological within an order) and the
// unfiltered activity feed (most recent first).
auditLogSchema.index({ orderId: 1, timestamp: 1 })
auditLogSchema.index({ timestamp: -1 })

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema)
