#!/usr/bin/env bash
# verify.sh — Fenrir Ledger verification wrapper
# Runs tsc, next build, and tests (unit/e2e) in sequence.
# Output: tsc errors stream live, build is quiet (summary only), tests stream live.
#
# Usage:
#   bash quality/scripts/verify.sh                    # full suite (tsc + build + all tests)
#   bash quality/scripts/verify.sh --step tsc         # run ONLY tsc
#   bash quality/scripts/verify.sh --step build       # run ONLY next build
#   bash quality/scripts/verify.sh --step unit        # run ONLY Vitest unit tests
#   bash quality/scripts/verify.sh --step e2e         # run ONLY Playwright E2E tests
#   bash quality/scripts/verify.sh --step e2e <slug>  # run single Playwright suite
#   bash quality/scripts/verify.sh --step test        # run ALL tests (unit + e2e)
#   bash quality/scripts/verify.sh --tests-only       # skip tsc+build, run all tests
#   bash quality/scripts/verify.sh --coverage         # enable coverage collection
#   bash quality/scripts/verify.sh --fail-fast        # stop on first test failure
#   bash quality/scripts/verify.sh -x <slug>          # fail-fast shorthand
#   bash quality/scripts/verify.sh <slug>             # single Playwright suite
#   bash quality/scripts/verify.sh <slug1> <slug2>    # multiple Playwright suites
#
# Test types:
#   unit    — Vitest unit tests (src/__tests__/**/*.test.ts)
#   e2e     — Playwright E2E tests (quality/test-suites/**/*.spec.ts)
#   test    — All tests (unit + e2e)
#
# Coverage:
#   --coverage enables coverage collection for the test step(s) being run.
#   Reports go to quality/reports/coverage/{vitest,playwright}/ (overwritten each run).
#   Use quality/scripts/coverage-combine.mjs to merge into a single report.
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
COVERAGE=false
STEP=""
TEST_PATHS=()
for arg in "$@"; do
  if [ "$arg" = "--tests-only" ]; then
    TESTS_ONLY=true
  elif [ "$arg" = "--fail-fast" ] || [ "$arg" = "-x" ]; then
    FAIL_FAST=true
  elif [ "$arg" = "--coverage" ]; then
    COVERAGE=true
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
  echo "ERROR: --step requires a value: tsc, build, unit, e2e, or test"
  exit 1
fi
if [ -n "$STEP" ] && [ "$STEP" != "tsc" ] && [ "$STEP" != "build" ] && [ "$STEP" != "test" ] && [ "$STEP" != "unit" ] && [ "$STEP" != "e2e" ]; then
  echo "ERROR: --step must be one of: tsc, build, unit, e2e, test (got '$STEP')"
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
  if cd "$FRONTEND_DIR" && npx --silent next build > "$REPORTS_DIR/build-output.txt" 2>&1; then
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
  # If SERVER_URL is set we're testing against an external deployment (e.g. GKE preview).
  # No local build needed — skip silently.
  if [ -n "${SERVER_URL:-}" ]; then
    return 0
  fi
  if [ ! -d "$FRONTEND_DIR/.next" ]; then
    echo "[build] no .next found, building"
    if cd "$FRONTEND_DIR" && npx --silent next build > "$REPORTS_DIR/build-output.txt" 2>&1; then
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

