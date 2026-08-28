import { NextFunction, Request, Response } from 'express'
import { HydratedDocument, Types } from 'mongoose'
import { AuditLog, IAuditLog } from '../models/AuditLog'
import type { AuditLogEntry } from '../types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function toAuditEntry(doc: HydratedDocument<IAuditLog>): AuditLogEntry {
  return {
    id: doc._id.toString(),
    timestamp: doc.timestamp.toISOString(),
    actor: doc.actor,
    action: doc.action,
    decision: doc.decision,
    reasoning: doc.reasoning,
    input: doc.input,
    result: doc.result,
    orderId: doc.orderId?.toString(),
    productId: doc.productId?.toString(),
  }
}

// GET /api/audit?orderId=       -> full chronological trail for one order
// GET /api/audit?limit=         -> most recent entries across all orders
export async function getAuditTrail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId, limit } = req.query

    if (typeof orderId === 'string' && orderId.trim()) {
      if (!Types.ObjectId.isValid(orderId)) {
        res.status(400).json({ error: { message: 'Invalid order id', code: 'INVALID_ORDER_ID' } })
        return
      }

      const logs = await AuditLog.find({ orderId }).sort({ timestamp: 1 })
      res.json({ orderId, count: logs.length, logs: logs.map(toAuditEntry) })
      return
    }

    const requested = typeof limit === 'string' ? Number(limit) : DEFAULT_LIMIT
    const max = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT

    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(max)
    res.json({ count: logs.length, logs: logs.map(toAuditEntry) })
  } catch (err) {
    next(err)
  }
}
