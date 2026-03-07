# Trust Boundaries — Fenrir Ledger

**Owner**: Heimdall
**Last reviewed**: 2026-03-05 (updated for Stripe Direct — Patreon removed)

---

## Overview

Fenrir Ledger has two primary trust zones: the browser (untrusted) and the Next.js
server (trusted). A third zone, Google's infrastructure, is treated as trusted for
OAuth token responses and JWKS key material. A fourth zone, Stripe's infrastructure,
is trusted for payment processing and subscription lifecycle events.

```
┌──────────────────────────────────────────────────────────────┐
│  ZONE 1: Browser (Untrusted)                                 │
│                                                              │
│  - localStorage (accessible to all same-origin scripts)      │
│  - sessionStorage (tab-scoped; accessible to same-origin JS) │
│  - React component state (memory)                            │
│  - URL parameters                                            │
│                                                              │
│  Threat: XSS can read all of localStorage                    │
│  Threat: Compromised dependency (supply chain) can do same   │
└───────────────────────────┬──────────────────────────────────┘
                             │  HTTPS only (HSTS enforced)
        ─────────────────────┼─────────────────── TRUST BOUNDARY A
                             │
┌───────────────────────────▼──────────────────────────────────┐
│  ZONE 2: Next.js Server (Trusted — Vercel Serverless)        │
│                                                              │
│  - process.env (server-only secrets)                         │
│  - API route handlers                                        │
│  - LLM provider (Anthropic/OpenAI via API key)               │
│  - Stripe API client (server-to-server only)                 │
│                                                              │
│  Threat: Server-side code injection (supply chain)           │
│  Threat: SSRF from import pipeline                           │
└───────────────────────────┬──────────────────────────────────┘
                             │  HTTPS only
        ─────────────────────┼─────────────────── TRUST BOUNDARY B
                             │
┌───────────────────────────▼──────────────────────────────────┐
│  ZONE 3: Google Infrastructure (Trusted)                     │
│                                                              │
│  - accounts.google.com (OAuth consent, GIS)                  │
│  - oauth2.googleapis.com (token endpoint)                    │
│  - www.googleapis.com (JWKS)                                 │
│  - sheets.googleapis.com (Sheets API v4)                     │
│  - docs.google.com (Picker iframe, CSV export)               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  ZONE 4: Stripe Infrastructure (Trusted)                     │
│                                                              │
│  - api.stripe.com (Stripe API — server-to-server)            │
│  - checkout.stripe.com (hosted checkout pages)               │
│  - Stripe webhook delivery (HMAC-authenticated)              │
│                                                              │
│  Stripe webhooks arrive at ZONE 2 and are authenticated      │
│  by SHA-256 HMAC before any processing.                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  ZONE 5: Vercel KV / Upstash Redis (Trusted Persistent Store)│
│                                                              │
│  - entitlement:{googleSub}       → StripeEntitlement         │
│  - stripe-customer:{stripeId}    → googleSub (reverse index) │
│                                                              │
│  Accessed only from ZONE 2 (server). Browser has no direct   │
│  access. No user credentials stored in KV.                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Secrets and Their Locations

| Secret | Location | Accessible to Browser? | Notes |
|--------|----------|----------------------|-------|
| `GOOGLE_CLIENT_SECRET` | `process.env` (server) | No | Used only in `/api/auth/token` |
| `FENRIR_ANTHROPIC_API_KEY` | `process.env` (server) | No | Used only in `extract.ts` |
| `FENRIR_OPENAI_API_KEY` | `process.env` (server) | No | Optional; same module |
| `STRIPE_SECRET_KEY` | `process.env` (server) | No | Used only in Stripe API calls (server-side) |
| `STRIPE_WEBHOOK_SECRET` | `process.env` (server) | No | Used only for webhook signature verification |
| `STRIPE_PRICE_ID` | `process.env` (server) | No | Stripe price ID for subscription |
| `KV_REST_API_URL` | `process.env` (server) | No | Vercel KV connection |
| `KV_REST_API_TOKEN` | `process.env` (server) | No | Vercel KV auth token |
| `GOOGLE_PICKER_API_KEY` | `process.env` (server) | Yes — served on request | Auth-gated; GCP referrer restriction required |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `process.env` (public) | Yes — by design | OAuth Client ID is public; embedded in auth URL |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `process.env` (public) | Yes — by design | Stripe publishable key is safe for client exposure |
| Google `access_token` | `localStorage["fenrir:auth"]` | Yes — same-origin JS | XSS risk; ~1-hour TTL |
| Google `id_token` | `localStorage["fenrir:auth"]` | Yes — same-origin JS | XSS risk; used as API Bearer token |
| Google `refresh_token` | `localStorage["fenrir:auth"]` | Yes — same-origin JS | XSS risk; long-lived (no TTL) |
| Drive `access_token` | `localStorage["fenrir:drive-token"]` | Yes — same-origin JS | XSS risk; ~1-hour TTL |
| PKCE `code_verifier` | `sessionStorage["fenrir:pkce"]` | Yes — same-origin JS | Transient; removed after callback |

---

## What Crosses Each Boundary

### Boundary A: Browser → Server

Every request to an API route crosses this boundary. The following data crosses:

**Inbound (browser → server)**:
- `Authorization: Bearer <id_token>` header — on all protected routes
- Request body: `{ url }` or `{ csv }` for import, `{ code, code_verifier, redirect_uri }` for token exchange
- IP address (via `x-forwarded-for`)

**Outbound (server → browser)**:
- Token exchange response: `{ access_token, id_token, expires_in, refresh_token? }`
- Import result: `{ cards: Card[] }` or `{ error: ... }`
- Picker config: `{ pickerApiKey }` — the one server secret served to the browser
- Stripe checkout URL: `{ url: "https://checkout.stripe.com/..." }`
- Membership status: `{ tier, active, platform, ... }` — no secrets

**What must never cross outbound:**
- `GOOGLE_CLIENT_SECRET`
- `FENRIR_ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `KV_REST_API_TOKEN`
- Stack traces
- Internal error messages

