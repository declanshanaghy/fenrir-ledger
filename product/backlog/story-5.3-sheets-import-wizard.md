# Story 5.3: Google Sheets Import — Import Wizard UI

- **As a**: Credit card churner and rewards optimizer
- **I want**: A step-by-step interface where I can paste my Google Sheets URL and see my cards previewed before they are imported
- **So that**: I can validate the AI-converted data looks correct before it lands in my ledger, without committing to anything blindly
- **Priority**: P1-Critical
- **Sprint Target**: 5
- **Status**: Ready

---

## Context / Problem

Story 5.2 builds the Anthropic conversion route. This story builds the user-facing wizard that drives it. The wizard must handle the full interaction arc: URL entry, loading state, preview of parsed cards, and the confirm/import action (which triggers Story 5.4's deduplication and persistence).

The wizard is a multi-step modal dialog, not a dedicated page. It appears over the dashboard when the user initiates an import. This is consistent with the app's existing modal-first UX pattern (card form, Gleipnir fragments, Ragnarök alerts all use modals).

The import entry point should be accessible from the dashboard — both the empty state (when zero cards exist, this is the primary onboarding path for Sheets users) and from a persistent "Import" action in the dashboard toolbar or card grid header.

---

## Desired Outcome

After this ships, a user with zero or more cards can:

1. Open the import wizard from the dashboard.
2. Paste a Google Sheets URL and submit.
3. See a loading state while the server fetches and converts the sheet.
4. See a preview of all parsed cards — card name, issuer, annual fee, open date — in a scannable list.
5. Review the count of cards found.
6. Confirm the import (or cancel and discard).
7. See the cards appear in their dashboard after confirmation.

---

## Entry Points

Two entry points must exist. Both open the same wizard modal.

**Entry Point A — Empty state CTA**: On the dashboard empty state ("Before Gleipnir was forged..."), add a secondary CTA below the "Add your first card" button:
- Label: "Import from Google Sheets"
- This is a secondary action — visually subordinate to the primary "Add card" button.

**Entry Point B — Dashboard toolbar**: A persistent "Import" button or icon in the dashboard header/toolbar area, visible when the card grid has ≥ 1 card. This serves returning users who want to bulk-import additional cards.
- Label: "Import cards"
- Placement: in the dashboard action area near the existing "Add card" button.
- Luna to determine exact placement in the wireframe.

---

## Wizard Steps

### Step 1 — URL Entry

**Heading (Voice 2)**: *"Read the loom."*
**Sub-heading (Voice 1)**: "Paste your Google Sheets URL to import your credit cards."

UI elements:
- Text input: full URL from the user's clipboard. Placeholder: "https://docs.google.com/spreadsheets/d/..."
- Helper text (Voice 1): "Your sheet must be set to 'Anyone with the link can view.'"
- A link-styled hint: "How to share a Google Sheet" — opens Google's help page in a new tab.
- Submit button: "Fetch my cards"
- Cancel button (or × close): "Cancel"

Validation (client-side, before submitting to the API):
- URL must be non-empty.
- URL must contain `docs.google.com/spreadsheets` — surface inline error if not: "That doesn't look like a Google Sheets URL."
- No other client-side validation — let the server decide if the sheet is public.

### Step 2 — Loading

**Heading (Voice 2)**: *"The Norns are reading the threads..."*
**Sub-heading (Voice 1)**: "Fetching your sheet and converting it — this may take a few seconds."

UI elements:
- Animated loading indicator (existing app loading pattern — not a spinner, see interactions.md for the rune-pulse pattern if available, otherwise a simple text pulse).
- No cancel button during this step — the request is in flight. If the user closes the modal (ESC or ×), show a confirmation: "Cancel the import? Your sheet will not be saved." Accept/dismiss.
- The loading step times out at 20 seconds. If the API has not responded, surface Step 4 (error state) with message: "The Norns took too long. Try again."

### Step 3 — Preview

**Heading (Voice 2)**: *"The chains are counted."*
**Sub-heading (Voice 1)**: "{N} cards found in your sheet. Review them before importing."

UI elements:
- Card count badge: "N cards found"
- A scrollable list of parsed card previews. Each preview row shows:
  - Issuer name (formatted from `issuerId`, e.g. "Chase")
  - Card name (`cardName`)
  - Annual fee (formatted as "$X" or "No annual fee" if 0)
  - Open date (formatted as "Opened [Month YYYY]")
  - A warning icon if any field has a default value applied (i.e., data was missing from the sheet)
- If `droppedCount > 0`: a warning banner below the list: "N row(s) could not be parsed and were skipped."
- If `warning: "CSV_TRUNCATED"` in the API response: a warning banner: "Your sheet was very large — only the first portion was processed."
- Primary button: "Import {N} cards" (count is dynamic)
- Secondary button: "Cancel"
- Tertiary action (text link): "Back" — returns to Step 1 to try a different URL.

### Step 4 — Error State

**Heading (Voice 2)**: *"The threads are knotted."*
**Sub-heading (Voice 1)**: "[Human-readable error message]"

Error messages by error code:
- `SHEET_NOT_PUBLIC`: "We couldn't read that sheet. Make sure it's shared as 'Anyone with the link can view.'"
- `NO_CARDS_FOUND`: "No credit card data was found in that sheet. Make sure your cards are listed with columns like name, issuer, or annual fee."
- `PARSE_ERROR`: "Something went wrong reading the response. Try again."
- `ANTHROPIC_ERROR`, `FETCH_ERROR`: "Something went wrong on our end. Try again in a moment."
- `INVALID_URL`: "That doesn't look like a Google Sheets URL. Check the link and try again."
- Timeout: "The conversion took too long. Try again."

UI elements:
- Error message
- "Try again" button — returns to Step 1 with the URL pre-filled
- "Cancel" button — closes the wizard

### Step 5 — Success

Displayed briefly (1.5s) before the modal closes and the toast fires.

**Heading (Voice 2)**: *"The pack grows."*
**Sub-heading (Voice 1)**: "{N} cards added to your ledger."

Then: modal closes, dashboard refreshes with new cards visible, toast from Story 5.4 fires.

---

## Accessibility Requirements

- The wizard is a modal dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` bound to the step heading.
- Focus is trapped inside the wizard at all steps.
- On step advance, focus moves to the new step's heading.
- The loading step announces its status to screen readers: `aria-live="polite"` region with the loading message.
- ESC dismisses the wizard at Steps 1, 3, and 4 (with confirmation at Step 2 if loading).
- All buttons meet the 44px minimum touch target.
- Error messages are announced immediately via `aria-live="assertive"`.

---

## Acceptance Criteria

- [ ] "Import from Google Sheets" CTA is visible on the dashboard empty state below the "Add your first card" button
- [ ] "Import cards" button is visible in the dashboard toolbar when ≥ 1 card exists
- [ ] Both entry points open the same import wizard modal
- [ ] Step 1 accepts a Google Sheets URL and shows an inline error if the URL does not contain `docs.google.com/spreadsheets`
- [ ] Step 2 (loading) displays while the API call is in flight
- [ ] Step 3 (preview) displays the card count and a scrollable list of parsed cards with issuer, name, annual fee, and open date
- [ ] The "Import N cards" button label is dynamic and matches the card count from the API response
- [ ] Step 4 (error) displays a human-readable error for each error code returned by the API
- [ ] Step 4 pre-fills the URL from Step 1 when the user taps "Try again"
- [ ] Step 5 (success) displays briefly before the modal closes
- [ ] If `droppedCount > 0` in the API response, a warning is shown in Step 3
- [ ] If `warning: "CSV_TRUNCATED"` in the API response, a warning is shown in Step 3
- [ ] The wizard is accessible: focus trap active, ESC dismisses, `aria-live` for loading and errors
- [ ] All buttons and touch targets are ≥ 44px
- [ ] The wizard renders correctly on mobile (375px min width) and desktop
- [ ] `npm run build` passes with zero errors
- [ ] TypeScript strict mode: zero new type errors introduced

---

## Technical Notes for FiremanDecko

**Wizard state machine**: Use a local `step` state variable (not a router navigation) with values: `"entry" | "loading" | "preview" | "error" | "success"`. All steps render inside the same dialog element — swap content based on step.

**API call**: `POST /api/sheets/import` with `{ url }` in the body. This is a standard `fetch()` from a client component. No authentication header required (per Story 5.2's decision).

**Preview list performance**: If the API returns 20+ cards, the preview list should use a fixed-height scrollable container (`max-height: 320px; overflow-y: auto`) to avoid a modal that extends beyond the viewport.

**Issuer display name**: The API returns `issuerId` in snake_case. Map to human-readable names using the existing `Issuer` list from `development/src/src/lib/` (or a simple lookup map). For any unknown `issuerId`, display it as-is with title case applied.

**Annual fee formatting**: Divide cents by 100. Show `$X` format. Use `$0` vs "No annual fee" based on `annualFee === 0`.

**Cancel during loading**: A simple `useRef` to track whether the component is still mounted is sufficient. If the user cancels, set an `aborted` ref to `true` — when the fetch resolves, check the ref before advancing to Step 3.

**Import trigger**: The "Import N cards" button in Step 3 should call a prop/callback function supplied by the parent component (not navigate or dispatch directly). This decouples the wizard from the storage logic in Story 5.4.

---

## Dependencies

- **Depends on**: Story 5.2 (API route must be implemented first for integration testing)
- **Blocks**: Story 5.4 (deduplication and persistence need the wizard's "confirm" event)

---

## UX Notes

Luna to produce a wireframe for the full wizard: `ux/wireframes/sheets-import/import-wizard.html`. The wizard must feel consistent with the app's existing modal patterns:
- Same `modal-rise` animation as all other modals
- Same `w-[92vw] max-h-[90vh]` sizing on mobile
- Void-black background, gold accents on the primary action button
- The loading state rune-pulse or equivalent from `interactions.md`

The step headings are Voice 2 (atmospheric) and the body copy is Voice 1 (functional). This is the Fenrir Ledger dual-register convention and must be respected in every step.
