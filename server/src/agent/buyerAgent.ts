import { createInterface } from 'node:readline/promises'
import { generateStructuredJSON } from './llmClient'
import type { CatalogListResponse, ProductOffer } from '../types'

// This plays the role of an external agent (ChatGPT/Perplexity-style)
// hitting the store from outside — it only ever calls this project's own
// public HTTP API (/api/catalog/search, /api/checkout/:id), the same way a
// real third-party agent would. Nothing here reaches into the DB directly.

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5000/api'
const ACTOR = 'gemini-buyer-agent'

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

interface ParsedIntent {
  query: string
  maxPrice?: number
}

interface PickedMatch {
  productId: string
  reasoning: string
}

// --- Step 1: turn the natural-language want into search parameters ---
async function parseIntent(want: string): Promise<ParsedIntent> {
  return generateStructuredJSON<ParsedIntent>({
    systemInstruction:
      "You extract search parameters from a shopper's request for a clothing store's product search API. Be concise and only extract what's actually stated — don't invent constraints the buyer didn't mention.",
    prompt: `Buyer request: "${want}"`,
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "Core product search keywords, e.g. 'black hoodie'. Do not include price constraints here.",
        },
        maxPrice: {
          type: 'integer',
          description: 'Maximum price in INR the buyer mentioned. Omit this field entirely if no price limit was mentioned.',
        },
      },
      required: ['query'],
    },
  })
}

// --- Step 2: call this project's own public search endpoint ---
async function searchCatalog(intent: ParsedIntent): Promise<ProductOffer[]> {
  const params = new URLSearchParams({ q: intent.query })
  if (intent.maxPrice !== undefined) params.set('maxPrice', String(intent.maxPrice))

  const res = await fetch(`${API_BASE}/catalog/search?${params.toString()}`, {
    headers: { 'X-Actor': ACTOR },
  })
  if (!res.ok) throw new Error(`Catalog search failed: ${res.status}`)

  const data = (await res.json()) as CatalogListResponse
  return data.products
}

// --- Step 3: pick the best match via Gemini, given the actual search results ---
async function pickBestMatch(want: string, offers: ProductOffer[]): Promise<PickedMatch> {
  const candidates = offers.map((o) => ({
    id: o.id,
    name: o.name,
    description: o.description,
    category: o.category,
    price: o.price.amount,
    currency: o.price.currency,
    availability: o.availability,
  }))

  return generateStructuredJSON<PickedMatch>({
    systemInstruction:
      'You are an AI shopping agent picking the single best product for a buyer from a short list of real search results. Prefer in_stock or limited_stock items over out_of_stock ones. If nothing reasonably matches the request, return an empty productId.',
    prompt: `Buyer wanted: "${want}"\n\nCandidates:\n${JSON.stringify(candidates, null, 2)}`,
    schema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The id of the chosen product from the candidates list above, or "" if none fit.',
        },
        reasoning: { type: 'string', description: 'One sentence on why this product was chosen.' },
      },
      required: ['productId', 'reasoning'],
    },
  })
}

// --- Step 4: call this project's own public checkout endpoint ---
async function checkout(productId: string, quotedPrice: number): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/checkout/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Actor': ACTOR },
    body: JSON.stringify({ quantity: 1, quotedPrice, actor: ACTOR }),
  })
  const body = (await res.json()) as Record<string, unknown>
  return { status: res.status, body }
}

async function runOnce(want: string): Promise<void> {
  console.log(`\n${c.bold}${c.cyan}🛍️  Buyer wants:${c.reset} "${want}"`)

  console.log(`${c.dim}   → asking Gemini to turn that into a catalog search...${c.reset}`)
  let intent: ParsedIntent
  try {
    intent = await parseIntent(want)
  } catch (err) {
    console.log(`${c.red}   ✗ Couldn't parse the request: ${err instanceof Error ? err.message : String(err)}${c.reset}`)
    return
  }
  const priceNote = intent.maxPrice !== undefined ? `, maxPrice=₹${intent.maxPrice}` : ''
  console.log(`${c.dim}   → GET /api/catalog/search?q=${intent.query}${priceNote}${c.reset}`)

  let offers: ProductOffer[]
  try {
    offers = await searchCatalog(intent)
  } catch (err) {
    console.log(`${c.red}   ✗ Search failed: ${err instanceof Error ? err.message : String(err)}${c.reset}`)
    return
  }

  if (offers.length === 0) {
    console.log(`${c.yellow}   ✗ No matches in the catalog for that.${c.reset}`)
    return
  }
  console.log(`${c.dim}   → ${offers.length} match(es) found${c.reset}`)

  console.log(`${c.dim}   → asking Gemini to pick the best one...${c.reset}`)
  let picked: PickedMatch
  try {
    picked = await pickBestMatch(want, offers)
  } catch (err) {
    console.log(`${c.red}   ✗ Couldn't pick a match: ${err instanceof Error ? err.message : String(err)}${c.reset}`)
    return
  }

  const chosen = offers.find((o) => o.id === picked.productId) ?? offers[0]
  if (picked.productId && !offers.some((o) => o.id === picked.productId)) {
    console.log(`${c.yellow}   ⚠ Gemini picked an id not in the results — falling back to the top match.${c.reset}`)
  }
  console.log(`${c.bold}${c.green}   ✓ Picked: ${chosen.name} — ₹${chosen.price.amount}${c.reset}`)
  console.log(`${c.dim}   → ${picked.reasoning}${c.reset}`)

  console.log(`${c.dim}   → POST /api/checkout/${chosen.id}...${c.reset}`)
  const { status, body } = await checkout(chosen.id, chosen.price.amount)

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
