# QA Report: Sprint 5 — Google Sheets Import + LCARS Easter Egg

**Date:** 2026-03-01
**Tester:** Loki (QA Agent)
**Branch:** `qa/sprint-5-validation`
**Base commit:** `c0c924d` (main HEAD)

---

## Summary

All build, lint, file manifest, and code review checks **pass**. Two minor non-blocking
observations noted below. Sprint 5 is **READY TO SHIP**.

---

## Build & Lint

| Check | Result | Notes |
|-------|--------|-------|
| `npm run build` | **PASS** | Zero TypeScript errors. 11 static pages generated. Both API routes compiled. |
| `npm run lint` | **PASS** | "No ESLint warnings or errors" |

Build output confirms all routes:
- `ƒ /api/sheets/import` — dynamic, server-rendered ✓
- `○ /` — static, client hydrated ✓
- `○ /auth/callback` — static, client hydrated ✓

---

## File Manifest (Story 5.1–5.5 new files)

All 10 required files present:

| # | File | Result |
|---|------|--------|
| 1 | `src/lib/merge-anonymous.ts` | **PASS** |
| 2 | `src/app/api/sheets/import/route.ts` | **PASS** |
| 3 | `src/lib/sheets/types.ts` | **PASS** |
| 4 | `src/lib/sheets/parse-url.ts` | **PASS** |
| 5 | `src/lib/sheets/prompt.ts` | **PASS** |
| 6 | `src/components/sheets/ImportWizard.tsx` | **PASS** |
| 7 | `src/hooks/useSheetImport.ts` | **PASS** |
| 8 | `src/lib/sheets/dedup.ts` | **PASS** |
| 9 | `src/components/sheets/ImportDedupStep.tsx` | **PASS** |
| 10 | `src/components/easter-eggs/LcarsOverlay.tsx` | **PASS** |

---

## Code Review Checklist

### Story 5.1 — Silent Auto-Merge (`merge-anonymous.ts`)

| # | Check | Result | Evidence |
|---|-------|--------|---------|
| 3 | SSR guard (`typeof window === "undefined"`) | **PASS** | `merge-anonymous.ts:26-28` — returns `{merged:0,skipped:0}` early on server |
| 4 | Sets tombstone AND clears anonymous data | **PASS** | `:62` sets `fenrir:merged:<anonId>` to `"1"`; `:65-66` removes both anonymous localStorage keys |

Auth callback (`app/auth/callback/page.tsx:163-172`) correctly:
- Imports `mergeAnonymousCards` and `isMergeComplete` dynamically
- Checks tombstone before merging
- Writes merge result to `sessionStorage` for dashboard toast
- Dashboard (`app/page.tsx:55-64`) reads and displays the toast ✓

### Story 5.2 — Google Sheets Import API Route (`route.ts`)

| # | Check | Result | Evidence |
|---|-------|--------|---------|
| 5 | `maxDuration = 60` | **PASS** | `route.ts:8` — `export const maxDuration = 60;` |
| 6 | Uses `claude-haiku-4-5-20251001` | **PASS** | `route.ts:129` — `model: "claude-haiku-4-5-20251001"` |
| 7 | Zod validation on extracted cards | **PASS** | `route.ts:10-30` — full `CardSchema` with field-level types, min values, nullable SUB; `CardsArraySchema.parse()` at `:160` |
| 8 | Does NOT set `householdId` on cards | **PASS** | `route.ts:171-177` — map only sets `id`, `status`, `createdAt`, `updatedAt` |

API also validates: empty CSV (`:91-96`), truncation warning (`:98-102`), missing `ANTHROPIC_API_KEY` (`:112-118`), retry on transient Anthropic errors (`:126-147`), ZodError vs JSON parse failure (`:183-194`). Error taxonomy matches `SheetImportError` types.

### Story 5.3 — Import Wizard UI (`ImportWizard.tsx`)

| # | Check | Result | Evidence |
|---|-------|--------|---------|
| 9 | Modal sizing `w-[92vw] max-w-[680px] max-h-[90vh]` | **PASS** | `ImportWizard.tsx:118` — exact class string confirmed |
| 10 | `aria-live="polite"` on step container | **PASS** | `ImportWizard.tsx:122` — `<div aria-live="polite" className="sr-only">` with per-step announcements |

All 5 wizard steps implemented: `entry`, `loading`, `preview`, `dedup`, `error`, `success`. Step type `ImportStep` in `useSheetImport.ts:7` includes `"dedup"` — no type mismatch. Radix `Dialog` provides built-in focus trap. All interactive buttons `h-11 min-w-[44px]` meet 44px touch target minimum.

