import { useEffect } from 'react'
import { cancelOrder } from '../api/client'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

interface CheckoutCancelProps {
  onNavigateHome: () => void
  onNavigateCatalog?: () => void
}

export function CheckoutCancel({ onNavigateHome, onNavigateCatalog }: CheckoutCancelProps) {
  const params = new URLSearchParams(window.location.search)
  const referenceId = params.get('referenceId') || params.get('orderId')

  useEffect(() => {
    if (referenceId) {
      cancelOrder(referenceId, 'Shopper navigated to cancel page.').catch(() => {})
    }
  }, [referenceId])

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="relative overflow-hidden rounded-2xl border border-dust/15 bg-surface p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-thread/30 bg-thread/10 shadow-[0_0_25px_rgba(212,162,78,0.2)]">
          <svg className="h-8 w-8 text-thread" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <Badge tone="warning">Transaction Aborted</Badge>
          <span className="font-mono text-xs text-dust">Razorpay Checkout</span>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-linen">
          Checkout Was Cancelled
        </h1>
        <p className="mt-2 text-xs text-dust max-w-md mx-auto leading-relaxed">
          The payment checkout session was closed without completing payment. No funds were debited from your account.
        </p>

        {referenceId && (
          <div className="mt-5 rounded-xl border border-dust/15 bg-ink p-3 font-mono text-xs text-dust">
            Reference Order ID: <span className="text-linen select-all">{referenceId}</span>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-sage/20 bg-sage/5 p-3 text-xs text-sage font-mono">
          ✓ Temporary stock reservation was safely released back to the catalog.
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="primary" onClick={onNavigateHome}>
            Back to Agent Console
          </Button>
          {onNavigateCatalog && (
            <Button variant="secondary" onClick={onNavigateCatalog}>
              Browse Catalog
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
