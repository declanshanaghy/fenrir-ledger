# Agent Sandbox Infrastructure — GKE Autopilot

Ephemeral Kubernetes Jobs for running Claude Code agent tasks on GKE Autopilot.

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
  --from-literal=anthropic-api-key="sk-ant-..." \
  --from-literal=gh-token="ghp_..."
```

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
kubectl get jobs -n fenrir-agents

# Follow agent logs
kubectl logs job/<job-name> -n fenrir-agents --follow

# Check pod status
kubectl get pods -n fenrir-agents
```

Cloud Logging also captures all agent output automatically via GKE's workload logging.
