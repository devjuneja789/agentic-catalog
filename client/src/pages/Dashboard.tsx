import { useState } from 'react'
import { BuyerAgentConsole } from '../components/BuyerAgentConsole'
import { AuditTrail } from '../components/AuditTrail'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function Dashboard({
  initialOrderId,
  onOrderCreated,
}: {
  initialOrderId?: string
  onOrderCreated?: (orderId: string) => void
} = {}) {
  const [orderId, setOrderId] = useState<string | undefined>(initialOrderId)

  function handleOrderCreated(id: string) {
    setOrderId(id)
    if (onOrderCreated) onOrderCreated(id)
  }

  return (
    <div className="space-y-6">
      {/* Top Architecture Metric Pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[0.07] bg-surface/80 p-3.5 backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-dust">
            AI Buyer Model
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-linen">
            <span className="h-2 w-2 rounded-full bg-thread shadow-[0_0_8px_#3395FF]" />
            Gemini AI
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-surface/80 p-3.5 backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-dust">
            Payment Gateway
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-thread">
            <span className="h-2 w-2 rounded-full bg-thread shadow-[0_0_8px_#3395FF]" />
            Razorpay Test Mode
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-surface/80 p-3.5 backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-dust">
            Guardrail Threshold
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-amber">
            <span className="h-2 w-2 rounded-full bg-amber shadow-[0_0_8px_#F59E0B]" />
            ₹10k Gate / ₹50k Max
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-surface/80 p-3.5 backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-dust">
            Stock Concurrency
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-sage">
            <span className="h-2 w-2 rounded-full bg-sage shadow-[0_0_8px_#10B981]" />
            Atomic MongoDB Locks
          </div>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Buyer Agent Console (7 cols) */}
        <div className="lg:col-span-7">
          <Card
            title={
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-thread shadow-[0_0_6px_#3395FF]" />
                <span>Autonomous Shopping Agent</span>
              </div>
            }
          >
            <BuyerAgentConsole onOrderCreated={handleOrderCreated} />
          </Card>
        </div>

        {/* Right Column: Live Decision Audit Trail (5 cols) */}
        <div className="lg:col-span-5">
          <Card
            title={
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sage shadow-[0_0_6px_#10B981] animate-pulse" />
                <span>Real-Time Audit Stream</span>
              </div>
            }
            action={
              orderId ? (
                <Button variant="ghost" size="sm" onClick={() => setOrderId(undefined)}>
                  Clear order filter
                </Button>
              ) : undefined
            }
          >
            {orderId && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-thread/30 bg-thread/10 px-3 py-1.5 font-mono text-xs text-thread">
                <span>Filter: Order {orderId}</span>
                <span className="text-[10px] text-dust">showing targeted trail</span>
              </div>
            )}
            <AuditTrail orderId={orderId} />
          </Card>
        </div>
      </div>
    </div>
  )
}
