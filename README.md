# Agentic Catalog

An "agent-readable" storefront backend + audit trail: a small e-commerce API
that's built to be browsed and checked out by an AI shopping agent (the kind
of thing ChatGPT/Perplexity-style agentic checkout expects), with bounded and
gated spending and a full audit log of every decision — payments run through
Razorpay in test mode.

> **Status: Phase 5 (simulated AI buyer) complete.** The dashboard lands in
> Phase 6 — see the phase list below.

## Stack

- **Client:** React + TypeScript + Vite + Tailwind CSS
- **Server:** Express + TypeScript + Mongoose (MongoDB)
- **Payments:** Razorpay (test mode)

## Monorepo layout

`client/` and `server/` are npm workspaces, run together from the root.

```
agentic-catalog/
├── client/     React + TS + Tailwind (Vite)
├── server/     Express + TS + Mongoose
└── docs/       architecture notes, audit schema, failure scenarios
```

## Getting started

1. `npm install` — installs the root workspace plus `client` and `server`
2. Copy `.env.example` → `server/.env` and fill in:
   - a MongoDB Atlas connection string
   - Razorpay test-mode API keys
3. Copy the `VITE_API_BASE_URL` line from `.env.example` into `client/.env`
4. `npm run dev` — runs client (http://localhost:5173) and server
   (http://localhost:5000) concurrently
5. Open http://localhost:5173 — you should see a "Server connected" badge,
   confirming the client is reaching the server's `/api/health` endpoint

## Phases

Built incrementally; each phase's code lands before the next starts.

- [x] Phase 0 — Scaffold
- [x] Phase 1 — Catalog (agent-readable product API)
- [x] Phase 2 — Checkout (verify, bound, gate, Razorpay payment links)
- [x] Phase 3 — Audit trail
- [x] Phase 4 — Graceful failure handling
- [x] Phase 5 — Simulated AI buyer agent
- [ ] Phase 6 — Dashboard (catalog admin + buyer console + audit view)
- [ ] Phase 7 — Polish + demo rehearsal

Architecture write-up lands in `docs/architecture.md` in Phase 7.
