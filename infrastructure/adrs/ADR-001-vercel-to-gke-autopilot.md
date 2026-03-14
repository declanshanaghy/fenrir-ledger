# ADR-001 — Migrate Application Hosting from Vercel to GKE Autopilot

**Status:** Accepted
**Date:** 2026-03-14
**Authors:** FiremanDecko (Principal Engineer)
**Ref:** GitHub Issue #854; supersedes [ADR-001: Tech Stack](../../architecture/adrs/ADR-001-tech-stack.md) (Vercel hosting intent)

---

## Context

Fenrir Ledger is a Next.js (App Router) application. The original tech stack ADR
([architecture/adrs/ADR-001-tech-stack.md](../../architecture/adrs/ADR-001-tech-stack.md))
chose Next.js in part because "Vercel is the natural deploy target — zero additional
config when we add hosting." Vercel was provisioned as the production host.

Over time, the product's requirements outgrew what a frontend PaaS can cleanly serve:

1. **Server-side secrets** — OAuth client secrets, Stripe keys, Anthropic API keys,
   and encryption keys require a controlled secret store, not Vercel environment
   variables which are visible to any team member with dashboard access.
2. **Stateful workloads** — Subscription entitlements and trial state require a
   persistent key/value store. Vercel KV (Upstash) added per-request egress cost and
   a ~10–50 ms cross-region round-trip to every authenticated request.
3. **Agent execution** — A multi-agent Claude Code orchestration pattern was adopted
   for engineering automation. Agents need compute, secrets, and ephemeral workspaces
   that Vercel's edge runtime cannot provide.
4. **Observability** — Vercel's built-in log tail is per-deployment. Cloud Logging
   with structured queries, retention policies, and unified dashboards across app,
   Redis, and agent workloads was not achievable on Vercel.
5. **Cost model** — At Vercel's Pro tier, function invocation cost scales with traffic
   and has no fixed ceiling. GKE Autopilot billing is per-pod resource request with a
   predictable monthly budget cap.

Additionally, the team already operates a GCP project (`fenrir-ledger-prod`) for other
Google services (OAuth, Picker API). Consolidating hosting in GCP eliminates a
cross-vendor IAM boundary.

---

## Options Considered

### 1. Vercel (status quo)

Managed Next.js platform with built-in CDN, edge functions, and preview deployments.

**Why rejected:**
- No persistent in-process server; stateful workloads (Redis, agents) require external
  services that add egress cost and latency
- Secrets management is project-dashboard-level, not IAM-scoped
- No path to running Kubernetes Jobs for agent dispatch
- Vercel Pro pricing scales unboundedly with function invocations
- Cross-vendor (GCP + Vercel) IAM complicates audit trails and least-privilege enforcement

### 2. Google Cloud Run

Serverless container execution on GCP. Supports long-running containers, VPC egress,
and IAM-native service accounts.

**Why rejected:**
- Cold starts on Cloud Run Gen1 are 1–4 s for a Next.js SSR container; unacceptable
  for interactive page loads
- No native Kubernetes Jobs primitive for agent dispatch — would require a separate
  orchestration layer (Cloud Tasks, Workflows) adding operational complexity
- Stateful workloads (Redis StatefulSet) need a cluster anyway; adding Cloud Run
  as a separate control plane increases surface area without simplifying operations

### 3. GKE Autopilot (chosen)

Regional, fully managed Kubernetes cluster (`fenrir-autopilot`, `us-central1`).
Google manages node provisioning, autoscaling, OS patching, and security hardening.
All workloads — app, Redis, analytics, and agent Jobs — run in the same cluster.

---

## Decision

**Host Fenrir Ledger on GKE Autopilot** in the `fenrir-ledger-prod` GCP project,
region `us-central1`.

### Architecture Overview

