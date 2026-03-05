#!/usr/bin/env bash
# Hook: auto-open tmux pane for background subagents
# Triggered by SubagentStart hook in .claude/settings.json
# Reads JSON from stdin, extracts output_file, opens tmux pane with agent-observer.py

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OBSERVER_SCRIPT="${REPO_ROOT}/.claude/scripts/agent-observer.py"

# Read stdin into variable (hook receives JSON)
INPUT=$(cat)

# Extract output_file from the hook payload
# The SubagentStart event may contain the output file path
OUTPUT_FILE=$(echo "$INPUT" | python3 -c "
import json, sys, glob, os
data = json.load(sys.stdin)

# Try direct output_file field
of = data.get('output_file', '')
if of and os.path.exists(of):
    print(of)
    sys.exit(0)

# Try agent_id to find the output file
agent_id = data.get('agent_id', '') or data.get('agentId', '')
if agent_id:
    pattern = f'/private/tmp/claude-501/*/tasks/{agent_id}.output'
    matches = glob.glob(pattern)
    if matches:
        print(matches[0])
        sys.exit(0)

# Fallback: find most recent output file
pattern = '/private/tmp/claude-501/*/tasks/*.output'
matches = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
if matches:
    print(matches[0])
    sys.exit(0)

print('')
" 2>/dev/null || echo "")

# If no output file found, exit silently
[ -z "$OUTPUT_FILE" ] && exit 0

# If observer script missing, exit silently
[ -f "$OBSERVER_SCRIPT" ] || exit 0

# Check if tmux is available
command -v tmux >/dev/null 2>&1 || exit 0

# Extract agent description for the pane title
AGENT_DESC=$(echo "$INPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
desc = data.get('description', '') or data.get('name', '') or 'agent'
print(desc[:30])
" 2>/dev/null || echo "agent")

# Open in tmux
if [ -n "${TMUX:-}" ]; then
    # Inside tmux: create a new pane in current window
    tmux split-window -h -l 80 "tail -f '$OUTPUT_FILE' | python3 '$OBSERVER_SCRIPT'; read -p 'Agent done. Press Enter to close.'"
    tmux select-pane -T "$AGENT_DESC"
    tmux select-layout tiled 2>/dev/null || true
else
    # Not inside tmux: create/update detached session
    if tmux has-session -t fenrir-observers 2>/dev/null; then
        # Add pane to existing session
        tmux split-window -t fenrir-observers:agents \
            "tail -f '$OUTPUT_FILE' | python3 '$OBSERVER_SCRIPT'; read -p 'Agent done. Press Enter to close.'"
        tmux select-layout -t fenrir-observers:agents tiled 2>/dev/null || true
    else
        # Create new session
        tmux new-session -d -s fenrir-observers -n agents \
            "tail -f '$OUTPUT_FILE' | python3 '$OBSERVER_SCRIPT'; read -p 'Agent done. Press Enter to close.'"
    fi
fi

exit 0