### Story 5.4 — Dedup + Persistence (`dedup.ts`, `page.tsx`)

| # | Check | Result | Evidence |
|---|-------|--------|---------|
| 11 | Dedup matches by issuerId + cardName (case-insensitive) | **PASS** | `dedup.ts:23,31` — key: `` `${issuerId}::${cardName.trim().toLowerCase()}` `` for both existing and imported |
| 12 | `handleConfirmImport` uses `saveCard()` | **PASS** | `page.tsx:91` — `saveCard(card)` inside loop; `getCards()` refresh at `:94` |

`findDuplicates` correctly splits into `{duplicates, unique}`. `ImportDedupStep` surfaces both "Skip duplicates" and "Import all" paths. `onSkipDuplicates` passes only `dedupResult.unique`; `onImportAll` passes full `cards` array.

### Story 5.5 — LCARS Mode Easter Egg (`LcarsOverlay.tsx`)

| # | Check | Result | Evidence |
|---|-------|--------|---------|
| 13 | Skips trigger when INPUT/TEXTAREA/SELECT focused | **PASS** | `LcarsOverlay.tsx:56-57` — reads `e.target.tagName`, returns early if form field |
| 14 | Auto-dismisses after 5 seconds | **PASS** | `LcarsOverlay.tsx:74-78` — `setTimeout(dismiss, 5000)` on `visible` change; cleanup via `clearTimeout` |

ESC dismiss: `LcarsOverlay.tsx:63-65` — handled in same keydown listener. Click-to-dismiss: `motion.div onClick={dismiss}:102`. Re-triggerable (no one-time gate per spec). Shows stardate, active cards, Valhalla count, urgent count, threat level, system status.

### Security — No Hardcoded Secrets

| # | Check | Result | Evidence |
|---|-------|--------|---------|
| 15 | No API keys or secrets in committed files | **PASS** | grep for `sk-ant-`, `ANTHROPIC_API_KEY=`, `AIza` in `src/` returned zero matches. `ANTHROPIC_API_KEY` accessed only via `process.env` at `route.ts:111`. `.env` and `*.env.*` are in both root and `development/ledger/.gitignore`. |

---

## Minor Observations (Non-Blocking)

### OBS-1: Client 20s timeout vs server 60s `maxDuration` tension

**Location:** `useSheetImport.ts:46-48`
**Description:** The client aborts the fetch after 20 seconds. The server's `maxDuration = 60` allows up to 60 seconds of processing. For sheets requiring multi-pass Anthropic extraction, the server may still be processing when the client aborts, resulting in a false FETCH_ERROR displayed to the user.
**Severity:** Low — affects user experience on large/complex spreadsheets only. Not a correctness bug.
**Recommendation:** Consider raising the client timeout to 50s or surfacing a "still working..." message during the wait.

### OBS-2: `Math.random()` in LcarsOverlay render produces non-deterministic block heights

**Location:** `LcarsOverlay.tsx:141`
**Description:** `height: ${30 + Math.random() * 40}px` inside the render function produces different heights on every React re-render (e.g., when `visible` changes). On a client-only component this causes no hydration issue, but the left sidebar blocks jump in size whenever any state updates during the 5-second display window.
**Severity:** Cosmetic only.
**Recommendation:** Pre-generate the random heights in a `useMemo` or `useRef` so they stabilise for the lifetime of each overlay activation.

---

## Test Coverage Assessment

| Area | Automated | Notes |
|------|-----------|-------|
| Build + type safety | ✓ `next build` | Zero errors |
| Lint | ✓ `next lint` | Clean |
| SSR guard | Static code review | ✓ confirmed |
| Tombstone logic | Static code review | ✓ confirmed |
| API contract | Static code review | ✓ full Zod schema |
| Dedup algorithm | Static code review | ✓ case-insensitive issuerId+cardName |
| Modal accessibility | Static code review | ✓ aria-live, focus trap, touch targets |
| LCARS trigger guards | Static code review | ✓ form field check, ESC, auto-dismiss |
| Secret scanning | grep scan | ✓ no hardcoded secrets |
| Manual browser tests | — | Not run (no live test server configured for this sprint) |

---

## Verdict

> **PASS — READY TO SHIP**

All 15 code review items pass. Build succeeds with zero TypeScript errors. Lint clean. All 10 new files present and correctly implemented. No hardcoded secrets found. Two minor non-blocking observations raised (OBS-1, OBS-2) that do not block shipping.
