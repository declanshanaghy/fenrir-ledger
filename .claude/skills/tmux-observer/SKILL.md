---
name: Observe Agents
description: "Observe background subagent output in tmux panes with decoded, formatted output. Use when the user says 'observe agents', 'watch agents', 'show agent output', 'tmux agents', or 'observe the builds'."
---

# Observe Agents — tmux Observer Skill

Opens a tmux session with one pane per active background agent, each streaming
decoded, color-coded output from the agent's JSONL transcript file.

## When Invoked

Follow these steps exactly:

### Step 1: Check Prerequisites

```bash
which tmux 2>/dev/null || echo "MISSING"
```

If tmux is missing, tell the user:

```
tmux is required. Install with: brew install tmux
```

And stop.

### Step 2: Find Active Agent Output Files

```bash
find /private/tmp/claude-501/*/tasks/*.output -mmin -30 -type f -o -mmin -30 -type l 2>/dev/null | sort -t/ -k7
```

This finds agent output files modified in the last 30 minutes. Each file is either
a plain file or a symlink to a `.jsonl` transcript.

If no files are found, tell the user:

```
No active agent output files found (none modified in last 30 minutes).
```

And stop.

### Step 3: Resolve the Script Path

The formatter script is at `.claude/scripts/agent-observer.py` relative to the
repo root. Resolve the absolute path:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
OBSERVER_SCRIPT="${REPO_ROOT}/.claude/scripts/agent-observer.py"
```

If the script does not exist, tell the user and stop.

### Step 4: Create the tmux Session

Kill any existing session named `fenrir-observers` to get a clean start:

```bash
tmux kill-session -t fenrir-observers 2>/dev/null
```

Collect the output files into an array. Create the session with the first file,
then split panes for each additional file:

```bash
# Collect files
FILES=( $(find /private/tmp/claude-501/*/tasks/*.output -mmin -30 \( -type f -o -type l \) 2>/dev/null | sort -t/ -k7) )
N=${#FILES[@]}

# Create session with first agent
tmux new-session -d -s fenrir-observers -n agents \
  "tail -f '${FILES[0]}' | python3 '${OBSERVER_SCRIPT}'"

# Add panes for remaining agents
for ((i=1; i<N; i++)); do
  tmux split-window -t fenrir-observers:agents \
    "tail -f '${FILES[$i]}' | python3 '${OBSERVER_SCRIPT}'"
  tmux select-layout -t fenrir-observers:agents tiled
done

# Final layout tiling
tmux select-layout -t fenrir-observers:agents tiled
```

### Step 5: Report to User

Print this to the conversation (substitute actual N):

```
Observing N agents in tmux session 'fenrir-observers'

Attach: tmux attach -t fenrir-observers

Controls:
  Ctrl-b left/right  -- switch panes
  Ctrl-b z           -- zoom pane (toggle)
  Ctrl-b d           -- detach
```

### Edge Cases

- **No agent files found**: Print the "no active" message and stop.
- **tmux not installed**: Print install instructions and stop.
- **Single agent**: One pane, no split. Still works.
- **Many agents (4+)**: tmux `tiled` layout handles automatic arrangement.
- **Stale files**: The 30-minute filter excludes old transcripts.

### Manual Usage

If the user wants to observe a specific agent file directly:

```bash
tail -f /private/tmp/claude-501/<dir>/tasks/<agentId>.output \
  | python3 .claude/scripts/agent-observer.py
```

Add `--verbose` for full tool result output, or `--no-color` to disable ANSI codes.