### Boundary B: Server → Google

**Outbound (server → Google)**:
- Token exchange: `{ code, code_verifier, redirect_uri, client_id, client_secret, grant_type }`

**Inbound (Google → server)**:
- Token response: `{ access_token, id_token, expires_in, refresh_token? }`
- JWKS public keys (for signature verification)

### Boundary C: Server → Stripe

**Outbound (server → Stripe)**:
- Checkout session creation: `{ customer_email, metadata.googleSub, success_url, cancel_url, price_id }`
- Subscription retrieve: `{ subscription_id }`
- Billing portal session creation: `{ customer_id, return_url }`
- Subscription cancel

**Inbound (Stripe → server)**:
- Checkout session response: `{ id, url }`
- Subscription object
- Webhook events (HMAC-authenticated): `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

---

## localStorage as an Untrusted Store

`localStorage` is **origin-scoped** but not **script-scoped**. Any JavaScript
executing on the same origin (`https://fenrir-ledger.vercel.app`) can read
`localStorage`. This includes:

1. First-party application code (intended)
2. XSS payloads injected via a content injection vulnerability
3. Compromised npm dependencies with access to `window.localStorage`
4. Browser extensions with access to page content (outside Fenrir's control)

### What an XSS payload could steal

A successful XSS attack on fenrir-ledger.vercel.app could read:
- `fenrir:auth` → full Google access token + id_token (valid for ~1 hour)
- `fenrir:drive-token` → Google Drive access token (valid for ~1 hour)
- `fenrir_ledger:{sub}:cards` → all credit card financial metadata
- `fenrir:pkce` → PKCE verifier if XSS fires during OAuth flow (tab-scoped)

Note: Stripe entitlements are NOT in localStorage. They are stored server-side in
Vercel KV and fetched on demand from the API. An XSS payload cannot access entitlement
data directly.

### Mitigations in place

| Mitigation | Status |
|------------|--------|
| Content Security Policy | PASS (`next.config.ts` — includes Google, Stripe, Vercel) |
| X-Frame-Options: DENY | PASS |
| X-Content-Type-Options: nosniff | PASS |
| HSTS (max-age=63072000) | PASS |
| Strict Referrer-Policy | PASS |
| React's default HTML escaping | PASS (protects against reflected XSS) |
| No `dangerouslySetInnerHTML` (verify per PR) | Should verify on each PR |

### Residual risk

- `refresh_token` in localStorage has no enforced TTL — if stolen, an attacker can
  obtain new access tokens indefinitely until the user revokes access in Google's
  account settings.
- Drive access token (`fenrir:drive-token`) is persisted rather than kept in React
  state, widening the XSS window.

---

## Card Data Storage

Card data lives entirely in `localStorage` under per-household keys:

```
fenrir_ledger:{householdId}:cards   → Card[]
fenrir_ledger:{householdId}:household → Household
```

The `householdId` is the Google `sub` claim from the verified `id_token`. This
prevents cross-user data contamination on shared browsers (key namespacing).

**No card data is transmitted to the Fenrir server** except as CSV text during
import, which is processed by the LLM and discarded. Cards returned from the LLM
are stored by the browser; the server holds no persistent card records.

This means:
- There is no server-side authorization for card CRUD operations (they are local)
- An XSS attack can exfiltrate the entire card portfolio
- The application has no server-side audit trail of card data changes

---

## Stripe Entitlement Data

Unlike card data, subscription entitlements are stored server-side in Vercel KV.
The browser fetches the current tier from `/api/stripe/membership` on demand and
caches it in React state only (not localStorage). This means:

- An XSS attack cannot read entitlement data from localStorage
- Entitlement data is protected by the full server trust boundary
- The browser receives only `{ tier, active, platform }` — no Stripe credentials
