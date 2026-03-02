# Plan: Browse the Archives — Google Drive Picker (Path B)

## Task Description

Implement the "Browse the Archives" import method (Path B) in the Import Wizard. This enables authenticated users to select a spreadsheet directly from their Google Drive using the Google Picker API, fetch its content via the Google Sheets API v4, and feed it into the existing LLM extraction pipeline — all without making the spreadsheet public.

This was previously deferred as P2 during the Import Workflow v2 implementation (PR #61). The method card is already rendered in `MethodSelection.tsx` but disabled with "Coming soon" text. The product brief (`designs/product/backlog/import-workflow-v2.md`, Story 6.5) and interaction spec (`designs/ux-design/interactions/import-workflow-v2.md`, Step 2B) are complete.

## Objective

When complete, a signed-in user can click "Browse the Archives" in the Import Wizard, grant Drive access via an incremental consent popup, browse their Google Drive for spreadsheets, select one, and import their cards — all within the modal. The spreadsheet never needs to be made public. Anonymous users see the card disabled with "Sign in to browse your Google Drive."

## Problem Statement

Path A (Share URL) requires users to make their spreadsheet publicly accessible, which many privacy-conscious churners refuse to do. Path C (CSV Upload) requires a manual export step. Path B eliminates both friction points: the user stays in the app, the spreadsheet stays private, and there's no file format conversion. This is the highest-quality import experience for the majority of users who track cards in Google Sheets.

## Solution Approach

### Architecture Overview

The implementation uses a **two-token architecture** that cleanly separates concerns:

1. **Existing PKCE session token** (`id_token`) — Used for Fenrir Ledger API auth (Bearer token in `/api/sheets/import`). Obtained at sign-in with `openid email profile` scopes. No changes needed.

2. **Drive-scoped access token** — Used exclusively for Google APIs (Picker + Sheets API v4). Obtained on-demand via Google Identity Services (GIS) `requestAccessToken()` popup when the user first clicks "Browse the Archives." Stored in `localStorage` with TTL. Scopes: `drive.file` + `spreadsheets.readonly`.

### Data Flow

```
User clicks "Browse the Archives"
  → Check for Drive-scoped token in localStorage
  → If missing/expired → GIS popup requests drive.file + spreadsheets.readonly
  → Open Google Picker (SPREADSHEETS view, filtered)
  → User selects a spreadsheet → Picker returns doc.id
  → Client-side: Sheets API v4 GET /spreadsheets/{id}/values/A:ZZ (with Drive token)
  → Convert Sheets API JSON response to CSV text
  → Submit { csv: string } to /api/sheets/import (with existing id_token Bearer auth)
  → Shared pipeline: LLM extraction → preview → dedup → confirm → success
```

This reuses the existing `{ csv }` import pipeline endpoint — no new server-side routes needed.

### Why GIS popup (not redirect)?

The existing PKCE flow uses full-page redirects. Using a redirect for incremental consent would close the Import Wizard modal and require the user to navigate back. The GIS `requestAccessToken()` opens a popup, keeping the user in the modal with zero context loss.

## Relevant Files

### Existing Files to Modify

- `development/frontend/src/components/sheets/MethodSelection.tsx` — Enable Path B card for authenticated users (currently `disabled: true`). Show "Sign in to browse your Google Drive" for anonymous users instead of "Coming soon."
- `development/frontend/src/components/sheets/ImportWizard.tsx` — Add `picker` step handling, wire PickerStep component, handle picker → loading → preview flow.
- `development/frontend/src/hooks/useSheetImport.ts` — Add `"picker"` to `ImportStep` type. Add `submitCsvFromPicker(csv: string)` or reuse `submitCsv()` for the picker path.
- `development/frontend/.env.example` — Add `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`.
- `development/frontend/src/lib/types.ts` — Add optional `driveAccessToken` and `driveTokenExpiresAt` to `FenrirSession` (or use separate storage key).

### New Files to Create

- `development/frontend/src/lib/google/picker.ts` — Google Picker API loader and wrapper. Loads `https://apis.google.com/js/api.js`, initializes Picker with SPREADSHEETS view, handles selection callback.
- `development/frontend/src/lib/google/sheets-api.ts` — Thin client for Google Sheets API v4. Fetches sheet values and converts to CSV text.
- `development/frontend/src/lib/google/gis.ts` — Google Identity Services token client. Handles `requestAccessToken()` for incremental consent. Manages the Drive-scoped token lifecycle.
- `development/frontend/src/hooks/useDriveToken.ts` — Hook that manages the Drive-scoped access token. Checks localStorage, validates expiry, triggers GIS consent if needed, returns `{ driveToken, requestDriveAccess, hasDriveAccess, isRequesting }`.
- `development/frontend/src/components/sheets/PickerStep.tsx` — Step 2B UI component. Shows consent prompt (if needed), loads Picker, handles selection, fetches sheet content, transitions to loading step.

### Reference Files (read-only context)

- `designs/product/backlog/import-workflow-v2.md` — Product brief, Story 6.5 acceptance criteria
- `designs/ux-design/interactions/import-workflow-v2.md` — Step 2B interaction spec, states, edge cases
- `development/frontend/src/lib/auth/pkce.ts` — Existing PKCE utilities (for reference, not modification)
- `development/frontend/src/contexts/AuthContext.tsx` — Auth state (read `status` to gate Path B)
- `development/frontend/src/components/shared/AuthGate.tsx` — Auth conditional rendering pattern
- `development/frontend/src/lib/sheets/csv-import-pipeline.ts` — CSV pipeline (reused by Path B)
- `development/frontend/src/lib/sheets/extract-cards.ts` — Shared LLM extraction
- `development/frontend/src/app/sign-in/page.tsx` — Current OAuth redirect flow (for reference)
- `development/frontend/src/app/auth/callback/page.tsx` — Current token exchange callback

## Implementation Phases

### Phase 1: Foundation — Google API Utilities

Build the Google API integration layer: GIS token client, Picker wrapper, Sheets API client, and the Drive token hook. These are all self-contained utilities with no UI changes.

### Phase 2: Core UI — PickerStep Component + Wizard Integration

Build the PickerStep component, enable the Path B card in MethodSelection, wire it into ImportWizard, and add the `picker` step to `useSheetImport`. This phase delivers the end-to-end flow.

### Phase 3: Polish + QA Validation

Edge case handling (token refresh, Picker load failure, consent decline), mobile testing, accessibility audit, and full QA validation by Loki.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to to the building, validating, testing, deploying, and other tasks.
  - This is critical. You're job is to act as a high level director of the team, not a builder.
  - You're role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate this by using the Task* Tools to manage coordination between the team members.
  - Communication is paramount. You'll use the Task* Tools to communicate with the team members and ensure they're on track to complete the plan.
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

Note: Product (Freya) and UX (Luna) work is already complete — Story 6.5 product brief and Step 2B interaction spec exist. This plan is implementation-only.

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. GCP Configuration + Environment Setup
- **Task ID**: gcp-env-setup
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (can run alongside task 2)
- Add `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` to `development/frontend/.env.example` with setup instructions
- Document in the plan notes what GCP Console steps are required (these are manual human steps):
  1. Enable Google Picker API in GCP Console
  2. Enable Google Sheets API v4 in GCP Console
  3. Create a browser API key restricted to the app's domains
  4. Add `drive.file` and `spreadsheets.readonly` to the OAuth consent screen scopes
- The builder should add the env var template and guard code — the actual key is configured by the human operator
- **Acceptance Criteria**:
  - `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` in `.env.example` with clear setup instructions
  - Code that reads the key guards against undefined with a helpful error message
  - Build passes, TypeScript passes

### 2. Google API Utilities — GIS, Picker, Sheets
- **Task ID**: google-api-utils
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (can run alongside task 1)
- Create `development/frontend/src/lib/google/gis.ts`:
  - Load Google Identity Services script (`https://accounts.google.com/gsi/client`) dynamically
  - `initTokenClient(clientId, scopes)` — initializes `google.accounts.oauth2.initTokenClient()`
  - `requestAccessToken()` — returns a Promise that resolves with the access token from the GIS popup
  - Scopes to request: `https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets.readonly`
  - Handle user declining consent (popup closed, error_type=access_denied)
  - Add proper TypeScript declarations for the `google.accounts.oauth2` API (declare module or ambient types)
- Create `development/frontend/src/lib/google/picker.ts`:
  - Load Google API client library (`https://apis.google.com/js/api.js`) dynamically
  - `loadPickerApi()` — loads `google.picker` via `gapi.load('picker', callback)`
  - `openPicker({ accessToken, apiKey, callback })` — creates and renders a Picker:
    - View: `google.picker.ViewId.SPREADSHEETS` (Sheets only)
    - Feature: `google.picker.Feature.NAV_HIDDEN` (simplified nav)
    - Set OAuth token and developer key
    - Callback receives `{ action, docs }` — extract `doc[0].id` on `PICKED` action
  - Add proper TypeScript declarations for the Google Picker API
- Create `development/frontend/src/lib/google/sheets-api.ts`:
  - `fetchSheetAsCSV(sheetId, accessToken)` — fetches sheet content via Sheets API v4:
    - `GET https://sheets.googleapis.com/v4/spreadsheets/{sheetId}/values/A:ZZ?majorDimension=ROWS`
    - Authorization: `Bearer {accessToken}`
    - Convert the `{ values: string[][] }` response to CSV text (join cells with commas, rows with newlines, escape cells containing commas/newlines/quotes)
  - Handle errors: 401 (token expired), 403 (no access), 404 (sheet not found), network errors
  - Return `{ csv: string }` or throw a typed error
- Branch: `feat/google-picker-utils`
- **Acceptance Criteria**:
  - All three files compile with strict TypeScript
  - GIS script loads dynamically (no global `<script>` tags in HTML)
  - Picker API loads dynamically
  - `fetchSheetAsCSV` correctly converts Sheets API response to valid CSV text
  - Proper error types for all failure modes
  - Build passes, TypeScript passes

### 3. Drive Token Hook
- **Task ID**: drive-token-hook
- **Depends On**: google-api-utils
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Create `development/frontend/src/hooks/useDriveToken.ts`:
  - Manages a Drive-scoped access token separately from the main Fenrir session
  - localStorage key: `"fenrir:drive-token"` — stores `{ access_token: string, expires_at: number }`
  - `hasDriveAccess: boolean` — true if a non-expired Drive token exists
  - `driveToken: string | null` — the current valid Drive access token
  - `isRequesting: boolean` — true while the GIS popup is open
  - `requestDriveAccess(): Promise<string | null>` — triggers the GIS consent popup, stores the token, returns it (or null if declined)
  - Token expiry: Google access tokens live ~3600s. Check `expires_at > Date.now()` before using. If expired, clear and re-request.
  - Clear Drive token on sign-out (listen to auth status changes)
- **Acceptance Criteria**:
  - Hook correctly manages Drive token lifecycle (store, retrieve, expire, clear)
  - Returns `null` gracefully when user declines consent
  - Token is cleared when user signs out
  - TypeScript strict passes
  - Build passes

### 4. PickerStep Component
- **Task ID**: picker-step-component
- **Depends On**: drive-token-hook
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Create `development/frontend/src/components/sheets/PickerStep.tsx`:
  - Three internal states: `consent`, `picker`, `fetching`
  - **Consent state** (when `!hasDriveAccess`):
    - Compact safety banner (Variant 2) at top
    - Heading: "Grant Archive Access"
    - Explanation: "To browse your Google Drive, Fenrir Ledger needs read access to the spreadsheets you select. We never access your entire Drive — only the files you choose."
    - "Allow Access" button (primary, 44x44px min) — calls `requestDriveAccess()`
    - "No thanks" button (outline) — calls `onBack()` with a toast/message: "You can still import using a share URL or CSV file."
    - If consent fails: show error message with retry
  - **Picker state** (when `hasDriveAccess` and picker not yet selected):
    - Compact safety banner (Variant 2) at top
    - Load and render the Google Picker inline
    - The Picker renders as an iframe — position it within the modal content area
    - "Back" link returns to method selection
    - Handle Picker cancel: return to method selection
  - **Fetching state** (after sheet selected):
    - Show spinner: "Fetching the sacred scrolls from your archives..."
    - Call `fetchSheetAsCSV(sheetId, driveToken)`
    - On success: call `onSubmitCsv(csvText)` which enters the shared pipeline
    - On error: show error with retry option (re-open Picker) or back to method selection
  - Follow interaction spec Step 2B states and edge cases from `designs/ux-design/interactions/import-workflow-v2.md`
  - Mobile: Picker iframe should be responsive within the `w-[92vw] max-w-[680px]` modal
  - Accessibility:
    - Consent prompt is keyboard-navigable, focus-trapped within modal
    - "Allow" and "No thanks" buttons are at least 44x44px
    - On Picker close/selection, focus returns to the modal
    - `aria-live="polite"` for state transitions
  - Supports `prefers-reduced-motion` for any transition animations
- Branch: `feat/google-picker-step`
- **Acceptance Criteria**:
  - Consent prompt shows when no Drive token exists
  - GIS popup opens on "Allow Access" click
  - Picker opens after consent, filtered to Google Sheets only
  - Sheet selection triggers Sheets API fetch
  - CSV text is passed to the shared import pipeline
  - Back navigation works from all states
  - Consent decline returns to method selection with a helpful message
  - Token expiry is handled (re-request if expired)
  - All touch targets >= 44x44px
  - Keyboard accessible
  - Build passes, TypeScript passes

### 5. Wire Path B into ImportWizard + Enable Method Card
- **Task ID**: wire-wizard-enable-card
- **Depends On**: picker-step-component
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Modify `development/frontend/src/components/sheets/MethodSelection.tsx`:
  - Change Path B card `disabled` from `true` to dynamic: disabled when `authStatus !== "authenticated"`
  - When disabled (anonymous): `disabledLabel` = "Sign in to browse your Google Drive"
  - When enabled (authenticated): remove `disabledLabel`, card is fully interactive
  - Import `useAuth` hook (or receive `isAuthenticated` as prop) to check auth state
  - Keep the existing keyboard navigation — Path B becomes a valid arrow-key target when enabled
- Modify `development/frontend/src/components/sheets/ImportWizard.tsx`:
  - Import `PickerStep` component
  - Add `"picker"` step rendering (between `method` and `loading`)
  - In `handleSelectMethod()`: when `method === "picker"`, set `setStep("picker")` and `setImportMethod("picker")`
  - Wire `PickerStep` props:
    - `onSubmitCsv`: calls `submitCsv(csv)` from `useSheetImport` (reuses existing CSV path)
    - `onBack`: calls `handleBackToMethod()`
  - Update the loading step Norse text for picker: "Fetching the sacred scrolls from your archives..."
  - Update `aria-live` region: add `{step === "picker" && "Step 2: Browsing Google Drive"}`
  - Update `getStepIndex()`: add `case "picker": return 1;`
- Modify `development/frontend/src/hooks/useSheetImport.ts`:
  - Add `"picker"` to the `ImportStep` union type
  - No other changes needed — the `submitCsv()` method is already compatible with Path B's output
- Branch: `feat/google-picker-integration`
- **Acceptance Criteria**:
  - Path B card is enabled for authenticated users, disabled for anonymous users
  - Clicking Path B card navigates to the picker step
  - The full flow works end-to-end: method selection → consent → picker → fetching → loading → preview → dedup → confirm → success
  - Back navigation from picker step returns to method selection
  - Anonymous users see "Sign in to browse your Google Drive" on the Path B card
  - Loading step shows appropriate Norse text for picker import
  - Step indicator shows correct progress
  - Existing Path A and Path C flows are not regressed
  - All three paths converge on the same preview/dedup/success flow
  - Build passes, TypeScript passes

### 6. Edge Cases + Polish
- **Task ID**: edge-cases-polish
- **Depends On**: wire-wizard-enable-card
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Handle all edge cases from the interaction spec:
  - **Token expiry during Picker browse**: Check token before opening Picker. If expired, silently re-request via GIS. If re-request fails, show re-authentication prompt.
  - **Google Picker fails to load**: Show error within Step 2B: "Unable to load Google Drive. Try using Share a Scroll or Upload CSV instead." with links to Path A / Path C.
  - **GIS script fails to load**: Show error with retry option.
  - **Sheets API fetch fails** (401/403/404/network):
    - 401: Token expired during fetch → re-request token and retry once
    - 403: "You don't have access to this spreadsheet" → suggest checking sharing settings
    - 404: "Spreadsheet not found" → suggest trying again
    - Network error: "Couldn't reach Google. Check your connection."
  - **User opens wizard while offline**: Path B should fail gracefully at the consent/picker stage, not crash.
  - **Picker cancel** (user closes Picker without selecting): Return to method selection, no error state.
  - **Empty spreadsheet selected**: The existing LLM pipeline handles this — returns `NO_CARDS_FOUND`.
  - **Consent decline**: Return to method selection with message: "Google Drive access was not granted. You can still import using a share URL or CSV file."
  - **API key not configured** (`NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` missing): Path B card is disabled with label "Configuration required" (dev-only concern, not user-facing in production)
- Add `prefers-reduced-motion` support for any animations in PickerStep
- Ensure Picker iframe responsive sizing at 375px width
- Branch: `feat/google-picker-edge-cases`
- **Acceptance Criteria**:
  - All edge cases from the interaction spec are handled gracefully
  - No uncaught errors in any failure scenario
  - Error messages are Norse-themed and helpful
  - Token refresh happens silently when possible
  - Mobile layout works at 375px
  - Build passes, TypeScript passes

### 7. QA Validation
- **Task ID**: validate-all
- **Depends On**: edge-cases-polish
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Full QA validation of the Google Picker import path (Path B)
- Code review all PRs against acceptance criteria from Story 6.5 in the product brief
- Build validation: `cd development/frontend && npm run build`
- TypeScript validation: `cd development/frontend && npx tsc --noEmit`
- Lint validation: `cd development/frontend && npx next lint`
- **Functional validation**:
  - Path B card enabled for authenticated users
  - Path B card disabled with correct message for anonymous users
  - Consent prompt appears when no Drive token exists
  - GIS popup opens and returns an access token
  - Google Picker opens filtered to Sheets only
  - Sheet selection triggers Sheets API fetch
  - CSV text enters the shared LLM extraction pipeline
  - Preview, dedup, and success steps work identically to Path A and C
  - Back navigation works from all states (consent, picker, fetching)
  - Consent decline shows helpful message and returns to method selection
  - Path A and Path C are NOT regressed (full regression test)
- **Accessibility validation**:
  - Keyboard navigation: Tab/Arrow through method cards, Enter to select Path B
  - All buttons >= 44x44px touch targets
  - `aria-live` announces step transitions
  - Focus management: focus returns to modal after Picker close
  - `prefers-reduced-motion` respected
- **Edge case validation**:
  - Missing API key → Path B disabled with appropriate message
  - Expired token → re-request handled
  - Picker cancel → returns to method selection
  - Sheets API errors → helpful error messages shown
- **Mobile validation** (375px width):
  - Method cards stack vertically
  - Picker step fits within modal
  - All touch targets accessible
- Report: SHIP / FIX REQUIRED with specific issues

## Acceptance Criteria

### Path B: Google Drive Picker (from Story 6.5)
- [ ] "Browse the Archives" card is enabled for authenticated users
- [ ] "Browse the Archives" card is disabled for anonymous users with message: "Sign in to browse your Google Drive"
- [ ] Clicking the card opens the PickerStep within the modal
- [ ] Incremental consent: Drive scopes (`drive.file`, `spreadsheets.readonly`) are requested only when Path B is first used, not at sign-in
- [ ] GIS consent popup opens and the user can grant or decline access
- [ ] If the user declines, they return to method selection with a helpful message suggesting Path A or C
- [ ] Google Picker overlay opens within the modal, filtered to Sheets only
- [ ] Selecting a sheet fetches its content via Google Sheets API v4 using the Drive access token
- [ ] The fetched CSV text enters the same LLM extraction pipeline as Path A and C
- [ ] Preview, dedup, and success steps are identical to other paths
- [ ] Token expiry is handled gracefully — refresh before opening Picker if needed
- [ ] Picker cancel returns to method selection (no error state)
- [ ] Back navigation from all PickerStep states returns to method selection

### Non-Regression
- [ ] Path A (Share URL) continues to work as before
- [ ] Path C (CSV Upload) continues to work as before
- [ ] Anonymous users can still use Path A and Path C
- [ ] No changes to the existing PKCE sign-in flow
- [ ] No changes to the `/api/sheets/import` route

### General
- [ ] Modal sizing: `w-[92vw] max-w-[680px] max-h-[90vh]` preserved
- [ ] Touch targets >= 44x44px on all buttons
- [ ] `prefers-reduced-motion` respected
- [ ] Keyboard navigation works for Path B selection and consent prompt
- [ ] TypeScript clean: `npx tsc --noEmit` passes
- [ ] Build clean: `npm run build` passes
- [ ] Lint clean: `npx next lint` passes

## Validation Commands

Execute these commands to validate the task is complete:

- `cd development/frontend && npx tsc --noEmit` — Type-check the codebase
- `cd development/frontend && npx next lint` — Lint the codebase
- `cd development/frontend && npm run build` — Verify the build succeeds

## Notes

### GCP Console Setup (Manual Steps — Not Automated)

Before Path B can function, a human operator must complete these steps in the Google Cloud Console:

1. **Enable Google Picker API**: APIs & Services → Library → search "Google Picker API" → Enable
2. **Enable Google Sheets API v4**: APIs & Services → Library → search "Google Sheets API" → Enable
3. **Create a Browser API Key**:
   - APIs & Services → Credentials → Create Credentials → API Key
   - Restrict to: HTTP referrers (websites)
   - Add: `http://localhost:9653/*`, `https://fenrir-ledger.vercel.app/*`
   - Restrict to APIs: Google Picker API
   - Copy the key to `.env.local` as `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`
4. **Update OAuth Consent Screen**:
   - OAuth consent screen → Edit → Scopes → Add: `drive.file`, `spreadsheets.readonly`
   - If not already verified: submit for Google verification (1-3 week process)
5. **Vercel Environment Variables**: Add `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` to Vercel project settings

### Google OAuth Consent Screen Verification

Adding `drive.file` scope moves the app from "basic" to "sensitive" verification tier. This requires:
- A published privacy policy URL
- A demo video showing the app's use of Drive data
- Review by Google (timeline: 1-3 weeks)

**Mitigation**: The implementation can be built and tested locally without verification (using test users in GCP Console). Verification is only needed before production rollout to all users.

### Two-Token Architecture Rationale

The Drive-scoped access token is stored separately from the main Fenrir session (`fenrir:auth`) because:
1. Different scopes: The session token has `openid email profile`; the Drive token has `drive.file spreadsheets.readonly`
2. Different lifetimes: Session expiry is managed by PKCE flow; Drive token is managed by GIS
3. Different usage: Session token is for Fenrir API auth; Drive token is for Google APIs only
4. Clean separation: Sign-out clears both; revoking Drive access doesn't affect sign-in

### Script Loading Strategy

All Google scripts are loaded dynamically on-demand (not in `<head>`):
- `https://accounts.google.com/gsi/client` — loaded when PickerStep mounts (for GIS token client)
- `https://apis.google.com/js/api.js` — loaded when Picker needs to open

This avoids the performance penalty of loading Google scripts on every page load. Scripts are cached by the browser after first load.

### CSV Conversion from Sheets API

The Sheets API v4 returns data as `{ values: string[][] }`. To convert to CSV:
- Each row is an array of cell values
- Cells containing commas, newlines, or quotes are wrapped in double quotes
- Internal quotes are escaped by doubling them
- Rows are joined with `\n`

This produces valid RFC 4180 CSV that the existing LLM pipeline can process.

### No New npm Dependencies

All work uses browser-native APIs and dynamically loaded Google scripts. No new npm packages needed.

### Existing Import Pipeline Reuse

Path B produces CSV text identical to what Path C uploads. The `submitCsv(csv)` method in `useSheetImport` sends `{ csv: string }` to `/api/sheets/import`, which calls `importFromCsv()` → `extractCardsFromCsv()` → LLM → cards. Zero server-side changes needed.
