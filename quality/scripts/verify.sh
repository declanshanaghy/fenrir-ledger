#!/usr/bin/env bash
# verify.sh — Fenrir Ledger lean verification wrapper
# Runs tsc, next build, and Playwright in sequence.
# Output: tsc errors stream live, build is quiet (summary only), tests stream live.
#
# Usage:
#   bash quality/scripts/verify.sh                    # full suite (all 3 steps)
#   bash quality/scripts/verify.sh <slug>             # single test suite
#   bash quality/scripts/verify.sh <slug1> <slug2>    # multiple test suites
#   bash quality/scripts/verify.sh --tests-only       # skip tsc+build, full suite
#   bash quality/scripts/verify.sh --tests-only <slug> # skip tsc+build, single suite
#   bash quality/scripts/verify.sh --fail-fast         # stop on first test failure
#   bash quality/scripts/verify.sh -x <slug>           # fail-fast shorthand
#   bash quality/scripts/verify.sh --step tsc          # run ONLY tsc
#   bash quality/scripts/verify.sh --step build        # run ONLY next build
#   bash quality/scripts/verify.sh --step test [slugs] # run ONLY playwright tests
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
FAIL_FAST=false
STEP=""
TEST_PATHS=()
for arg in "$@"; do
  if [ "$arg" = "--tests-only" ]; then
    TESTS_ONLY=true
  elif [ "$arg" = "--fail-fast" ] || [ "$arg" = "-x" ]; then
    FAIL_FAST=true
  elif [ "$arg" = "--step" ]; then
    STEP="__next__"  # sentinel: next arg is the step name
  elif [ "$STEP" = "__next__" ]; then
    STEP="$arg"
  else
    TEST_PATHS+=("$REPO_ROOT/quality/test-suites/$arg/")
  fi
done

# Validate --step
if [ "$STEP" = "__next__" ]; then
  echo "ERROR: --step requires a value: tsc, build, or test"
  exit 1
fi
if [ -n "$STEP" ] && [ "$STEP" != "tsc" ] && [ "$STEP" != "build" ] && [ "$STEP" != "test" ]; then
  echo "ERROR: --step must be one of: tsc, build, test (got '$STEP')"
  exit 1
fi

FAILS=0

# ─── Step: tsc ─────────────────────────────────────────────────────────────────
# tsc output is already minimal — only errors. Stream live.
run_tsc() {
  echo "[tsc] tsc --noEmit"
  if cd "$FRONTEND_DIR" && npx --silent tsc --noEmit --pretty; then
    echo "PASS"
  else
    echo "FAIL"
    ((FAILS++))
  fi
}

# ─── Step: build ───────────────────────────────────────────────────────────────
# next build is noisy. Capture to file, show only summary or errors.
run_build() {
  echo "[build] next build"
  if cd "$FRONTEND_DIR" && npx --silent next build --no-lint > "$REPORTS_DIR/build-output.txt" 2>&1; then
    ROUTES=$(grep -cE "├|└" "$REPORTS_DIR/build-output.txt" 2>/dev/null || echo "?")
    echo "PASS ($ROUTES routes)"
  else
    echo "FAIL"
    ((FAILS++))
    echo ""
    echo "BUILD ERRORS (last 30 lines):"
    tail -30 "$REPORTS_DIR/build-output.txt"
  fi
}

# ─── Step: build (ensure only — for --tests-only) ─────────────────────────────
ensure_build() {
  if [ ! -d "$FRONTEND_DIR/.next" ]; then
    echo "[build] no .next found, building"
    if cd "$FRONTEND_DIR" && npx --silent next build --no-lint > "$REPORTS_DIR/build-output.txt" 2>&1; then
      echo "OK"
    else
      echo "FAIL"
      ((FAILS++))
      echo ""
      echo "BUILD ERRORS (last 30 lines):"
      tail -30 "$REPORTS_DIR/build-output.txt"
    fi
  else
    echo "(skipping tsc + build — --tests-only)"
  fi
}

# ─── Step: test ────────────────────────────────────────────────────────────────
# Playwright line reporter streams live — compact one-line-per-test output.
run_test() {
  if [ ${#TEST_PATHS[@]} -gt 0 ]; then
    echo "[test] playwright (${#TEST_PATHS[@]} suite(s))"
  else
    echo "[test] playwright (full suite)"
  fi
  cd "$FRONTEND_DIR"

  FAIL_FAST_FLAG=""
  if [ "$FAIL_FAST" = true ]; then
    FAIL_FAST_FLAG="--max-failures=1"
  fi

  PLAYWRIGHT_JSON_OUTPUT_FILE="$REPORTS_DIR/playwright-report.json" \
    npx playwright test \
      ${TEST_PATHS[@]+"${TEST_PATHS[@]}"} \
      $FAIL_FAST_FLAG \
      --reporter=line,json
  PW_EXIT=$?

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
    jq -r '
      .. | objects |
      select(.ok == false and .title? and .file?) |
      "  \u2717 \(.file):\(.line // "?") — \(.title)"
    ' "$REPORTS_DIR/playwright-report.json" 2>/dev/null | head -20
  fi
}

# ─── Dispatch ──────────────────────────────────────────────────────────────────
echo "=== Fenrir Verify ==="

if [ -n "$STEP" ]; then
  # Single-step mode
  case "$STEP" in
    tsc)   run_tsc ;;
    build) run_build ;;
    test)  ensure_build; run_test ;;
  esac
else
  # Full suite
  if [ "$TESTS_ONLY" = false ]; then
    run_tsc
    run_build
  else
    ensure_build
  fi
  run_test
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ $FAILS -eq 0 ]; then
  echo "=== All checks passed ==="
else
  echo "=== $FAILS check(s) failed ==="
fi
exit $((FAILS > 0 ? 1 : 0))
