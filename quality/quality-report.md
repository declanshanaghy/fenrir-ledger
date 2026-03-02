# Quality Report: Sprint 6 — Browse the Archives (Path B)

## QA Verdict: FIX REQUIRED

**Validated by**: Loki (QA Tester)
**Date**: 2026-03-02
**Branch**: `feat/google-picker-path-b` (commit `209ac47`)
**Scope**: Google Drive Picker import path (Path B), regression check for Path A and Path C

---

## Summary

The implementation of Path B ("Browse the Archives") is **architecturally sound** and
nearly complete. The five new/modified files covering the Google API utilities, the Drive
token hook, the PickerStep component, and the Import Wizard wiring are well-written,
strictly typed, and secure.

However, **two files that are required by the committed code were not committed to git**:

1. `src/lib/auth/refresh-session.ts` — imported by the committed `useSheetImport.ts`
2. `src/app/api/auth/token/route.ts` modifications — the refresh-token grant type added
   on disk but not staged or committed

These are uncommitted on disk only. A fresh clone or CI build will fail because the
import cannot be resolved. The build only passes locally because the files exist on disk.
This must be fixed before the PR can be created or merged.

---

## Build Validation

| Check | Result | Notes |
|-------|--------|-------|
| `npm run build` | ✅ PASS | Build succeeds locally (files on disk) |
| `npx tsc --noEmit` | ⚠️ FAIL (pre-existing) | Errors in `LcarsOverlay.tsx` only — NOT in Path B files |
| `npx next lint` | ⚠️ FAIL (pre-existing) | Lint errors in `LcarsOverlay.tsx` only — NOT in Path B files |
| CI / fresh clone build | ❌ FAIL | `refresh-session.ts` missing from git — import fails |

### Pre-existing TypeScript/Lint Errors (Not introduced by this PR)

