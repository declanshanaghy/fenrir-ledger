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
      if grep -q "$QUERY" "$f" 2>/dev/null; then
        SESSION_FILE="$f"
        break
      fi
    fi
  done
fi

if [ -z "$SESSION_FILE" ]; then
  echo "ERROR: Could not find session matching: $QUERY" >&2
  echo "" >&2
  echo "Possible causes:" >&2
  echo "  - Session ID doesn't match any local file content" >&2
  echo "  - Session hasn't been downloaded (try --wait --resume manually)" >&2
  echo "" >&2
  echo "Hint: Depot session IDs are NOT stored in the JSONL files." >&2
  echo "Search by content instead (branch name, issue number):" >&2
  echo "  depot-session-log.sh fix/issue-199" >&2
  exit 1
fi

LINES=$(wc -l < "$SESSION_FILE" | tr -d ' ')
echo "Session: $QUERY" >&2
echo "File: $(basename "$SESSION_FILE") ($LINES messages)" >&2
echo "---" >&2

case "$MODE" in
  --raw)
    cat "$SESSION_FILE"
    ;;

  --errors)
    jq -r '
      if .type == "tool_result" then
        .content[] |
        if .type == "text" and (.text | test("(?i)error|fatal|failed|denied|not found|no such")) then
          "ERROR: " + (.text | .[0:500])
        else empty end
      else empty end
    ' "$SESSION_FILE"
    ;;

  --tools)
    jq -r '
      if .type == "assistant" then
        .message.content[] |
        if .type == "tool_use" then
          "TOOL: " + .name + "\n  INPUT: " + (.input | tostring | .[0:500])
        else empty end
      elif .type == "tool_result" then
        .content[] |
        if .type == "text" then
          "  OUTPUT: " + (.text | .[0:500])
        else empty end
      else empty end
    ' "$SESSION_FILE"
    ;;

  *)
    # Default: compact view with assistant messages and tool calls
    jq -r '
      if .type == "assistant" then
        .message.content[] |
        if .type == "text" then
          ">>> " + .text
        elif .type == "tool_use" then
          "TOOL: " + .name + " -- " + (.input | tostring | .[0:200])
        else empty end
      elif .type == "tool_result" then
        .content[] |
        if .type == "text" then
          if (.text | test("(?i)error|fatal|failed|denied")) then
            "!!! " + (.text | .[0:300])
          else
            "<<< " + (.text | .[0:200])
          end
        else empty end
      else empty end
    ' "$SESSION_FILE"
    ;;
esac
