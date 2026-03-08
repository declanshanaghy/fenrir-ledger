#!/usr/bin/env bash
# status-dashboard.sh — Full pack status dashboard
# Usage: status-dashboard.sh
# Outputs structured JSON with all in-flight chains, up-next queue, and suggested actions.
# The orchestrator renders this as markdown.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMPOUT="${TMPDIR:-/tmp}/fenrir-status-$$"
mkdir -p "$TMPOUT"

# Step 1: Parallel data gathering
# Fetch board (In Progress + Up Next) and open PRs simultaneously
"$SCRIPT_DIR/board-fetch.sh" --refresh --status "In Progress" > "$TMPOUT/in-progress.json" &
PID_IP=$!
"$SCRIPT_DIR/board-fetch.sh" --status "Up Next" > "$TMPOUT/up-next.json" &
PID_UN=$!
gh pr list --state open --json number,title,headRefName,updatedAt > "$TMPOUT/open-prs.json" &
PID_PR=$!

wait $PID_IP $PID_UN $PID_PR

# Step 2: For each in-progress issue, get chain status (parallel, max 5 at a time)
IN_PROGRESS_NUMS=$(jq -r '.[].num' "$TMPOUT/in-progress.json")
PIDS=()
for NUM in $IN_PROGRESS_NUMS; do
  "$SCRIPT_DIR/chain-status.sh" "$NUM" > "$TMPOUT/chain-$NUM.json" 2>/dev/null &
  PIDS+=($!)
  # Throttle: max 5 parallel
  if (( ${#PIDS[@]} >= 5 )); then
    wait "${PIDS[0]}"
    PIDS=("${PIDS[@]:1}")
  fi
done
# Wait for remaining
for pid in "${PIDS[@]}"; do
  wait "$pid" 2>/dev/null || true
done

# Step 3: Assemble results
# Merge chain statuses into array
CHAINS="[]"
for NUM in $IN_PROGRESS_NUMS; do
  if [[ -f "$TMPOUT/chain-$NUM.json" ]]; then
    CHAINS=$(echo "$CHAINS" | jq --slurpfile c "$TMPOUT/chain-$NUM.json" '. + $c')
  fi
done

UP_NEXT_COUNT=$(jq 'length' "$TMPOUT/up-next.json")
UP_NEXT_TOP3=$(jq '[.[:3][] | {num, title, labels}]' "$TMPOUT/up-next.json")
OPEN_PRS=$(cat "$TMPOUT/open-prs.json")

# Build final JSON
jq -n \
  --argjson chains "$CHAINS" \
  --argjson up_next_count "$UP_NEXT_COUNT" \
  --argjson up_next_top3 "$UP_NEXT_TOP3" \
  --argjson open_prs "$OPEN_PRS" \
  '{
    in_flight: $chains,
    in_flight_count: ($chains | length),
    up_next_count: $up_next_count,
    up_next_top3: $up_next_top3,
    open_prs: $open_prs,
    verdicts: {
      pass: [$chains[] | select(.verdict == "PASS") | .issue],
      fail: [$chains[] | select(.verdict == "FAIL") | .issue],
      awaiting_loki: [$chains[] | select(.position | test("Awaiting Loki")) | .issue],
      awaiting_decko: [$chains[] | select(.position | test("Awaiting FiremanDecko")) | .issue],
      no_response: [$chains[] | select(.position | test("No PR|running")) | .issue]
    },
    actions: [$chains[] | {issue: .issue, command: .command, reason: .position}]
  }'

# Cleanup
rm -rf "$TMPOUT"
