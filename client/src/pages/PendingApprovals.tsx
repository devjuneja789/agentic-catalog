import { useEffect, useState } from 'react'
import { getPendingOrders, approveOrder, denyOrder } from '../api/client'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

interface PendingApprovalsProps {
  onOrderUpdated?: () => void
  onNavigateConsole?: () => void
}

export function PendingApprovals({ onOrderUpdated, onNavigateConsole }: PendingApprovalsProps) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, 'approving' | 'denying'>>({})
  const [approvedLinks, setApprovedLinks] = useState<Record<string, string>>({})

  async function loadPending() {
    setLoading(true)
    setError(null)
    try {
      const data = await getPendingOrders()
      setOrders(data.orders)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pending orders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPending()
  }, [])

  async function handleApprove(orderId: string) {
    setActionLoading((prev) => ({ ...prev, [orderId]: 'approving' }))
    try {
      const res = await approveOrder(orderId)
      const link = res.paymentLink || res.paymentLinkUrl
      if (link) {
        setApprovedLinks((prev) => ({ ...prev, [orderId]: link }))
      }
      setOrders((prev) => prev.filter((o) => o._id !== orderId))
      if (onOrderUpdated) onOrderUpdated()
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`)
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })
    }
  }

  async function handleDeny(orderId: string) {
    const reason = prompt('Reason for denying this order (optional):', 'Order rejected by store administrator.')
    if (reason === null) return // cancelled

    setActionLoading((prev) => ({ ...prev, [orderId]: 'denying' }))
    try {
      await denyOrder(orderId, reason)
      setOrders((prev) => prev.filter((o) => o._id !== orderId))
      if (onOrderUpdated) onOrderUpdated()
    } catch (err: any) {
      alert(`Denial failed: ${err.message}`)
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-linen">Human-in-the-Loop Review Queue</h2>
          <p className="text-xs text-dust">
            Transactions requiring approval are held in reserve pending store manager authorization.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadPending} loading={loading}>
          Refresh Queue
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2.5 py-20 text-sm text-dust">
          <Spinner /> Scanning pending approval queue...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rust/20 bg-rust/5 p-6 text-center text-sm text-rust">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && orders.length === 0 && (
        <Card className="text-center py-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sage/30 bg-sage/10 shadow-[0_0_20px_rgba(127,166,135,0.2)]">
            <svg className="h-7 w-7 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-linen">Review Queue is Clear</h3>
          <p className="mt-1 text-xs text-dust max-w-md mx-auto">
            All autonomous transactions have been approved or processed. Trigger a gated scenario from the console to test this workflow.
          </p>
          {onNavigateConsole && (
            <div className="mt-6">
              <Button variant="secondary" size="sm" onClick={onNavigateConsole}>
                Open Agent Console
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Orders List */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((ord) => {
            const isApproving = actionLoading[ord._id] === 'approving'
            const isDenying = actionLoading[ord._id] === 'denying'
            const approvedLink = approvedLinks[ord._id]
            const product = ord.product
            const currencySymbol = ord.currency === 'USD' ? '$' : '₹'

            return (
              <div
                key={ord._id}
                className="overflow-hidden rounded-xl border border-dust/15 bg-surface p-5 shadow-xl backdrop-blur-md transition-all hover:border-thread/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dust/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Badge tone="warning">Pending Review</Badge>
                    <span className="font-mono text-xs text-dust">
                      Order: <span className="text-linen">{ord._id}</span>
                    </span>
                  </div>
                  <span className="font-mono text-xs text-thread">
                    Amount: {currencySymbol}{ord.amount} {ord.currency || 'INR'}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    {product?.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="h-16 w-16 rounded-xl border border-dust/15 object-cover shadow-sm"
                      />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-linen">{product?.name}</div>
                      <div className="font-mono text-xs text-dust">SKU: {product?.sku}</div>
                      <div className="mt-1 text-xs text-dust">
                        Shopper: <span className="font-semibold text-linen">{ord.actor}</span> · Qty: {ord.quantity}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <div className="rounded-lg border border-thread/30 bg-thread/10 px-3 py-1.5 text-[11px] text-thread">
                      ⚠ {ord.guardrailReasoning || 'Exceeds auto-approval threshold'}
                    </div>
                    <div className="text-[10px] text-sage font-mono">
                      ✓ {ord.quantity} unit(s) held in atomic reserve
                    </div>
                  </div>
                </div>

                {/* Inline Approved Payment Link */}
                {approvedLink && (
                  <div className="mt-4 rounded-xl border border-sage/30 bg-sage/10 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-sage">
                        ✓ Order Approved! Razorpay link generated:
                      </span>
                      <a
                        href={approvedLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-thread px-3.5 py-1.5 font-mono text-xs font-semibold text-ink hover:bg-thread-dim"
                      >
                        Open Razorpay Test Checkout →
                      </a>
                    </div>
                  </div>
                )}

                {/* Approval & Denial Controls */}
                {!approvedLink && (
                  <div className="mt-5 flex items-center justify-end gap-3 border-t border-dust/10 pt-4">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isApproving || isDenying}
                      loading={isDenying}
                      onClick={() => handleDeny(ord._id)}
                    >
                      Deny & Release Stock
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isApproving || isDenying}
                      loading={isApproving}
                      onClick={() => handleApprove(ord._id)}
                    >
                      Approve & Issue Razorpay Link
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
