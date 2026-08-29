import { useEffect, useRef, useState } from 'react'
import { getAuditTrail } from '../api/client'
import type { AuditLogEntry } from '../types'
import { Badge, auditActionTone } from './ui/Badge'
import { Spinner } from './ui/Spinner'

const POLL_MS = 3000

const dotClass: Record<string, string> = {
  success: 'bg-sage',
  warning: 'bg-thread',
  danger: 'bg-rust',
  neutral: 'bg-dust',
  info: 'bg-dust',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
        const data = await getAuditTrail(orderId ? { orderId } : { limit: 30 })
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
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-dust">
        <Spinner /> Loading audit trail...
      </div>
    )
  }

  if (status === 'error') {
    return <div className="py-16 text-center text-sm text-rust">Couldn't load the audit trail. Is the server running?</div>
  }

  if (logs.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-dust">
        {orderId ? 'No audit entries for this order yet.' : 'No activity yet — run the buyer agent or browse the catalog.'}
      </div>
    )
  }

  return (
    <div className="relative pl-6">
      {/* the stitch — a dashed seam running the length of the trail */}
      <div className="absolute bottom-1 left-[7px] top-1 border-l-2 border-dashed border-dust/25" aria-hidden="true" />

      <ul className="space-y-4">
        {logs.map((log) => {
          const isOpen = expanded.has(log.id)
          const hasDetail =
            (log.input && Object.keys(log.input).length > 0) || (log.result && Object.keys(log.result).length > 0)
          const tone = auditActionTone(log.action)

          return (
            <li key={log.id} className="relative">
              <span
                className={`absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-ink ${dotClass[tone]}`}
                aria-hidden="true"
              />
              <div className="rounded-lg border border-dust/15 bg-surface-raised/40 px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={tone}>{log.action.replace(/_/g, ' ')}</Badge>
                    <span className="font-mono text-[11px] text-dust">{log.decision}</span>
                  </div>
                  <span className="font-mono text-[11px] text-dust">{formatTime(log.timestamp)}</span>
                </div>
                <p className="mt-1.5 text-sm text-linen/90">{log.reasoning}</p>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-dust">
                  <span>actor: {log.actor}</span>
                  {hasDetail && (
                    <button type="button" onClick={() => toggle(log.id)} className="underline decoration-dotted hover:text-thread">
                      {isOpen ? 'hide details' : 'show details'}
                    </button>
                  )}
                </div>
                {isOpen && hasDetail && (
                  <pre className="mt-2 overflow-x-auto rounded bg-ink px-3 py-2 font-mono text-[11px] text-dust">
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
