#!/usr/bin/env bash
# depot-session-log.sh — Download and display Depot session logs
#
# Usage:
#   bash .claude/scripts/depot-session-log.sh <session-id> [--raw|--errors|--tools]
#
# Modes:
#   (default)  Show tool calls and assistant messages (compact view)
#   --raw      Dump raw JSONL (for piping to jq)
#   --errors   Show only tool results containing errors
#   --tools    Show tool calls with full input/output
#
# The script searches local session files for the matching session.
# If not found locally, it uses `depot claude --wait --resume` to download it.
set -euo pipefail

QUERY="${1:-}"
MODE="${2:---default}"

# Strip URL to session ID if a depot.dev URL was passed
QUERY="${QUERY##*/}"

# Extract a search term from the session ID for local file matching.
# Depot session IDs (e.g. "issue-199-step1-firemandecko-v4") are NOT stored
# in the JSONL files, but the branch name (e.g. "fix/issue-199-...") IS.
# Extract the issue number to use as a content search key.
SEARCH_KEY="$QUERY"
if [[ "$QUERY" =~ issue-([0-9]+) ]]; then
  SEARCH_KEY="issue-${BASH_REMATCH[1]}"
fi
ORG_ID="${DEPOT_ORG_ID:-pqtm7s538l}"
PROJECT_DIR="$HOME/.claude/projects/-Users-declanshanaghy-src-github-com-declanshanaghy-fenrir-ledger"

if [ -z "$QUERY" ]; then
  echo "Usage: depot-session-log.sh <session-id|search-term> [--raw|--errors|--tools]"
  echo ""
  echo "Examples:"
  echo "  depot-session-log.sh issue-199-step1-firemandecko-v4"
  echo "  depot-session-log.sh issue-199     # finds most recent matching session"
  echo ""
  echo "Available Depot sessions:"
  depot claude list-sessions --org "$ORG_ID" --output json 2>&1 \
    | sed -n '/^\[/,$ p' \
    | jq -r '.[] | "  \(.session_id)  \(.created_at)"' 2>/dev/null
  exit 1
fi

# --- Step 1: Try to download via --wait --resume (idempotent for completed sessions) ---
echo "Syncing session $QUERY from Depot..." >&2
depot claude --wait --resume "$QUERY" --org "$ORG_ID" >/dev/null 2>&1 || true

# --- Step 2: Find the session JSONL locally ---
# Depot sessions are small (<200 lines, <500KB).
# We search small JSONL files for content matching the query.
SESSION_FILE=""

if [ -d "$PROJECT_DIR" ]; then
  # Build a list of candidate files: small JSONL, sorted newest first
  CANDIDATES=$(find "$PROJECT_DIR" -name "*.jsonl" -size -500k -print0 2>/dev/null \
    | xargs -0 ls -t 2>/dev/null)

  for f in $CANDIDATES; do
    lines=$(wc -l < "$f" | tr -d ' ')
    # Depot sessions are 10-200 lines; skip tiny or large files
    if [ "$lines" -gt 5 ] && [ "$lines" -lt 200 ]; then
      if grep -q "$SEARCH_KEY" "$f" 2>/dev/null; then
        SESSION_FILE="$f"
        break
      fi
    fi
  done
fi

if [ -z "$SESSION_FILE" ]; then
  echo "ERROR: Could not find session matching: $QUERY (search key: $SEARCH_KEY)" >&2
  echo "The session may not have been downloaded yet." >&2
  echo "Try: depot claude --wait --resume $QUERY --org $ORG_ID" >&2
  exit 1
fi

LINES=$(wc -l < "$SESSION_FILE" | tr -d ' ')

# --- Step 3: Write output to log file ---
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
LOG_DIR="$REPO_ROOT/tmp/depot-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${QUERY}.log"

{
echo "Session: $QUERY"
echo "File: $(basename "$SESSION_FILE") ($LINES messages)"
echo "Mode: $MODE"
echo "---"
echo ""

case "$MODE" in
  --raw)
    cat "$SESSION_FILE"
    ;;

  --errors)
    jq -r '
      if .type == "user" then
        .message.content[]? |
        if .type == "tool_result" then
          .content as $c |
          if ($c | type) == "string" and ($c | test("(?i)error|fatal|failed|denied|not found|no such")) then
            "ERROR: " + ($c | .[0:2000])
          else empty end
        else empty end
      else empty end
    ' "$SESSION_FILE"
    ;;

  --tools)
    jq -r '
      if .type == "assistant" then
        .message.content[] |
        if .type == "tool_use" then
          "TOOL: " + .name + "\n  INPUT: " + (.input | tostring | .[0:2000])
        else empty end
      elif .type == "user" then
        .message.content[]? |
        if .type == "tool_result" then
          .content as $c |
          if ($c | type) == "string" and ($c | length) > 0 then
            "  OUTPUT: " + ($c | .[0:2000])
          else empty end
        else empty end
      else empty end
    ' "$SESSION_FILE"
    ;;

  *)
    # Default: show assistant messages, tool calls, and tool outputs
    jq -r '
      if .type == "assistant" then
        .message.content[] |
        if .type == "text" then
          "\n>>> " + .text
        elif .type == "tool_use" then
          "\nTOOL: " + .name + " -- " + (.input | tostring | .[0:200])
        else empty end
      elif .type == "user" then
        .message.content[]? |
        if .type == "tool_result" then
          .content as $c |
          if ($c | type) == "string" and ($c | length) > 0 then
            if ($c | test("(?i)error|fatal|failed|denied|warning")) then
              "!!! " + ($c | .[0:2000])
            else
              "    " + ($c | .[0:2000])
            end
          else empty end
        else empty end
      else empty end
    ' "$SESSION_FILE"
    ;;
esac
} > "$LOG_FILE"

# --- Step 4: Display the log and link to the file ---
cat "$LOG_FILE"
echo ""
echo "---"
echo "Log saved: $LOG_FILE"
