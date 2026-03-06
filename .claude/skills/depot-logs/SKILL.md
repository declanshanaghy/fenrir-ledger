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

## How to use this skill

1. Run the script via Bash tool
2. Read the generated log file with the Read tool and display it to the user
3. Tell the user where the log file is saved

```
# Step 1: Run the script
bash .claude/scripts/depot-session-log.sh <session-id> [--raw|--errors|--tools]

# Step 2: Read and display the log file
# The script prints the log path on the last line: "Log saved: tmp/depot-logs/<session>.log"
# Use the Read tool to read that file, then output the contents to the user.

# Step 3: Tell the user
# "Log saved to: tmp/depot-logs/<session>.log"
```

**IMPORTANT:** Always use the Read tool to read the log file and output the contents
directly as text in your response. Do NOT just run the script in a Bash tool — the
user cannot see Bash tool output. They need the content in your response text.

## How It Works

1. Searches `~/.claude/projects/<project>/` for JSONL files containing the session
2. Filters to small files (<200 lines) since Depot sessions are compact vs local conversations
3. If not found locally, uses `depot claude --wait --resume` to trigger download
4. Parses the JSONL with `jq` in the requested mode
5. Writes output to `tmp/depot-logs/<session>.log`
6. Prints the log to stdout and shows the file path

## Limitations

- Session must have been downloaded via `--wait --resume` at some point, or the
  script triggers a download (which may take a moment)
- The search heuristic uses file size to distinguish Depot sessions from local
  conversations — sessions over 200 lines are skipped