```
Internet
  │
  ▼
GKE Ingress (GCE L7 Load Balancer)
  │  Google-managed SSL cert (fenrirledger.com, www.*, analytics.*)
  │
  ├── fenrir-app namespace
  │     ├── Deployment: fenrir-app (2 replicas, 0.5 vCPU / 512 Mi)
  │     │     Image: us-central1-docker.pkg.dev/fenrir-ledger-prod/
  │     │             fenrir-images/fenrir-app:<git-sha>
  │     └── StatefulSet: redis (1 replica, AOF persistence, ClusterIP only)
  │
  ├── fenrir-agents namespace
  │     └── Jobs: ephemeral Claude Code agent sandboxes (GKE Jobs, Spot)
  │
  └── fenrir-analytics namespace
        └── Umami analytics (self-hosted, PostgreSQL backend)
```

### Container Image

The Next.js app is built as a **standalone output** (`output: 'standalone'` in
`next.config.js`). The Dockerfile produces a minimal Node.js image:

```
docker build → Artifact Registry (us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/fenrir-app)
```

The image is tagged by git SHA at build time. `latest` is also updated on every
main-branch deploy.

### Cluster Configuration (`infrastructure/gke.tf`)

| Parameter | Value |
|-----------|-------|
| Mode | Autopilot (Google manages nodes) |
| Region | `us-central1` (regional — multi-zone HA) |
| Release channel | Regular |
| Node networking | Private nodes, public control plane endpoint |
| Workload Identity | Enabled — pod-level IAM, no static key files in containers |
| Logging | `SYSTEM_COMPONENTS` + `WORKLOADS` → Cloud Logging |
| Monitoring | `SYSTEM_COMPONENTS` + Managed Prometheus |
| Binary Authorization | `PROJECT_SINGLETON_POLICY_ENFORCE` |

### Application Deployment (`infrastructure/k8s/app/deployment.yaml`)

| Parameter | Value |
|-----------|-------|
| Replicas | 2 |
| CPU (request = limit) | 500 m |
| Memory (request = limit) | 512 Mi |
| Rolling update | `maxUnavailable: 0`, `maxSurge: 1` (zero-downtime) |
| Readiness / Liveness | HTTP GET `/api/health` on `:3000` |
| Secret injection | `secretRef: fenrir-app-secrets` (K8s Secret, not env vars in YAML) |

### CI/CD Pipeline (`.github/workflows/deploy.yml`)

On every push to `main`:

1. **Terraform** — `plan` + `apply` (idempotent; no-ops if infrastructure unchanged)
2. **Docker Build & Push** — multi-stage build, layer cache via GitHub Actions cache,
   pushed to Artifact Registry tagged by `github.sha`
3. **Helm Rolling Deploy** — `helm upgrade --install fenrir-app` with `--wait` and
   5-minute timeout; GKE performs a zero-downtime rolling update
4. **Health Check** — `curl /api/health` against the Ingress IP; warns (does not
   fail) if SSL is still provisioning

### Secrets Management

All application secrets are stored in a Kubernetes Secret (`fenrir-app-secrets` in
`fenrir-app` namespace), populated by the deploy pipeline from GitHub Secrets. They
are injected into pods at runtime via `envFrom.secretRef` — never written to YAML
files checked into the repository.

The Kubernetes service account (`fenrir-app-sa`) is bound to a GCP service account
(`fenrir-app-workload`) via Workload Identity, granting only `logging.logWriter` and
`monitoring.metricWriter`. No static JSON key files are used.

### Observability (`infrastructure/monitoring.tf`)

- **Uptime checks** — Cloud Monitoring probes `/api/health` every 5 minutes from
  `USA`, `EUROPE`, and `ASIA_PACIFIC`
- **Alert policy** — `Fenrir App Down` fires after 2 consecutive failures (~10 min),
  notifying `alerts@fenrirledger.com`
- **Pod logs** — structured logs forwarded to Cloud Logging via the `WORKLOADS`
  logging component; same workspace as agent and Redis logs

---

## Consequences

### Positive

- **Unified GCP perimeter** — All secrets, compute, logging, monitoring, and IAM
  live within `fenrir-ledger-prod`. No cross-vendor trust boundary.
