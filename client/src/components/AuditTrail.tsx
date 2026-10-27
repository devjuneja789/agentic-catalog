import { useEffect, useRef, useState } from 'react'
import { getAuditTrail } from '../api/client'
import type { AuditLogEntry } from '../types'
import { Badge, auditActionTone } from './ui/Badge'
import { Spinner } from './ui/Spinner'

const POLL_MS = 3000

const dotGlowClass: Record<string, string> = {
  success: 'bg-sage shadow-[0_0_8px_rgba(16,185,129,0.7)]',
  warning: 'bg-amber shadow-[0_0_8px_rgba(245,158,11,0.7)]',
  danger: 'bg-rust shadow-[0_0_8px_rgba(244,63,94,0.7)]',
  neutral: 'bg-dust shadow-[0_0_6px_rgba(148,163,184,0.4)]',
  info: 'bg-thread shadow-[0_0_8px_rgba(51,149,255,0.7)]',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function AuditTrail({ orderId }: { orderId?: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(isInitial: boolean) {
      if (isInitial) setStatus('loading')
      try {
        const data = await getAuditTrail(orderId ? { orderId } : { limit: 35 })
        if (!cancelled) {
          setLogs(data.logs)
          setStatus('ready')
        }
      } catch {
        if (!cancelled && isInitial) setStatus('error')
      }
    }

    load(true)
    pollRef.current = window.setInterval(() => load(false), POLL_MS)

    return () => {
      cancelled = true
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [orderId])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2.5 py-20 text-sm text-dust">
        <Spinner size={16} /> Connecting to real-time audit stream...
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-rust/20 bg-rust/5 py-12 text-center text-sm text-rust">
        Unable to reach audit trail service.
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] py-16 text-center text-sm text-dust">
        {orderId
          ? 'No audit log entries recorded for this order yet.'
          : 'Stream listening... Run the AI agent or initiate a transaction to see live telemetry.'}
      </div>
    )
  }

  return (
    <div className="relative pl-6">
      {/* Precision vertical seam line */}
      <div
        className="absolute bottom-2 left-[7px] top-2 border-l border-dashed border-white/[0.12]"
        aria-hidden="true"
      />

      <ul className="space-y-3.5">
        {logs.map((log) => {
          const isOpen = expanded.has(log.id)
          const hasDetail =
            (log.input && Object.keys(log.input).length > 0) ||
            (log.result && Object.keys(log.result).length > 0)
          const tone = auditActionTone(log.action)

          return (
            <li key={log.id} className="relative group">
              {/* Telemetry node point */}
              <span
                className={`absolute -left-6 top-3 h-2.5 w-2.5 rounded-full border-2 border-ink transition-transform duration-200 group-hover:scale-125 ${dotGlowClass[tone]}`}
                aria-hidden="true"
              />
              <div className="rounded-xl border border-white/[0.07] bg-surface-raised/40 p-3.5 backdrop-blur-sm transition-all duration-200 hover:border-white/[0.14] hover:bg-surface-raised/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={tone}>{log.action.replace(/_/g, ' ')}</Badge>
                    <span className="font-mono text-xs font-semibold text-linen">
                      {log.decision}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-dust">
                    {formatTime(log.timestamp)}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-linen/90">
                  {log.reasoning}
                </p>

                <div className="mt-2.5 flex items-center justify-between font-mono text-[11px] text-dust">
                  <span className="flex items-center gap-1">
                    <span className="text-dust/60">actor:</span>
                    <span className="text-linen">{log.actor}</span>
                  </span>
                  {hasDetail && (
                    <button
                      type="button"
                      onClick={() => toggle(log.id)}
                      className="font-medium text-thread hover:underline"
                    >
                      {isOpen ? 'Close payload ▲' : 'Inspect payload ▼'}
                    </button>
                  )}
                </div>

                {isOpen && hasDetail && (
                  <pre className="mt-2.5 overflow-x-auto rounded-lg border border-white/[0.08] bg-[#050608] p-3 font-mono text-[11px] text-linen/90">
                    {JSON.stringify({ input: log.input, result: log.result }, null, 2)}
                  </pre>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
