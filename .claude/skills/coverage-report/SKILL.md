---
name: coverage-report
description: "Generate code coverage reports. Supports Vitest (--unit-only), Playwright E2E (default), and combined (--combined) modes. Outputs HTML + text-summary + LCOV reports."
---

# Coverage Report

Generate code coverage reports via `coverage.mjs` directly.

## Usage

```
/coverage-report [--unit-only | --combined] [-- playwright args...]
```

## Modes

### Unit-only mode (`--unit-only`)

Runs Vitest unit + integration tests with V8 coverage. Fast, no browser needed.

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs --unit-only
```

Reports: `quality/reports/coverage/vitest/` (HTML + LCOV + text-summary)

### E2E-only mode (default)

Starts the Next.js production server with `NODE_V8_COVERAGE`, runs Playwright
tests, then sends SIGTERM for a clean exit that flushes V8 coverage files.
Uses c8 to process the V8 data — source maps from `.next/server/chunks/ssr/`
map compiled code back to `src/` automatically.

```bash
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs
```

Reports: `quality/reports/coverage/playwright/` (HTML + LCOV + text-summary)

**Note:** `--skip-build` skips the Next.js build if `.next/` already exists.

### Combined mode (`--combined`)

Runs Vitest + Playwright coverage, then merges into a single report.

```bash
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs --combined [--skip-build]
# or merge existing reports only:
cd "$REPO_ROOT" && node quality/scripts/coverage-combine.mjs
```

Reports:
- `quality/reports/coverage/vitest/` — unit/integration coverage
- `quality/reports/coverage/playwright/` — E2E server-side coverage
- `quality/reports/coverage/combined/` — merged report (HTML via genhtml + LCOV)

## Execution

Always run from the repo root. The scripts handle dependency installation
automatically (`@vitest/coverage-v8`, rollup native module).

Requires `genhtml` for the combined HTML report:
```bash
brew install lcov   # macOS
```

### Viewing reports

```bash
open quality/reports/coverage/vitest/index.html      # Unit
open quality/reports/coverage/playwright/index.html  # E2E
open quality/reports/coverage/combined/index.html    # Combined
```

## Styling the HTML report

Drop a custom CSS file at `quality/scripts/coverage.css`. It will be picked
up automatically by `coverage-combine.mjs` and passed to genhtml via
`--css-file`. The file completely replaces genhtml's default stylesheet.

genhtml's default classes to target: `coverFile`, `coverBar`, `coverPerHi`
(green), `coverPerMed` (yellow), `coverPerLo` (red), `title`, `tableHead`.

## How E2E coverage works

1. Next.js production build creates `.next/server/chunks/ssr/*.js` files with
   inline `sourceMappingURL` comments pointing to sibling `.js.map` files.
2. Server starts with `NODE_V8_COVERAGE` — Node writes raw V8 coverage JSON to
   `quality/.coverage-tmp/` on clean exit.
3. SIGTERM → server exits cleanly → coverage files written.
4. c8 reads V8 JSON, follows source maps to resolve `.next/` paths back to `src/`.
5. `coverage-combine.mjs` filters `.next/` and `node_modules` entries from the
   merged LCOV so genhtml only reports on `src/` source files.

## Notes

- Reports are overwritten on every run (no dated directories)
- `quality/reports/` is in `.gitignore`
- `quality/.coverage-tmp/` is kept after each run for inspection (also gitignored)
- E2E coverage is server-side only — client-rendered components show 0% unless
  they also run server-side (RSC, API routes, middleware)
- `coverage-combine.mjs` can be run standalone to re-merge existing LCOV files
  without re-running tests