- **Stateful workloads are first-class** — Redis runs as a StatefulSet in the same
  cluster; sub-millisecond latency vs. Vercel KV's 10–50 ms HTTP round-trip
  (see ADR-005).
- **Agent dispatch is native** — GKE Jobs in `fenrir-agents` namespace dispatch
  Claude Code agents without an external sandbox vendor (see ADR-004).
- **Predictable cost** — GKE Autopilot billing is per-pod resource request. A
  `$150/month` budget alert is configured in Terraform. Spot nodes in `fenrir-agents`
  reduce agent compute cost by up to 70%.
- **Zero-downtime deploys** — Rolling update strategy with `maxUnavailable: 0`
  ensures requests are never dropped during a deploy.
- **Structured observability** — Cloud Logging + Managed Prometheus covers app, agent,
  Redis, and analytics workloads in a single dashboard.
- **Binary Authorization** — Supply chain integrity enforced at the cluster level;
  only images built and signed by the CI pipeline can be deployed.

### Negative

- **Operational surface** — Kubernetes YAML, Helm charts, Terraform, and Artifact
  Registry all require maintenance. Vercel's zero-config deploy is gone.
- **No automatic preview deployments** — Vercel created isolated preview URLs per PR.
  GKE does not; PR previews require a separate implementation (not currently
  planned).
- **SSL provisioning lag** — Google-managed certificates can take 15–60 minutes to
  provision after DNS cutover. Vercel's certificates provision in under 60 seconds.
- **Cold start eliminated, not zero** — Autopilot pods start in ~5–10 s after a scale
  event; comparable to Vercel serverless but slightly slower for the first request
  after idle scale-to-zero (if configured).

### Neutral

- **Next.js features unchanged** — App Router, Server Components, API routes, and
  middleware all behave identically. The migration required adding `output: 'standalone'`
  to `next.config.js` and adjusting `APP_BASE_URL` from `VERCEL_URL` to a static
  `https://fenrirledger.com`.
- **No Vercel-specific APIs** — `@vercel/kv`, `@vercel/analytics`, and `VERCEL_URL`
  were removed during cleanup (Issue #682). No residual Vercel dependency remains in
  the application source.

---

## Migration Notes

The migration was executed incrementally:

1. `infrastructure/gke.tf` — cluster provisioned via Terraform
2. `infrastructure/k8s/app/` — Deployment, Service, Ingress, and Redis StatefulSet
   applied via `kubectl` / Helm
3. `infrastructure/k8s/agents/` — agent namespace, RBAC, NetworkPolicy, and Job
   template for Claude Code dispatch
4. `.github/workflows/deploy.yml` — Vercel GitHub integration removed; GKE deploy
   pipeline added
5. Issue #682 — `VERCEL_URL`, `@vercel/kv`, CSP Vercel origins, and Depot references
   cleaned from source code

---

## Related

- [ADR-001: Tech Stack](../../architecture/adrs/ADR-001-tech-stack.md) — original decision to use Vercel; now superseded for hosting
- [ADR-004: GKE Jobs for Agent Execution](ADR-004-gke-jobs-agent-execution.md) — ephemeral agent sandboxes on the same cluster
- [ADR-005: In-Cluster Redis over Vercel KV](ADR-005-redis-over-vercel-kv.md) — stateful KV store collocated with the app
- [ADR-006: Umami Self-Hosted Analytics](ADR-006-umami-self-hosted-analytics.md) — analytics pod in `fenrir-analytics` namespace
- [ADR-007: Google Cloud DNS and Managed Certificates](ADR-007-gcloud-dns-managed-certs.md) — DNS and TLS for the GKE Ingress
- `infrastructure/gke.tf` — GKE Autopilot cluster Terraform
- `infrastructure/k8s/app/` — Kubernetes manifests for the application
- `.github/workflows/deploy.yml` — CI/CD pipeline
- `infrastructure/SMOKE-TEST.md` — post-deploy verification steps
- GitHub Issue #682 — Vercel/Depot reference cleanup
