import { useState } from 'react'
import { runBuyerAgent } from '../api/client'
import type { BuyerAgentResult } from '../types'
import { Badge, type Tone } from './ui/Badge'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Spinner } from './ui/Spinner'

type StepStatus = 'pending' | 'done' | 'error' | 'skipped'

interface Step {
  key: string
  label: string
  status: StepStatus
}

function computeSteps(result: BuyerAgentResult | null): Step[] {
  const steps: Step[] = [
    { key: 'parse', label: 'Parse want', status: 'pending' },
    { key: 'search', label: 'Search catalog', status: 'pending' },
    { key: 'pick', label: 'Pick match', status: 'pending' },
    { key: 'checkout', label: 'Checkout', status: 'pending' },
  ]
  if (!result) return steps

  steps[0].status = result.stoppedAt === 'parse_intent' ? 'error' : 'done'
  if (steps[0].status === 'error') {
    steps[1].status = steps[2].status = steps[3].status = 'skipped'
    return steps
  }

  if (result.stoppedAt === 'search' || result.stoppedAt === 'no_matches') {
    steps[1].status = 'error'
    steps[2].status = steps[3].status = 'skipped'
    return steps
  }
  steps[1].status = 'done'

  if (result.stoppedAt === 'pick_match') {
    steps[2].status = 'error'
    steps[3].status = 'skipped'
    return steps
  }
  steps[2].status = 'done'

  steps[3].status = result.checkout ? 'done' : 'skipped'
  return steps
}

function checkoutOutcomeTone(status: number): Tone {
  if (status === 201) return 'success'
  if (status === 202) return 'warning'
  return 'danger'
}

const stepClass: Record<StepStatus, string> = {
  done: 'bg-sage/15 text-sage',
  error: 'bg-rust/15 text-rust',
  skipped: 'bg-dust/5 text-dust/40',
  pending: 'bg-surface-raised text-dust',
}

export function BuyerAgentConsole({ onOrderCreated }: { onOrderCreated?: (orderId: string) => void }) {
  const [want, setWant] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BuyerAgentResult | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  async function run() {
    if (!want.trim() || !customerName.trim() || running) return
    setRunning(true)
    setFatalError(null)
    setResult(null)
    try {
      const data = await runBuyerAgent(want.trim(), customerName.trim())
      setResult(data)
      const orderId = data.checkout?.body.orderId
      if (typeof orderId === 'string' && onOrderCreated) onOrderCreated(orderId)
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setRunning(false)
    }
  }

  const steps = computeSteps(result)
  const chosen = result?.offers?.find((o) => o.id === result.picked?.productId)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder='e.g. "black hoodie under ₹1500"'
          value={want}
          onChange={(e) => setWant(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          disabled={running}
        />
        <Input
          placeholder="Customer name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          disabled={running}
        />
        <Button onClick={run} loading={running} disabled={!want.trim() || !customerName.trim()}>
          Run
        </Button>
      </div>

      <ol className="flex items-center gap-1.5">
        {steps.map((step, i) => (
          <li key={step.key} className="flex flex-1 items-center gap-1.5">
            <div
              className={`flex h-7 flex-1 items-center justify-center rounded text-center text-[10px] font-medium uppercase tracking-wide ${
                running && step.status === 'pending' ? 'bg-thread/10 text-thread' : stepClass[step.status]
              }`}
            >
              {step.label}
            </div>
            {i < steps.length - 1 && <span className="text-dust/30">→</span>}
          </li>
        ))}
      </ol>

      {running && (
        <div className="flex items-center gap-2 text-sm text-dust">
          <Spinner /> Gemini is working through the request...
        </div>
      )}

      {fatalError && <div className="rounded-lg border border-rust/30 bg-rust/10 px-3.5 py-3 text-sm text-rust">{fatalError}</div>}

      {result && (
        <div className="space-y-3">
          {result.intent && (
            <div className="text-xs text-dust">
              searched: <span className="font-mono text-linen">q="{result.intent.query}"</span>
              {result.intent.maxPrice !== undefined && (
                <span className="font-mono text-linen"> maxPrice=₹{result.intent.maxPrice}</span>
              )}
              {result.offers && <span> — {result.offers.length} match(es)</span>}
            </div>
          )}

          {result.error && (
            <div className="rounded-lg border border-rust/30 bg-rust/10 px-3.5 py-3 text-sm text-rust">{result.error}</div>
          )}

          {chosen && result.picked && (
            <div className="rounded-lg border border-dust/15 bg-surface-raised/40 px-3.5 py-3">
              <div className="flex items-center gap-3">
                <img src={chosen.imageUrl} alt="" className="h-12 w-12 rounded-md bg-surface object-cover" />
                <div>
                  <div className="font-medium text-linen">{chosen.name}</div>
                  <div className="font-mono text-xs text-dust">₹{chosen.price.amount}</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-dust">{result.picked.reasoning}</p>
              {result.picked.fellBack && (
                <p className="mt-1 text-[11px] text-thread">⚠ Gemini's pick wasn't in the results — fell back to the top match.</p>
              )}
            </div>
          )}

          {result.checkout && (
            <div className="rounded-lg border border-dust/15 bg-surface-raised/40 px-3.5 py-3">
              <div className="flex items-center justify-between">
                <Badge tone={checkoutOutcomeTone(result.checkout.status)}>HTTP {result.checkout.status}</Badge>
                {typeof result.checkout.body.orderId === 'string' && (
                  <span className="font-mono text-[11px] text-dust">order {result.checkout.body.orderId}</span>
                )}
              </div>

              {result.checkout.status === 201 && typeof result.checkout.body.amount === 'number' && (
                <p className="mt-2 text-sm text-linen/90">Payment link created for ₹{result.checkout.body.amount}.</p>
              )}
              {result.checkout.status !== 201 && (
                <p className="mt-2 text-sm text-linen/90">
                  {typeof result.checkout.body.error === 'string' && typeof result.checkout.body.message === 'string'
                    ? `${result.checkout.body.error}: ${result.checkout.body.message}`
                    : typeof result.checkout.body.message === 'string'
                      ? result.checkout.body.message
                      : null}
                </p>
              )}

              {typeof result.checkout.body.paymentLink === 'string' && (
                <a
                  href={result.checkout.body.paymentLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block break-all font-mono text-xs text-thread underline"
                >
                  {result.checkout.body.paymentLink}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
