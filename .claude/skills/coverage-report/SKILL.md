---
name: coverage-report
description: "Generate code coverage reports. Supports Vitest (--unit-only), Playwright E2E (default), and combined (--combined) modes. Outputs HTML + text-summary + LCOV reports."
---

# Coverage Report

Generate code coverage reports via `verify.sh --coverage` or `coverage.mjs` directly.

## Usage

```
/coverage-report [--unit-only | --combined] [-- playwright args...]
```

## Modes

### Unit-only mode (`--unit-only`)

Runs Vitest unit + integration tests with V8 coverage. Fast, no browser needed.

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" && bash quality/scripts/verify.sh --step unit --coverage
# or
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs --unit-only
```

Reports: `quality/reports/coverage/vitest/` (HTML + LCOV + text-summary)

### E2E-only mode (default)

Runs Playwright E2E tests with V8 server-side coverage.

```bash
cd "$REPO_ROOT" && bash quality/scripts/verify.sh --step e2e --coverage
# or
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs
```

Reports: `quality/reports/coverage/` (HTML + LCOV + text-summary)

### Combined mode (`--combined`)

Runs Vitest + Playwright coverage, then merges into a single combined report.

```bash
cd "$REPO_ROOT" && node quality/scripts/coverage.mjs --combined
# or manually:
cd "$REPO_ROOT" && bash quality/scripts/verify.sh --step test --coverage
cd "$REPO_ROOT" && node quality/scripts/coverage-combine.mjs
```

Reports:
- `quality/reports/coverage/vitest/` — unit/integration coverage
- `quality/reports/coverage/playwright/` — E2E server-side coverage
- `quality/reports/coverage/combined/` — merged report (LCOV + HTML if genhtml available)

## Execution

Always run from the repo root. The scripts handle dependency installation automatically (including `@vitest/coverage-v8` and the npm rollup native module bug).

### Viewing reports

```bash
# Unit coverage
open quality/reports/coverage/vitest/index.html

# E2E coverage
open quality/reports/coverage/playwright/index.html

# Combined coverage
open quality/reports/coverage/combined/index.html
```

## Notes

- Reports are overwritten on every run (no dated directories)
- `quality/reports/` is in `.gitignore`
- The combiner (`coverage-combine.mjs`) merges LCOV files from all available sources
- If only one source has data, it still generates the combined report from that source
- E2E coverage is server-side only (API routes, middleware) — client code is bundled/minified
- `--coverage` flag works with all `verify.sh` step modes: `--step unit`, `--step e2e`, `--step test`
- `--combined` flag on `coverage.mjs` orchestrates the full pipeline in one command
