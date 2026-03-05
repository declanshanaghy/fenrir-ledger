# Quality Report: PR #116 — feat/theme-foundation

**Date:** 2026-03-04
**Branch:** `feat/theme-foundation`
**Engineer:** FiremanDecko
**QA Tester:** Loki
**Re-validation round:** 2 (after commit 5c85e4b — DEF-TF-001 fix attempt)

---

## QA Verdict: FAIL

**Recommendation: HOLD FOR FIX.** DEF-TF-001 source fix is confirmed correct in
`globals.css` — the `.dark {}` block is now outside `@layer base` as recommended.
However, TC-TF-015 through TC-TF-019 still fail because the **worktree dev server
(port 9654) is broken and cannot serve static assets** (CSS, JS chunks). This is a
test infrastructure defect caused by the dev server being started with `-p 9653 -p 9654`
(two `-p` flags), which is not a valid Next.js invocation. A correctly started dev server
must be provided before re-validation can pass. See DEF-TF-002.

---

## Summary

| Check | Result |
|-------|--------|
| Code review against acceptance criteria | PASS |
| `npx tsc --noEmit` | PASS — 0 errors |
| `globals.css` fix: `.dark {}` outside `@layer base` | PASS — source confirmed correct |
| No stray `dark:` Tailwind prefixes | PASS |
| `next-themes` installed | PASS — v0.4.6 |
| `ThemeProvider` wraps app in `layout.tsx` | PASS |
| `suppressHydrationWarning` on `<html>` | PASS |
| `defaultTheme="system"` | PASS |
| `storageKey="fenrir-theme"` | PASS |
| `attribute="class"` | PASS |
| `.dark` class applied/removed by next-themes | PASS |
| Playwright TC-TF-001 to TC-TF-014, TC-TF-020 | PASS — 15/20 |
| Playwright TC-TF-015 to TC-TF-019 (CSS var values) | FAIL — DEF-TF-002 (infra) |

---

## Test Execution — Round 2

Run against port 9654 (worktree dev server):
```bash
SERVER_URL=http://localhost:9654 npx playwright test quality/test-suites/theme-toggle/ --reporter=list
```

- **Total:** 20
- **Passed:** 15
- **Failed:** 5

| ID | Name | Result |
|----|------|--------|
| TC-TF-001 | `layout.tsx` contains `suppressHydrationWarning` | PASS |
| TC-TF-002 | `layout.tsx` does NOT have hardcoded `className="dark"` | PASS |
| TC-TF-003 | `layout.tsx` imports `ThemeProvider` from `next-themes` | PASS |
| TC-TF-004 | `ThemeProvider` has `defaultTheme="system"` | PASS |
| TC-TF-005 | `ThemeProvider` has `storageKey="fenrir-theme"` | PASS |
| TC-TF-006 | `ThemeProvider` has `attribute="class"` | PASS |
| TC-TF-007 | `next-themes` in `package.json` dependencies | PASS |
| TC-TF-008 | `globals.css` has both `:root` and `.dark` blocks | PASS |
| TC-TF-009 | No stray `dark:` prefixed classes in `.tsx`/`.ts` files | PASS |
| TC-TF-010 | `fenrir-theme=dark` → `.dark` class on `<html>` | PASS |
| TC-TF-011 | `fenrir-theme=light` → no `.dark` class on `<html>` | PASS |
| TC-TF-012 | System + OS dark → `.dark` class on `<html>` | PASS |
| TC-TF-013 | System + OS light → no `.dark` class on `<html>` | PASS |
| TC-TF-014 | Theme persists across page reloads | PASS |
| TC-TF-015 | Dark mode `--background` is dark (low lightness) | **FAIL — DEF-TF-002** |
| TC-TF-016 | Light mode `--background` is parchment (high lightness) | **FAIL — DEF-TF-002** |
| TC-TF-017 | Dark mode `--foreground` is light text (high lightness) | **FAIL — DEF-TF-002** |
| TC-TF-018 | Light mode `--foreground` is dark text (low lightness) | **FAIL — DEF-TF-002** |
| TC-TF-019 | `--primary` differs between light and dark themes | **FAIL — DEF-TF-002** |
| TC-TF-020 | No React hydration errors in dark mode | PASS |

---

## Comparison: Round 1 vs Round 2

| Test | Round 1 (9653 — wrong server) | Round 2 (9654 — correct server) | Delta |
|------|-------------------------------|----------------------------------|-------|
| TC-TF-011 (light → no .dark class) | FAIL | PASS | Fixed by 5c85e4b |
| TC-TF-013 (system+light → no .dark) | FAIL | PASS | Fixed by 5c85e4b |
| TC-TF-015 (dark --background) | FAIL | FAIL | Infra blocking |
| TC-TF-016 (light --background) | FAIL | FAIL | Infra blocking |
| TC-TF-017 (dark --foreground) | FAIL | FAIL | Infra blocking |
| TC-TF-018 (light --foreground) | FAIL | FAIL | Infra blocking |
| TC-TF-019 (--primary differs) | FAIL | FAIL | Infra blocking |

