---
description: Stream parsed agent logs from GKE. Accepts issue number, session ID, or --all. Opens in tmux right-column pane.
---

Stream agent execution logs from GKE Autopilot K8s Jobs.

The argument `$ARGUMENTS` can be:
- An issue number (e.g. `714`) — finds the latest job for that issue
- A session ID (e.g. `issue-714-step1-firemandecko-3a19c027`) — direct lookup
- `--all` — all active agent jobs

## Instructions

1. Parse `$ARGUMENTS` to determine the target:
   - Strip `#` prefix if present
   - If it looks like a session ID (`issue-N-stepS-agent-uuid`), use directly
   - If it's a number, resolve to the latest job via `--issue`
   - If `--all`, pass through

2. Run `agent-logs.mjs` with `--spawn-pane` to open in a tmux right-column pane:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
node "$REPO_ROOT/infrastructure/k8s/agents/agent-logs.mjs" <target> --tools --spawn-pane
```

For `--all`:
```bash
node "$REPO_ROOT/infrastructure/k8s/agents/agent-logs.mjs" --all --tmux --tools
```

3. Report back:
```
Streaming <target> in tmux pane
```

## Additional flags (pass through from $ARGUMENTS)

- `--thinking` — include thinking blocks
- `--no-follow` — dump existing logs, don't stream
- `--raw` — show raw JSONL
- `--verbose` — alias for --tools (default)