The following errors exist in `src/components/easter-eggs/LcarsOverlay.tsx` and predate
this branch (confirmed via `git diff main..HEAD` — file is not in this PR's changeset):

- `TS6133`: `EasterEggModal`, `discoveryOpen`, `sidebarHeights`, `handleDiscoveryClose` declared but never used
- `TS2304`: Cannot find name `visible` / `dismiss`

These are **pre-existing** and must be tracked separately. They do NOT block this PR
beyond the fact that `tsc --noEmit` is already broken on `main`.

---

## Defects Found

### DEF-001 [CRITICAL] — `refresh-session.ts` not committed

**File**: `development/frontend/src/lib/auth/refresh-session.ts`
**Status in git**: `??` (untracked — never committed)

**Evidence**:
```
$ git show main:development/frontend/src/lib/auth/refresh-session.ts
fatal: path '...refresh-session.ts' exists on disk, but not in 'main'
```
```
$ git status --short development/frontend/src/lib/auth/
?? development/frontend/src/lib/auth/refresh-session.ts
```

**Impact**: The committed `useSheetImport.ts` (in commit `209ac47`) contains:
```typescript
import { ensureFreshToken } from "@/lib/auth/refresh-session";
```
Without the file in git, CI and any fresh clone will fail compilation. The build
only passes locally because the file exists on disk.

**Fix**: Commit `refresh-session.ts` as part of this PR.

---

### DEF-002 [HIGH] — `auth/token/route.ts` refresh_token changes not committed

**File**: `development/frontend/src/app/api/auth/token/route.ts`
**Status in git**: `M` (modified on disk, NOT staged)

**Evidence**:
```
$ git diff HEAD -- development/frontend/src/app/api/auth/token/route.ts
# Shows extensive diff adding refresh_token grant type support
```
The committed version of `route.ts` only handles `authorization_code` grants. The
disk version (uncommitted) adds `refresh_token` grant handling.

**Impact**: When `ensureFreshToken()` detects a stale session token, `refreshSession()`
sends `{ refresh_token }` to `/api/auth/token`. The committed route treats this as
a malformed `authorization_code` request and returns `400`. The refresh fails silently,
`buildHeaders()` sends no Authorization header, and `/api/sheets/import` returns 401
("session expired"). Any user with a session token within 5 minutes of expiry will
fail to import via any of the three paths.

This is a **functional regression** for all import paths (A, B, and C) for users with
near-expiry sessions — worse than the `main` branch behavior.

**Fix**: Stage and commit the working-tree changes to `auth/token/route.ts`.

---

### DEF-003 [LOW] — "No thanks" button missing the spec-required helpful message

**File**: `src/components/sheets/PickerStep.tsx`, line 149-151
**Acceptance Criteria**: "Consent decline returns to method selection with a helpful message"

**Current code**:
```typescript
const handleDecline = useCallback(() => {
  onBack();
}, [onBack]);
```

**Expected**: When the user clicks "No thanks", a toast or inline message should say:
> "You can still import using a share URL or CSV file."

**Note**: The GIS popup CONSENT_DECLINED path **does** show this message (via `driveError`
rendering in the consent view). Only the direct "No thanks" button click is missing it.

**Fix**: Add `toast("You can still import using a share URL or CSV file.")` before
`onBack()` in `handleDecline` (sonner `toast` is already available in the project).

---

### DEF-004 [LOW] — Picker `setSize(600, 400)` may overflow 375px mobile viewports

**File**: `src/lib/google/picker.ts`, line 185
**Spec requirement**: "Picker iframe should be responsive within the `w-[92vw] max-w-[680px]` modal"

```typescript
.setSize(600, 400)
```

At 375px viewport width, 92vw ≈ 345px. The Picker width of 600px overflows the viewport.
The Picker renders as a floating overlay (not a nested div), so the modal width does not
constrain it. Google may or may not honour `.setSize()` on mobile, but the advisory width
should respect the viewport.

**Fix**: Compute the size dynamically:
```typescript
const pickerWidth = Math.min(typeof window !== "undefined" ? window.innerWidth - 24 : 600, 600);
.setSize(pickerWidth, 400)
```

---

## Tests Passed

The following acceptance criteria are fully implemented and verified by code review:

### Path B — Core Flow
- ✅ "Browse the Archives" card enabled for authenticated users (`status === "authenticated"`)
- ✅ "Browse the Archives" card disabled for anonymous users with label "Sign in to browse your Google Drive"
- ✅ "Browse the Archives" card disabled with label "Configuration required" when `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` is missing
- ✅ Clicking the card navigates to PickerStep (sets step to `"picker"`)
- ✅ GIS script loaded dynamically (no `<script>` tag in `<head>`)
- ✅ Drive scopes: `drive.file` + `spreadsheets.readonly` — incremental consent only on Path B
- ✅ Consent prompt shows when no valid Drive token exists
- ✅ "Allow Access" button triggers GIS popup
- ✅ Token stored in `localStorage["fenrir:drive-token"]` with `expires_at`
- ✅ 2-minute expiry buffer before token considered stale
- ✅ Drive token cleared on sign-out (auth status transition: `authenticated → anonymous`)
- ✅ Google Picker opens auto after consent (SPREADSHEETS view, NAV_HIDDEN)
- ✅ Picker cancel (`CANCEL` action) → `onBack()` with no error state
- ✅ Sheet selection triggers Sheets API v4 fetch
- ✅ Bearer Authorization with Drive access token on Sheets API call
- ✅ RFC 4180 CSV conversion (comma/newline/quote escaping)
- ✅ CSV text passed to `submitCsv()` → existing LLM extraction pipeline
- ✅ TOKEN_EXPIRED during fetch → re-request token once and retry
- ✅ All SheetsApiError codes handled with Norse-flavored messages
- ✅ Picker load failure → helpful error with Path A/C alternatives

### Path B — Back Navigation
- ✅ Consent state: "No thanks" button → `onBack()`
- ✅ Consent state: "← Back to import methods" link → `onBack()`
- ✅ Picker state: "← Back to import methods" link → `onBack()`
- ✅ Error state (picker): "Try another method" button → `onBack()`

### Accessibility
- ✅ `aria-live="polite"` on all three PickerStep states
- ✅ `aria-live` in ImportWizard announces `"Step 2: Browsing Google Drive"`
- ✅ `min-h-[44px]` on all buttons (44×44px touch target minimum)
- ✅ `motion-reduce:animate-none` on all spinners (prefers-reduced-motion)
- ✅ `role="status"` + `aria-label` on loading spinners
- ✅ `role="alert"` on error messages

### Non-Regression — Confirmed
- ✅ Path A (url) card: `disabled: false`, unchanged, still navigates to `url-entry` step
- ✅ Path C (csv) card: `disabled: false`, unchanged, still navigates to `csv-upload` step
- ✅ Anonymous users: Path A and Path C fully accessible
- ✅ PKCE sign-in flow: not touched (confirmed via `git diff --name-only`)
- ✅ `/api/sheets/import` route: not modified
- ✅ `requireAuth()` in `/api/sheets/import` — confirmed present
- ✅ `/api/auth/token` does NOT call `requireAuth()` — correct exemption per ADR-008

### Security
- ✅ No hardcoded secrets in any Path B file
- ✅ `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` correctly uses `NEXT_PUBLIC_` prefix (Picker API keys are client-safe by design)
- ✅ Drive access token stored in localStorage (same tier as session tokens — acceptable)
- ✅ Drive token cleared on sign-out
- ✅ Sheets API call uses Bearer token — never sends key or token to the Fenrir backend
- ✅ No secrets in `aria-*` attributes, error messages, or console output

### `.env.example`
- ✅ `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` added with full 6-step GCP setup instructions
- ✅ Value left empty (not a placeholder stub)
- ✅ Explains NEXT_PUBLIC_ safety rationale

---

## Observations (Non-Blocking)

**OBS-001**: `MethodCardDef.subtitle` field is populated on all three method cards but
never rendered in the JSX (`MethodSelection.tsx`). Dead field. Consider removing or
rendering it as supporting text under the description.

**OBS-002**: `getStepIndex()` in `ImportWizard.tsx` has redundant structure:
```typescript
case "url-entry":
case "csv-upload":
case "picker":
  return 1;
case "loading":
  return 1;  // ← same return value, separate case
```
Both return 1. Could be consolidated into one case group.

---

## Risk Assessment

| Risk | Severity | Likelihood | Notes |
|------|----------|------------|-------|
| CI build failure (DEF-001) | Critical | Certain | Blocks PR creation until fixed |
| Import failures for near-expiry sessions (DEF-002) | High | Low-moderate | Only users within 5min of token expiry |
| "No thanks" missing toast (DEF-003) | Low | Certain | UX gap, not functional |
| Mobile Picker overflow (DEF-004) | Low | Moderate | Google Picker may self-adapt on mobile |
| Pre-existing TS errors (LcarsOverlay) | Low | Pre-existing | Track separately, not this PR's problem |

---

## Recommendation: HOLD FOR FIXES

**DEF-001 and DEF-002 must be resolved before merging.** Both are quick fixes — stage and
commit the two missing/unstaged files. Once committed:

1. Re-run `npm run build` to confirm clean
2. Re-run `npx tsc --noEmit` (will still show pre-existing LcarsOverlay errors, which is acceptable)
3. Optionally address DEF-003 (toast on "No thanks") and DEF-004 (Picker mobile sizing)

The core Path B implementation is otherwise solid. Once the committed-file gap is resolved,
this is ready to ship.
