# Route Ownership — Fenrir Ledger

**Date:** 2026-03-01 (updated: 2026-03-07 — added Stripe and picker routes; 2026-03-20 — Redis removed, Firestore is entitlement store)
**Author:** FiremanDecko (Principal Engineer)
**Related:** ADR-008: `adrs/ADR-008-api-auth.md`, ADR-010: `adrs/ADR-010-stripe-direct.md`, ADR-014: `adrs/ADR-014-firestore-cloud-sync.md`

## Route Placement

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/` (app routes) | GET | None (anonymous-first) | All UI pages (dashboard, cards, valhalla, auth) |
| `POST /api/auth/token` | POST | None (token exchange) | Google OAuth2 PKCE token exchange proxy — exempt from requireAuth by design |
| `GET /api/config/picker` | GET | requireAuth | Serve Google Picker API key to authenticated clients |
| `POST /api/sheets/import` | POST | requireAuth | Import pipeline: fetch CSV + Anthropic call + Zod validation (`maxDuration = 60`) |
| `POST /api/stripe/checkout` | POST | requireAuth | Create Stripe Checkout session, return redirect URL |
| `POST /api/stripe/webhook` | POST | Stripe signature only | Process Stripe webhook events — no Bearer auth, secured by SHA-256 HMAC |
| `GET /api/stripe/membership` | GET | requireAuth | Return Stripe entitlement from Firestore |
| `POST /api/stripe/portal` | POST | requireAuth | Create Stripe Customer Portal session, return redirect URL |
| `POST /api/stripe/unlink` | POST | requireAuth | Cancel Stripe subscription, delete KV entitlement record |
| `GET /api/sync/pull` | GET | requireAuthz (Karl) | Download all Firestore cards for authenticated user's household; Karl-only |
| `POST /api/sync/push` | POST | requireAuthz (Karl) | Upload local cards to Firestore with last-write-wins conflict resolution; Karl-only |

## Environment Variables

| Variable | Runtime | Scope | Description |
|----------|---------|-------|-------------|
| `GOOGLE_CLIENT_SECRET` | Next.js (server) | Server-side only | Used by auth token proxy (`/api/auth/token`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Next.js (client) | Browser-exposed | Used for the Google OAuth redirect |
| `GOOGLE_PICKER_API_KEY` | Next.js (server) | Server-side only | Used by picker config route (`/api/config/picker`) |
| `ANTHROPIC_API_KEY` | Next.js (server) | Server-side only | Used by import pipeline (`/api/sheets/import`) |
| `STRIPE_SECRET_KEY` | Next.js (server) | Server-side only | Stripe API authentication (all Stripe routes) |
| `STRIPE_WEBHOOK_SECRET` | Next.js (server) | Server-side only | Webhook HMAC signature verification (`/api/stripe/webhook`) |
| `STRIPE_PRICE_ID` | Next.js (server) | Server-side only | Stripe product price for checkout sessions |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Next.js (client) | Browser-exposed | Future: Stripe.js initialization |
| `FIRESTORE_PROJECT_ID` | Next.js (server) | Server-side only | GCP project for Firestore entitlement store + cloud sync (`/api/sync/pull`, `/api/sync/push`) |

## Design Principles

1. **All routes live in Next.js**: With the backend removed, all API routes run as GKE pods (Next.js standalone on GKE Autopilot).
2. **All routes call `requireAuth()` except**: `/api/auth/token` (no token exists yet) and `/api/stripe/webhook` (Stripe sends webhooks — secured by HMAC signature).
3. **Server-side secrets stay server-side**: No `NEXT_PUBLIC_` prefix on secret values (except publishable keys).
4. **Graceful degradation**: The app works without auth for anonymous users (localStorage-only mode).
5. **Stripe is the sole subscription platform**: Patreon has been removed. See `adr-feature-flags.md` (superseded) and `adr-010-stripe-direct.md`.
