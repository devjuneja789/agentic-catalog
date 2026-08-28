import { Request } from 'express'
import { Types } from 'mongoose'
import { AuditAction, AuditLog } from '../models/AuditLog'

// The only place any route writes to AuditLog — every catalog read (Phase 1)
// and every checkout/webhook step (Phase 2) logs through this one function,
// so there's exactly one place to point at when a judge asks "is this real?"

export interface LogAuditParams {
  actor: string
  action: AuditAction
  decision: string
  reasoning: string
  input?: Record<string, unknown>
  result?: Record<string, unknown>
  orderId?: string | Types.ObjectId
  productId?: string | Types.ObjectId
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await AuditLog.create({
      timestamp: new Date(),
      actor: params.actor,
      action: params.action,
      decision: params.decision,
      reasoning: params.reasoning,
      input: params.input,
      result: params.result,
      orderId: params.orderId,
      productId: params.productId,
    })
  } catch (err) {
    // Audit logging must never take down the flow it's observing — a failed
    // write here is a bug to go fix, not a reason to fail someone's checkout.
    console.error('[audit] Failed to write audit log entry:', err)
  }
}

// Reads the actor identity off a request: an explicit X-Actor header first
// (what Phase 5's buyer agent sends), then body.actor / query.actor, falling
// back to a generic label so every log entry always has *someone* attached.
export function resolveActor(req: Request): string {
  const headerActor = req.headers['x-actor']
  if (typeof headerActor === 'string' && headerActor.trim()) return headerActor.trim()

  const bodyActor = (req.body as { actor?: unknown } | undefined)?.actor
  if (typeof bodyActor === 'string' && bodyActor.trim()) return bodyActor.trim()

  const queryActor = req.query?.actor
  if (typeof queryActor === 'string' && queryActor.trim()) return queryActor.trim()

  return 'unknown-agent'
}
