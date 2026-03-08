#!/usr/bin/env bash
# move-issue.sh — Move an issue to a project board column
# Usage: move-issue.sh <ISSUE_NUMBER> <up-next|in-progress|done>
set -euo pipefail

ISSUE="$1"
STATUS="$2"

[[ -z "$ISSUE" || -z "$STATUS" ]] && { echo "Usage: move-issue.sh <ISSUE_NUMBER> <up-next|in-progress|done>" >&2; exit 1; }

PROJECT_ID="PVT_kwHOAAW5PM4BQ7LP"
FIELD_ID="PVTSSF_lAHOAAW5PM4BQ7LPzg-54RA"

case "$STATUS" in
  up-next)     OPTION_ID="6e492bcc" ;;
  in-progress) OPTION_ID="1d9139d4" ;;
  done)        OPTION_ID="c5fe053a" ;;
  *) echo "Invalid status: $STATUS (use up-next, in-progress, done)" >&2; exit 1 ;;
esac

# Use cached board data if available, otherwise fetch
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ITEM_ID=$("$SCRIPT_DIR/board-fetch.sh" --refresh \
  | jq -r --argjson n "$ISSUE" '.[] | select(.num == $n) | .num' 2>/dev/null || echo "")

# Need the project item ID, not issue number — fetch directly
ITEM_ID=$(gh project item-list 1 --owner declanshanaghy --format json --limit 200 \
  | tr -d '\000-\037' \
  | jq -r --argjson n "$ISSUE" '.items[] | select(.content.number == $n) | .id')

if [[ -z "$ITEM_ID" ]]; then
  echo "Issue #$ISSUE not found on project board" >&2
  exit 1
fi

gh project item-edit \
  --project-id "$PROJECT_ID" \
  --id "$ITEM_ID" \
  --field-id "$FIELD_ID" \
  --single-select-option-id "$OPTION_ID"

echo "Moved #$ISSUE to $STATUS"