# ─── Step: unit ────────────────────────────────────────────────────────────────
# Vitest unit tests. Runs with coverage if --coverage is set.
run_unit() {
  echo "[unit] vitest"
  cd "$FRONTEND_DIR"

  if [ "$COVERAGE" = true ]; then
    # Clean previous coverage
    rm -rf "$REPO_ROOT/quality/reports/coverage/vitest"
    mkdir -p "$REPO_ROOT/quality/reports/coverage/vitest"

    # Ensure @vitest/coverage-v8 is installed
    if [ ! -d "$FRONTEND_DIR/node_modules/@vitest/coverage-v8" ]; then
      echo "[unit] installing @vitest/coverage-v8..."
      npm install --save-dev @vitest/coverage-v8 2>/dev/null
      # Fix npm optional dep corruption if needed
      if [ ! -d "$FRONTEND_DIR/node_modules/@rollup/rollup-darwin-arm64" ]; then
        rm -rf "$FRONTEND_DIR/node_modules"
        npm ci 2>/dev/null
      fi
    fi

    if npx vitest run --pool threads --poolOptions.threads.maxThreads 4 --coverage; then
      UNIT_TOTAL=$(npx vitest run --reporter=json 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo "?")
      echo "PASS (coverage → quality/reports/coverage/vitest/)"
    else
      ((FAILS++))
      echo "FAIL"
    fi
  else
    if npx vitest run --pool threads --poolOptions.threads.maxThreads 4; then
      echo "PASS"
    else
      ((FAILS++))
      echo "FAIL"
    fi
  fi
}

# ─── Step: e2e ─────────────────────────────────────────────────────────────────
# Playwright E2E tests. Runs with coverage if --coverage is set.
run_e2e() {
  if [ ${#TEST_PATHS[@]} -gt 0 ]; then
    echo "[e2e] playwright (${#TEST_PATHS[@]} suite(s))"
  else
    echo "[e2e] playwright (full suite)"
  fi
  cd "$FRONTEND_DIR"

  FAIL_FAST_FLAG=""
  if [ "$FAIL_FAST" = true ]; then
    FAIL_FAST_FLAG="--max-failures=1"
  fi

  if [ "$COVERAGE" = true ]; then
    # Clean previous coverage
    rm -rf "$REPO_ROOT/quality/reports/coverage/playwright"
    mkdir -p "$REPO_ROOT/quality/reports/coverage/playwright"

    # Run with NODE_V8_COVERAGE to collect server-side coverage
    V8_COVERAGE_DIR="$REPO_ROOT/quality/.coverage-tmp-pw"
    rm -rf "$V8_COVERAGE_DIR"
    mkdir -p "$V8_COVERAGE_DIR"

    NODE_V8_COVERAGE="$V8_COVERAGE_DIR" \
    PLAYWRIGHT_JSON_OUTPUT_FILE="$REPORTS_DIR/playwright-report.json" \
      npx playwright test \
        ${TEST_PATHS[@]+"${TEST_PATHS[@]}"} \
        $FAIL_FAST_FLAG \
        --reporter=line,json
    PW_EXIT=$?

    # Generate coverage report from V8 data if any was collected
    if [ -d "$V8_COVERAGE_DIR" ] && ls "$V8_COVERAGE_DIR"/*.json >/dev/null 2>&1; then
      npx c8 report \
        --temp-directory "$V8_COVERAGE_DIR" \
        --reporter text-summary --reporter html --reporter lcov \
        --reports-dir "$REPO_ROOT/quality/reports/coverage/playwright" \
        --all --src "$FRONTEND_DIR/src" \
        --include "src/**/*.ts" --include "src/**/*.tsx" \
        --exclude "src/**/*.test.*" --exclude "src/**/*.spec.*" --exclude "node_modules/**" \
        2>/dev/null || true
    fi
    # Keep V8 coverage data for inspection (in quality/reports/ which is gitignored)
  else
    PLAYWRIGHT_JSON_OUTPUT_FILE="$REPORTS_DIR/playwright-report.json" \
      npx playwright test \
        ${TEST_PATHS[@]+"${TEST_PATHS[@]}"} \
        $FAIL_FAST_FLAG \
        --reporter=line,json
    PW_EXIT=$?
  fi

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
    unit)  run_unit ;;
    e2e)   ensure_build; run_e2e ;;
    test)  run_unit; ensure_build; run_e2e ;;
  esac
else
  # Full suite
  if [ "$TESTS_ONLY" = false ]; then
    run_tsc
    run_build
  else
    ensure_build
  fi
  run_unit
  run_e2e
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ $FAILS -eq 0 ]; then
  echo "=== All checks passed ==="
else
  echo "=== $FAILS check(s) failed ==="
fi
exit $((FAILS > 0 ? 1 : 0))
