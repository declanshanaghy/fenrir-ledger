---
name: coverage-report
description: "Generate code coverage reports. Supports Vitest unit test coverage (--unit-only) and full Playwright E2E coverage. Outputs HTML + text-summary + LCOV reports. Overwrites previous reports."
---

# Coverage Report

Generate code coverage reports for unit tests (Vitest) or E2E tests (Playwright).

## Usage

```
/coverage-report [--unit-only] [--skip-build] [--skip-tests] [-- playwright args...]
```

## Modes

### Unit-only mode (`--unit-only`)

Runs Vitest unit tests with `@vitest/coverage-v8` instrumentation. Fast, no server needed.

```bash
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs --unit-only
```

Reports go to `quality/reports/coverage/vitest/`:
- `index.html` — interactive HTML report
- `lcov.info` — LCOV format for CI tools
- Text summary printed to stdout

### Full E2E mode (default)

1. Builds the Next.js app (unless `--skip-build`)
2. Starts the production server with `NODE_V8_COVERAGE` enabled (collects server-side coverage)
3. Runs the full Playwright test suite
4. Converts V8 coverage data to Istanbul format
5. Generates reports to `quality/reports/coverage/` (overwrites previous)

Reports go to `quality/reports/coverage/`:
- `index.html` — interactive HTML report
- `lcov.info` — LCOV format for CI tools
- Text summary printed to stdout

## Execution

Run the coverage script from the repo root:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)

# Unit tests only (fast)
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs --unit-only

# Full E2E coverage
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs
```

### Flags

| Flag | Effect |
|------|--------|
| `--unit-only` | Run Vitest unit coverage only (skips build/server/Playwright) |
| `--skip-build` | Skip `npm run build`, use existing `.next` output (E2E mode only) |
| `--skip-tests` | Skip Playwright run, only regenerate reports from existing coverage data (E2E mode only) |
| `-- <args>` | Pass additional args to `npx playwright test` (e.g. `-- --grep "dashboard"`) |

### Prerequisites

**Unit-only mode:**
- `@vitest/coverage-v8` installed (devDependency)

**Full E2E mode:**
- Next.js app must be buildable (`npm run build` in `development/frontend/`)
- Port 9653 must be free (kill any running dev server first)
- Coverage packages installed: `c8`, `v8-to-istanbul`, `istanbul-lib-coverage`, `istanbul-lib-report`, `istanbul-reports`

### If port is busy

```bash
lsof -ti:9653 | xargs kill 2>/dev/null
```

### Viewing the HTML report

```bash
# Unit coverage
open quality/reports/coverage/vitest/index.html

# E2E coverage
open quality/reports/coverage/index.html
```

## Notes

- Unit coverage uses `@vitest/coverage-v8` directly — no server or build needed
- Server-side E2E coverage (API routes, middleware) is collected via `NODE_V8_COVERAGE`
- Client-side code is bundled/minified by Next.js so browser-side coverage maps are approximate
- The script continues to generate reports even if some tests fail, giving partial coverage data
- `quality/reports/` is in `.gitignore` — use `git add -f` if you need to commit a report
