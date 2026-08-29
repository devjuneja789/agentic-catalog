# Demo Script

A rehearsed walkthrough: normal flow → trigger out-of-stock → trigger a
payment failure → point at the audit trail. Roughly 4 minutes end to end;
trim step 3 if you're short on time, it's the one clearly marked optional.

## Before judges arrive

- [ ] `npm run dev` running, both client and server up
- [ ] Server logs show `[db] Connected to MongoDB` — no `MONGODB_URI is not set` warning
- [ ] Catalog seeded (`npm run seed` if you're not sure it's current)
- [ ] `RAZORPAY_SIMULATE_FAILURE=false` in `server/.env` — reset this now if you tested the failure path recently, it's easy to forget
- [ ] Webhook set up via ngrok if you want the "flips to paid live" moment (optional — see [README setup](../README.md#getting-started))
- [ ] Dashboard open at `localhost:5173`, a second browser tab on Catalog Admin
- [ ] A terminal window visible alongside the browser, `cd`'d into `server/`
- [ ] Pick two products ahead of time and note their names: one for the normal flow, a **different** one you'll zero out later — don't zero it yet

## 1. Normal flow (~90s)

On the Dashboard, in the Buyer Agent console, enter a customer name and type
your chosen product's natural-language description — the exact example from
the spec works well:

```
black hoodie under ₹1500
```

Hit **Run**. Narrate as the step tracker lights up: *parse → search → pick →
checkout*. When it resolves:

- Point at the picked product card — name, price, and Gemini's one-line
  reasoning for why it chose that item
- Point at the `HTTP 201` result and the payment link
- Point at the **Audit Trail** panel on the right — it's already scoped to
  this order, showing `query → verify → gate → payment_created` in order

Click the payment link, complete it with a Razorpay test card in the new
tab, then switch back. Within ~3 seconds (it polls) the audit trail should
show a new `payment_confirmed` entry appear on its own — no refresh needed.
This is the moment that sells "live," so give it a beat.

## 2. Trigger: out-of-stock (~60s)

Switch to **Catalog Admin**. Find your second chosen product and click the
small **zero** link next to its stock — confirm it shows `0` and the
availability badge flips to `out of stock`.

Back on Dashboard, run the buyer agent asking for that exact product. It
should come back with a clean `409 OUT_OF_STOCK` in the console — not a
crash, not a hang.

**To prove this is a real concurrency guarantee, not a lucky demo:** in the
terminal, set some other product's stock to `1` via Catalog Admin, then run:

```
npm run test:race -- <productId> 5
```

Narrate: this fires 5 genuinely concurrent checkout requests. Exactly one
should come back `201`, the rest `409 OUT_OF_STOCK`. If more than one
succeeded, the script says so explicitly — that would mean overselling. It
won't, but saying that out loud is the point.

## 3. Trigger: payment failure (~45s, optional if short on time)

In `server/.env`, set:

```
RAZORPAY_SIMULATE_FAILURE=true
```

Restart the server. Run the buyer agent again with any normal request.
Expect `502 PAYMENT_LINK_FAILED` after a short pause (both retry attempts
ran). Open that entry's **show details** in the audit trail — `result.attempts`
holds both attempts' actual error messages, not a generic failure string.

Set `RAZORPAY_SIMULATE_FAILURE` back to `false` and restart before moving on
— easy to forget, and it'll silently break every checkout afterward if left on.

## 4. Point at the audit trail (~20s)

Back on Dashboard, click **Show all activity**. This is the closing point:
every decision from the last few minutes — successful or not, auto-approved
or rejected, human-triggered or agent-triggered — is timestamped, attributed
to an actor, and explained in plain language. That's the trust layer that
makes autonomous agent commerce auditable, and it's what you hand a judge
who asks "how do I know the agent didn't just make this up."

## If something goes wrong live

- **Gemini is slow or errors:** the CLI (`npm run agent -- "..."`) hits the
  same backend and is a fine fallback to narrate from a terminal instead of
  the browser.
- **Webhook/ngrok isn't cooperating:** skip the "watch it flip to paid live"
  beat in step 1 — the payment link itself still generates and that's the
  more important proof point.
- **Lost track of a product's stock mid-rehearsal:** `npm run seed` resets
  everything to a known state in a few seconds.
- **A checkout hangs unexpectedly:** check `RAZORPAY_SIMULATE_FAILURE` isn't
  still `true` from a previous test — this is the most common self-inflicted
  issue.
