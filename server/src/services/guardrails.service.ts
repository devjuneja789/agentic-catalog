import { config } from '../config/env'

// This file is the "bounded and gated" answer for a demo — every checkout
// amount passes through here exactly once, and nowhere else decides whether
// an order auto-proceeds, waits for a human, or gets rejected outright.

export type GuardrailDecision = 'auto_proceed' | 'pending_approval' | 'rejected'

export interface GuardrailResult {
  decision: GuardrailDecision
  reasoning: string
}

export function evaluateGuardrails(amount: number): GuardrailResult {
  const { maxOrderValue, approvalThreshold } = config.guardrails

  // Bound: anything over the hard cap is rejected outright, no exceptions.
  if (amount > maxOrderValue) {
    return {
      decision: 'rejected',
      reasoning: `Order amount ₹${amount} exceeds the configured max order value of ₹${maxOrderValue} — rejected.`,
    }
  }

  // Gate: above the lower threshold (but within the cap), hold for approval
  // instead of auto-issuing a payment link.
  if (amount > approvalThreshold) {
    return {
      decision: 'pending_approval',
      reasoning: `Order amount ₹${amount} exceeds the approval threshold of ₹${approvalThreshold} — held for manual approval.`,
    }
  }

  return {
    decision: 'auto_proceed',
    reasoning: `Order amount ₹${amount} is within the auto-approval threshold of ₹${approvalThreshold}.`,
  }
}
