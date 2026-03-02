# Plan: Import Workflow v2 — Three Paths to the Forge

## Task Description

Implement the unified import workflow that consolidates three import methods into a single elegant wizard: pasting a Google Sheets URL (enhanced with safety), uploading a CSV file, and (P2) browsing Google Drive via Picker. All three paths converge on the same LLM extraction → preview → dedup → confirm pipeline.

The product brief, wireframes, and interaction specs already exist:
- **Product Brief**: `designs/product/backlog/import-workflow-v2.md`
- **Wireframes**: `designs/ux-design/wireframes/import/` (method selection, CSV upload, safety banner)
- **Interaction Spec**: `designs/ux-design/interactions/import-workflow-v2.md`

## Objective

When complete, the Import Wizard opens to a method selection screen with three options. Users can paste a Google Sheets URL (Path A), upload a CSV file (Path C), or (P2) pick from Google Drive (Path B). Safety banners appear at every step. The CSV upload path extends the existing serverless import pipeline to accept raw CSV text. Path B is deferred to P2 (requires GCP verification).

## Problem Statement

The current import wizard only supports pasting a public Google Sheets URL. This excludes users who track cards in Excel, Numbers, or other non-Google tools. It also lacks safety guardrails warning users not to include sensitive financial data (card numbers, CVVs, SSNs) in their spreadsheets.

## Solution Approach

1. **Refactor ImportWizard** to add a method selection step before the existing URL entry step
2. **Create a CSV upload component** with drag-and-drop, file validation, and FileReader-based content extraction
3. **Extend the serverless import API** to accept either `{ url: string }` or `{ csv: string }`
4. **Add safety banner components** (4 variants) per the interaction spec
5. **Simplify useSheetImport hook** to support both URL and CSV text submission
6. Path B (Google Drive Picker) is designed but deferred to P2

**Critical context**: The Fly.io backend is being removed (separate PR in progress). The import pipeline is now HTTP-only via the serverless API route `/api/sheets/import`. WebSocket code is being stripped. This plan assumes HTTP-only import.

## Relevant Files

### Existing Files to Modify

- `development/frontend/src/components/sheets/ImportWizard.tsx` — Main wizard component. Add method selection step, safety banners, step indicator. This is the largest change.
- `development/frontend/src/components/sheets/ImportDedupStep.tsx` — May need minor prop changes if step flow changes.
- `development/frontend/src/hooks/useSheetImport.ts` — Extend to support both `{ url }` and `{ csv }` submission modes. After Fly.io removal, this will be HTTP-only.
- `development/frontend/src/app/api/sheets/import/route.ts` — Extend to accept `{ csv: string }` alongside `{ url: string }`. Skip URL-parse and CSV-fetch steps when CSV text is provided directly.
- `development/frontend/src/lib/sheets/import-pipeline.ts` — Add a `importFromCsv(csv: string)` function or extend `importFromSheet()` to accept CSV text directly.
- `development/frontend/src/lib/sheets/types.ts` — Add `sensitiveDataWarning` field to `SheetImportSuccess`.
- `development/frontend/src/lib/sheets/prompt.ts` — Harden the extraction prompt to ignore and flag sensitive data (card numbers, CVVs, SSNs).
- `development/frontend/src/app/page.tsx` — May need minor updates to pass `importMethod` context to the wizard.

### New Files to Create

- `development/frontend/src/components/sheets/MethodSelection.tsx` — Step 1: Three method cards (Path A, B, C) with safety banner.
- `development/frontend/src/components/sheets/CsvUpload.tsx` — Step 2C: Drag-and-drop zone with file validation.
- `development/frontend/src/components/sheets/SafetyBanner.tsx` — Shared safety banner component with 4 variants (full, compact, sensitive-data, post-share).
- `development/frontend/src/components/sheets/StepIndicator.tsx` — Linear dot stepper showing Method → Import → Preview → Confirm.
- `development/frontend/src/components/sheets/ShareUrlEntry.tsx` — Step 2A: Extracted from current ImportWizard entry step, enhanced with safety banner.
- `development/frontend/src/lib/sheets/csv-import-pipeline.ts` — Pipeline function that accepts raw CSV text (skips URL parse + fetch).

## Implementation Phases

### Phase 1: Foundation (Stories 1-2)
Extend the import pipeline to accept CSV text and add the safety banner component. These are prerequisites for all UI work.

### Phase 2: Core UI (Stories 3-4)
Build the method selection step, CSV upload component, and refactor ImportWizard to use the new multi-step flow with step indicator.

