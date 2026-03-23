---
name: brandify-agent
description: "Convert agent log files (stream-json from Claude Code) into MDX chronicles published at /chronicles/agent-{slug}. Use when the user says 'brandify agent', 'agent report', 'prettify agent log', or wants to publish agent execution logs as chronicles."
---

# Brandify Agent — Agent Log to MDX Chronicle

Converts Claude Code stream-json agent logs into MDX chronicles with plain HTML markup, styled by `chronicle.css`. Published at `/chronicles/agent-{slug}`.

## Usage

```
/brandify-agent <session-id-or-log-path>
/brandify-agent <file1.log> <file2.log> <file3.log>        # saga mode
```

## Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| `<session-id>` | Yes | Session ID (looks up `tmp/agent-logs/<id>.log`) or full path to `.log` file |

### Saga Mode (multiple files)

When given 2+ log files, brandify automatically combines them into a single continuous
saga report via `combine-saga.mjs`. Files are auto-sorted by step number from the filename
pattern (`issue-N-stepS-agent-hash`). The combined report shows chapter divisions between
sessions.

## Workflow

### Step 1 — Download log from GKE cluster (ALWAYS try this first)

When given a session ID, **always** attempt to download the latest log from the GKE
cluster before falling back to any cached local copy. This ensures the report reflects
the most recent agent output, even if the agent is still running.

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
SESSION_ID="<session-id>"
LOG_DIR="$REPO_ROOT/tmp/agent-logs"
LOG_FILE="$LOG_DIR/$SESSION_ID.log"

# Always try to download fresh from GKE first
mkdir -p "$LOG_DIR"
kubectl logs "job/agent-$SESSION_ID" -n fenrir-agents --timestamps=false > "$LOG_FILE.tmp" 2>/dev/null
if [ -s "$LOG_FILE.tmp" ]; then
  mv "$LOG_FILE.tmp" "$LOG_FILE"
  echo "[ok] Downloaded fresh log from GKE: $LOG_FILE"
elif [ -f "$LOG_FILE" ]; then
  rm -f "$LOG_FILE.tmp"
  echo "[info] GKE download failed, using cached log: $LOG_FILE"
else
  rm -f "$LOG_FILE.tmp"
  echo "[error] No log available — GKE download failed and no cached copy"
  exit 1
fi
```

If the argument is a full file path (contains `/` or ends with `.log`), use it directly
(skip the download step — the user provided a specific file).

**Saga mode:** If multiple file paths are provided (2+ files), combine them first:

```bash
SAGA_FILE="$REPO_ROOT/tmp/agent-logs/saga-issue-$(date +%s).log"
COMBINE="$REPO_ROOT/.claude/skills/brandify-agent/scripts/combine-saga.mjs"
node "$COMBINE" --output "$SAGA_FILE" --sort <file1> <file2> <file3>
LOG_FILE="$SAGA_FILE"
```

Then proceed to Step 2 with the combined saga log.

### Step 2 — Generate the chronicle

```bash
SCRIPT="$REPO_ROOT/.claude/skills/brandify-agent/scripts/generate-agent-report.mjs"
BLOG_DIR="$REPO_ROOT/development/ledger/content/blog"
node "$SCRIPT" --input "$LOG_FILE" --blog-dir "$BLOG_DIR"
```

Output: `content/blog/agent-{session-slug}.mdx` with frontmatter (title, date, rune, excerpt, slug, category: "agent"). Viewable at `/chronicles/agent-{slug}`. Uses `<details>`/`<summary>` for collapsible turns (no JS needed). Agent chronicles display with an "Agent" badge on the index and detail pages.

### Step 3 — Report

```
**Report generated:** `<mdx-path>`
**Turns:** N | **Tool calls:** N | **Errors:** N
View at `/chronicles/agent-{slug}`
```

## Metadata Detection

The report extracts session ID, branch, and model from multiple sources (in priority order):

1. **Entrypoint text lines** — GKE startup output before JSON events (Session:, Branch:, Model:)
2. **JSON `system/init` event** — Always present in stream-json logs (contains `model`, `session_id`)
3. **Filename** — Dispatch session ID pattern: `issue-<N>-step<S>-<agent>-<hash>.log`
4. **Git commands in log** — Branch name from `git branch --show-current` tool results

## Features

- Plain HTML output compatible with MDXRemote `format: "md"` + `rehypeRaw`
- Collapsible turns with thinking, text, and tool blocks via `<details>`/`<summary>`
- Color-coded tool badges (Bash=teal, Read=blue, Edit=amber, Write=gold, Todo=purple)
- Entrypoint section with decree formatting
- Stats grid with turn/tool/error/token/git counts
- Auto-detected QA verdict with PASS/FAIL styling
- Decree Complete block rendering
- Agent callback with Norse signoff
- Secret masking via sanitize-chronicle.mjs
- Post-generation MDX compile validation
