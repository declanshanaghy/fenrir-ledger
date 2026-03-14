# ADR-005: In-Cluster Redis over Vercel KV

**Status:** Accepted
**Date:** 2026-03-14
**Issue:** [#858](https://github.com/declanshanaghy/fenrir-ledger/issues/858)

---

## Context

Fenrir Ledger requires server-side key/value storage for two classes of mutable state:

1. **Subscription entitlements** — Stripe tier, active status, and customer ID mappings keyed by Google sub or Stripe customer ID (`entitlement:{googleSub}`, `entitlement:stripe:{cus_xxx}`, `stripe-customer:{cus_xxx}`).
2. **Trial state** — start date and conversion timestamp keyed by browser fingerprint (`trial:{fingerprint}`, 60-day TTL).

The original architecture used **Vercel KV** (`@vercel/kv`), a managed Redis-over-HTTP service built on Upstash and designed for Vercel-hosted applications. Fenrir Ledger subsequently migrated its hosting from Vercel to **GKE Autopilot** (see CLAUDE.md — GKE Autopilot Infrastructure). After that migration, Vercel KV became an external dependency with no cost or operational advantage for a cluster-internal workload.

### Options considered

| Option | Egress cost | Latency | Operational overhead | Auth surface |
|---|---|---|---|---|
| Vercel KV (Upstash) | Per-request HTTP egress | ~10–50 ms (cross-region) | None (managed) | UPSTASH_REDIS_REST_URL + token in secret |
| Self-hosted Redis in cluster | Zero (ClusterIP only) | <1 ms (same namespace) | StatefulSet lifecycle | No auth required (network-isolated) |
| Google Cloud Memorystore | VPC peering cost | ~1–5 ms | Moderate (Terraform) | VPC, IAM binding |

---

## Decision

Deploy a single-replica **Redis 7 Alpine StatefulSet** in the `fenrir-app` namespace and connect to it via the Kubernetes in-cluster DNS name.

```
REDIS_URL=redis://redis.fenrir-app.svc.cluster.local:6379
```

The Next.js application uses the **ioredis** client (`src/lib/kv/redis-client.ts`) as a singleton with `lazyConnect: true` and `maxRetriesPerRequest: 3`. All KV access is mediated through two store modules:

- `src/lib/kv/entitlement-store.ts` — Stripe entitlement CRUD and anonymous→authenticated migration
- `src/lib/kv/trial-store.ts` — trial lifecycle (init, status, conversion)

### Deployment specification (`infrastructure/k8s/app/redis-statefulset.yaml`)

| Parameter | Value |
|---|---|
| Image | `redis:7-alpine` |
| Replicas | 1 |
| Persistence | AOF (`--appendonly yes`), 1 Gi PVC at `/data` |
| Resources (requests) | 50 m CPU, 64 Mi memory |
| Resources (limits) | 100 m CPU, 128 Mi memory |
| Service type | `ClusterIP` — no external exposure |
| Liveness / Readiness | `redis-cli ping` every 10 s / 5 s |

The `REDIS_URL` env var is set directly in `infrastructure/k8s/app/deployment.yaml` (not in the K8s Secret) because it contains no credentials and is safe for the deployment manifest.

---

## Consequences

### Positive

- **Zero egress cost.** All traffic stays within the `fenrir-app` namespace over the cluster network.
- **Sub-millisecond latency.** Same-namespace ClusterIP eliminates the HTTP round-trip overhead of Vercel KV (Upstash REST API).
- **No external dependency.** Removes the Vercel KV tier, UPSTASH_REDIS_REST_URL, and UPSTASH_REDIS_REST_TOKEN secrets from the application's trust boundary.
- **Simpler local dev.** `REDIS_URL` falls back to `redis://localhost:6379` in the client; a local Redis container is sufficient for development.
- **AOF durability.** Append-only file persistence survives pod restarts without data loss within the PVC lifetime.

### Negative / Risks

- **Single point of failure.** One replica means Redis unavailability (crash, rolling update) causes entitlement/trial reads to fail gracefully (stores return `null`) but writes throw. Application code handles errors by returning safe defaults, not hard failures.
- **No replication or failover.** Not suitable if the data becomes critical enough to require HA. If that threshold is reached, migrating to a multi-replica setup or Google Cloud Memorystore is the documented escape path.
- **Self-managed lifecycle.** Upgrades, PVC resize, and data migration are manual operations via `kubectl`. Runbook in `infrastructure/k8s/app/RUNBOOK.md`.
- **PVC bound to one zone.** GKE Autopilot provisions `ReadWriteOnce` volumes in a single zone; if the node is scheduled in a different zone after an outage, the PVC must be detached/reattached or the data lost and re-warmed from Stripe webhooks.

### Neutral

- Data model is unchanged. All key formats (`entitlement:*`, `trial:*`, `stripe-customer:*`) and TTL semantics (30 days for entitlements, 60 days for trials) carry over verbatim from the Vercel KV implementation.
- The `ioredis` client is a drop-in replacement for `@vercel/kv`; no API shape changes were required in the store modules.

---

## Related

- `infrastructure/k8s/app/redis-statefulset.yaml` — StatefulSet and Service manifests
- `infrastructure/k8s/app/deployment.yaml` — `REDIS_URL` env injection
- `development/frontend/src/lib/kv/redis-client.ts` — ioredis singleton
- `development/frontend/src/lib/kv/entitlement-store.ts` — entitlement persistence
- `development/frontend/src/lib/kv/trial-store.ts` — trial persistence
- `infrastructure/k8s/app/RUNBOOK.md` — operational procedures
