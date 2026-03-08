#!/usr/bin/env bash
# chain-status.sh — Determine chain position for an issue
# Usage: chain-status.sh <ISSUE_NUMBER>
# Output: JSON object with chain position, PR info, and next action
# {
#   "issue": 269,
#   "title": "...",
#   "type": "bug",
#   "priority": "high",
#   "chain": "FiremanDecko → Loki",
#   "position": "Awaiting Loki QA",
#   "pr": 286,
#   "branch": "fix/issue-269-back-button",
#   "verdict": null | "PASS" | "FAIL",
#   "ci": null | "pass" | "fail" | "pending",
#   "next_action": "resume" | "merge" | "bounce-back" | "re-dispatch" | "wait" | "done",
#   "command": "/fire-next-up --resume #269"
# }
set -euo pipefail

ISSUE="$1"
[[ -z "$ISSUE" ]] && { echo '{"error":"Usage: chain-status.sh <ISSUE_NUMBER>"}'; exit 1; }

# Fetch issue details
ISSUE_JSON=$(gh issue view "$ISSUE" --json number,title,body,labels,state)
TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
STATE=$(echo "$ISSUE_JSON" | jq -r '.state')

if [[ "$STATE" == "CLOSED" ]]; then
  echo "{\"issue\":$ISSUE,\"title\":$(echo "$TITLE" | jq -Rs .),\"position\":\"Closed\",\"next_action\":\"done\",\"command\":\"\"}"
  exit 0
fi

# Determine type and priority from labels
TYPE=$(echo "$ISSUE_JSON" | jq -r '[.labels[].name] | if any(. == "bug") then "bug"
  elif any(. == "security") then "security"
  elif any(. == "ux") then "ux"
  elif any(. == "enhancement") then "enhancement"
  elif any(. == "research") then "research"
  else "unknown" end')

PRIORITY=$(echo "$ISSUE_JSON" | jq -r '[.labels[].name] | if any(. == "critical") then "critical"
  elif any(. == "high") then "high"
  elif any(. == "normal") then "normal"
  elif any(. == "low") then "low"
  else "normal" end')

# Determine chain from type
case "$TYPE" in
  bug|enhancement) CHAIN="FiremanDecko → Loki" ;;
  ux)              CHAIN="Luna → FiremanDecko → Loki" ;;
  security)        CHAIN="Heimdall → Loki" ;;
  research)        CHAIN="FiremanDecko (research)" ;;
  *)               CHAIN="unknown" ;;
esac

# Fetch comments
COMMENTS=$(gh issue view "$ISSUE" --comments --json comments --jq '[.comments[].body]')

# Check for handoff markers (priority order)
LOKI_PASS=$(echo "$COMMENTS" | jq '[.[] | select(test("## Loki QA Verdict") and test("Verdict.*PASS"))] | length')
LOKI_FAIL=$(echo "$COMMENTS" | jq '[.[] | select(test("## Loki QA Verdict") and test("Verdict.*FAIL"))] | length')
DECKO_HANDOFF=$(echo "$COMMENTS" | jq '[.[] | select(test("## FiremanDecko → Loki Handoff"))] | length')
HEIMDALL_HANDOFF=$(echo "$COMMENTS" | jq '[.[] | select(test("## Heimdall → Loki Handoff"))] | length')
LUNA_HANDOFF=$(echo "$COMMENTS" | jq '[.[] | select(test("## Luna → FiremanDecko Handoff"))] | length')

# Find PR for this issue
PR_JSON=$(gh pr list --state open --search "issue-$ISSUE" --json number,headRefName 2>/dev/null || echo '[]')
PR_NUM=$(echo "$PR_JSON" | jq -r '.[0].number // empty')
BRANCH=$(echo "$PR_JSON" | jq -r '.[0].headRefName // empty')

# Also check closed/merged PRs if no open one found
if [[ -z "$PR_NUM" ]]; then
  PR_JSON=$(gh pr list --state merged --search "issue-$ISSUE" --json number,headRefName --limit 1 2>/dev/null || echo '[]')
  PR_NUM=$(echo "$PR_JSON" | jq -r '.[0].number // empty')
  BRANCH=$(echo "$PR_JSON" | jq -r '.[0].headRefName // empty')
fi

# Check CI if we have a PR
CI_STATUS=""
if [[ -n "$PR_NUM" ]]; then
  CI_RAW=$(gh pr checks "$PR_NUM" 2>&1 || true)
  if echo "$CI_RAW" | grep -q "fail\|FAIL"; then
    CI_STATUS="fail"
  elif echo "$CI_RAW" | grep -q "pass\|PASS\|✓"; then
    CI_STATUS="pass"
  elif echo "$CI_RAW" | grep -q "pending\|PENDING\|running"; then
    CI_STATUS="pending"
  else
    CI_STATUS="unknown"
  fi
fi

# Determine position, verdict, next_action, and command
POSITION=""
VERDICT="null"
NEXT_ACTION=""
COMMAND=""

if (( LOKI_PASS > 0 )); then
  VERDICT="\"PASS\""
  if [[ "$CI_STATUS" == "pass" ]]; then
    POSITION="Loki PASS + CI green"
    NEXT_ACTION="merge"
    COMMAND="gh pr merge $PR_NUM --squash --delete-branch"
  elif [[ "$CI_STATUS" == "fail" ]]; then
    POSITION="Loki PASS but CI failing"
    NEXT_ACTION="bounce-back"
    COMMAND="/fire-next-up --resume #$ISSUE"
  elif [[ "$CI_STATUS" == "pending" ]]; then
    POSITION="Loki PASS, CI pending"
    NEXT_ACTION="wait"
    COMMAND="gh pr checks $PR_NUM"
  else
    POSITION="Loki PASS"
    NEXT_ACTION="merge"
    COMMAND="gh pr merge $PR_NUM --squash --delete-branch"
  fi
elif (( LOKI_FAIL > 0 )); then
  VERDICT="\"FAIL\""
  POSITION="Loki FAIL"
  NEXT_ACTION="bounce-back"
  COMMAND="/fire-next-up --resume #$ISSUE"
elif (( DECKO_HANDOFF > 0 || HEIMDALL_HANDOFF > 0 )); then
  POSITION="Awaiting Loki QA"
  NEXT_ACTION="resume"
  COMMAND="/fire-next-up --resume #$ISSUE"
elif (( LUNA_HANDOFF > 0 )); then
  POSITION="Awaiting FiremanDecko"
  NEXT_ACTION="resume"
  COMMAND="/fire-next-up --resume #$ISSUE"
elif [[ -n "$PR_NUM" ]]; then
  POSITION="Step 1 running or stalled"
  NEXT_ACTION="wait"
  COMMAND="/fire-next-up --resume #$ISSUE"
else
  POSITION="No PR — agent may have failed"
  NEXT_ACTION="re-dispatch"
  COMMAND="/fire-next-up #$ISSUE --local"
fi

# Build output JSON
cat <<EOJSON
{
  "issue": $ISSUE,
  "title": $(echo "$TITLE" | jq -Rs .),
  "type": "$TYPE",
  "priority": "$PRIORITY",
  "chain": "$CHAIN",
  "position": "$POSITION",
  "pr": ${PR_NUM:-null},
  "branch": $(echo "${BRANCH:-}" | jq -Rs .),
  "verdict": $VERDICT,
  "ci": $(echo "${CI_STATUS:-null}" | jq -Rs .),
  "next_action": "$NEXT_ACTION",
  "command": $(echo "$COMMAND" | jq -Rs .)
}
EOJSON
