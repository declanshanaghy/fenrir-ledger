#!/usr/bin/env bash
# verify.sh — Fenrir Ledger lean verification wrapper
# Runs tsc, next build, and Playwright in sequence.
# Stdout: condensed one-line result per check (< 10 lines on full pass).
# Full output: quality/reports/<name>-output.txt
#
# Usage:
#   bash quality/scripts/verify.sh                    # full suite
#   bash quality/scripts/verify.sh <slug>             # single test suite
#   bash quality/scripts/verify.sh <slug1> <slug2>    # multiple test suites
#   bash quality/scripts/verify.sh --tests-only       # skip tsc+build, full suite
#   bash quality/scripts/verify.sh --tests-only <slug> # skip tsc+build, single suite
#
# <slug> is a directory name under quality/test-suites/ (e.g. "dashboard", "card-lifecycle")
# Exit: 0 = all checks passed, 1 = one or more checks failed

set -uo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
REPORTS_DIR="$REPO_ROOT/quality/reports"
FRONTEND_DIR="$REPO_ROOT/development/frontend"
mkdir -p "$REPORTS_DIR"

# Parse flags
TESTS_ONLY=false
TEST_PATHS=()
for arg in "$@"; do
  if [ "$arg" = "--tests-only" ]; then
    TESTS_ONLY=true
  else
    TEST_PATHS+=("$REPO_ROOT/quality/test-suites/$arg/")
  fi
done

FAILS=0
SPINNER_PID=""

# Print a dot every 5s so agents/humans know we're alive
start_progress() {
  while true; do sleep 5; printf "."; done &
  SPINNER_PID=$!
}
stop_progress() {
  if [ -n "$SPINNER_PID" ]; then
    kill "$SPINNER_PID" 2>/dev/null
    wait "$SPINNER_PID" 2>/dev/null
    SPINNER_PID=""
  fi
  printf " "
}

echo "=== Fenrir Verify ==="

if [ "$TESTS_ONLY" = false ]; then
  # ─── 1. TypeScript ──────────────────────────────────────────────────────────
  printf "[1/3] tsc --noEmit "
  start_progress
  if cd "$FRONTEND_DIR" && npx tsc --noEmit > "$REPORTS_DIR/tsc-output.txt" 2>&1; then
    stop_progress
    echo "PASS"
  else
    stop_progress
    echo "FAIL"
    ((FAILS++))
    echo ""
    echo "TSC ERRORS:"
    cat "$REPORTS_DIR/tsc-output.txt"
  fi

  # ─── 2. Next.js build ──────────────────────────────────────────────────────
  printf "[2/3] next build "
  start_progress
  if cd "$FRONTEND_DIR" && npx next build > "$REPORTS_DIR/build-output.txt" 2>&1; then
    stop_progress
    ROUTES=$(grep -cE "├|└|─" "$REPORTS_DIR/build-output.txt" 2>/dev/null || echo "?")
    echo "PASS ($ROUTES routes)"
  else
    stop_progress
    echo "FAIL"
    ((FAILS++))
    echo ""
    echo "BUILD ERRORS (last 30 lines):"
    tail -30 "$REPORTS_DIR/build-output.txt"
  fi
else
  echo "(skipping tsc + build — --tests-only)"
fi

# ─── 3. Playwright ────────────────────────────────────────────────────────────
if [ ${#TEST_PATHS[@]} -gt 0 ]; then
  echo "[3/3] playwright (${#TEST_PATHS[@]} suite(s))"
else
  echo "[3/3] playwright (full suite)"
fi
cd "$FRONTEND_DIR"

# line reporter → stdout (live progress), sed strips long path prefix
# json reporter → report file (machine-readable)
# Full unfiltered output saved to file; compact version shown on screen
PLAYWRIGHT_JSON_OUTPUT_FILE="$REPORTS_DIR/playwright-report.json" \
  npx playwright test \
    ${TEST_PATHS[@]+"${TEST_PATHS[@]}"} \
    --reporter=line,json \
    2>&1 | tee "$REPORTS_DIR/playwright-output.txt" \
         | sed 's|\.\.\/\.\.\/quality\/test-suites\/||g; s| \[chromium\] ||g'
PW_EXIT=${PIPESTATUS[0]}

if [ $PW_EXIT -eq 0 ]; then
  TOTAL=$(jq '.stats.expected // 0' "$REPORTS_DIR/playwright-report.json" 2>/dev/null || echo "?")
  echo "PASS ($TOTAL/$TOTAL)"
else
  ((FAILS++))
  TOTAL=$(jq '(.stats.expected // 0)' "$REPORTS_DIR/playwright-report.json" 2>/dev/null || echo "?")
  FAIL_COUNT=$(jq '(.stats.unexpected // 0)' "$REPORTS_DIR/playwright-report.json" 2>/dev/null || echo "?")
  if [[ "$TOTAL" =~ ^[0-9]+$ ]] && [[ "$FAIL_COUNT" =~ ^[0-9]+$ ]]; then
    PASS_COUNT=$((TOTAL - FAIL_COUNT))
  else
    PASS_COUNT="?"
  fi
  echo "FAIL ($PASS_COUNT/$TOTAL, $FAIL_COUNT failed)"
  echo ""
  echo "FAILED TESTS:"
  # Try nested suites structure first (standard Playwright JSON format)
  PARSED=$(jq -r '
    .. | objects |
    select(.ok == false and .title? and .file?) |
    "  \u2717 \(.file):\(.line // "?") — \(.title)"
  ' "$REPORTS_DIR/playwright-report.json" 2>/dev/null | head -20)

  if [ -z "$PARSED" ]; then
    # Fallback: look for unexpected results with location
    PARSED=$(jq -r '
      .. | objects |
      select(.status == "unexpected" and .location?) |
      "  \u2717 \(.location.file):\(.location.line // "?") — \(.title // "(unknown)")"
    ' "$REPORTS_DIR/playwright-report.json" 2>/dev/null | head -20)
  fi

  if [ -n "$PARSED" ]; then
    echo "$PARSED"
  else
    echo "  (could not parse failures — see full output below)"
    tail -20 "$REPORTS_DIR/playwright-output.txt"
  fi

  echo ""
  echo "Full report: $REPORTS_DIR/playwright-report.json"
  echo "Full output: $REPORTS_DIR/playwright-output.txt"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ $FAILS -eq 0 ]; then
  echo "=== All checks passed ==="
else
  echo "=== $FAILS check(s) failed ==="
fi
exit $((FAILS > 0 ? 1 : 0))
