# Quality Report: PR #116 — feat/theme-foundation

**Date:** 2026-03-04
**Branch:** `feat/theme-foundation`
**Engineer:** FiremanDecko
**QA Tester:** Loki

---

## QA Verdict: FAIL

**Recommendation: HOLD FOR FIX.** DEF-TF-001 is critical — the `.dark` CSS variable
block is completely absent from the compiled CSS output. Dark mode renders the light
(parchment) palette, not the Norse war-room palette. The ThemeProvider wiring is
correct; the bug is in the CSS layer structure. Fix required before merge.

---

## Summary

| Check | Result |
|-------|--------|
| Code review against acceptance criteria | PASS |
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx next build` | PASS — build succeeds (1 pre-existing ESLint warning) |
| No stray `dark:` Tailwind prefixes | PASS — 0 matches |
| `next-themes` installed | PASS — v0.4.6 in package.json |
| `ThemeProvider` wraps app in `layout.tsx` | PASS |
| `suppressHydrationWarning` on `<html>` | PASS |
| `defaultTheme="system"` | PASS |
| `storageKey="fenrir-theme"` | PASS |
| `attribute="class"` | PASS |
| `.dark` class applied/removed by next-themes | PASS — verified via Playwright |
| GH Actions | PENDING (deploy-preview check pending at time of report) |
| Playwright tests: 17/20 pass | FAIL — 3 tests expose DEF-TF-001 |

---

## Test Execution

- **Total:** 20 (TC-TF-001 through TC-TF-020)
- **Passed:** 17
- **Failed:** 3
- **Blocked:** 0

### Test suite: `quality/test-suites/theme-toggle/theme-foundation.spec.ts`

Run command:
```bash
SERVER_URL=http://localhost:9654 npx playwright test --grep "TC-TF" --reporter=list
```

(Must run against the worktree dev server on port 9654, not the main repo server on 9653.)

| ID | Name | Result |
|----|------|--------|
| TC-TF-001 | `layout.tsx` contains `suppressHydrationWarning` | PASS |
| TC-TF-002 | `layout.tsx` does NOT have hardcoded `className="dark"` | PASS |
| TC-TF-003 | `layout.tsx` imports `ThemeProvider` from `next-themes` | PASS |
| TC-TF-004 | `ThemeProvider` has `defaultTheme="system"` | PASS |
| TC-TF-005 | `ThemeProvider` has `storageKey="fenrir-theme"` | PASS |
| TC-TF-006 | `ThemeProvider` has `attribute="class"` (Tailwind requirement) | PASS |
| TC-TF-007 | `next-themes` in `package.json` dependencies | PASS |
| TC-TF-008 | `globals.css` has both `:root` and `.dark` blocks | PASS |
| TC-TF-009 | No stray `dark:` prefixed classes in `.tsx`/`.ts` files | PASS |
| TC-TF-010 | `fenrir-theme=dark` → `.dark` class on `<html>` | PASS |
| TC-TF-011 | `fenrir-theme=light` → no `.dark` class on `<html>` | PASS |
| TC-TF-012 | System + OS dark → `.dark` class on `<html>` | PASS |
| TC-TF-013 | System + OS light → no `.dark` class on `<html>` | PASS |
| TC-TF-014 | Theme persists across page reloads | PASS |
| TC-TF-015 | Dark mode `--background` is dark (low lightness) | **FAIL — DEF-TF-001** |
| TC-TF-016 | Light mode `--background` is parchment (high lightness) | PASS |
| TC-TF-017 | Dark mode `--foreground` is light text (high lightness) | **FAIL — DEF-TF-001** |
| TC-TF-018 | Light mode `--foreground` is dark text (low lightness) | PASS |
| TC-TF-019 | `--primary` differs between light and dark themes | **FAIL — DEF-TF-001** |
| TC-TF-020 | No React hydration errors in dark mode | PASS |

---

## Defects Found

### DEF-TF-001: Dark CSS variable block absent from compiled CSS output

- **Severity:** CRITICAL
- **File:** `development/frontend/src/app/globals.css`
- **Acceptance Criteria Violated:** "globals.css has :root (light) and .dark (dark) variable blocks"

**Description:**

The `.dark { }` CSS variable block defined inside `@layer base` is completely absent
from the compiled CSS output. The compiled `layout.css` contains only the `:root`
(light parchment) variable block. As a result, dark mode renders with the wrong palette
— parchment backgrounds and brown text instead of void-black backgrounds and light text.

**Evidence:**

The `.dark` class IS correctly applied to `<html>` by next-themes (TC-TF-010 through
TC-TF-013 all pass). However, `getComputedStyle(document.documentElement)` returns
light palette values even when `document.documentElement.classList.contains("dark")`
is `true`.

Compiled CSS (`layout.css`) has zero occurrences of the dark palette values:
- `28  15% 7%` (dark background) — absent
- `40  27% 91%` (dark foreground) — absent
- `42  75% 48%` (dark primary gold) — absent

**Root Cause:**

The `.dark { }` selector is placed inside `@layer base { }` in `globals.css`. Tailwind's
CSS compilation appears to be dropping the `.dark` block from the base layer. This may
be because Tailwind's base layer processing does not expect class-based selectors for
CSS custom property overrides, or the specificity/ordering within `@layer base` is
preventing the `.dark` block from surviving compilation.

**Reproduction:**

```bash
# Build the project
cd development/frontend && npm run build