Note: Round 1 was accidentally run against port 9653 (main repo server). Round 2 used
the correct worktree server on 9654. TC-TF-011 and TC-TF-013 recover because the
worktree server serves the correct (post-fix) layout.tsx. TC-TF-015–019 require live
CSS variable computation from the compiled stylesheet, which is blocked by DEF-TF-002.

---

## Defects Found

### DEF-TF-001: Dark CSS variable block absent from compiled CSS output — FIXED in 5c85e4b

- **Severity:** CRITICAL — now RESOLVED in source
- **Fix verified:** `.dark {}` block confirmed at line 68 of `globals.css`, outside `@layer base`
- **Status:** Source fix is correct. Cannot confirm runtime fix because DEF-TF-002
  blocks the CSS variable tests.

### DEF-TF-002: Worktree dev server (port 9654) cannot serve static assets

- **Severity:** HIGH (test infrastructure — blocks QA validation)
- **File:** Dev server startup command
- **Component:** Port 9654 Next.js dev server process (PID 66683)

**Description:**

The dev server on port 9654 returns HTTP 404 for all `/_next/static/` assets (CSS,
JS chunks). Static asset requests in Playwright result in `net::ERR_ABORTED`. The
Playwright browser receives zero loaded stylesheets. CSS custom properties therefore
return empty strings from `getComputedStyle`.

**Root Cause:**

The dev server process was started with two `-p` flags:
```
node .../next dev -p 9653 -p 9654
```
Next.js does not accept multiple `-p` arguments. The server listens on port 9654
(last `-p` wins) but the Turbopack dev compiler is initialised incorrectly. SSR
HTML renders successfully (because React Server Components run on the Node process),
but the static asset bundler does not correctly serve `/_next/static/` paths.

**Evidence:**
```bash
$ curl -s -I "http://localhost:9654/_next/static/css/app/layout.css"
HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8
# Returns full Next.js 404 HTML page, not CSS
```

Playwright network intercept shows:
```
CSS content length: 34826
CSS has .dark: false       # 34KB of HTML, not CSS
CSS has --background: false
```

**Fix Required:**

Kill the broken dev server and restart it correctly with a single port:
```bash
kill 66683
cd development/frontend && npx next dev -p 9654
```

Then re-run the full test suite:
```bash
SERVER_URL=http://localhost:9654 npx playwright test quality/test-suites/theme-toggle/ --reporter=list
```

All 20 tests are expected to pass once the dev server serves static assets correctly
and TC-TF-015 through TC-TF-019 can read live CSS variable values.

**Impact:** TC-TF-015, TC-TF-016, TC-TF-017, TC-TF-018, TC-TF-019 all fail with
`--background: ""`, `--foreground: ""`, `--primary: ""` (empty computed style).

---

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| `next-themes` installed; `ThemeProvider` wraps app in `layout.tsx` | PASS |
| `globals.css` has `:root` (light) and `.dark` (dark) variable blocks | PASS — source confirmed |
| `.dark {}` outside `@layer base` (DEF-TF-001 fix) | PASS — line 68, confirmed |
| Hardcoded `"dark"` class removed; `suppressHydrationWarning` added | PASS |
| Default theme is "system" with localStorage key `fenrir-theme` | PASS |
| App renders correctly in dark mode | CANNOT VERIFY — DEF-TF-002 blocks |
| `npx tsc --noEmit` passes | PASS — 0 errors |

---

## Risk Assessment

| Risk | Level | Notes |
|------|-------|-------|
| DEF-TF-001 source fix | LOW | Fix confirmed correct in globals.css |
| DEF-TF-002 dev server broken | HIGH | Blocks CSS variable test verification |
| ThemeProvider wiring | LOW | Verified correct |
| suppressHydrationWarning | LOW | Present and working |
| Pre-existing ESLint warning | LOW | `useCallback` dep in `PickerStep.tsx` — unrelated |

---

## Notes for FiremanDecko

The source fix in commit 5c85e4b is structurally correct — `.dark {}` is now
outside `@layer base` exactly as prescribed in DEF-TF-001. Two tests that were
previously failing due to SSR/hydration behaviour (TC-TF-011, TC-TF-013) now pass,
confirming the layout.tsx changes are working correctly.

The remaining 5 failures are entirely due to the dev server infrastructure issue
(DEF-TF-002) — the broken `-p 9653 -p 9654` dual-port startup. This is not a code
defect in the PR itself.

**To unblock final QA sign-off:**

1. Kill process 66683 (the broken dual-port dev server)
2. Start a fresh single-port dev server: `npx next dev -p 9654`
3. Re-run: `SERVER_URL=http://localhost:9654 npx playwright test quality/test-suites/theme-toggle/`
4. All 20 tests are expected to pass

If all 20 pass after the infra fix, this PR is cleared for merge.
