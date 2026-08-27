import { Schema, Types, model } from 'mongoose'

export interface OrderProductSnapshot {
  productId: Types.ObjectId
  name: string
  sku: string
  imageUrl: string
  unitPrice: { amount: number; currency: string }
}

// awaiting_payment -> paid | cancelled  (via Razorpay webhook)
// awaiting_payment -> failed            (Razorpay call itself failed)
// pending_approval -> ...               (Phase 6 admin action moves this on)
// rejected                              (bounded guardrail — terminal)
export type OrderStatus = 'pending_approval' | 'awaiting_payment' | 'paid' | 'failed' | 'rejected' | 'cancelled'

export type GuardrailDecision = 'auto_proceed' | 'pending_approval' | 'rejected'

export interface OrderRazorpayInfo {
  paymentLinkId?: string
  paymentLinkUrl?: string
  paymentId?: string
  status?: string
}

export interface IOrder {
  product: OrderProductSnapshot
  quantity: number
  amount: number
  currency: string
  status: OrderStatus
  actor: string
  guardrailDecision: GuardrailDecision
  guardrailReasoning: string
  rejectionReason?: string
  razorpay?: OrderRazorpayInfo
}

const productSnapshotSchema = new Schema<OrderProductSnapshot>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    imageUrl: { type: String, required: true },
    unitPrice: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
  },
  { _id: false },
)

const razorpaySchema = new Schema<OrderRazorpayInfo>(
  {
    paymentLinkId: String,
    paymentLinkUrl: String,
    paymentId: String,
    status: String,
  },
  { _id: false },
)

const orderSchema = new Schema<IOrder>(
  {
    // Snapshotted rather than a live populate — the audit trail (Phase 3)
    // should show what the buyer was quoted, even if the product changes later.
    product: { type: productSnapshotSchema, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      required: true,
      enum: ['pending_approval', 'awaiting_payment', 'paid', 'failed', 'rejected', 'cancelled'],
    },
    actor: { type: String, required: true, default: 'unknown-agent' },
    guardrailDecision: {
      type: String,
      required: true,
      enum: ['auto_proceed', 'pending_approval', 'rejected'],
    },
    guardrailReasoning: { type: String, required: true },
    rejectionReason: String,
    razorpay: { type: razorpaySchema, required: false },
  },
  { timestamps: true },
)

export const Order = model<IOrder>('Order', orderSchema)
