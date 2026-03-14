---
name: brandify-agent
description: "Convert agent log files (stream-json from Claude Code) into styled HTML reports using the Fenrir Ledger theme. Use when the user says 'brandify agent', 'agent report', 'prettify agent log', or wants to view agent execution logs as HTML."
---

# Brandify Agent — Agent Log to HTML Report

Converts Claude Code stream-json agent logs into styled, interactive HTML reports using the Fenrir Ledger visual system. Not published — local viewing only.

## Usage

```
/brandify-agent <session-id-or-log-path>
/brandify-agent --regen-assets
```

## Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| `<session-id>` | Yes (unless `--regen-assets`) | Session ID (looks up `tmp/agent-logs/<id>.log`) or full path to `.log` file |
| `--regen-assets` | No | Regenerate shared CSS/JS files without processing a log |

## Workflow

### Step 1 — Resolve the log file

If the argument looks like a session ID (no `/` or `.log`), resolve to:
`tmp/agent-logs/<session-id>.log`

If it's a path, use it directly.

Error if the file doesn't exist.

### Step 2 — Generate the HTML report

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
SCRIPT="$REPO_ROOT/.claude/skills/brandify-agent/scripts/generate-agent-report.mjs"
node "$SCRIPT" --input "<log-file>"
```

Output goes to the same directory with `.html` extension (replacing `.log`).
Shared assets (`agent-report.css`, `agent-report.js`) are auto-generated alongside.

### Step 3 — Report

```
**Report generated:** `<html-path>`
**Turns:** N | **Tool calls:** N | **Errors:** N
**Verdict:** PASS/FAIL/none
Open: `open <html-path>`
```

## Regenerate Assets

To regenerate shared CSS/JS without processing a log:

```bash
node "$SCRIPT" --regen-assets --output-dir tmp/agent-logs
```

## Output Structure

```
tmp/agent-logs/
  agent-report.css        ← shared theme (regenerable)
  agent-report.js         ← shared toggle logic (regenerable)
  issue-682-step2-loki-xxxx.log   ← raw log (input)
  issue-682-step2-loki-xxxx.html  ← styled report (output)
```

## Features

- Fenrir Ledger dark theme (void black, gold accents, Cinzel fonts)
- Collapsible turns with thinking, text, and tool blocks
- Color-coded tool badges (Bash=teal, Read=blue, Edit=amber, Write=gold, Todo=purple)
- Entrypoint section with color-coded status lines
- Summary bar with turn/tool/error counts
- Auto-detected QA verdict with PASS/FAIL styling
- Expand All / Collapse All controls