# Check compiled CSS for dark palette values (will find none)
grep "28.*15%.*7%\|40.*27%.*91%\|42.*75%.*48%" .next/static/css/app/layout.css
# Expected: matches
# Actual:   no matches
```

**Fix Required:**

Option A (recommended): Move the `.dark { }` block outside of `@layer base`. Place
it after the `@layer base { }` block in `globals.css`. CSS custom properties on
`.dark` do not need to be in a layer — they work as standard CSS.

```css
@layer base {
  :root {
    --background: 36 33% 88%;
    /* ... rest of light palette ... */
  }
  /* Remove .dark from here */
}

/* Outside any @layer — this guarantees the block survives compilation */
.dark {
  --background: 28 15% 7%;
  /* ... rest of dark palette ... */
}
```

Option B: Qualify the `.dark` selector more explicitly:
```css
@layer base {
  html.dark {
    --background: 28 15% 7%;
    /* ... */
  }
}
```

**Impact:** Without this fix, dark mode is completely broken. The app renders the
parchment palette regardless of the selected theme. The ThemeProvider correctly
toggles the `.dark` class, but the CSS variables never change.

---

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| `next-themes` installed; `ThemeProvider` wraps app in `layout.tsx` | PASS |
| `globals.css` has `:root` (light) and `.dark` (dark) variable blocks | PASS (source) / FAIL (compiled) |
| Hardcoded `"dark"` class removed from `<html>`; `suppressHydrationWarning` added | PASS |
| Default theme is "system" with localStorage key `fenrir-theme` | PASS |
| App renders correctly in dark mode (no visual regression) | **FAIL — DEF-TF-001** |
| `npx tsc --noEmit` passes | PASS |
| `npx next build` succeeds | PASS (build succeeds but dark CSS is missing) |

---

## Risk Assessment

| Risk | Level | Notes |
|------|-------|-------|
| DEF-TF-001 dark CSS absent | CRITICAL | Dark mode completely broken at runtime |
| ThemeProvider wiring | LOW | Verified correct — next-themes wires up correctly |
| suppressHydrationWarning | LOW | Present in source; works correctly |
| next-themes version | LOW | v0.4.6, well-maintained package |
| Pre-existing ESLint warning | LOW | `useCallback` dep in `PickerStep.tsx` — pre-existing, unrelated |

---

## Notes for FiremanDecko

The ThemeProvider is wired up perfectly. The `layout.tsx` changes are all correct.
The `dark:text-amber-400` removals are confirmed. The only issue is the `.dark { }`
CSS variable block being stripped by Tailwind's `@layer base` compilation step.

Move the `.dark { }` block outside of `@layer base` in `globals.css` — the fix is
a one-line structural change (moving the closing brace position). See DEF-TF-001 for
the exact recommended change.

Once fixed, re-run:
```bash
SERVER_URL=http://localhost:<worktree-port> npx playwright test --grep "TC-TF"
```

All 20 tests should pass after the fix.
