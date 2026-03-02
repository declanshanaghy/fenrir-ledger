# QA Verdict: Import Workflow v2 — Three Paths to the Forge

**PR:** #61 `feat/import-workflow-v2`
**Date:** 2026-03-01
**Reviewer:** Loki (QA Tester)
**Branch:** `feat/import-workflow-v2`

---

## QA Verdict: FAIL

**Recommendation: HOLD FOR FIXES**

Three defects require resolution before ship. Two are HIGH severity (a broken
user-visible flow and a missing accessibility requirement). One is MEDIUM
severity (missing format-specific error messages). All other acceptance
criteria pass.

---

## Issues Found

### DEF-001 [HIGH] Success step is dead code — never reached, post-share banner never shown

- **File:** `development/frontend/src/components/sheets/ImportWizard.tsx`,
  `development/frontend/src/app/page.tsx`
- **Expected:** After the user confirms an import (via preview or dedup step),
  the wizard transitions to the `"success"` step. The Fehu rune, success
  message, and Variant 4 post-share `SafetyBanner` are displayed for URL
  imports. The modal auto-closes after 1.5 s.
- **Actual:** `setStep("success")` is **never called anywhere in the codebase**.
  `handleConfirmImport` in `page.tsx` calls `setImportWizardOpen(false)`
  directly, closing the modal immediately without ever rendering the success
  step. The `step === "success"` block in `ImportWizard.tsx` (lines 391-416),
  the `importMethod === "url"` post-share banner (line 409-413), and the
  auto-close timer (lines 123-130) are all unreachable dead code.
- **Acceptance criteria violated:**
  - "Post-share reminder (Variant 4) in success step for URL imports only"
  - "Full flow works end-to-end: method selection -> URL entry -> loading ->
    preview -> confirm -> **success**"
- **Fix required:** `handleConfirmImport` in `page.tsx` must call
  `setStep("success")` on the hook (or accept it as a prop) before closing,
  OR `ImportWizard.handleConfirm` / `handleSkipDuplicates` / `handleImportAll`
  must call `setStep("success")` internally before delegating to
  `onConfirmImport`. The `onConfirmImport` callback should be invoked from
  within the success step (perhaps on mount or after the 1.5 s timer), not
  before it.

---

### DEF-002 [HIGH] Method option cards missing individual `aria-label`

- **File:** `development/frontend/src/components/sheets/MethodSelection.tsx`
  (lines 190-224)
- **Expected (from interaction spec
  `designs/ux-design/interactions/import-workflow-v2.md` line 100):**
  `Each card: role="option", tabindex="0", aria-label with full description.`
- **Actual:** The `role="option"` divs have `role`, `tabIndex`,
  `aria-selected`, and `aria-disabled`, but **no `aria-label`**. Screen
  readers announce the element type and focus without a useful description of
  what the option does.
- **Fix required:** Add `aria-label` to each option div. Example:
  ```tsx
  aria-label={`${method.title}: ${method.description}${method.disabled ? " (Coming soon)" : ""}`}
  ```

---

### DEF-003 [MEDIUM] CSV upload rejects non-.csv files with a generic message instead of format-specific guidance

- **File:** `development/frontend/src/components/sheets/CsvUpload.tsx`
  (lines 53-58)
- **Expected (from interaction spec
  `designs/ux-design/interactions/import-workflow-v2.md`):**
  - `.xlsx` / `.xls` files: "Excel files are not supported directly. Please
    export as CSV from Excel first (File > Save As > CSV UTF-8)."
  - `.numbers` files: "Numbers files are not supported directly. Please export
    as CSV from Numbers first (File > Export To > CSV)."
  - Orchestration spec also states: "Helpful error messages for .xlsx,
    .numbers files"
- **Actual:** All non-.csv files receive the same generic message: "Only .csv
  files are accepted." No format-specific export instructions.
