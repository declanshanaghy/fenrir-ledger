# ADR-012: Redis KV Store for Subscription Entitlements

**Status:** Superseded — Redis fully removed; all entitlements and trial state migrated to Firestore (issues #1516–#1521, PRs #1533–#1568)
**Date:** 2026-03-07 (Stripe integration) / 2026-03-14 (in-cluster Redis)
**Author:** FiremanDecko (Principal Engineer)
**Superseded by:** ADR-014 (Firestore) addendum; see also infrastructure/adrs/ADR-005-redis-over-vercel-kv.md (infra layer)

> **Note:** Redis has been fully removed from Fenrir Ledger. This ADR is retained for
> historical context. Entitlement and trial state now live in Firestore under
> `/users/{googleSub}` and `/stripe/{stripeCustomerId}`. See [ADR-014](ADR-014-firestore-cloud-sync.md)
> and the addendum in [ADR-010](ADR-010-stripe-direct.md).

---

## Context

When Stripe Direct (ADR-010) was introduced, Fenrir Ledger needed a server-side store
for two classes of mutable state that could not live in the browser:

1. **Subscription entitlements** — Stripe tier (`thrall` / `karl`), active status, and
   customer ID mappings keyed by Google sub or Stripe customer ID.
2. **Trial state** — trial start date, conversion timestamp, keyed by Google sub with a
   60-day TTL on eligibility.

The data was small, frequently read, and needed sub-10ms access on every authenticated
API request. A document database felt like overkill; a key-value store was the natural fit.

---

## Options Considered

### 1. Vercel KV (Upstash Redis)

Managed Redis-over-HTTP service built on Upstash, designed for Vercel-hosted applications.

**Why initially chosen:** Zero operational overhead, one env var to configure.

**Why later rejected:** After the GKE migration (ADR-016), Vercel KV became an external
dependency with cross-region HTTP latency (~10–50ms) and per-request egress cost — no
longer justified for a cluster-internal workload.

### 2. In-cluster Redis StatefulSet (chosen at ADR-012 time)

Single-replica Redis 7 Alpine StatefulSet in the `fenrir-app` namespace.

**Pros:**
- Sub-millisecond ClusterIP latency (same namespace)
- Zero egress cost
- Removes Upstash from the trust boundary

**Cons:**
- Single point of failure (no replication)
- PVC bound to one zone
- Self-managed lifecycle

### 3. Firestore (eventual winner — see Supersession)

Google-managed document store already used for card data (ADR-014).

**Why not chosen initially:** Firestore felt heavyweight for small KV operations;
Redis was already the team's mental model for session/entitlement caching.

---

## Decision

Use **in-cluster Redis 7 Alpine StatefulSet** in the `fenrir-app` namespace.

### Key Schema

```
entitlement:{googleSub}            → JSON: { tier, status, stripeCustomerId, updatedAt }
entitlement:stripe:{cus_xxx}       → JSON: same shape, keyed by Stripe customer ID
stripe-customer:{cus_xxx}          → string: googleSub (reverse lookup)
trial:{googleSub}                  → JSON: { startedAt, convertedAt?, expiresAt }
```

All KV access via:
- `src/lib/kv/entitlement-store.ts`
- `src/lib/kv/trial-store.ts`
- `src/lib/kv/redis-client.ts` (ioredis singleton, `lazyConnect: true`)

Full infrastructure spec in `infrastructure/adrs/ADR-005-redis-over-vercel-kv.md`.

---

## Consequences

### Positive

- Fast entitlement lookups on every authenticated request
- No external vendor dependency post-GKE migration
- AOF persistence survives pod restarts

### Negative

- Single-replica Redis is a soft SPoF for entitlement reads/writes
- PVC zone-binding creates recovery risk after node failure
- Self-managed container lifecycle vs. Google-managed Firestore

---

## Supersession

Redis accumulated operational friction without providing meaningful advantages over
Firestore, which was already in use for card data (ADR-014). Key drivers:

1. **Unified persistence layer** — maintaining two stores (Redis + Firestore) added
   complexity with no performance benefit given Firestore's ~5–20ms latency for
   small documents.
2. **Zone-binding reliability** — the single-replica PVC proved fragile during node
   maintenance events.
3. **Simplified local dev** — Firestore emulator replaces both Firestore and Redis
   in development; no `docker run redis` required.

Migration (issues #1516–#1521, PRs #1533–#1568):
- `entitlement:*` keys → Firestore `/users/{googleSub}` document
- `stripe-customer:*` keys → Firestore `/stripe/{stripeCustomerId}` document
- `trial:*` keys → Firestore `/users/{googleSub}/trial` subcollection
- `ioredis` client, Redis StatefulSet, and PVC deleted
- `REDIS_URL` removed from all deployment manifests and `.env.example`
