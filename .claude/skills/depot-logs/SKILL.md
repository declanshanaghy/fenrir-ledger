---
name: depot-logs
description: "View Depot sandbox session logs. Use when the user says 'depot logs', 'session log', 'show depot output', 'what did the agent do', or wants to inspect a Depot sandbox session's tool calls, errors, or full output."
---

# Depot Logs — View Depot Sandbox Session Logs

Download and display logs from Depot remote sandbox sessions. Useful for
debugging agent failures, auditing what an agent did, and checking for errors.

## Usage

```bash
bash .claude/scripts/depot-session-log.sh <session-id> [--raw|--errors|--tools]
```

## Modes

| Flag | Output |
|------|--------|
| *(default)* | Compact view: assistant messages + tool calls, errors highlighted with `!!!` |
| `--errors` | Only lines containing error/fatal/failed/denied |
| `--tools` | Tool calls with full input and output (verbose) |
| `--raw` | Raw JSONL for piping to `jq` |

## Examples

```bash
# List available sessions
bash .claude/scripts/depot-session-log.sh

# View compact log
bash .claude/scripts/depot-session-log.sh issue-199-step1-firemandecko-v4

# Show only errors
bash .claude/scripts/depot-session-log.sh issue-199-step1-firemandecko-v4 --errors

# Full tool input/output
bash .claude/scripts/depot-session-log.sh issue-199-step1-firemandecko-v4 --tools
```

## How It Works

1. Searches `~/.claude/projects/<project>/` for JSONL files containing the session
2. Filters to small files (<200 lines) since Depot sessions are compact vs local conversations
3. If not found locally, uses `depot claude --wait --resume` to trigger download
4. Parses the JSONL with `jq` in the requested mode

## Limitations

- Session must have been downloaded via `--wait --resume` at some point, or the
  script triggers a download (which may take a moment)
- The search heuristic uses file size to distinguish Depot sessions from local
  conversations — sessions over 200 lines are skipped
