import { generateStructuredJSON } from './llmClient'
import type { BuyerAgentResult, CatalogListResponse, ProductOffer } from '../types'

// This plays the role of an external agent (ChatGPT/Perplexity-style)
// hitting the store from outside — it only ever calls this project's own
// public HTTP API (/api/catalog/search, /api/checkout/:id), the same way a
// real third-party agent would, whether it's triggered from the CLI
// (buyerAgent.ts) or from the dashboard (agent.controller.ts).

const ACTOR = 'gemini-buyer-agent'

interface ParsedIntent {
  query: string
  maxPrice?: number
}

interface PickedMatch {
  productId: string
  reasoning: string
}

export type BuyerAgentProgressEvent =
  | { step: 'parsing' }
  | { step: 'searching'; intent: ParsedIntent }
  | { step: 'picking'; offers: ProductOffer[] }
  | { step: 'checking_out'; chosen: ProductOffer }

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

async function searchCatalog(apiBase: string, intent: ParsedIntent): Promise<ProductOffer[]> {
  const params = new URLSearchParams({ q: intent.query })
  if (intent.maxPrice !== undefined) params.set('maxPrice', String(intent.maxPrice))

  const res = await fetch(`${apiBase}/catalog/search?${params.toString()}`, {
    headers: { 'X-Actor': ACTOR },
  })
  if (!res.ok) throw new Error(`Catalog search failed: ${res.status}`)

  const data = (await res.json()) as CatalogListResponse
  return data.products
}

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

async function checkout(
  apiBase: string,
  productId: string,
  quotedPrice: number,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${apiBase}/checkout/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Actor': ACTOR },
    body: JSON.stringify({ quantity: 1, quotedPrice, actor: ACTOR }),
  })
  const body = (await res.json()) as Record<string, unknown>
  return { status: res.status, body }
}

// The single entrypoint both the CLI and POST /api/agent/buy call.
export async function runBuyerAgentFlow(
  want: string,
  apiBase: string,
  onProgress?: (event: BuyerAgentProgressEvent) => void,
): Promise<BuyerAgentResult> {
  onProgress?.({ step: 'parsing' })
  let intent: ParsedIntent
  try {
    intent = await parseIntent(want)
  } catch (err) {
    return { want, error: err instanceof Error ? err.message : String(err), stoppedAt: 'parse_intent' }
  }

  onProgress?.({ step: 'searching', intent })
  let offers: ProductOffer[]
  try {
    offers = await searchCatalog(apiBase, intent)
  } catch (err) {
    return { want, intent, error: err instanceof Error ? err.message : String(err), stoppedAt: 'search' }
  }

  if (offers.length === 0) {
    return { want, intent, offers, error: 'No matches in the catalog for that.', stoppedAt: 'no_matches' }
  }

  onProgress?.({ step: 'picking', offers })
  let picked: PickedMatch
  try {
    picked = await pickBestMatch(want, offers)
  } catch (err) {
    return { want, intent, offers, error: err instanceof Error ? err.message : String(err), stoppedAt: 'pick_match' }
  }

  const fellBack = !!picked.productId && !offers.some((o) => o.id === picked.productId)
  const chosen = offers.find((o) => o.id === picked.productId) ?? offers[0]

  onProgress?.({ step: 'checking_out', chosen })
  const { status, body } = await checkout(apiBase, chosen.id, chosen.price.amount)

  return {
    want,
    intent,
    offers,
    picked: { productId: chosen.id, reasoning: picked.reasoning, fellBack },
    checkout: { status, body },
  }
}
