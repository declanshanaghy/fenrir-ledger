#!/usr/bin/env bash
# Pre-compact hook: exports session transcript to tmp/sessions/{slug}-{N}.txt
# Reads JSON from stdin: { session_id, transcript_path, ... }
# Converts the JSONL transcript to readable text directly.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SESSIONS_DIR="$REPO_ROOT/tmp/sessions"
COUNTERS_DIR="$SESSIONS_DIR/.counters"

# Read stdin JSON
INPUT="$(cat)"

SESSION_ID="$(echo "$INPUT" | jq -r '.session_id // "unknown"')"
TRANSCRIPT_PATH="$(echo "$INPUT" | jq -r '.transcript_path // ""')"

if [[ -z "$TRANSCRIPT_PATH" || ! -f "$TRANSCRIPT_PATH" ]]; then
  exit 0
fi

mkdir -p "$COUNTERS_DIR"

# Get or create slug from first user message (cached per session)
SLUG_FILE="$COUNTERS_DIR/${SESSION_ID}.slug"
if [[ -f "$SLUG_FILE" ]]; then
  SLUG="$(cat "$SLUG_FILE")"
else
  # Extract first user message — read line-by-line, stop at first match
  FIRST_MSG=""
  while IFS= read -r line; do
    FIRST_MSG="$(echo "$line" | jq -r '
      select(.type == "user") | .message.content |
      if type == "array" then
        map(select(.type == "text") | .text) | join(" ")
      elif type == "string" then .
      else empty
      end
    ' 2>/dev/null)" && [[ -n "$FIRST_MSG" ]] && break
  done < "$TRANSCRIPT_PATH"

  # Slugify: strip skill prefix, lowercase, keep alnum+space, first 5 words, max 40 chars
  SLUG="$(echo "$FIRST_MSG" \
    | sed 's|^/[^ ]* *||' \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9 ]/ /g; s/  */ /g; s/^ //; s/ $//' \
    | awk '{for(i=1;i<=5&&i<=NF;i++) printf "%s%s",$i,(i<5&&i<NF?"-":""); print ""}' \
    | cut -c1-40 \
    | sed 's/-$//')"

  # Fallback to UUID prefix
  if [[ -z "$SLUG" ]]; then
    SLUG="${SESSION_ID%%-*}"
  fi

  printf '%s' "$SLUG" > "$SLUG_FILE"
fi

# Increment counter
COUNTER_FILE="$COUNTERS_DIR/${SESSION_ID}.n"
if [[ -f "$COUNTER_FILE" ]]; then
  N="$(cat "$COUNTER_FILE")"
  N=$((N + 1))
else
  N=1
fi
printf '%s' "$N" > "$COUNTER_FILE"

# Convert JSONL transcript to readable text
EXPORT_FILE="$SESSIONS_DIR/${SLUG}-${N}.txt"
{
  echo "# Session Export: $SLUG (compaction #$N)"
  echo "# Session ID: $SESSION_ID"
  echo "# Exported: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Source: $TRANSCRIPT_PATH"
  echo "---"
  echo ""

  # Extract user + assistant text only, then collapse consecutive assistant blocks
  jq -r '
    if .type == "user" then
      (.message.content |
        if type == "array" then
          map(select(.type == "text") | .text) | join("\n")
        elif type == "string" then .
        else empty
        end) as $c |
      if ($c | length) > 0 then "## User\n\n\($c)\n" else empty end
    elif .type == "assistant" then
      (.message.content |
        if type == "array" then
          [.[] | select(.type == "text" and (.text | length) > 0) | .text] | join("\n\n")
        elif type == "string" then .
        else empty
        end) as $c |
      if ($c | length) > 0 then "## Assistant\n\n\($c)\n" else empty end
    else empty
    end
  ' "$TRANSCRIPT_PATH" 2>/dev/null \
    | awk '
      # Collapse consecutive "## Assistant" headers into one block
      /^## Assistant$/ {
        if (last_was_assistant) { next }
        last_was_assistant = 1
        print; next
      }
      /^## User$/ { last_was_assistant = 0 }
      { if (/^## /) last_was_assistant = (/^## Assistant$/); print }
    ' || echo "(failed to parse transcript)"
} > "$EXPORT_FILE"

echo "Session exported to: $EXPORT_FILE"
exit 0
