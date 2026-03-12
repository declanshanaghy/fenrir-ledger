---
name: coverage-report
description: "Generate a Playwright code coverage report. Runs the full test suite with V8 coverage instrumentation and outputs HTML + text + LCOV reports to quality/reports/coverage/. Overwrites previous reports."
---

# Coverage Report

Generate an actual code coverage report by running Playwright tests with V8 coverage instrumentation.

## Usage

```
/coverage-report [--skip-build] [--skip-tests] [-- playwright args...]
```

## What it does

1. Builds the Next.js app (unless `--skip-build`)
2. Starts the production server with `NODE_V8_COVERAGE` enabled (collects server-side coverage)
3. Runs the full Playwright test suite
4. Converts V8 coverage data to Istanbul format
5. Generates reports to `quality/reports/coverage/` (overwrites previous)

## Reports output

All reports go to `quality/reports/coverage/` — no date suffixes, overwritten each run:

- `index.html` — interactive HTML report (open in browser)
- `lcov.info` — LCOV format for CI tools
- Text summary printed to stdout

## Execution

Run the coverage script from the repo root:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs
```

### Flags

| Flag | Effect |
|------|--------|
| `--skip-build` | Skip `npm run build`, use existing `.next` output |
| `--skip-tests` | Skip Playwright run, only regenerate reports from existing coverage data |
| `-- <args>` | Pass additional args to `npx playwright test` (e.g. `-- --grep "dashboard"`) |

### Prerequisites

- Next.js app must be buildable (`npm run build` in `development/frontend/`)
- Port 9653 must be free (kill any running dev server first)
- Coverage packages installed: `c8`, `v8-to-istanbul`, `istanbul-lib-coverage`, `istanbul-lib-report`, `istanbul-reports`

### If port is busy

```bash
lsof -ti:9653 | xargs kill 2>/dev/null
```

### Viewing the HTML report

```bash
open quality/reports/coverage/index.html
```

## Notes

- Server-side coverage (API routes, middleware) is collected via `NODE_V8_COVERAGE`
- Client-side code is bundled/minified by Next.js so browser-side coverage maps are approximate
- The script continues to generate reports even if some tests fail, giving partial coverage data
- `quality/reports/` is in `.gitignore` — use `git add -f` if you need to commit a report
