# ADR-009: Patreon Subscription Platform

**Status:** Superseded by [ADR-010](ADR-010-stripe-direct.md)
**Date:** 2026-02-20 (estimated — original Patreon integration)
**Author:** FiremanDecko (Principal Engineer)
**Superseded by:** ADR-010 (Stripe Direct Integration, 2026-03-07)

> **Note:** Patreon has been fully removed from Fenrir Ledger. This ADR is retained for
> historical context. See [ADR-010](ADR-010-stripe-direct.md) for the current subscription
> platform architecture.

---

## Context

Fenrir Ledger needed a subscription/monetization layer to gate premium features behind a
paywall. The product decision was to charge for Karl-tier access (advanced analytics,
cloud sync, import). The team evaluated subscription platforms available at the time.

The primary constraint was low operational overhead — a managed billing platform was
strongly preferred over building custom payment infrastructure.

---

## Options Considered

### 1. Patreon (chosen initially)

Creator-monetization platform with membership tiers and patron management.

**Pros:**
- Existing user base familiar with Patreon for creator support
- No custom payment flow to build — Patreon handles billing, receipts, dunning
- Webhook support for membership events
- Free to integrate (Patreon takes a platform cut)

**Cons:**
- Patreon is positioned for creator support, not SaaS subscriptions
- No way to offer a free trial natively
- Limited control over billing lifecycle (upgrades, downgrades, cancellations)
- 5–12% platform fee on top of payment processing
- Patron webhook reliability issues documented by other developers
- No ability to offer one-time purchases or tiered annual billing
- Patreon's branding on checkout flow is confusing for a web app product

### 2. Stripe (evaluated but deferred)

Full-featured payments platform with subscription billing, trials, invoicing.

**Why deferred initially:**
- More integration effort than Patreon
- Required building a checkout flow
- Team opted for fastest path to monetization

---

## Decision

Use **Patreon** as the initial subscription platform. Fenrir Ledger would expose Karl-tier
features to users whose Patreon patron status was confirmed via webhook and cached in Redis.

### Implementation

- Patreon OAuth used to link a Patreon account to a `householdId`
- Patron tier checked on each request via a cached Redis entitlement
- Seven Patreon API routes under `src/app/api/patreon/`
- Feature flag (`SUBSCRIPTION_PLATFORM=patreon`) used to toggle Patreon on/off

---

## Consequences

### Positive

- Fast time-to-monetization — Patreon handles all billing complexity
- No Stripe integration effort required for MVP

### Negative

- Platform fee higher than Stripe's processing fee alone
- No trial support — could not offer "try Karl free for 7 days"
- Webhook reliability issues caused entitlement sync problems in production
- Patreon branding confused users who expected a standard SaaS checkout
- Tight coupling to Patreon's membership model made feature gating awkward

---

## Supersession

These cons accumulated quickly post-launch. ADR-010 documents the migration to Stripe
Direct. The migration was completed on 2026-03-07:

- All Patreon API routes deleted
- `SUBSCRIPTION_PLATFORM` feature flag (ADR-011) deleted along with all flag helpers
- Entitlement state migrated to Stripe + Firestore
- Stripe provides first-class trial support (ADR-017)
