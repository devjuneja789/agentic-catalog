# Failure Scenarios

Two failure paths, both handled without crashing and both visible afterward
in the audit trail (`GET /api/audit?orderId=`).

## 1. Out-of-stock mid-flow / duplicate simultaneous request

**The problem.** An agent's catalog query and its checkout call are never
the same request. Stock can change in between — another buyer takes the
last unit, or an admin zeroes it out — and naively trusting a stock number
read a moment earlier lets two checkouts both "win" the same unit.

**The fix.** `verification.service.ts`'s `verifyProduct()` doesn't read
stock and then separately decide whether to allow the order — it performs
one atomic MongoDB operation:

```js
Product.findOneAndUpdate(
  { _id: productId, stock: { $gte: quantity } },
  { $inc: { stock: -quantity } },
  { new: true },
)
```

The `$gte` guard and the `$inc` decrement happen as a single document-level
operation. Of two requests racing for the last unit, only one can ever have
this succeed; the other gets `null` back — not a stale read — and the
checkout controller turns that into:

```json
{ "error": "OUT_OF_STOCK", "message": "Only 0 left in stock, 1 requested.", "productId": "...", "stock": 0, "requested": 1 }
```

with HTTP `409`, logged to the audit trail as a `verify` action with
decision `OUT_OF_STOCK`.

**Reservations that don't complete get released.** Since stock is
decremented at verification time (before payment), every path that doesn't
end in a real sale releases it back via `releaseStock()`:
- guardrail-rejected orders (bound exceeded)
- payment-link creation failures (see below)
- payment links that later expire or get cancelled (via the Razorpay webhook)

Orders sitting in `pending_approval` keep their hold — a human might still
approve them.

**How to trigger it for a demo, two ways:**

- *Manual, via the admin panel:* set a product's stock to 0 while
  a checkout is about to run against it. The next checkout attempt gets
  `409 OUT_OF_STOCK` immediately.
- *Automated, proving the race is actually handled:* set a product's stock
  to 1, then run:
  ```
  cd server
  npm run test:race -- <productId> 5
  ```
  This fires 5 truly concurrent checkout requests (via `Promise.all`, not
  manually-timed curl calls) and reports how many succeeded. Exactly one
  should succeed; the rest should come back `409 OUT_OF_STOCK`. More than
  one succeeding would mean overselling — the script flags that explicitly.

## 2. Razorpay call fails or times out

**The problem.** A third-party payment API call can hang, time out, or
return an error. Without handling, that either crashes the request or
leaves the caller waiting indefinitely.

**The fix.** `razorpay.service.ts` wraps every payment-link creation
attempt in a hard timeout (`RAZORPAY_TIMEOUT_MS`, default 8000ms), and
`createPaymentLinkWithRetry()` retries exactly once on any failure —
network error, timeout, or a Razorpay error response — before giving up.
If both attempts fail, it throws a `PaymentLinkCreationError` carrying both
attempts' messages.

The checkout controller catches that, releases the reserved stock, marks
the order `failed`, and returns a structured fallback:

```json
{ "error": "PAYMENT_LINK_FAILED", "message": "Could not create a Razorpay payment link for this order after retrying once.", "orderId": "..." }
```

with HTTP `502`, logged to the audit trail as a `payment_failed` action —
the log's `result.attempts` field holds both attempts' error messages for
anyone digging into why it failed.

**How to trigger it for a demo:** real network flakiness isn't reliable to
show live, so there's a deliberate escape hatch — set in `server/.env`:

```
RAZORPAY_SIMULATE_FAILURE=true
```

Every payment-link creation will then fail both attempts immediately,
letting you demo the retry + structured-fallback path on demand. Set it
back to `false` (or remove it) for normal operation.
