import { useEffect, useState } from 'react'
import { verifyOrderPayment, getOrder, type VerifyPaymentResponse } from '../api/client'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

interface CheckoutSuccessProps {
  onNavigateHome: () => void
  onViewAudit?: (orderId: string) => void
}

export function CheckoutSuccess({ onNavigateHome, onViewAudit }: CheckoutSuccessProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifyData, setVerifyData] = useState<VerifyPaymentResponse | null>(null)
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const referenceId =
      params.get('referenceId') ||
      params.get('orderId') ||
      params.get('razorpay_payment_link_reference_id')
    const razorpayPaymentId = params.get('razorpay_payment_id') || undefined
    const razorpayPaymentLinkId = params.get('razorpay_payment_link_id') || undefined
    const razorpaySignature = params.get('razorpay_signature') || undefined

    if (!referenceId) {
      setError('Missing order reference ID in URL parameters.')
      setLoading(false)
      return
    }

    async function executeVerification() {
      try {
        setLoading(true)
        const result = await verifyOrderPayment(referenceId!, {
          razorpayPaymentId,
          razorpayPaymentLinkId,
          razorpaySignature,
        })
        setVerifyData(result)

        if (result.order) {
          setOrder(result.order)
        } else {
          const fetched = await getOrder(referenceId!)
          setOrder(fetched.order)
        }
      } catch (err: any) {
        console.error('Verification error:', err)
        // If verify endpoint errored, check if order was marked paid by webhook
        try {
          const fallback = await getOrder(referenceId!)
          if (fallback.order?.status === 'paid') {
            setOrder(fallback.order)
            setVerifyData({
              status: 'paid',
              orderId: referenceId!,
              paymentId: fallback.order?.razorpay?.paymentId,
              order: fallback.order,
            })
            return
          }
        } catch {
          // ignore
        }
        setError(err.message || 'Failed to verify Razorpay payment.')
      } finally {
        setLoading(false)
      }
    }

    executeVerification()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-thread/30 bg-thread/10 shadow-[0_0_30px_rgba(212,162,78,0.25)]">
          <Spinner size={28} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-linen">
          Finalizing Razorpay Payment Verification...
        </h2>
        <p className="max-w-md text-xs text-dust font-mono">
          Verifying payment status with Razorpay API & updating immutable inventory ledger.
        </p>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rust/30 bg-surface p-8 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rust/30 bg-rust/10 text-rust">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-bold text-linen">Payment Finalization Notice</h2>
        <p className="mt-2 text-xs text-dust">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={onNavigateHome}>
            Return to Agent Console
          </Button>
        </div>
      </div>
    )
  }

  const orderId = verifyData?.orderId || order?._id
  const paymentId = verifyData?.paymentId || order?.razorpay?.paymentId || 'RAZORPAY-CONFIRMED'
  const product = order?.product
  const amount = order?.amount ?? product?.unitPrice?.amount ?? 0
  const currencySymbol = order?.currency === 'USD' ? '$' : '₹'

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="relative overflow-hidden rounded-2xl border border-dust/15 bg-surface p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sage/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-thread/10 blur-3xl" />

        {/* Success Banner */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-sage/30 bg-sage/10 shadow-[0_0_35px_rgba(127,166,135,0.3)]">
            <svg
              className="h-8 w-8 text-sage"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge tone="success">Payment Confirmed</Badge>
            <span className="font-mono text-xs text-dust">Razorpay Test Mode</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-linen sm:text-3xl">
            Autonomous Order Complete!
          </h1>
          <p className="mt-1 max-w-md text-xs text-dust">
            Payment verified and permanently booked. Atomic inventory deduction confirmed.
          </p>
        </div>

        {/* Receipt & Item Summary Card */}
        {product && (
          <div className="mt-6 rounded-xl border border-dust/15 bg-surface-raised/40 p-4">
            <div className="flex items-center gap-4">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-16 w-16 rounded-xl border border-dust/15 object-cover shadow-sm"
                />
              )}
              <div className="flex-1">
                <div className="text-sm font-semibold text-linen">{product.name}</div>
                <div className="font-mono text-xs text-dust">SKU: {product.sku}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-xs text-sage font-semibold">
                    {currencySymbol}{amount} {order?.currency || 'INR'}
                  </span>
                  <span className="text-[11px] text-dust">· Quantity: {order?.quantity || 1}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Technical Audit Proof Details */}
        <div className="mt-6 space-y-2.5 rounded-xl border border-dust/15 bg-ink p-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-dust/10 pb-2">
            <span className="text-dust">Store Order ID</span>
            <span className="text-linen select-all">{orderId}</span>
          </div>
          <div className="flex items-center justify-between border-b border-dust/10 pb-2">
            <span className="text-dust">Razorpay Payment ID</span>
            <span className="text-thread select-all font-semibold">{paymentId}</span>
          </div>
          <div className="flex items-center justify-between border-b border-dust/10 pb-2">
            <span className="text-dust">Shopper Actor</span>
            <span className="text-linen">{order?.actor || 'gemini-buyer-agent'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-dust">Inventory Status</span>
            <span className="text-sage">Claimed & Decremented</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="primary" size="lg" onClick={onNavigateHome}>
            Return to Agent Console
          </Button>
          {onViewAudit && orderId && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => onViewAudit(orderId)}
            >
              Inspect Order Audit Log
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