### Phase 3: Integration & Polish (Story 5)
LLM prompt hardening for sensitive data detection, end-to-end integration testing, and QA validation.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to do the building, validating, testing, deploying, and other tasks.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Builder
  - Name: fireman-decko
  - Role: Architecture, system design, implementation
  - Agent Type: fireman-decko-principal-engineer
  - Resume: true
- Validator
  - Name: loki
  - Role: QA testing, validation, ship/no-ship decision
  - Agent Type: loki-qa-tester
  - Resume: true

Note: Product (Freya) and UX (Luna) work is already complete — the product brief, wireframes, and interaction spec exist. This plan is implementation-only.

## Step by Step Tasks

### 1. Extend Import Pipeline to Accept Raw CSV Text
- **Task ID**: extend-pipeline-csv
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (can run alongside task 2)
- Create `development/frontend/src/lib/sheets/csv-import-pipeline.ts` with an `importFromCsv(csv: string)` function that:
  - Skips URL parsing and CSV fetching
  - Validates CSV is non-empty and under 100K chars (truncate with warning if over)
  - Feeds CSV directly to `buildExtractionPrompt(csv)` → LLM → validate → assign IDs
  - Returns the same `SheetImportResponse` type
- Update `development/frontend/src/app/api/sheets/import/route.ts`:
  - Accept request body as either `{ url: string }` or `{ csv: string }`
  - If `csv` is provided, call `importFromCsv(csv)` instead of `importFromSheet(url)`
  - Validate that exactly one of `url` or `csv` is provided
  - Keep `requireAuth()` for both paths
- Update `development/frontend/src/lib/sheets/types.ts`:
  - Add `sensitiveDataWarning?: boolean` to `SheetImportSuccess`
- Branch: `feat/import-csv-pipeline`
- **Acceptance Criteria**:
  - `POST /api/sheets/import` with `{ csv: "..." }` returns extracted cards
  - `POST /api/sheets/import` with `{ url: "..." }` continues to work (regression)
  - Sending both `url` and `csv` returns a 400 error
  - Sending neither returns a 400 error
  - CSV > 100K chars is truncated with a warning in the response
  - Build passes, TypeScript passes

### 2. Create Safety Banner Component
- **Task ID**: safety-banner-component
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (can run alongside task 1)
- Create `development/frontend/src/components/sheets/SafetyBanner.tsx`:
  - 4 variants controlled by a `variant` prop: `"full" | "compact" | "sensitive-data" | "post-share"`
  - **Variant 1 (full)**: Two-column include/exclude list, "Protect Your Secrets" heading, `role="alert"`, not dismissible
  - **Variant 2 (compact)**: Single-line reminder, `role="note"`, not dismissible
  - **Variant 3 (sensitive-data)**: Warning heading + explanation, `role="alert"`, only shown when `sensitiveDataWarning` is true
  - **Variant 4 (post-share)**: Reminder to remove public share, `role="note"`, shown after Path A success only
  - Follow wireframe at `designs/ux-design/wireframes/import/safety-banner.html`
  - Amber/gold styling consistent with the Saga Ledger theme
  - Responsive: columns stack below 480px for variant 1
- Branch: `feat/import-safety-banner`
- **Acceptance Criteria**:
  - All 4 variants render correctly
  - `role="alert"` on variants 1 and 3, `role="note"` on variants 2 and 4
  - Responsive layout works at 375px
  - Build passes, TypeScript passes

### 3. Build Method Selection and CSV Upload Components
- **Task ID**: method-selection-csv-upload
- **Depends On**: extend-pipeline-csv, safety-banner-component
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false (depends on tasks 1 and 2)
- Create `development/frontend/src/components/sheets/MethodSelection.tsx`:
  - Three selectable cards: "Share a Scroll" (Path A), "Browse the Archives" (Path B, disabled/P2), "Deliver a Rune-Stone" (Path C)
  - Safety banner (Variant 1 full) above method cards
  - `role="listbox"` with `role="option"` pattern per wireframe
  - Keyboard: Arrow keys between cards, Enter to select
  - Path B card: `aria-disabled="true"`, reduced opacity, "Coming soon" or "Sign in to browse your Google Drive" message
  - Mobile: cards stack vertically below 768px
  - Clicking a card calls `onSelectMethod(method: "url" | "picker" | "csv")`
  - Follow wireframe at `designs/ux-design/wireframes/import/import-method-selection.html`
- Create `development/frontend/src/components/sheets/CsvUpload.tsx`:
  - Drag-and-drop zone with 5 states: idle, drag-over, processing, accepted, error
  - "Choose file" button opens hidden `<input type="file" accept=".csv">`
  - Client-side validation: `.csv` only, max 1MB, UTF-8
  - Helpful error messages for `.xlsx`, `.numbers` files per interaction spec
  - File read via `FileReader.readAsText(file, 'UTF-8')`
  - On acceptance: show file summary row (name + size + remove button)
  - "Begin Import" button enabled only when file is accepted
  - "Back" link returns to method selection
  - Compact safety banner (Variant 2) at top
  - Follow wireframe at `designs/ux-design/wireframes/import/csv-upload.html`
  - Drop zone: `role="button"`, `tabindex="0"`, keyboard accessible
  - Follow interaction spec at `designs/ux-design/interactions/import-workflow-v2.md` Step 2C
