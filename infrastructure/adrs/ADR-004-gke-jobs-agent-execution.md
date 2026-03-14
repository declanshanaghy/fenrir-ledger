# ADR-004 — GKE Jobs for Agent Execution

**Status:** Accepted
**Date:** 2026-03-14
**Authors:** FiremanDecko (Principal Engineer)
**Ref:** GitHub Issue #857; supersedes ADR-007 (Remote Builder Platforms) recommendation of Depot

---

## Context

Fenrir Ledger uses a multi-agent orchestration pattern where a local orchestrator
dispatches parallel Claude Code sessions to perform engineering tasks — design,
implementation, QA — on isolated git branches.

[ADR-007](../../architecture/adrs/ADR-007-remote-builder-platforms.md) (2026-03-06)
evaluated external managed platforms (Depot, E2B, Daytona, Codespaces, Coder) and
recommended **Depot** as the primary platform for remote agent execution. The key
driver was relieving CPU/memory pressure on the local machine while keeping the
orchestrator local.

Between the evaluation and implementation, a more constrained requirement became
clear: **Fenrir Ledger already runs on GKE Autopilot**. All application workloads,
the Redis database, monitoring, and IAM are managed in a private GKE cluster in
`us-central1`. The team controls this cluster. Adding a dependency on a third-party
sandbox vendor meant paying for compute we already own, routing agent secrets outside
our security perimeter, and accepting a cold-start penalty on an unknown external
network path.

### Requirements

1. Agents must authenticate via `CLAUDE_CODE_OAUTH_TOKEN` (subscription auth, not API billing)
2. Secrets (`CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN`) must not leave the GCP project
3. Agents must be truly ephemeral — no state persists after job completion
4. Max concurrent agents must be capped to prevent runaway costs
5. Agent pods must be network-isolated from application workloads
6. Pod eviction (Spot preemption) must be handled gracefully
7. Logs must be observable from the same toolchain as application logs

---

## Options Considered

### 1. Depot (prior recommendation — ADR-007)

Managed Claude Code sandbox platform. Secrets would be stored at Depot's
organization level and injected at runtime.

**Why rejected:**
- Secrets (`CLAUDE_CODE_OAUTH_TOKEN`) must leave our GCP project perimeter to reach
  Depot's infrastructure — unacceptable given the token grants full Claude Max
  subscription access
- Additional $0.60/hr per agent on top of GKE compute already paid
- New external vendor dependency with no SLA; if Depot is unavailable, agent dispatch
  stops entirely
- Depot is not in our existing GCP billing, IAM, or audit log chain

### 2. GitHub Actions (`claude-code-action`)

Official Anthropic GitHub Action for Claude Code in CI/CD.

**Why rejected:**
- OAuth tokens expire in ~1 day in this context — subscription auth is unreliable
- 6-hour job limit is sufficient but not ideal for complex tasks
- No persistent workspace between steps
- Actions minutes cost ($0.008/min) adds up; GKE Spot is cheaper

### 3. GKE Autopilot Jobs (chosen)

Ephemeral `batch/v1 Job` resources in the existing `fenrir-agents` Kubernetes
namespace on the cluster already running application workloads.

---

## Decision

**Use Kubernetes Jobs on the existing GKE Autopilot cluster for all agent execution.**

Implementation lives in `infrastructure/k8s/agents/`. The dispatch flow is:

```
/dispatch skill → dispatch-job.sh → kubectl apply → GKE Job (fenrir-agents ns)
                                                      ├── entrypoint.sh
                                                      ├── git clone + branch setup
                                                      ├── npm ci
                                                      └── claude --print --output-format stream-json
```

### Container Image

A custom image (`agent-sandbox`) is built from `infrastructure/k8s/agents/Dockerfile`
and pushed to Artifact Registry (`us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/agent-sandbox`).

It pre-bakes:
- Node.js 20, Claude Code CLI (`@anthropic-ai/claude-code`), GitHub CLI
- Playwright Chromium + system dependencies
- A warm npm cache to minimize cold-start time

The image runs as the `node` user (uid 1000). Claude Code refuses
`--dangerously-skip-permissions` as root, so root is never used.

### Job Spec Highlights (`job-template.yaml`)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `backoffLimit` | 0 | Agent tasks are not idempotent — no retries |
| `activeDeadlineSeconds` | 3600 | 60-minute hard timeout per agent |
| `ttlSecondsAfterFinished` | 1800 | Auto-delete pods 30 minutes after completion |
| CPU / Memory | 2 vCPU / 4 GiB | Matches Depot's default specs; sufficient for `npm ci` + Claude |
| `ephemeral-storage` | 10 GiB | Covers full repo clone + Playwright browser |
| `nodeSelector` | `cloud.google.com/gke-spot: "true"` | Spot nodes — up to 70% cost savings |

