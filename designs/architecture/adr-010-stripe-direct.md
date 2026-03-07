# ADR-010: Stripe Direct Integration

## Status: Accepted

> **Addendum (2026-03-07):** Patreon has been fully removed. Stripe is the sole subscription
> platform. The `SUBSCRIPTION_PLATFORM` feature flag, `isPatreon()`, `isStripe()` helpers,
> and `src/lib/feature-flags.ts` have all been deleted. The feature flag guards on routes
> are no longer needed — all Stripe routes are always active. See `adr-feature-flags.md`
> (superseded) for the transition history.

## Context

Fenrir Ledger originally used Patreon as its subscription platform (ADR-009). The product team decided to add Stripe as an alternative subscription platform, and subsequently migrated fully to Stripe to provide a more streamlined payment experience with lower fees and better control over the billing lifecycle.

The SUBSCRIPTION_PLATFORM feature flag (see adr-feature-flags.md, now superseded) was used to toggle between "patreon" and "stripe" during migration. This ADR documents the technical architecture for the Stripe Direct integration.

Key requirements:
- Stripe Checkout for subscription creation (no custom payment forms)
- Stripe Customer Portal for self-service billing management
- Webhook-driven entitlement updates (no polling)
- Same KV key namespace as Patreon (`entitlement:{googleSub}`)
- Feature flag guards on all routes (only one platform active at a time)

## Options Considered

### 1. Stripe Checkout + Customer Portal (Direct Integration)
- Use Stripe's hosted Checkout page for subscription creation
- Use Stripe's hosted Customer Portal for billing management
- Process webhooks for real-time entitlement updates
- **Pros**: Minimal UI work, PCI compliance handled by Stripe, built-in subscription management
- **Cons**: Less UI customization, redirect-based flow

### 2. Stripe Elements (Embedded Payment Forms)
- Build custom payment forms using Stripe Elements
- Handle subscription lifecycle manually via API
- **Pros**: Full UI control, no redirects
- **Cons**: More code to maintain, PCI SAQ-A-EP scope, complex error handling

### 3. Stripe Payment Links (No-Code)
- Use pre-built Stripe Payment Links
- **Pros**: Zero code for checkout
- **Cons**: No metadata injection (cannot link to Google sub), limited customization

## Decision

**Option 1: Stripe Checkout + Customer Portal.**

Rationale:
- Stripe Checkout handles PCI compliance, fraud detection, and payment method collection
- The hosted Customer Portal provides cancel/update functionality with zero custom UI
- Metadata on checkout sessions allows us to link Stripe customers to Google users
- Webhook-driven updates mean the KV store is always fresh without polling
- Mirrors the Patreon architecture pattern (server-side only, KV-backed entitlements)

## Architecture

### API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/stripe/checkout` | POST | requireAuth | Create checkout session, return URL |
| `/api/stripe/webhook` | POST | Signature only | Process Stripe webhook events |
| `/api/stripe/membership` | GET | requireAuth | Return cached entitlement from KV |
| `/api/stripe/portal` | POST | requireAuth | Create portal session, return URL |
| `/api/stripe/unlink` | POST | requireAuth | Cancel subscription, delete KV record |

### Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create entitlement (metadata.googleSub links to user) |
| `customer.subscription.updated` | Update tier/status via reverse index |
| `customer.subscription.deleted` | Downgrade to thrall |

### KV Schema

Primary key: `entitlement:{googleSub}` (same namespace as Patreon)
Reverse index: `stripe-customer:{stripeCustomerId}` -> `{googleSub}`

StoredStripeEntitlement fields:
- `tier`: "thrall" | "karl"
- `active`: boolean
- `stripeCustomerId`: string (cus_xxx)
- `stripeSubscriptionId`: string (sub_xxx)
- `stripeStatus`: string (Stripe subscription status)
- `linkedAt`: ISO 8601
- `checkedAt`: ISO 8601

### Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `STRIPE_SECRET_KEY` | Server | Stripe API authentication |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client | Future: Stripe.js initialization |
| `STRIPE_WEBHOOK_SECRET` | Server | Webhook signature verification |
| `STRIPE_PRICE_ID` | Server | Product price for checkout sessions |
| `SUBSCRIPTION_PLATFORM` | Shared | Feature flag: "stripe" or "patreon" |

### Security

- Webhook signature verification uses Stripe's `constructEvent()` which performs SHA-256 HMAC validation (stronger than Patreon's HMAC-MD5)
- No Stripe secrets are exposed to the client bundle (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET have no NEXT_PUBLIC_ prefix)
- All routes except webhook require Google auth via `requireAuth()`
- Webhook route has no Bearer auth — Stripe sends webhooks, security is signature-based

## Consequences

### Positive
- Clean separation: feature flag ensures only one platform is active
- Webhook-driven updates eliminate polling and staleness
- Stripe Checkout handles PCI compliance and payment UX
- Customer Portal provides self-service billing with zero custom UI
- Same KV key namespace means membership checks work identically regardless of platform

### Negative
- Two separate code paths for subscription management (Patreon + Stripe)
- Stripe webhooks require a publicly accessible endpoint (standard for any webhook integration)
- Checkout session metadata is the sole link between Stripe customer and Google user — if metadata is missing, the webhook cannot map the user
- During migration from Patreon to Stripe, users will need to re-subscribe (no automatic migration)