- Create `development/frontend/src/components/sheets/StepIndicator.tsx`:
  - Linear dot stepper: Method → Import → Preview → Confirm
  - Active step has emphasized dot (gold in theme)
  - Compact, works within modal width
- Create `development/frontend/src/components/sheets/ShareUrlEntry.tsx`:
  - Extract current URL entry UI from ImportWizard into its own component
  - Add compact safety banner (Variant 2) at top
  - Add "Back" link to return to method selection
  - Add post-import tip: "Make sure the spreadsheet is shared as 'Anyone with the link can view'"
  - Keep existing URL validation logic
- Branch: `feat/import-method-selection`
- **Acceptance Criteria**:
  - Method selection shows 3 cards, Path B is disabled
  - Selecting Path A navigates to URL entry with back button
  - Selecting Path C navigates to CSV upload with back button
  - CSV drag-and-drop works with visual state transitions
  - File validation rejects non-CSV, oversized, and empty files with correct messages
  - FileReader successfully reads CSV content
  - "Begin Import" submits CSV text to the API
  - Step indicator shows correct active step
  - All touch targets >= 44x44px
  - Keyboard navigation works (Arrow keys in listbox, Tab, Enter)
  - Mobile layout works at 375px
  - Build passes, TypeScript passes

### 4. Refactor ImportWizard to Multi-Step Flow
- **Task ID**: refactor-import-wizard
- **Depends On**: method-selection-csv-upload
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false (depends on task 3)
- Refactor `ImportWizard.tsx` to orchestrate the new multi-step flow:
  - **Step flow**: method-selection → url-entry/csv-upload → loading → preview → dedup → success
  - Add `importMethod` state: `"url" | "csv" | null`
  - Add `csvText` state for Path C data
  - Wire MethodSelection → ShareUrlEntry / CsvUpload based on selection
  - Update `useSheetImport` hook:
    - Add `csvText` parameter to `submit()` or add a `submitCsv(csv: string)` method
    - When CSV is provided, POST `{ csv }` instead of `{ url }` to the API route
    - Remove `importPhase` if WebSocket code was removed by Fly.io PR, or keep as null
  - Wire the step indicator with correct active step for each view
  - Add safety banner Variant 3 to preview step (when `sensitiveDataWarning` is true in response)
  - Add safety banner Variant 4 to success step (when `importMethod === "url"`)
  - Ensure back navigation works: Step 2A/2C → Step 1
  - Ensure cancel at any step closes the modal
  - Ensure modal close during loading shows confirmation
  - Keep existing preview, dedup, and success steps working
- Branch: `feat/import-wizard-v2`
- **Acceptance Criteria**:
  - Full flow works end-to-end: method selection → URL entry → loading → preview → confirm
  - Full flow works end-to-end: method selection → CSV upload → loading → preview → confirm
  - Back navigation from Step 2 returns to method selection
  - Safety banners appear at correct steps (Variant 1, 2, 3, 4)
  - Step indicator progresses correctly
  - Existing URL import flow is not regressed
  - Dedup still works for both import methods
  - Modal sizing: `w-[92vw] max-w-[680px] max-h-[90vh]`
  - Mobile responsive at 375px
  - Keyboard and screen reader accessible
  - Build passes, TypeScript passes

### 5. LLM Prompt Hardening + Final QA Validation
- **Task ID**: llm-hardening-qa
- **Depends On**: refactor-import-wizard
- **Assigned To**: fireman-decko (hardening), then loki (QA)
- **Agent Type**: fireman-decko-principal-engineer, then loki-qa-tester
- **Parallel**: false (sequential: build then validate)
- **FiremanDecko**:
  - Update `development/frontend/src/lib/sheets/prompt.ts`:
    - Add instructions to the extraction prompt to ignore and never return:
      - Full card numbers (13-19 consecutive digits)
      - CVV codes (3-4 digit codes in CVV-labeled columns)
      - SSN patterns (XXX-XX-XXXX)
    - If detected, include `"sensitiveDataWarning": true` in the JSON response
  - Update `development/frontend/src/lib/sheets/card-schema.ts`:
    - The CardsArraySchema doesn't need to change, but the wrapper response type should support `sensitiveDataWarning`
  - Branch: `feat/import-llm-hardening`