- **Fix required:** Check `file.name.toLowerCase()` for `.xlsx`, `.xls`, and
  `.numbers` extensions before falling through to the generic message.

---

## Tests Passed

### Safety
- SafetyBanner Variant 1 (full, `role="alert"`) renders on method selection step via `MethodSelection.tsx` line 181. PASS.
- SafetyBanner Variant 2 (compact, `role="note"`) renders on both URL entry (`ShareUrlEntry.tsx` line 37) and CSV upload (`CsvUpload.tsx` line 154). PASS.
- SafetyBanner Variant 3 (sensitive-data, `role="alert"`) renders conditionally in preview step when `sensitiveDataWarning === true` (`ImportWizard.tsx` lines 283-285). PASS.
- LLM prompt instructs model to ignore card numbers (13-19 digits), CVVs, SSNs (`prompt.ts` lines 31-35). PASS.
- `sensitiveDataWarning?: boolean` field present in `SheetImportSuccess` (`types.ts` line 20). PASS.
- Post-share Variant 4 banner is implemented in code (`ImportWizard.tsx` lines 408-413) but unreachable — see DEF-001.

### Method Selection
- Three cards rendered: "Share a Scroll" (url), "Browse the Archives" (picker, disabled), "Deliver a Rune-Stone" (csv). PASS.
- `role="listbox"` on container, `role="option"` on each card. PASS.
- Path B `aria-disabled={true}`, `tabIndex={-1}`, `opacity-50 cursor-not-allowed`, "Coming soon" badge. PASS.
- Arrow key navigation between enabled cards (ArrowRight/ArrowDown/ArrowLeft/ArrowUp) implemented. PASS.
- Enter and Space keys select focused card. PASS.
- Mobile: `grid-cols-1 md:grid-cols-3` — cards stack on mobile. PASS.

### CSV Upload
- Drag-and-drop zone with 5 visual states: idle, drag-over, processing, accepted, error. PASS.
- `dragCountRef` prevents premature drag-leave on child elements. PASS.
- File picker button opens hidden `<input type="file" accept=".csv">`. PASS.
- `.csv` extension validation (generic message — see DEF-003 for specific messages gap).
- File size validation: `file.size > 1_048_576` (1 MB). PASS.
- Empty file validation: `file.size === 0` check. PASS.
- `FileReader.readAsText(file, "utf-8")` for client-side reading. PASS.
- File summary row (name + size + remove button) shown in accepted state. PASS.
- Remove button resets file state. PASS.
- "Import CSV" button disabled until `dropState === "accepted"`. PASS.
- Back button returns to method selection. PASS.
- Compact safety banner at top. PASS.
- Drop zone `role="button"`, `tabIndex={0}`, keyboard accessible (Enter/Space). PASS.
- Remove button touch target: `min-w-[44px] min-h-[44px]`. PASS.

### Share URL Entry
- Compact safety banner at top. PASS.
- Back button to method selection. PASS.
- URL input with Enter key submission. PASS.
- Import button disabled when URL is invalid. PASS.
- Validation error shown when URL is non-empty but invalid. PASS.
- Public share tip text present. PASS.
- Button touch targets: `h-11` (44px). PASS.

### Pipeline / API
- `route.ts` accepts `{ url }` OR `{ csv }` (validated with mutually exclusive check). PASS.
- Sending both `url` and `csv` returns 400. PASS.
- Sending neither returns 400. PASS.
- `importFromCsv` validates non-empty, truncates at 100K chars with warning. PASS.
- Truncation warning merged into response `warning` field. PASS.
- Shared `extractCardsFromCsv` used by both `importFromSheet` and `importFromCsv`. PASS.
- `requireAuth(request)` called at top of route handler (CLAUDE.md compliance). PASS.
- `INVALID_CSV` error code added to `SheetImportErrorCode`. PASS.
- `ImportResponseSchema` added to `card-schema.ts` wrapping cards + `sensitiveDataWarning`. PASS.
- Backwards-compatible fallback to plain array format in `extractCardsFromCsv`. PASS.

