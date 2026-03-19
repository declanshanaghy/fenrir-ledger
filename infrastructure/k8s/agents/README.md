# Agent Sandbox Infrastructure — GKE Autopilot

Ephemeral Kubernetes Jobs for running Claude Code agent tasks on GKE Autopilot.

## GitHub PAT Token Strategy

Two tokens are used. Both live in `.secrets` and are synced to K8s via the `Sync agent secrets`
step in `deploy.yml`. Agent pods receive `GH_TOKEN` set to the classic PAT.

| Secret Name | K8s Key | Env Var | Use Case |
|---|---|---|---|
| `GITHUB_TOKEN_PAT_CLASSIC` | `gh-token-classic` | `GH_TOKEN` (agents) | `gh pr edit`, `gh issue comment`, `gh project item-add`, `git push` — any write operation |
| `GITHUB_TOKEN_PAT_FINE_GRAINED` | `gh-token-fine-grained` | `GITHUB_TOKEN` (CI) | `gh pr view`, `gh issue view`, CI status checks, PR comment upserts — read-only / low-privilege |

**Why classic for agents?** Fine-grained PATs do not support GitHub Projects v2 (`project` scope)
or certain PR edit operations. Agents need full write access; the classic PAT has `repo` + `project`.

**Why fine-grained for CI?** CI workflows only read PRs/issues and post comments. The fine-grained
PAT is repo-scoped and can be rotated independently without affecting agent dispatch.

**Fail-fast guarantee:** `entrypoint.sh` exits immediately with `[FATAL]` if `GH_TOKEN` is unset,
preventing silent fallback to an incorrect or missing token.

## Architecture

```
dispatch skill → dispatch-job.sh → kubectl apply → GKE Autopilot Job
                                                    ├── Clone repo
                                                    ├── Checkout branch
                                                    ├── Install deps
                                                    ├── Run Claude Code CLI
                                                    └── Auto-cleanup (ttlSecondsAfterFinished)
```

## Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Agent sandbox container image |
| `entrypoint.sh` | Container entrypoint — clone, setup, run Claude |
| `job-template.yaml` | K8s Job spec template with placeholders |
| `secrets-template.yaml` | K8s Secret template (DO NOT commit real values) |
| `dispatch-job.sh` | Script to generate and apply Job manifests |
| `agent-logs.mjs` | Stream + parse agent JSONL logs (saves to `tmp/agent-logs/`) |

## Setup

### 1. Build and push the container image

```bash
# From repo root
docker build -t us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/agent-sandbox:latest \
  -f infrastructure/k8s/agents/Dockerfile .

docker push us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/agent-sandbox:latest
```

### 2. Create the K8s secrets

```bash
kubectl create secret generic agent-secrets \
  --namespace fenrir-agents \
  --from-literal=anthropic-api-key="<your-anthropic-key>" \
  --from-literal=gh-token-classic="<classic-pat-with-repo-and-project-scopes>" \
  --from-literal=gh-token-fine-grained="<fine-grained-pat-scoped-to-this-repo>" \
  --from-literal=claude-oauth-token="<claude-code-oauth-token>"
```

**Note:** `gh-token-classic` must be a **classic PAT** with `repo` and `project` scopes — required
for `gh pr edit`, `gh issue comment`, `gh project item-add`, and `git push`.
`gh-token-fine-grained` is a **fine-grained PAT** scoped to this repo for read-only CI operations.
See the PAT Token Strategy table above for the full routing breakdown.

### 3. Dispatch an agent

```bash
bash infrastructure/k8s/agents/dispatch-job.sh \
  --session-id "issue-681-step1-firemandecko-$(uuidgen | cut -c1-8)" \
  --branch "feat/issue-681-description" \
  --model "claude-opus-4-6" \
  --prompt "Your agent task prompt..."
```

## Resource Specs

- **CPU:** 2 vCPU per agent pod
- **Memory:** 4 GiB per agent pod
- **Max concurrent:** 8 pods (enforced by ResourceQuota)
- **Timeout:** 60 minutes (activeDeadlineSeconds)
- **Cleanup:** 1 hour after completion (ttlSecondsAfterFinished)
- **Pod type:** Spot/preemptible (up to 70% savings)

## Monitoring

```bash
# List running agent jobs
just infra agent-jobs

# Stream parsed agent logs (with pod startup polling)
just infra agent-log-issue 744

# Stream all active agents in tmux panes
just infra agent-log-all

# Dump finished session logs
just infra agent-log-dump <session-id>

# Generate HTML report from saved logs
/brandify-agent <session-id>
```

Cloud Logging also captures all agent output automatically via GKE's workload logging.
