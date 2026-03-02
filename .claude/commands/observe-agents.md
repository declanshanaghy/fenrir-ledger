---
description: Observe background subagent output in tmux panes with decoded, Norse-themed formatted output
argument-hint: "[auto|split|window|session|here]"
---

# Observe Agents

Stream decoded, color-coded output from background subagent JSONL transcripts.

## Variables

MODE: $ARGUMENTS

## Workflow

### Step 1: Resolve the Formatter Script

```bash
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
OBSERVER_SCRIPT="${REPO_ROOT}/.claude/scripts/agent-observer.py"
test -f "$OBSERVER_SCRIPT" && echo "OK" || echo "MISSING"
```

If the script is missing, STOP and tell the user:
```
agent-observer.py not found. Expected at: .claude/scripts/agent-observer.py
```

### Step 2: Find Active Agent Output Files

```bash
find /private/tmp/claude-501/*/tasks/*.output -mmin -30 \( -type f -o -type l \) 2>/dev/null | sort -t/ -k7
```

If no files are found, STOP and tell the user:
```
No active agent output files found in the last 30 minutes.
```

Collect the list of files into a bash array variable `FILES` for subsequent steps.

### Step 3: Determine Mode

If `MODE` is empty or `auto`:
- Check if currently inside tmux: `[ -n "$TMUX" ]`
  - If yes: behave as `window` (create new tmux window in current session)
  - If no: behave as `session` (create detached session)

Valid modes and their behavior:

#### Mode: `here`
No tmux needed. Pipe the first (most recent) agent output file directly through the formatter. Good for a quick single-agent peek.

```bash
tail -f "${FILES[-1]}" | python3 "$OBSERVER_SCRIPT"
```

If there are multiple files, tell the user how many were found and that `here` mode shows only the most recent one. Suggest using `session` or `window` mode to see all agents.

#### Mode: `split`
Requires tmux. Must already be inside a tmux session (`$TMUX` must be set). Split the current pane horizontally for each agent file.

First check tmux is available:
```bash
which tmux 2>/dev/null || echo "MISSING"
```
If missing: STOP and tell the user:
```
tmux required. Install: brew install tmux. Or use: /observe-agents here
```

If `$TMUX` is not set: STOP and tell the user:
```
Not inside a tmux session. Use 'session' mode or run from within tmux.
```

```bash
for f in "${FILES[@]}"; do
  tmux split-window -h "tail -f '$f' | python3 '$OBSERVER_SCRIPT'"
done
tmux select-layout tiled
```

#### Mode: `window`
Requires tmux. Must already be inside a tmux session. Create a new window with tiled panes.

Check tmux and `$TMUX` as above.

```bash
tmux new-window -n agents "tail -f '${FILES[0]}' | python3 '$OBSERVER_SCRIPT'"
for ((i=1; i<${#FILES[@]}; i++)); do
  tmux split-window -t :agents "tail -f '${FILES[$i]}' | python3 '$OBSERVER_SCRIPT'"
  tmux select-layout -t :agents tiled
done
tmux select-layout -t :agents tiled
```

#### Mode: `session`
Requires tmux (but does NOT require being inside tmux already). Creates a new detached session named `fenrir-observers`.

Check tmux is available (same as above).

```bash
tmux kill-session -t fenrir-observers 2>/dev/null

tmux new-session -d -s fenrir-observers -n agents \
  "tail -f '${FILES[0]}' | python3 '$OBSERVER_SCRIPT'"

for ((i=1; i<${#FILES[@]}; i++)); do
  tmux split-window -t fenrir-observers:agents \
    "tail -f '${FILES[$i]}' | python3 '$OBSERVER_SCRIPT'"
  tmux select-layout -t fenrir-observers:agents tiled
done
tmux select-layout -t fenrir-observers:agents tiled
```

### Step 4: Report to User

After setup, print a summary. Tailor the message to the mode used:

For `session` mode:
```
Observing N agents in tmux session 'fenrir-observers'

Attach:  tmux attach -t fenrir-observers

Controls:
  Ctrl-b left/right  -- switch panes
  Ctrl-b z           -- zoom pane (toggle)
  Ctrl-b d           -- detach
```

For `window` mode:
```
Observing N agents in new tmux window 'agents'

Controls:
  Ctrl-b left/right  -- switch panes
  Ctrl-b z           -- zoom pane (toggle)
  Ctrl-b n/p         -- next/prev window
```

For `split` mode:
```
Observing N agents in split panes

Controls:
  Ctrl-b left/right  -- switch panes
  Ctrl-b z           -- zoom pane (toggle)
```

For `here` mode:
```
Streaming agent output inline. Press Ctrl-C to stop.
(N total agents found -- showing most recent. Use /observe-agents session to see all.)
```

## Edge Cases

- **No output files**: Print the "no active" message and stop.
- **tmux not installed + mode needs tmux**: Print install instructions and suggest `here` mode.
- **Not inside tmux + split/window mode**: Explain the issue and suggest `session` mode.
- **Single agent**: Works in all modes. `split` creates one extra pane, `session`/`window` creates one pane.
- **Many agents (5+)**: tmux `tiled` layout handles automatic arrangement.
- **Stale files**: The `-mmin -30` filter excludes old transcripts.

## Manual Usage

To observe a specific agent file directly without this command:
```bash
tail -f /private/tmp/claude-501/<dir>/tasks/<agentId>.output \
  | python3 .claude/scripts/agent-observer.py
```

Flags: `--verbose` for full tool results, `--no-color` to disable ANSI codes.
