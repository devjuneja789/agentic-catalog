# Architecture

## Overview

See the diagram and one-paragraph summary in the [README](../README.md#architecture)
for the high-level shape. This document goes one level deeper: how a request
actually moves through the system, and why each design decision was made.

## Request walkthroughs

### A catalog read

`GET /api/catalog/search?q=black+hoodie&maxPrice=1500` hits
`catalog.controller.ts`, which builds a Mongo filter (regex `$or` across
name/description/category, plus a `price.amount` range), runs the query,
serializes each result through `toProductOffer()`, and — before responding —
writes one `query` entry to the audit log via `audit.service.ts`. Every
catalog endpoint (list, get-by-id, search) follows this same
query-then-log-then-respond shape.

### A checkout

`POST /api/checkout/:productId` is the one endpoint with real sequencing:

1. **Verify** (`verification.service.ts`) — re-checks the product exists,
   the quoted price still matches, and atomically reserves stock via a
   single `findOneAndUpdate({ stock: { $gte: quantity } }, { $inc: { stock: -quantity } })`.
   This is a single document-level MongoDB operation, not a read followed by
   a separate write — see [failure-scenarios.md](failure-scenarios.md) for
   why that distinction is what actually prevents overselling.
2. **Gate** (`guardrails.service.ts`) — given the now-verified amount,
   decides `auto_proceed` / `pending_approval` / `rejected` against
   `MAX_ORDER_VALUE` and `APPROVAL_THRESHOLD`. An `Order` document is created
   here regardless of outcome, so rejections and holds still have a record.
3. **Pay** (`razorpay.service.ts`) — only reached on `auto_proceed`. Creates
   a Razorpay test-mode payment link with a hard timeout and a single retry.
4. **Release on anything that doesn't complete** — a rejected order, a
   failed payment-link creation, or (later) a payment link that expires or
   gets cancelled via the webhook all call `releaseStock()` to give the
   reserved units back. `pending_approval` orders are the one exception —
   they keep their hold since a human might still approve them.

Every one of those four steps writes to the audit log before or immediately
after responding — `verify`, `gate`, `payment_created`/`payment_failed`, and
later `payment_confirmed`/`payment_cancelled` from the webhook.

### The buyer agent

`agent/buyerAgentFlow.ts` is a pure function (`runBuyerAgentFlow`) with no
console output, used by both the CLI (`agent/buyerAgent.ts`) and the
dashboard's `POST /api/agent/buy` (`agent.controller.ts`). The dashboard
collects and validates a customer name, which the flow forwards to checkout
for payment-link creation. It then does four things, in order: ask Gemini to turn the natural-language want into
`{query, maxPrice}`, call this server's own `GET /api/catalog/search` over
real HTTP, ask Gemini to pick the best match from the actual results
(falling back to the top match if Gemini ever returns an id not in the
list), then call this server's own `POST /api/checkout/:id`. It deliberately
never touches Mongoose models directly — the point of the exercise is that
an external agent could do exactly what this script does, using nothing but
the public API.

## Design decisions worth explaining

**Why the ACP/AP2-loose response shape.** `ProductOffer` (`id`, `name`,
`price: {amount, currency}`, `availability`, `seller`, ...) isn't a full
ACP/AP2 implementation, but it's close enough that an agent already familiar
with that shape needs no bespoke parsing to use this API. If a judge asks
"why this shape," that's the answer.

**Why atomic reservation instead of a stock check + separate decrement.**
Two requests reading `stock: 1` a millisecond apart would both conclude
"available" under a naive read-then-write. A single `findOneAndUpdate` with
the stock guard baked into the query condition means MongoDB itself
serializes the decision — only one request can ever see it succeed.

**Why verification, guardrails, and audit logging are each a single
service file.** So there's exactly one place to point at for "where's the
bound/gate logic" or "where does every action get logged" — not logic
scattered across controllers where it's easy for a new endpoint to
accidentally skip a step.

**Why audit logging swallows its own errors.** `logAudit()` never throws —
a failed audit write is a bug to go fix, not a reason to fail someone's
checkout. For example, with no DB connected,
an audit write timed out after several seconds and the checkout still
completed correctly afterward.

**Why the buyer agent calls its own public API instead of internal
functions.** It would be faster to call the Mongoose models directly. It
would also prove nothing — the purpose is demonstrating that
an external agent, with no special access, can browse and buy through the
same HTTP surface. Routing through real HTTP calls (whether from the CLI or
the dashboard's "Run" button) means the demo is evidence, not a shortcut
that only looks like one.

**Why `RAZORPAY_SIMULATE_FAILURE` and the concurrent test script exist.**
Two of this project's most important properties — atomic stock reservation
under a race, and graceful handling of a failed payment call — are both hard
to trigger reliably on demand from real-world conditions. Rather than hoping
a live demo happens to hit them, both have a deterministic trigger:
`npm run test:race` fires genuinely concurrent requests via `Promise.all`,
and `RAZORPAY_SIMULATE_FAILURE=true` forces the retry-and-fail path on
command.

## Known limitations

See the [README](../README.md#known-limitations) — no auth on admin
endpoints, no approve/deny endpoint for `pending_approval` orders, and the
buyer agent's dashboard integration is request/response rather than
streaming. All deliberate scope cuts for a project at this stage, not
oversights.
