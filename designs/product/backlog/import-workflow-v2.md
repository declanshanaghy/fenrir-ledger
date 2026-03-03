# Product Design Brief: Import Workflow v2 — Three Paths to the Forge

**Priority**: P1 | **Sprint**: 6 | **Max stories**: 5

## Problem

One import method (paste public Google Sheets URL) creates friction: requires public sharing of financial data, excludes non-Google users, no safety guardrails against sensitive data in spreadsheets.

## Three Import Paths

All paths converge on the same pipeline: LLM extraction → preview → dedup → confirm.

| Path | Method | Auth Required | Priority |
|------|--------|---------------|----------|
| A | Paste Google Sheets share URL (existing, enhanced) | No | P1 |
| B | Google Drive Picker (select sheet without public sharing) | Yes (incremental consent) | P2 |
| C | Drag-and-drop CSV upload | No | P1 |

## Safety Requirements (Non-negotiable)

1. **Pre-import safety banner** before method selection: explain what to include (card names, issuers, fees, dates) and what to exclude (card numbers, CVVs, PINs, SSNs)
2. **LLM prompt hardening**: instruct model to ignore/flag card numbers (13-19 digits), CVVs (3-4 digits), SSNs (XXX-XX-XXXX)
3. **Post-import warning** if LLM flags sensitive data in preview step
4. No full card numbers, CVVs, PINs, or SSNs ever stored or returned

## Path Details

**Path A (Share URL)**: Existing flow + safety banner + post-import reminder to remove public share.

**Path B (Google Picker)**: Opens Google Picker overlay (Sheets-only filter). Uses user's access token via `drive.file` + `spreadsheets.readonly` scopes (incremental consent — only requested when Path B is first used). Disabled for anonymous users. Requires GCP API key + OAuth verification (1-3 week timeline risk).

**Path C (CSV Upload)**: Drag-and-drop zone or file picker. Client-side FileReader, `.csv` only, 1 MB limit. No raw file upload — only text content sent to backend. Works for all users.

## Acceptance Criteria

### Safety
- [ ] Safety banner visible before method selection with include/exclude guidance
- [ ] LLM prompt instructs model to ignore/flag card numbers, CVVs, SSNs
- [ ] Warning displayed in preview if sensitive data flagged
- [ ] No sensitive financial data ever stored or returned

### Path A (enhanced)
- [ ] Existing flow works as before with safety banner added
- [ ] Post-import reminder to remove public share
- [ ] URL validation rejects non-Google-Sheets URLs

### Path B (Google Picker)
- [ ] Picker opens within modal, filtered to Sheets only
- [ ] Fetches content via Sheets API v4 with user's access token
- [ ] Incremental consent: Drive scopes requested only on first Path B use
- [ ] Graceful handling: declined consent, token expiry, anonymous users
- [ ] No public sharing required

### Path C (CSV Upload)
- [ ] Drag-and-drop zone with visual feedback + file picker button
- [ ] `.csv` only (reject others with helpful message), 1 MB limit
- [ ] Client-side FileReader, text content sent to LLM pipeline
- [ ] Works for signed-in and anonymous users

### Shared
- [ ] All paths converge on same loading → preview → dedup → success flow
- [ ] Method selection is first step in Import Wizard
- [ ] Mobile responsive: cards stack vertically < 768px
- [ ] Keyboard navigable, ARIA labels, modal sizing `w-[92vw] max-w-[680px] max-h-[90vh]`

## User Stories

### 6.1: Import Method Selection Step
**As a** churner | **I want** to choose import method (URL, Drive, CSV) | **So that** I use whichever fits my setup
**P1-Critical** | Status: Backlog
- [ ] Three method cards with icon, title, description
- [ ] Safety banner above options
- [ ] Mobile stacking, keyboard nav, ARIA labels

### 6.2: CSV File Upload (Path C)
**As a** churner with non-Google spreadsheet | **I want** to upload a CSV | **So that** I import without Google
**P1-Critical** | Status: Backlog
- [ ] Drag-and-drop zone + file picker, `.csv` only, 1 MB limit
- [ ] Client-side FileReader → LLM pipeline
- [ ] Same preview/dedup/success as URL import
- [ ] Works for all users (signed-in and anonymous)

### 6.3: Share URL Enhancement (Path A Safety)
**As a** user importing via share URL | **I want** safety guidance and post-import reminder | **So that** I don't expose sensitive data
**P1-Critical** | Status: Backlog
- [ ] Safety banner before URL entry
- [ ] Post-import reminder to remove public share

### 6.4: LLM Extraction Prompt Hardening
**As a** user who may have card numbers in my spreadsheet | **I want** the system to detect and discard them | **So that** sensitive data is never stored
**P2-High** | Status: Backlog
- [ ] Prompt instructs LLM to ignore card numbers, CVVs, SSNs
- [ ] `sensitiveDataWarning` flag triggers preview warning
- [ ] No sensitive data in extracted output

### 6.5: Google Drive Picker (Path B)
**As a** Google Sheets user who won't make sheets public | **I want** to browse and select from Drive | **So that** I import without changing sharing settings
**P2-High** | Status: Backlog
- [ ] Google Picker overlay, Sheets-only filter
- [ ] Incremental consent for Drive scopes
- [ ] Graceful fallback if user declines or is anonymous
- [ ] Same pipeline as other paths

## Open Questions for Principal Engineer

1. Does `getLlmProvider()` support receiving raw CSV text (not from URL)? Path C needs to skip URL-parse/fetch.
2. Should CSV upload go through WebSocket backend or serverless HTTP? Recommend: support both (same as Path A).
3. Google Picker API key: store as `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` in `.env`?
4. Incremental consent pattern for adding Drive scopes to existing PKCE flow?
5. Is `CSV_TRUNCATION_LIMIT` (100K chars) appropriate for uploaded CSVs?
6. New endpoint `POST /import/csv` or extend existing `POST /import` to accept `{ csv: string }`?

## Handoff Notes for Principal Engineer

- **Three methods, one pipeline**: All paths must converge on same extraction → preview → dedup → confirm flow.
- **CSV Upload (Path C) ships first**: Zero dependencies, all users, broadest reach.
- **Safety is non-negotiable**: Banner + prompt hardening ship with first method.
- **Incremental consent for Picker**: Do not add Drive scopes to initial sign-in.
- **UX constraints**: Modal `w-[92vw] max-w-[680px] max-h-[90vh]`, 44px touch targets, 375px minimum width, Picker renders inside modal.
- **Acceptable trade-offs**: Path B can slip to later sprint if GCP verification delays. HTTP fallback acceptable for Path C initially. CSV size limit adjustable later.