### Namespacing and Isolation

Agent jobs run in the `fenrir-agents` namespace, separate from `fenrir-app`.
Network policies enforce:
- **No inbound traffic** to agent pods from any source
- **Egress only** on ports 53 (DNS), 80, 443 (HTTPS for API + GitHub)
- **Implicit deny** blocks agent pods from reaching Redis or any app services

A `ResourceQuota` on `fenrir-agents` caps the namespace at:
- 8 pods / 16 vCPU / 32 GiB memory total

This prevents a runaway dispatch loop from consuming the full cluster budget.

### Secrets

Secrets are stored in a Kubernetes Secret (`agent-secrets`) in the `fenrir-agents`
namespace. They never leave the GCP project boundary:

```
CLAUDE_CODE_OAUTH_TOKEN  ← claude-oauth-token (K8s Secret)
GH_TOKEN                 ← gh-token (K8s Secret)
```

The `fenrir-agents-sa` Kubernetes service account is bound to a GCP service account
(`fenrir-agents-workload`) via Workload Identity. It has `logging.logWriter`,
`monitoring.metricWriter`, and `storage.objectAdmin` — no broader project permissions.

### Eviction Handling

Spot pods can be preempted by GKE Autopilot. `entrypoint.sh` traps `SIGTERM` and
runs a cleanup handler that commits any staged work-in-progress and pushes to the
branch before the pod terminates (30-second grace period).

### Prompt Encoding

`dispatch-job.sh` base64-encodes the task prompt before injecting it into the Job
manifest as an environment variable. This avoids YAML quoting issues with multi-line
prompts containing special characters. `entrypoint.sh` decodes it before passing to
`claude`.

---

## Consequences

### Positive

- **No secrets leave the GCP project** — `CLAUDE_CODE_OAUTH_TOKEN` stays in K8s
  Secrets, visible only to agents via Workload Identity
- **No new vendor dependency** — Depot, E2B, or Daytona accounts not required; agent
  infrastructure managed in the same Terraform/Helm/`kubectl` chain as the app
- **Cost reduction** — Spot preemptible pods cost ~70% less than on-demand; no
  per-minute SaaS markup
- **Unified observability** — agent logs flow into the same Cloud Logging workspace
  as application logs; same dashboards, same alert policies
- **Namespace isolation** — network policies prevent agent code from reaching
  production Redis or application services even if an agent goes rogue
- **Capacity control** — `ResourceQuota` hard-caps parallel execution; cost is
  bounded at the Kubernetes level without application-layer coordination

### Negative

- **More operational surface** — container image must be built and pushed to
  Artifact Registry on changes to the Dockerfile or entrypoint
- **Cold start is slower** than managed platforms (~30–60s for GKE Autopilot to
  provision a Spot node vs. 90–150ms for E2B/Daytona)
- **No session persistence** — Jobs are ephemeral; git push is the only durable
  state. A preempted agent must be re-dispatched from scratch if cleanup push fails
- **Token management unchanged** — `CLAUDE_CODE_OAUTH_TOKEN` must still be
  regenerated annually via `claude setup-token` and updated in the K8s Secret

### Risks

| Risk | Mitigation |
|------|------------|
| Spot eviction interrupts long task | `SIGTERM` handler commits WIP; re-dispatch with same branch |
| Node cold start delays block CI | Pre-warm node pool via `warm-node-pool.yaml` (Helm chart) |
| OAuth token bugs in containers | Mitigated by running as non-root; monitor Anthropic Issue #8938 |
| ResourceQuota exhausted | `dispatch-job.sh` fails fast with `kubectl` error; alert on quota usage |
| `agent-sandbox` image drift | CI builds and pushes image on Dockerfile changes |

---

## References

- `infrastructure/k8s/agents/` — full implementation
- `infrastructure/k8s/namespaces.yaml` — namespace, RBAC, ResourceQuota, NetworkPolicy
- `infrastructure/iam.tf` — Workload Identity bindings for `fenrir-agents-sa`
- `infrastructure/gke.tf` — Autopilot cluster configuration
- [ADR-007: Remote Builder Platforms](../../architecture/adrs/ADR-007-remote-builder-platforms.md) — prior evaluation, superseded for execution model
- [GKE Autopilot Spot Pods](https://cloud.google.com/kubernetes-engine/docs/concepts/spot-vms)
- [Kubernetes Jobs Documentation](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
