import { createInterface } from 'node:readline/promises'
import { runBuyerAgentFlow } from './buyerAgentFlow'
import type { BuyerAgentResult } from '../types'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5000/api'

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

async function runOnce(want: string): Promise<void> {
  console.log(`\n${c.bold}${c.cyan}🛍️  Buyer wants:${c.reset} "${want}"`)

  const result: BuyerAgentResult = await runBuyerAgentFlow(want, API_BASE, (event) => {
    switch (event.step) {
      case 'parsing':
        console.log(`${c.dim}   → asking Gemini to turn that into a catalog search...${c.reset}`)
        break
      case 'searching': {
        const priceNote = event.intent.maxPrice !== undefined ? `, maxPrice=₹${event.intent.maxPrice}` : ''
        console.log(`${c.dim}   → GET /api/catalog/search?q=${event.intent.query}${priceNote}${c.reset}`)
        break
      }
      case 'picking':
        console.log(`${c.dim}   → ${event.offers.length} match(es) found — asking Gemini to pick the best one...${c.reset}`)
        break
      case 'checking_out':
        console.log(`${c.dim}   → POST /api/checkout/${event.chosen.id}...${c.reset}`)
        break
    }
  })

  if (result.stoppedAt === 'parse_intent') {
    console.log(`${c.red}   ✗ Couldn't parse the request: ${result.error}${c.reset}`)
    return
  }
  if (result.stoppedAt === 'search') {
    console.log(`${c.red}   ✗ Search failed: ${result.error}${c.reset}`)
    return
  }
  if (result.stoppedAt === 'no_matches') {
    console.log(`${c.yellow}   ✗ No matches in the catalog for that.${c.reset}`)
    return
  }
  if (result.stoppedAt === 'pick_match') {
    console.log(`${c.red}   ✗ Couldn't pick a match: ${result.error}${c.reset}`)
    return
  }

  if (!result.picked || !result.offers || !result.checkout) return // unreachable, keeps TS happy

  const chosen = result.offers.find((o) => o.id === result.picked?.productId)
  if (result.picked.fellBack) {
    console.log(`${c.yellow}   ⚠ Gemini picked an id not in the results — falling back to the top match.${c.reset}`)
  }
  if (chosen) {
    console.log(`${c.bold}${c.green}   ✓ Picked: ${chosen.name} — ₹${chosen.price.amount}${c.reset}`)
  }
  console.log(`${c.dim}   → ${result.picked.reasoning}${c.reset}`)

  const { status, body } = result.checkout
  switch (status) {
    case 201:
      console.log(`${c.bold}${c.green}   ✓ Payment link created!${c.reset}`)
      console.log(`     ${body.paymentLink}`)
      console.log(`${c.dim}     order ${body.orderId} — ₹${body.amount}${c.reset}`)
      break
    case 202:
      console.log(`${c.yellow}   ⏳ Held for approval: ${body.message}${c.reset}`)
      console.log(`${c.dim}     order ${body.orderId}${c.reset}`)
      break
    case 409:
      console.log(`${c.red}   ✗ ${body.error}: ${body.message}${c.reset}`)
      break
    case 422:
      console.log(`${c.red}   ✗ Rejected — exceeds max order value: ${body.message}${c.reset}`)
      break
    case 502:
      console.log(`${c.red}   ✗ Payment link failed after retry: ${body.message}${c.reset}`)
      break
    default:
      console.log(`${c.red}   ✗ ${status}: ${JSON.stringify(body)}${c.reset}`)
  }

  if (typeof body.orderId === 'string') {
    console.log(`${c.dim}     audit trail: GET /api/audit?orderId=${body.orderId}${c.reset}`)
  }
}

async function main(): Promise<void> {
  const oneShotWant = process.argv.slice(2).join(' ').trim()

  if (oneShotWant) {
    await runOnce(oneShotWant)
    return
  }

  console.log(`${c.bold}Studio Loom buyer agent (Gemini-powered)${c.reset}`)
  console.log(`${c.dim}Type what you're looking for, or "exit" to quit.${c.reset}`)

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const want = (await rl.question(`\n${c.cyan}> ${c.reset}`)).trim()
      if (!want || ['exit', 'quit'].includes(want.toLowerCase())) break
      await runOnce(want)
    }
  } finally {
    rl.close()
  }
}

main().catch((err) => {
  console.error('[buyer-agent] Fatal error:', err)
  process.exit(1)
})
