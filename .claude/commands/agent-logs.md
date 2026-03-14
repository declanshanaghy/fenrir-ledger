---
description: Stream parsed agent logs from GKE. Accepts issue number, session ID, or --all. Opens in tmux right-column pane.
---

Stream agent execution logs from GKE Autopilot K8s Jobs.

The argument `$ARGUMENTS` can be:
- An issue number (e.g. `714`) — finds the latest job for that issue
- A session ID (e.g. `issue-714-step1-firemandecko-3a19c027`) — direct lookup
- `--all` or `all` — all active agent jobs

## Instructions

1. Parse `$ARGUMENTS` to determine the target:
   - Strip `#` prefix if present
   - If it looks like a session ID (`issue-N-stepS-agent-uuid`), use directly
   - If it's a number, resolve to the latest job via `--issue`
   - If `--all` or `all`, use the --all flow below

2. **For a single target** — spawn one pane:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
node "$REPO_ROOT/infrastructure/k8s/agents/agent-logs.mjs" <target> --tools --spawn-pane
```

3. **For `--all`** — get all active jobs and spawn a pane for EACH one using `--spawn-pane`:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
kubectl get jobs -n fenrir-agents \
  -o jsonpath='{range .items[?(@.status.active)]}{.metadata.name}{"\n"}{end}' | \
while read job; do
  [ -z "$job" ] && continue
  sid="${job#agent-}"
  node "$REPO_ROOT/infrastructure/k8s/agents/agent-logs.mjs" "$sid" --tools --spawn-pane
done
```

**IMPORTANT:** Do NOT use `--all --tmux` — that blocks the current process. Always loop
with `--spawn-pane` so each agent gets its own non-blocking tmux pane.

4. Report back:
```
Streaming N active agents in tmux panes
```
Or if no active agents: "No active agent jobs found."

## Additional flags (pass through from $ARGUMENTS)

- `--thinking` — include thinking blocks
- `--no-follow` — dump existing logs, don't stream
- `--raw` — show raw JSONL
- `--verbose` — alias for --tools (default)
