# Infrastructure — FiremanDecko's Forge

GKE Autopilot infrastructure for Fenrir Ledger: Terraform, Kubernetes manifests, agent sandbox, and operational runbooks.

---

## Getting Started

```bash
# Authenticate and set up GKE access
bash scripts/gke-setup.sh

# Verify the app is running
cat infrastructure/SMOKE-TEST.md
```

## Key Files

| File | Purpose |
|------|---------|
| `main.tf` | Terraform provider configuration and GCP API enablement |
| `gke.tf` | GKE Autopilot cluster definition |
| `iam.tf` | Workload Identity bindings for app and agent service accounts |
| `network.tf` | VPC, subnets, and firewall rules |
| `monitoring.tf` | Cloud Monitoring uptime checks and alert policies |
| `cdn-monitoring.tf` | Cloud CDN monitoring and alert policies |
| `firestore.tf` | Firestore database and IAM for cloud sync |
| `artifact-registry.tf` | Google Artifact Registry for container images |
| `dns.tf` | Cloud DNS managed zone configuration |
| `variables.tf` | Terraform input variables |
| `outputs.tf` | Terraform output values |
| `SMOKE-TEST.md` | Manual verification steps: Ingress IP, health check, pod status |

## Kubernetes Manifests

### App (`k8s/app/`)

Next.js standalone app running in the `fenrir-app` namespace.

- `deployment.yaml` — App Deployment with rolling update strategy
- `service.yaml` — ClusterIP service
- `ingress.yaml` — Google-managed load balancer with SSL cert
- `RUNBOOK.md` — Rollback, scaling, and health check procedures

### Agents (`k8s/agents/`)

Ephemeral GKE Jobs for Claude Code agent execution in the `fenrir-agents` namespace.

- `Dockerfile` — Agent sandbox container image
- `entrypoint.sh` — Clone, setup, and run Claude Code
- `job-template.yaml` — K8s Job spec template
- `dispatch-job.sh` — Script to generate and apply Job manifests
- `agent-logs.mjs` — Stream and parse agent JSONL logs
- `README.md` — Full setup and monitoring guide

### Namespaces (`k8s/namespaces.yaml`)

Defines `fenrir-app` and `fenrir-agents` namespaces with RBAC, ResourceQuota, and NetworkPolicy.

## ADRs (`infrastructure/adrs/`)

Infrastructure Architecture Decision Records:

- [ADR-001: Vercel to GKE Autopilot](adrs/ADR-001-vercel-to-gke-autopilot.md) — Full migration from Vercel serverless to GKE Autopilot. **Accepted, current.**
- [ADR-002: Standalone Docker Builds](adrs/ADR-002-standalone-docker-builds.md) — Next.js standalone output for multi-stage Docker builds. **Accepted, current.**
- [ADR-003: Helm K8s Manifest Management](adrs/ADR-003-helm-k8s-manifest-management.md) — Helm for templating K8s manifests. **Accepted, current.**
- [ADR-004: GKE Jobs for Agent Execution](adrs/ADR-004-gke-jobs-agent-execution.md) — GKE Autopilot Jobs superseding Depot for agent sandbox execution. **Accepted, current.**
- [ADR-005: Redis over Vercel KV](adrs/ADR-005-redis-over-vercel-kv.md) — In-cluster Redis StatefulSet replacing Vercel KV. **Accepted, current.**
- [ADR-006: Umami Self-Hosted Analytics](adrs/ADR-006-umami-self-hosted-analytics.md) — Self-hosted Umami for privacy-first analytics. **Accepted, current.**
- [ADR-007: gcloud DNS + Managed Certs](adrs/ADR-007-gcloud-dns-managed-certs.md) — Google-managed SSL certs and Cloud DNS. **Accepted, current.**
