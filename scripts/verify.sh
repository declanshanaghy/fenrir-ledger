#!/usr/bin/env bash
# verify.sh — Fenrir Ledger lean verification wrapper
# Runs tsc, next build, and Playwright in sequence.
# Stdout: condensed one-line result per check (< 10 lines on full pass).
# Full output: quality/reports/<name>-output.txt
#
# Usage: bash scripts/verify.sh [from any directory]
# Exit:  0 = all checks passed, 1 = one or more checks failed

set -uo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
REPORTS_DIR="$REPO_ROOT/quality/reports"
FRONTEND_DIR="$REPO_ROOT/development/frontend"
mkdir -p "$REPORTS_DIR"

FAILED=0
echo "=== Fenrir Verify ==="

# ─── 1. TypeScript ────────────────────────────────────────────────────────────
printf "[1/3] tsc --noEmit .............. "
if cd "$FRONTEND_DIR" && npx tsc --noEmit > "$REPORTS_DIR/tsc-output.txt" 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
  echo ""
  echo "TSC ERRORS:"
  cat "$REPORTS_DIR/tsc-output.txt"
fi

# ─── 2. Next.js build ─────────────────────────────────────────────────────────
printf "[2/3] next build ................ "
if cd "$FRONTEND_DIR" && npx next build > "$REPORTS_DIR/build-output.txt" 2>&1; then
  ROUTES=$(grep -c "├\|└\|─" "$REPORTS_DIR/build-output.txt" 2>/dev/null || echo "?")
  echo "PASS ($ROUTES routes)"
else
  echo "FAIL"
  FAILED=1
  echo ""
  echo "BUILD ERRORS (last 30 lines):"
  tail -30 "$REPORTS_DIR/build-output.txt"
fi

# ─── 3. Playwright ────────────────────────────────────────────────────────────
printf "[3/3] playwright ................ "
cd "$FRONTEND_DIR"
# Use json reporter to file so we can parse failures, plus line reporter to capture progress output
PLAYWRIGHT_JSON_OUTPUT_FILE="$REPORTS_DIR/playwright-report.json" \
  npx playwright test \
    --reporter=json,line \
    > "$REPORTS_DIR/playwright-output.txt" 2>&1
PW_EXIT=$?

if [ $PW_EXIT -eq 0 ]; then
  TOTAL=$(jq '.stats.expected // 0' "$REPORTS_DIR/playwright-report.json" 2>/dev/null || echo "?")
  echo "PASS ($TOTAL/$TOTAL)"
else
  FAILED=1
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
if [ $FAILED -eq 0 ]; then
  echo "=== All checks passed ==="
else
  echo "=== $FAILED check(s) failed ==="
fi
exit $FAILED
