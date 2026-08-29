# Audit Log Schema

`AuditLog` (`server/src/models/AuditLog.ts`) is written to exclusively
through `audit.service.ts` — see [architecture.md](architecture.md) for why
that matters. This document is the field-by-field reference.

## Fields

| Field | Type | Always present? | Notes |
| --- | --- | --- | --- |
| `timestamp` | `Date` | yes | Set server-side at write time, not client-supplied |
| `actor` | `string` | yes | Who initiated the action — see [Actors](#actors) below |
| `action` | enum (see below) | yes | What kind of step this was |
| `decision` | `string` | yes | The specific outcome — free-form, not an enum, so it can carry codes like `OUT_OF_STOCK` or statuses like `auto_proceed` |
| `reasoning` | `string` | yes | Human-readable explanation, safe to show directly in the dashboard |
| `input` | object | no | What was being evaluated (varies by action) |
| `result` | object | no | What came out of it (varies by action) |
| `orderId` | ObjectId ref `Order` | no | Present from `verify` onward in a checkout; absent for catalog reads |
| `productId` | ObjectId ref `Product` | no | Present whenever a specific product was involved |

## Action taxonomy

Deliberately flat — one entry per *kind* of step, not one per possible
outcome. The outcome lives in `decision`.

| Action | Written by | `decision` values | Meaning |
| --- | --- | --- | --- |
| `query` | catalog controller | `<n>_results`, `found`, `not_found` | A catalog read (list, get, or search) |
| `verify` | checkout controller | `verified`, `INVALID_PRODUCT_ID`, `PRODUCT_NOT_FOUND`, `OUT_OF_STOCK`, `PRICE_MISMATCH` | Stock/price re-check at checkout time |
| `gate` | checkout controller | `auto_proceed`, `pending_approval`, `rejected` | The bound + gate guardrail decision |
| `payment_created` | checkout controller | `success` | Razorpay payment link created |
| `payment_failed` | checkout controller | `failure` | Both Razorpay attempts failed — `result.attempts` holds both error messages |
| `payment_confirmed` | webhook handler | `paid` | Razorpay confirmed payment via webhook |
| `payment_cancelled` | webhook handler | the payment link's Razorpay status (`cancelled`/`expired`) | Payment link abandoned — stock was released, see `result.stockReleased` |
| `catalog_update` | catalog controller (admin) | `updated` | A product was edited from the dashboard |

## Actors

`resolveActor()` in `audit.service.ts` resolves, in order: an `X-Actor`
header, then `body.actor`, then `query.actor`, falling back to
`unknown-agent`. In practice you'll see:

- `gemini-buyer-agent` — the buyer agent, whether run from the CLI or the dashboard
- `razorpay-webhook` — set explicitly by the webhook handler, never resolved from a request
- `catalog-admin` — set by the dashboard's catalog edit calls
- `race-test-N` — set by `scripts/testConcurrentCheckout.ts` for each concurrent request, so a race's individual outcomes are distinguishable in the trail
- `unknown-agent` — anything hitting the API without identifying itself

## Reading the trail

`GET /api/audit?orderId=<id>` returns every entry for one order, **ascending**
by timestamp — read top to bottom as the story of that order.

`GET /api/audit?limit=<n>` (orderId omitted) returns a recent-activity feed
across everything, **descending** by timestamp, capped at 200. This is what
the dashboard shows before any order has been selected.

## Example: a normal paid order

```json
[
  { "action": "query", "decision": "1_results", "reasoning": "Searched the catalog (q=\"black hoodie\", maxPrice=1500, category=any) — 1 matches." },
  { "action": "verify", "decision": "verified", "reasoning": "\"Classic Black Hoodie\" was in stock and 1 unit(s) reserved; price matches the quote." },
  { "action": "gate", "decision": "auto_proceed", "reasoning": "Order amount ₹1499 is within the auto-approval threshold of ₹10000." },
  { "action": "payment_created", "decision": "success", "reasoning": "Razorpay payment link created for ₹1499." },
  { "action": "payment_confirmed", "decision": "paid", "reasoning": "Razorpay confirmed the payment via webhook." }
]
```

## Example: an out-of-stock rejection under a race

```json
[
  { "actor": "race-test-1", "action": "verify", "decision": "verified", "result": { "remainingStock": 0 } },
  { "actor": "race-test-2", "action": "verify", "decision": "OUT_OF_STOCK", "reasoning": "Only 0 left in stock, 1 requested." },
  { "actor": "race-test-3", "action": "verify", "decision": "OUT_OF_STOCK", "reasoning": "Only 0 left in stock, 1 requested." }
]
```

Only one `verify` in a batch like this should ever come back `verified` —
see `npm run test:race` in [failure-scenarios.md](failure-scenarios.md).
