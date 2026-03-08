#!/usr/bin/env bash
# board-fetch.sh — Single board fetch with caching
# Usage: board-fetch.sh [--status <Up Next|In Progress|Done>] [--refresh]
# Fetches the full board once, caches for 60s, filters by status.
# Without --status, returns all items.
# Output: JSON array of {num, title, labels, status}
set -euo pipefail

OWNER="declanshanaghy"
PROJECT=1
CACHE_DIR="${TMPDIR:-/tmp}/fenrir-board-cache"
CACHE_FILE="$CACHE_DIR/board.json"
CACHE_TTL=60  # seconds

mkdir -p "$CACHE_DIR"

STATUS_FILTER=""
REFRESH=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --status) STATUS_FILTER="$2"; shift 2 ;;
    --refresh) REFRESH=true; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Check cache freshness
needs_refresh() {
  $REFRESH && return 0
  [[ ! -f "$CACHE_FILE" ]] && return 0
  local age
  age=$(( $(date +%s) - $(stat -f %m "$CACHE_FILE" 2>/dev/null || echo 0) ))
  (( age > CACHE_TTL ))
}

if needs_refresh; then
  gh project item-list "$PROJECT" --owner "$OWNER" --format json --limit 200 \
    | tr -d '\000-\037' \
    | jq '[.items[] | {num: .content.number, title: .content.title, labels: .labels, status: .status}]' \
    > "$CACHE_FILE"
fi

if [[ -n "$STATUS_FILTER" ]]; then
  jq --arg s "$STATUS_FILTER" '[.[] | select(.status == $s)]' "$CACHE_FILE"
else
  cat "$CACHE_FILE"
fi
