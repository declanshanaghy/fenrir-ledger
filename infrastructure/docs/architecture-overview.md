# Architecture Overview — Fenrir Ledger on GKE Autopilot

Fenrir Ledger runs entirely on **Google Kubernetes Engine (GKE) Autopilot** in `us-central1`.
Terraform manages cloud infrastructure (cluster, DNS, networking, IAM).
Helm manages Kubernetes workloads. GitHub Actions orchestrates every deployment.

---

## Top-Level Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    Google Cloud (us-central1)                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               GKE Autopilot Cluster                      │  │
│  │  (Terraform: gke.tf — Google manages nodes & scaling)    │  │
│  │                                                          │  │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │  fenrir-app      │  │  fenrir-agents               │  │  │
│  │  │                 │  │                              │  │  │
│  │  │  Next.js app    │  │  Agent sandbox GKE Jobs      │  │  │
│  │  │  Redis StatefulSet  │  (ephemeral, fire-and-forget)|  │  │
│  │  │  Ingress (GCE)  │  └──────────────────────────────┘  │  │
│  │  │  PDB, WarmNode  │                                     │  │
│  │  └─────────────────┘  ┌──────────────────────────────┐  │  │
│  │                        │  fenrir-analytics            │  │  │
│  │  ┌─────────────────┐  │                              │  │  │
│  │  │  fenrir-monitor  │  │  Umami (analytics)           │  │  │
│  │  │                 │  │  PostgreSQL StatefulSet       │  │  │
│  │  │  Odin's Throne  │  └──────────────────────────────┘  │  │
│  │  │  (monitor + UI) │                                     │  │
│  │  │  oauth2-proxy   │                                     │  │
│  │  └─────────────────┘                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  Cloud DNS   │  │  Artifact    │  │  Firestore         │   │
│  │  (dns.tf)    │  │  Registry    │  │  (firestore.tf)    │   │
│  └──────────────┘  │  (artifact-  │  └────────────────────┘   │
│                    │  registry.tf)│                            │
│  ┌──────────────┐  └──────────────┘  ┌────────────────────┐   │
│  │  Cloud CDN + │                    │  IAM / Workload    │   │
│  │  Load Bal.   │                    │  Identity          │   │
│  │ (cdn-mon.tf) │                    │  (iam.tf)          │   │
│  └──────────────┘                    └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Namespace Layout

| Namespace | Contents | Managed by |
|---|---|---|
| `fenrir-app` | Next.js app, Redis StatefulSet, Ingress, PDB, warm-node-pool placeholder | `helm/fenrir-app` |
| `fenrir-agents` | Ephemeral agent sandbox GKE Jobs (fire-and-forget) | `k8s/agents/dispatch-job.sh` (not Helm) |
| `fenrir-analytics` | Umami self-hosted analytics + PostgreSQL | `helm/umami` |
| `fenrir-monitor` | Odin's Throne monitor backend + UI + oauth2-proxy | `helm/odin-throne` |

Namespaces, service accounts, ResourceQuotas, and NetworkPolicies are created by the **bootstrap chart** (`helm/fenrir-bootstrap`) — deployed first on every CI run.

---

## What Manages What

| Layer | Tool | Scope |
|---|---|---|
| Cloud infrastructure | Terraform (`*.tf`) | GKE cluster, VPC, DNS, CDN, Firestore, Artifact Registry, IAM |
| Cluster bootstrap | Helm (`helm/fenrir-bootstrap`) | Namespaces, service accounts, RBAC, resource quotas, network policies |
| App workloads | Helm (`helm/fenrir-app`) | Next.js app + Redis in `fenrir-app` |
| Monitor | Helm (`helm/odin-throne`) | Odin's Throne backend + UI in `fenrir-monitor` |
| Analytics | Helm (`helm/umami`) | Umami + PostgreSQL in `fenrir-analytics` |
| Agent sandbox | Shell script (`k8s/agents/dispatch-job.sh`) | GKE Jobs in `fenrir-agents` — not managed by Helm |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`) | Build, test, terraform apply, helm upgrade |

---

## How It All Connects

1. **Terraform** provisions the GKE cluster, VPC, static IP, Cloud DNS zone, CDN backend, Artifact Registry, IAM bindings, and Firestore.
2. **GitHub Actions** (`deploy.yml`) detects which services changed and runs only the relevant build/deploy jobs in parallel.
3. **Docker images** are pushed to Google Artifact Registry (`us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/`).
4. **Helm** (`helm upgrade --install`) deploys each service into its namespace. Secrets are injected via `kubectl create secret` in the deploy workflow before Helm runs.
5. **Agent dispatch** uses `dispatch-job.sh` to generate a Job manifest from `job-template.yaml`, substituting placeholders, then `kubectl apply -f` it into `fenrir-agents`. The Job is fire-and-forget — TTL auto-deletes after 30 minutes.

---

## Workload Identity

Pods authenticate to GCP services without exported keys via [Workload Identity](https://cloud.google.com/kubernetes-engine/docs/concepts/workload-identity):

- `fenrir-app-sa` (K8s) ↔ `fenrir-app-workload@...iam.gserviceaccount.com` (GCP) — Firestore, logging
- `fenrir-agents-sa` (K8s) ↔ `fenrir-agents-workload@...iam.gserviceaccount.com` (GCP) — Artifact Registry pull, logging

Both are created by `helm/fenrir-bootstrap` and bound by `infrastructure/iam.tf`.

---

## Further Reading

- [Helm Charts](helm-charts.md) — all 4 Helm charts documented
- [Agent Sandbox](agent-sandbox.md) — how agent GKE Jobs work end-to-end
- [Terraform](terraform.md) — every `.tf` file explained
- [Deployment Pipeline](deployment-pipeline.md) — `deploy.yml` change matrix and rollback
- [Legacy Manifests](legacy-manifests.md) — what `k8s/app/` was and current status
- [SMOKE-TEST.md](../SMOKE-TEST.md) — manual cluster verification steps
- [ADRs](../adrs/) — architecture decision records