- **Loki** (after FiremanDecko merges):
  - Full QA validation of the entire import workflow v2
  - Code review all PRs against acceptance criteria from the product brief
  - Build validation: `npm run build`
  - TypeScript validation: `npx tsc --noEmit`
  - GitHub Actions check on all PRs
  - **Acceptance Criteria from Product Brief** (designs/product/backlog/import-workflow-v2.md):
    - Safety banner visible before any import action
    - CSV upload: drag-and-drop works, validation rejects bad files, FileReader reads content
    - URL import: existing flow works with safety enhancements
    - All paths converge on same preview/dedup/confirm flow
    - Mobile responsive at 375px
    - Keyboard accessible
    - 44x44px touch targets
  - Report: SHIP / FIX REQUIRED with specific issues

## Acceptance Criteria

### Safety
- [ ] Safety banner (Variant 1 full) visible on method selection step before any import action
- [ ] Safety banner (Variant 2 compact) visible on URL entry and CSV upload steps
- [ ] LLM prompt instructs model to ignore card numbers (13-19 digits), CVVs, SSNs
- [ ] If sensitive data detected, `sensitiveDataWarning: true` in response and Variant 3 banner in preview
- [ ] Post-import Path A reminder (Variant 4) tells user to remove public share

### Path A: Share URL (enhanced)
- [ ] Existing URL import flow works as before
- [ ] Safety banner shown before URL entry
- [ ] Post-share reminder in success step
- [ ] Back button returns to method selection

### Path C: CSV Upload (new)
- [ ] Drag-and-drop zone with 5 visual states (idle, drag-over, processing, accepted, error)
- [ ] File picker button opens native dialog filtered to `.csv`
- [ ] Rejects non-CSV with specific messages (`.xlsx` → "export as CSV from Excel", `.numbers` → "export from Numbers")
- [ ] Rejects files > 1MB with size message
- [ ] Reads CSV client-side via FileReader
- [ ] Submits CSV text to `/api/sheets/import` with `{ csv: string }`
- [ ] Preview, dedup, and success steps identical to URL import
- [ ] Works for both signed-in and anonymous users

### Method Selection
- [ ] Three cards: Share a Scroll, Browse the Archives (disabled/P2), Deliver a Rune-Stone
- [ ] Selecting a card immediately advances to the corresponding Step 2
- [ ] Mobile: cards stack vertically below 768px
- [ ] Keyboard: Arrow keys between cards, Enter to select
- [ ] ARIA: `role="listbox"` + `role="option"` pattern
- [ ] Step indicator shows progress: Method → Import → Preview → Confirm

### General
- [ ] Modal sizing: `w-[92vw] max-w-[680px] max-h-[90vh]`
- [ ] Touch targets >= 44x44px on all buttons and cards
- [ ] `prefers-reduced-motion` respected for all animations
- [ ] Focus management correct on step transitions
- [ ] TypeScript clean: `npx tsc --noEmit` passes
- [ ] Build clean: `npm run build` passes

## Validation Commands

Execute these commands to validate the task is complete:

- `cd development/frontend && npx tsc --noEmit` — Type-check the codebase
- `cd development/frontend && npx next lint` — Lint the codebase
- `cd development/frontend && npm run build` — Verify the build succeeds

## Notes

### Dependencies on In-Flight Work
- **Fly.io Removal PR** (in progress): Removes WebSocket import code and the standalone backend. This plan assumes the import hook will be HTTP-only after that PR merges. If the Fly.io PR merges first, `useSheetImport.ts` will already be simplified.
- **AuthGate PR #59** (merged): The `<AuthGate>` component can be used to gate Path B's method card (show only to authenticated users), though for P1 Path B is disabled entirely.

### Path B (Google Drive Picker) — Deferred to P2
Path B is fully designed (see product brief and interaction spec) but deferred because:
1. Requires enabling Google Picker API and Sheets API v4 in GCP Console
2. Requires adding `drive.file` + `spreadsheets.readonly` OAuth scopes
3. Requires Google OAuth consent screen verification (1-3 weeks)
4. Requires incremental consent implementation in the auth flow

The method selection card for Path B should be rendered but disabled with "Coming soon" text.

### No New Dependencies
All work uses existing libraries (React, Radix Dialog, Tailwind). No new npm packages needed. The FileReader API and drag-and-drop APIs are native browser APIs.

### CSV Import Pipeline Design
The `importFromCsv()` function should share as much code as possible with `importFromSheet()`. The key difference is that `importFromCsv()` skips steps 1 (URL parse) and 2 (CSV fetch) and starts directly at step 3 (build prompt). Consider extracting a shared `extractCardsFromCsv(csv: string)` function that both pipelines call.
