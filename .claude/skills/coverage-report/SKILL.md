---
name: coverage-report
description: "Generate code coverage reports. Supports Vitest unit test coverage (--unit-only) and full Playwright E2E coverage. Outputs HTML + text-summary + LCOV reports. Overwrites previous reports."
---

# Coverage Report

Generate code coverage reports via `verify.sh --coverage` and combine them.

## Usage

```
/coverage-report [--unit-only] [-- playwright args...]
```

## Modes

### Unit-only mode (`--unit-only`)

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" && bash quality/scripts/verify.sh --step unit --coverage
```

Reports: `quality/reports/coverage/vitest/` (HTML + LCOV + text-summary)

### E2E-only mode

```bash
cd "$REPO_ROOT" && bash quality/scripts/verify.sh --step e2e --coverage
```

Reports: `quality/reports/coverage/playwright/` (HTML + LCOV + text-summary)

### Full coverage (unit + e2e + combined)

```bash
cd "$REPO_ROOT" && bash quality/scripts/verify.sh --step test --coverage
cd "$REPO_ROOT" && node quality/scripts/coverage-combine.mjs
```

Reports:
- `quality/reports/coverage/vitest/` — unit test coverage
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
