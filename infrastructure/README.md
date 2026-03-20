# Infrastructure — Fenrir Ledger on GKE Autopilot

GKE Autopilot infrastructure for Fenrir Ledger: Terraform manages cloud resources, Helm manages Kubernetes workloads, and GitHub Actions orchestrates every deployment.

---

## Quick Reference

| What | Tool | Namespace | Files |
|---|---|---|---|
| Cloud infrastructure (cluster, DNS, CDN, IAM) | Terraform | — | `*.tf` |
| Next.js app | Helm | `fenrir-app` | `helm/fenrir-app/` |
| Odin's Throne monitor | Helm | `fenrir-monitor` | `helm/odin-throne/` |
| Umami analytics + PostgreSQL | Helm | `fenrir-analytics` | `helm/umami/` |
| n8n marketing engine | Helm | `fenrir-marketing` | `helm/n8n/` |
| Agent sandbox Jobs | Shell script | `fenrir-agents` | `k8s/agents/dispatch-job.sh` |
| CI/CD pipeline | GitHub Actions | — | `.github/workflows/deploy.yml` |

---

## Sub-Documents (`docs/`)

- **[Architecture Overview](docs/architecture-overview.md)** — Top-level map: what runs in GKE, what lives in Terraform, namespace layout, and how everything connects.

- **[Helm Charts](docs/helm-charts.md)** — Helm charts (`fenrir-app`, `odin-throne`, `umami`): what each deploys, key values, upgrade commands, and how `values-prod.yaml` differs from `values.yaml`.

- **[Agent Sandbox](docs/agent-sandbox.md)** — How agent GKE Jobs work: `dispatch-job.sh` flow, the sandbox container, job-template placeholders, secrets, job lifecycle, and log retrieval.

- **[Terraform](docs/terraform.md)** — Every `.tf` file documented: GKE cluster, DNS, CDN, Firestore, Artifact Registry, IAM. How to run `terraform apply` locally and in CI.

- **[Deployment Pipeline](docs/deployment-pipeline.md)** — `deploy.yml` change detection matrix, which jobs run on which path changes, how secrets are wired, and rollback procedures.

- **[Legacy Manifests](docs/legacy-manifests.md)** — What was in `k8s/app/` and `k8s/namespaces.yaml`, why they were deleted, and what `k8s/agents/` is (still active, not managed by Helm).

---

## Getting Started

```bash
# Set up kubectl access to the GKE cluster
bash scripts/gke-setup.sh

# Verify the cluster is healthy
cat SMOKE-TEST.md
```

---

## ADRs (`adrs/`)

Architecture decisions that shaped this infrastructure:

- [ADR-001: Vercel → GKE Autopilot](adrs/ADR-001-vercel-to-gke-autopilot.md)
- [ADR-002: Next.js Standalone Docker Builds](adrs/ADR-002-standalone-docker-builds.md)
- [ADR-003: Helm for K8s Manifest Management](adrs/ADR-003-helm-k8s-manifest-management.md)
- [ADR-004: GKE Jobs for Agent Execution](adrs/ADR-004-gke-jobs-agent-execution.md)
- [ADR-005: In-cluster Redis (over Vercel KV)](adrs/ADR-005-redis-over-vercel-kv.md) — **Superseded** (Redis removed; Firestore is the entitlement store)
- [ADR-006: Self-Hosted Umami Analytics](adrs/ADR-006-umami-self-hosted-analytics.md)
- [ADR-007: Cloud DNS + Google-Managed Certs](adrs/ADR-007-gcloud-dns-managed-certs.md)

---

## Operational Runbooks

- [SMOKE-TEST.md](SMOKE-TEST.md) — Manual verification: Ingress IP, health check, pod status, Helm releases
- [k8s/agents/README.md](k8s/agents/README.md) — Agent sandbox setup and monitoring guide
