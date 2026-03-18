# Agent Sandbox — GKE Jobs for Claude Code

Agent sandboxes are **ephemeral GKE Jobs** that run Claude Code CLI on a containerized clone of the repository. They live in the `fenrir-agents` namespace, are dispatched by `dispatch-job.sh`, and self-delete after 30 minutes via `ttlSecondsAfterFinished`.

All agent sandbox files live under `infrastructure/k8s/agents/`.

---

## How It Works — End to End

```
1. User / skill invokes dispatch-job.sh
         |
         v
2. dispatch-job.sh fills placeholders in job-template.yaml
   → generates a unique Job manifest
         |
         v
3. kubectl apply -f <generated-job>.yaml -n fenrir-agents
         |
         v
4. GKE Autopilot schedules the Job on a Spot node
         |
         v
5. Container starts entrypoint.sh:
   a. Configure git auth (GH_TOKEN)
   b. Wait for DNS (CoreDNS ready check)
   c. Clone the repo
   d. Checkout/create BRANCH
   e. Run sandbox-setup.sh (npm ci, etc.)
   f. Invoke: claude --model $AGENT_MODEL --dangerously-skip-permissions "$TASK_PROMPT"
         |
         v
6. Claude Code runs the task, commits, pushes, opens PR
         |
         v
7. Job completes (exit 0) or fails (exit 1)
   → TTL: auto-deleted 30 min after completion
```

---

## Key Files

| File | Purpose |
|---|---|
| `job-template.yaml` | K8s Job spec with `{{PLACEHOLDER}}` substitution tokens |
| `dispatch-job.sh` | Fills placeholders, generates manifest, runs `kubectl apply` |
| `entrypoint.sh` | Container entrypoint: git setup, clone, run Claude Code |
| `Dockerfile` | Agent sandbox container image definition |
| `secrets-template.yaml` | Template for `agent-secrets` K8s Secret (reference only — do not apply manually) |
| `agent-logs.mjs` | Node.js utility to stream and parse JSONL agent logs from GKE |
| `mayo-heckler.mjs` | Utility for monitoring/heckler functionality |
| `README.md` | Full setup and monitoring guide |

---

## Dispatching an Agent Job

```bash
bash infrastructure/k8s/agents/dispatch-job.sh \
  --session-id "issue-681-step1-firemandecko-a1b2c3d4" \
  --branch "feat/issue-681-gke-agent-sandboxes" \
  --model "claude-opus-4-6" \
  --prompt "Your task prompt here..." \
  [--image-tag "latest"] \
  [--issue-number "681"] \
  [--dry-run]
```

`--dry-run` prints the generated manifest without applying it — useful for inspection.

### What dispatch-job.sh does

1. Validates all required args (`--session-id`, `--branch`, `--model`, `--prompt`)
2. Optionally fetches issue/PR titles via `gh` CLI (stored as Job annotations for the monitor)
3. Generates a DNS-safe Job name: `agent-<session-id>` (lowercase, max 63 chars)
4. Substitutes all `{{PLACEHOLDER}}` tokens in `job-template.yaml`
5. Base64-encodes `TASK_PROMPT` to avoid YAML escaping issues
6. Runs `kubectl apply -f <generated-manifest>.yaml` (or prints if `--dry-run`)

---

## Job Template Placeholders

| Placeholder | Value source | Description |
|---|---|---|
| `{{JOB_NAME}}` | Auto-generated | DNS-safe job name, max 63 chars |
| `{{SESSION_ID}}` | `--session-id` arg | Unique session identifier |
| `{{BRANCH}}` | `--branch` arg | Git branch to checkout/create |
| `{{AGENT_MODEL}}` | `--model` arg | Claude model (e.g. `claude-opus-4-6`) |
| `{{IMAGE_TAG}}` | `--image-tag` (default: `latest`) | Container image tag |
| `{{TASK_PROMPT}}` | `--prompt` arg (base64-encoded) | The full task prompt |
| `{{ISSUE_TITLE}}` | Fetched via `gh issue view` | For Job annotation display in monitor |
| `{{PR_TITLE}}` | Fetched via `gh pr list` | For Job annotation display in monitor |

---

## Job Spec Details

| Setting | Value | Why |
|---|---|---|
| `namespace` | `fenrir-agents` | Isolated from app namespace |
| `ttlSecondsAfterFinished` | 1800 (30 min) | Auto-cleanup of completed/failed Jobs |
| `activeDeadlineSeconds` | 7200 (2 hours) | Hard cap — prevents runaway agents |
| `backoffLimit` | 5 | Retries on transient failures (Autopilot node scale-up) |
| `restartPolicy` | `Never` | Each attempt = new pod |
| `nodeSelector` | `cloud.google.com/gke-spot: "true"` | Use Spot nodes (up to 70% cheaper) |
| CPU / memory | 2 vCPU / 4Gi | Per request and limit |
| `ephemeral-storage` | 10Gi | For repo clone + npm deps |
| `serviceAccountName` | `fenrir-agents-sa` | Workload Identity for Artifact Registry |

---

## Secrets

The agent container receives two secrets from the `agent-secrets` K8s Secret:

| Secret key | Env var | Purpose |
|---|---|---|
| `claude-oauth-token` | `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code CLI OAuth subscription token |
| `gh-token` | `GH_TOKEN` | GitHub fine-grained PAT (contents, PRs, issues, workflows, metadata) |

The `agent-secrets` Secret is **created and populated by CI** (`deploy.yml` "Sync agent secrets" step) via `kubectl create secret ... --dry-run=client | kubectl apply`. Never commit real values.

To update secrets manually:
```bash
kubectl create secret generic agent-secrets \
  --namespace fenrir-agents \
  --from-literal=anthropic-api-key="<KEY>" \
  --from-literal=gh-token="<PAT>" \
  --from-literal=claude-oauth-token="<OAUTH_TOKEN>" \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## Retrieving Logs

```bash
# Stream live logs
kubectl logs job/<JOB_NAME> -n fenrir-agents --follow

# Get all pod logs for a session
kubectl logs -l fenrir.dev/session-id=<SESSION_ID> -n fenrir-agents

# Use the agent-logs utility (parses JSONL output)
node infrastructure/k8s/agents/agent-logs.mjs <SESSION_ID>
```

---

## Job Lifecycle

```
PENDING → RUNNING → SUCCEEDED  (TTL: auto-deleted after 30 min)
                 ↘ FAILED     (up to 5 retries with exponential backoff)
                              (TTL: auto-deleted after 30 min)
```

GKE Autopilot Spot nodes can be preempted. The Job's `terminationGracePeriodSeconds: 30` gives the container time to commit WIP before eviction.

---

## Not Managed by Helm

Agent Jobs are **not managed by Helm**. They are fire-and-forget workloads generated and applied imperatively by `dispatch-job.sh`. This is by design — each agent run is a unique, ephemeral job, not a long-running service.

See [ADR-004](../adrs/ADR-004-gke-jobs-agent-execution.md) for the full rationale.
