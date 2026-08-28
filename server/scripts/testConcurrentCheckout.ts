// Fires N concurrent checkout requests at the same product to prove the
// atomic stock reservation in verification.service.ts actually prevents
// overselling under a race, rather than just looking correct on paper.
// Manually firing two curl commands can't reliably land in the same
// millisecond — this uses Promise.all so the requests genuinely overlap.
//
// Usage (from server/, with the dev server already running elsewhere):
//   npm run test:race -- <productId> [concurrency]
//
// Tip: set the target product's stock to 1 first (via MongoDB directly, or
// the Phase 6 admin panel once it exists) so a race is actually possible —
// racing against a product with plenty of stock will just show everyone succeeding.

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:5000/api'

interface CheckoutResult {
  index: number
  status: number
  body: Record<string, unknown>
}

async function main(): Promise<void> {
  const productId = process.argv[2]
  const concurrency = Number(process.argv[3] ?? 2)

  if (!productId) {
    console.error('Usage: npm run test:race -- <productId> [concurrency]')
    console.error("Tip: set the target product's stock to 1 first so a race is actually possible.")
    process.exit(1)
  }

  console.log(`[race-test] Firing ${concurrency} concurrent checkout requests at product ${productId}...`)

  const requests: Promise<CheckoutResult>[] = Array.from({ length: concurrency }, (_, i) =>
    fetch(`${BASE_URL}/checkout/${productId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Actor': `race-test-${i + 1}` },
      body: JSON.stringify({ quantity: 1 }),
    }).then(async (res) => ({ index: i + 1, status: res.status, body: await res.json() })),
  )

  const results = await Promise.all(requests)

  let succeeded = 0
  let outOfStock = 0
  let other = 0

  for (const r of results.sort((a, b) => a.index - b.index)) {
    if (r.status === 201) {
      succeeded++
      console.log(`  #${r.index}: 201 awaiting_payment — orderId ${r.body.orderId}`)
    } else if (r.status === 409 && r.body.error === 'OUT_OF_STOCK') {
      outOfStock++
      console.log(`  #${r.index}: 409 OUT_OF_STOCK — ${r.body.message}`)
    } else {
      other++
      console.log(`  #${r.index}: ${r.status} — ${JSON.stringify(r.body)}`)
    }
  }

  console.log(`\n[race-test] ${succeeded} succeeded, ${outOfStock} rejected as out-of-stock, ${other} other.`)

  if (succeeded > 1) {
    console.log('[race-test] More than one request succeeded for what should have been a single unit — overselling occurred.')
    process.exitCode = 1
  } else if (succeeded === 1) {
    console.log('[race-test] Exactly one request succeeded — atomic stock reservation held under a race.')
  } else {
    console.log('[race-test] No requests succeeded — check the product actually had stock before running this.')
  }
}

main().catch((err) => {
  console.error('[race-test] Failed:', err)
  process.exit(1)
})