### ImportWizard Integration
- Steps: method -> url-entry/csv-upload -> loading -> preview -> dedup. PASS.
- `StepIndicator` renders with correct `activeStep` index for each step via `getStepIndex()`. PASS.
- Back navigation from url-entry/csv-upload -> method (calls `handleBackToMethod` which sets `"method"` and clears `importMethod`). PASS.
- `sensitiveDataWarning` banner in preview step. PASS.
- Modal sizing: `w-[92vw] max-w-[680px] max-h-[90vh]`. PASS.
- `aria-live="polite"` region announces step changes to screen readers. PASS.
- Error step displays human-readable message and "Try Again" button. PASS.
- Cancel from loading aborts in-flight request via `AbortController`. PASS.

### General
- Touch targets: all buttons use `h-11` (44px) with `min-w-[44px]`. PASS.
- Mobile responsive: method cards use `grid-cols-1 md:grid-cols-3`. PASS.
- `prefers-reduced-motion`: `globals.css` sets `animation: none` globally under the media query, covering `animate-spin` spinners. PASS.
- TypeScript: `npx tsc --noEmit` — PASS (zero errors).
- Build: `npm run build` — PASS (zero errors, 11 pages generated).
- GH Actions `deploy-preview`: PASS (completed in 2m55s).

---

## Build Validation

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npm run build` | PASS — clean production build |
| GH Actions `deploy-preview` | PASS |

---

## Minor Observations (non-blocking)

These do not block ship but should be noted for follow-up:

1. **Dead field: `subtitle` in `MethodCardDef`** — The `subtitle` field is defined in the interface and populated for all three method cards but is never rendered in JSX. It is dead code. Either render it (adds useful subtext under the title) or remove it from the type definition.

2. **Listbox `aria-label` mismatch** — Spec says `aria-label="Import method"` but implementation says `aria-label="Choose import method"`. Functionally equivalent but diverges from the interaction spec's exact wording.

3. **Drop zone `aria-label` mismatch** — Spec says `aria-label="Drop a CSV file here or click to browse"` but implementation says `aria-label="Upload CSV file"`. The spec version is more descriptive and discoverable for screen reader users.

4. **Remove button `aria-label` mismatch** — Spec says `aria-label="Remove selected file"` but implementation says `aria-label="Remove file"`. Minor but diverges from the spec.

5. **SafetyBanner Variant 1 responsive breakpoint** — Spec says columns stack below 480px. Implementation uses `md:grid-cols-2` (Tailwind `md` = 768px). There is no 480px custom breakpoint in `tailwind.config.ts`. Within the import modal (`max-w-[680px]`), the two-column layout will never stack since the modal itself is narrower than 768px on most screens — meaning the columns always stack inside the modal. This is functionally acceptable (the modal is already narrow) but does not match the spec's stated 480px threshold.

---

## Files Reviewed

| File | Status |
|------|--------|
| `src/lib/sheets/types.ts` | PASS |
| `src/lib/sheets/prompt.ts` | PASS |
| `src/lib/sheets/card-schema.ts` | PASS |
| `src/lib/sheets/extract-cards.ts` | PASS |
| `src/lib/sheets/csv-import-pipeline.ts` | PASS |
| `src/lib/sheets/import-pipeline.ts` | PASS |
| `src/app/api/sheets/import/route.ts` | PASS |
| `src/components/sheets/SafetyBanner.tsx` | PASS |
| `src/components/sheets/StepIndicator.tsx` | PASS |
| `src/components/sheets/MethodSelection.tsx` | FAIL (DEF-002) |
| `src/components/sheets/ShareUrlEntry.tsx` | PASS |
| `src/components/sheets/CsvUpload.tsx` | FAIL (DEF-003) |
| `src/hooks/useSheetImport.ts` | PASS |
| `src/components/sheets/ImportWizard.tsx` | FAIL (DEF-001) |
