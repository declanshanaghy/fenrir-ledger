# QA Handoff: Stripe Foundation + API Routes (Story 1)

**Branch:** `feat/stripe-foundation`
**Date:** 2026-03-04
**Engineer:** FiremanDecko

## What Was Implemented

Stripe Direct integration foundation -- SDK, library modules, KV store extensions, and all 5 API routes.

### Files Created

| File | Description |
|------|-------------|
| `src/lib/stripe/api.ts` | Lazy singleton Stripe SDK client (deferred init for build safety) |
| `src/lib/stripe/types.ts` | Stripe entitlement types, tier mapping, API response types |
| `src/lib/stripe/webhook.ts` | Webhook signature verification + entitlement builders |
| `src/app/api/stripe/checkout/route.ts` | POST: create Checkout Session, return URL |
| `src/app/api/stripe/webhook/route.ts` | POST: verify signature, process 3 event types |
| `src/app/api/stripe/membership/route.ts` | GET: return cached entitlement from KV |
| `src/app/api/stripe/portal/route.ts` | POST: create Customer Portal session, return URL |
| `src/app/api/stripe/unlink/route.ts` | POST: cancel subscription + delete KV record |
| `designs/architecture/adr-010-stripe-direct.md` | Architecture decision record |

### Files Modified

| File | Change |
|------|--------|
| `package.json` | Added `stripe` dependency |
| `src/lib/kv/entitlement-store.ts` | Added Stripe KV ops: getStripeEntitlement, setStripeEntitlement, deleteStripeEntitlement, getGoogleSubByStripeCustomerId |
| `.env.example` | Added Stripe environment variable placeholders |

## How to Deploy / Test

### Prerequisites
1. Set `SUBSCRIPTION_PLATFORM=stripe` in `.env.local`
2. Add real Stripe keys to `.env.local`:
   - `STRIPE_SECRET_KEY=sk_test_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
   - `STRIPE_PRICE_ID=price_...`
3. Ensure Vercel KV credentials are configured (`KV_REST_API_URL`, `KV_REST_API_TOKEN`)

### Dev Server
```bash
cd development/frontend && npm run dev
```
Port: 9655 (worktree) or 9653 (main)

### Testing Routes

All routes except webhook require Bearer auth (Google id_token):
```
Authorization: Bearer <google_id_token>
```

**Checkout:**
```bash
curl -X POST http://localhost:9655/api/stripe/checkout \
  -H "Authorization: Bearer <token>"
# Returns: { "url": "https://checkout.stripe.com/..." }
```

**Membership:**
```bash
curl http://localhost:9655/api/stripe/membership \
  -H "Authorization: Bearer <token>"
# Returns: { "tier": "thrall", "active": false, "platform": "stripe", ... }
```

**Portal:**
```bash
curl -X POST http://localhost:9655/api/stripe/portal \
  -H "Authorization: Bearer <token>"
# Returns: { "url": "https://billing.stripe.com/..." }
# Requires existing entitlement (returns 404 if no subscription)
```

**Unlink:**
```bash
curl -X POST http://localhost:9655/api/stripe/unlink \
  -H "Authorization: Bearer <token>"
# Returns: { "success": true }
```

**Webhook (use Stripe CLI):**
```bash
stripe listen --forward-to http://localhost:9655/api/stripe/webhook
stripe trigger checkout.session.completed
```

### Feature Flag Behavior
- When `SUBSCRIPTION_PLATFORM=patreon`: all `/api/stripe/*` routes return 404
- When `SUBSCRIPTION_PLATFORM=stripe`: all `/api/patreon/*` routes return 404

## Build Validation

```bash
cd development/frontend
npx tsc --noEmit   # PASS (verified)
npx next build     # PASS (verified)
```

## Known Limitations
- Placeholder env vars -- Odin must provide real Stripe keys before testing
- No frontend UI yet -- this is the backend foundation only
- Webhook testing requires either Stripe CLI or a public URL (ngrok/Vercel preview)
- No migration path from Patreon entitlements to Stripe (by design -- users re-subscribe)

## Suggested Test Focus Areas
1. Feature flag guard: verify Stripe routes return 404 when `SUBSCRIPTION_PLATFORM=patreon`
2. Auth guard: verify all routes except webhook return 401 without Bearer token
3. Webhook signature: verify invalid signatures are rejected (400)
4. Checkout flow: verify session URL is returned with correct metadata
5. KV operations: verify entitlements are stored/retrieved/deleted correctly
6. Rate limiting: verify excessive requests are throttled (429)
