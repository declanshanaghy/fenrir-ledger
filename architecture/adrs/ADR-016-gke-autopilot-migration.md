# ADR-016: GKE Autopilot Migration

**Status:** Accepted
**Date:** 2026-03-14
**Authors:** FiremanDecko (Principal Engineer)
**Supersedes:** ADR-001 (hosting intent — Vercel references)
**Full decision record:** [infrastructure/adrs/ADR-001-vercel-to-gke-autopilot.md](../../infrastructure/adrs/ADR-001-vercel-to-gke-autopilot.md)

---

## Context

Fenrir Ledger was originally planned to deploy on Vercel (referenced in ADR-001 tech stack).
As product requirements grew — server-side secrets, persistent KV storage, agent execution
workloads, and unified GCP observability — Vercel's frontend PaaS model became insufficient.

The full decision record lives in the infrastructure ADR layer
(`infrastructure/adrs/ADR-001-vercel-to-gke-autopilot.md`). This entry records the
architectural decision from the application layer's perspective.

---

## Decision

Deploy Fenrir Ledger on **GKE Autopilot** (`fenrir-autopilot`, `us-central1`) in the
`fenrir-ledger-prod` GCP project. All workloads — app, Redis, analytics, and agent Jobs —
run in the same cluster.

### Key application-layer changes

| Concern | Before (Vercel) | After (GKE) |
|---------|----------------|-------------|
| Next.js output mode | Default server (Vercel-managed) | `output: 'standalone'` in `next.config.js` |
| Base URL env var | `VERCEL_URL` | `APP_BASE_URL=https://fenrirledger.com` (static) |
| KV store | Vercel KV (Upstash, external) | Redis StatefulSet (in-cluster, ~0 ms latency) |
| Secrets | Vercel dashboard env vars | K8s Secret `fenrir-app-secrets`, injected via `envFrom.secretRef` |
| Deploy trigger | Vercel GitHub integration | `.github/workflows/deploy.yml` — Docker + Helm on push to `main` |
| Preview deployments | Automatic per-PR | Not available (manual workarounds not planned) |

### Deployment architecture summary

```
Internet
  │
  ▼
GKE Ingress (GCE L7 Load Balancer)
  │  Google-managed SSL cert (fenrirledger.com)
  │
  └── fenrir-app namespace
        ├── Deployment: fenrir-app (2 replicas, 0.5 vCPU / 512 Mi)
        └── StatefulSet: redis (AOF persistence, ClusterIP only)
```

### Infrastructure files

| File | Purpose |
|------|---------|
| `infrastructure/gke.tf` | GKE Autopilot cluster (Terraform) |
| `infrastructure/k8s/app/deployment.yaml` | App Deployment, Service, Ingress |
| `infrastructure/k8s/app/redis.yaml` | Redis StatefulSet |
| `.github/workflows/deploy.yml` | CI/CD pipeline (Docker → Artifact Registry → Helm) |
| `infrastructure/SMOKE-TEST.md` | Post-deploy verification steps |

---

## Alternatives Considered

See `infrastructure/adrs/ADR-001-vercel-to-gke-autopilot.md` for the full evaluation of
Vercel (status quo), Google Cloud Run, and GKE Autopilot.

---

## Consequences

### Positive

- **Unified GCP perimeter** — all secrets, compute, logging, and IAM in `fenrir-ledger-prod`
- **Stateful workloads** — Redis runs in-cluster; ~0 ms latency vs. Vercel KV's 10–50 ms
- **Agent dispatch** — GKE Jobs in `fenrir-agents` namespace, no external sandbox vendor
- **Predictable cost** — per-pod resource billing with a `$150/month` budget alert
- **Zero-downtime deploys** — rolling update with `maxUnavailable: 0`

### Negative

- **No automatic preview deployments** — Vercel's per-PR preview URLs are gone
- **Operational surface** — Kubernetes YAML, Helm, Terraform, Artifact Registry require maintenance
- **SSL provisioning lag** — Google-managed certs take 15–60 min after DNS cutover

### Neutral

- **Next.js features unchanged** — App Router, API routes, and Server Components behave
  identically; only `output: 'standalone'` was added to `next.config.js`
- **No Vercel-specific APIs remain** — `@vercel/kv`, `@vercel/analytics`, and `VERCEL_URL`
  were removed in Issue #682

---

## Related

- [infrastructure/adrs/ADR-001-vercel-to-gke-autopilot.md](../../infrastructure/adrs/ADR-001-vercel-to-gke-autopilot.md) — full decision record
- [infrastructure/adrs/ADR-004-gke-jobs-agent-execution.md](../../infrastructure/adrs/ADR-004-gke-jobs-agent-execution.md) — agent sandboxes on the same cluster
- [infrastructure/adrs/ADR-005-redis-over-vercel-kv.md](../../infrastructure/adrs/ADR-005-redis-over-vercel-kv.md) — in-cluster Redis
- [ADR-001-tech-stack.md](ADR-001-tech-stack.md) — original tech stack decision (hosting intent superseded here)
- GitHub Issue #854 — GKE migration tracking issue
- GitHub Issue #682 — Vercel/Depot reference cleanup
