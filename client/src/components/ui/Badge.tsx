import type { ReactNode } from 'react'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const toneClasses: Record<Tone, string> = {
  success: 'bg-sage/15 text-sage border-sage/30',
  warning: 'bg-thread/15 text-thread border-thread/30',
  danger: 'bg-rust/15 text-rust border-rust/30',
  neutral: 'bg-dust/10 text-dust border-dust/25',
  info: 'bg-surface-raised text-linen border-dust/20',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}

// --- Domain tone mappers, shared across CatalogTable / AuditTrail / BuyerAgentConsole ---

export function availabilityTone(availability: string): Tone {
  switch (availability) {
    case 'in_stock':
      return 'success'
    case 'limited_stock':
      return 'warning'
    case 'out_of_stock':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function orderStatusTone(status: string): Tone {
  switch (status) {
    case 'paid':
      return 'success'
    case 'awaiting_payment':
    case 'pending_approval':
      return 'warning'
    case 'failed':
    case 'rejected':
    case 'cancelled':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function auditActionTone(action: string): Tone {
  switch (action) {
    case 'payment_created':
    case 'payment_confirmed':
      return 'success'
    case 'gate':
    case 'catalog_update':
      return 'warning'
    case 'payment_failed':
    case 'payment_cancelled':
      return 'danger'
    default:
      return 'info'
  }
}
