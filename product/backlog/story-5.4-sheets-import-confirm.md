# Story 5.4: Google Sheets Import — Deduplication and Persistence

- **As a**: Credit card churner and rewards optimizer
- **I want**: Cards imported from Google Sheets to be safely merged into my existing ledger without creating duplicates
- **So that**: I can import confidently even if I have already manually added some of my cards, knowing the app will not create duplicate entries
- **Priority**: P2-High
- **Sprint Target**: 5
- **Status**: Done

---

## Context / Problem

Story 5.3 builds the wizard UI through to the "Import N cards" confirmation button. This story covers what happens when the user taps that button: deduplication against the existing household portfolio, the actual persistence of new cards, and the post-import feedback.

Deduplication is non-trivial for this feature. Because the Anthropic API assigns new UUIDs to every imported card (they have no `id` in the source sheet), ID-based deduplication (used in Story 5.1's sign-in merge) does not apply here. Instead, deduplication must be based on **content similarity**: same issuer + same card name is treated as a potential duplicate, and the user is informed rather than silently skipped.

This story also owns the `householdId` assignment: imported cards must be scoped to the current user's household (Google `sub` if signed in, anonymous `householdId` if not).

---

## Desired Outcome

After this ships, when a user confirms an import:

1. Each imported card is checked against the current household's existing cards for potential duplicates.
2. Cards that are likely duplicates (same `issuerId` + same `cardName`, case-insensitive) are flagged — not silently dropped.
3. The user is shown a clear summary: "X new cards will be added. Y cards look like duplicates — skip them?"
4. The user can choose to skip duplicates or import everything (including duplicates).
5. Confirmed cards are saved to localStorage under the current household.
6. The dashboard refreshes and the new cards are immediately visible.
7. A success toast fires: "N card(s) added to your ledger."

---

## Deduplication Rules

### Primary match (skip by default)

If an imported card has **the same `issuerId` AND the same `cardName`** (case-insensitive, trimmed) as any existing non-deleted card in the household, it is considered a likely duplicate and is excluded from the default import set.

Examples:
- Existing: `issuerId: "chase"`, `cardName: "Sapphire Preferred"` → skip imported "Chase Sapphire Preferred"
- Existing: `issuerId: "amex"`, `cardName: "Platinum Card"` → skip imported "Amex Platinum"

### Fuzzy edge cases (import by default, annotate)

If the issuer matches but the card name is different (likely a different product from the same issuer), import it without flagging. The user's sheet may contain multiple Chase cards.

### User override

The duplicate summary screen (Step 3B in the wizard, inserted between Step 3 and Step 5) must let the user choose to import duplicates anyway. This handles cases where the user legitimately has the same card twice (e.g., a personal and a business version).

---

## Wizard Step 3B — Duplicate Summary

This step is only shown if ≥ 1 likely duplicate is found. If no duplicates, skip directly from Step 3 to the import action (no additional step).

**Heading (Voice 2)**: *"Some chains are already forged."*
**Sub-heading (Voice 1)**: "We found {Y} card(s) that look like ones you already have."

UI elements:
- A list of flagged duplicates: issuer + card name, paired with the existing card it matched.
- Two choices:
  - "Skip {Y} duplicate(s) and import {X} new cards" — primary action (recommended)
  - "Import all {N} cards anyway" — secondary action (for users who want duplicates)
- "Cancel" (close wizard without importing anything)

If the user chooses "Skip duplicates": only the X non-duplicate cards are imported.
If the user chooses "Import all": all N cards are imported regardless of duplicates.

---

## householdId Assignment

Every imported card must have its `householdId` set to the **current user's active household ID** before being saved. The current household ID is determined as follows:

- If signed in: `FenrirSession.user.sub` (Google sub claim, from `fenrir:auth` in localStorage)
- If anonymous: the UUID from `fenrir:household` in localStorage

The wizard must read the active `householdId` at the time the user confirms the import — not at the time the URL was submitted. This ensures correctness if the user somehow signs in between the URL submission and the import confirmation (unlikely but defensive).

---

## Post-Import State

After cards are saved:

1. The import wizard closes (Step 5 success flash, then modal closes).
2. The dashboard card grid re-renders with the new cards visible.
3. A non-blocking toast fires: "N card(s) added to your ledger." (4-second auto-dismiss)
4. If skipped duplicates > 0, the toast includes a secondary line: "Y duplicate(s) were skipped."
5. The new cards enter the normal card lifecycle: `computeCardStatus()` is called on each before save, so their status badges are immediately correct.

---

## Acceptance Criteria

- [ ] When the user confirms an import, each imported card is checked against the current household for `issuerId` + `cardName` duplicates (case-insensitive)
- [ ] If ≥ 1 duplicate is found, Step 3B (duplicate summary) is shown before any cards are saved
- [ ] The duplicate summary accurately lists each flagged card and the existing card it matched
- [ ] "Skip duplicates and import new cards" imports only the non-duplicate cards
- [ ] "Import all cards anyway" imports all cards regardless of duplicate flags
- [ ] All imported cards have `householdId` set to the current active household ID at the time of confirmation
- [ ] All imported cards have `status` computed via `computeCardStatus()` before saving
- [ ] All imported cards have valid `createdAt` and `updatedAt` timestamps set to the import time
- [ ] After confirmation, the dashboard card grid reflects all newly imported cards without requiring a page refresh
- [ ] After confirmation, a success toast fires: "N card(s) added to your ledger."
- [ ] If duplicates were skipped, the toast includes: "Y duplicate(s) were skipped."
- [ ] If the import results in zero new cards (all were duplicates and the user chose to skip), the toast reads: "No new cards were imported — all matched existing entries."
- [ ] The import works correctly for both anonymous users (anonymous householdId) and signed-in users (Google sub)
- [ ] `saveCard()` is called for each imported card (or the batch equivalent per the technical notes)
- [ ] `npm run build` passes with zero errors
- [ ] TypeScript strict mode: zero new type errors introduced

---

## Technical Notes for FiremanDecko

**Deduplication function**: Write a pure function `findDuplicates(imported: Card[], existing: Card[]): { duplicates: Card[], newCards: Card[] }`. The function compares `issuerId.toLowerCase()` and `cardName.toLowerCase().trim()` across all pairs. Return both sets so the wizard UI can render the duplicate summary accurately.

**Batch save strategy**: Mirror the approach from Story 5.1 — do not call `saveCard()` in a loop. Load all existing cards once, append the new cards, call `setAllCards()` once. This dispatches `fenrir:sync` once instead of once-per-card.

**householdId resolution timing**: The wizard component should resolve the active `householdId` immediately before the save operation (not when the wizard opens). Read `fenrir:auth` for signed-in state; read `fenrir:household` for anonymous state. Use whatever auth context / hook is already established in the app.

**computeCardStatus timing**: Run `computeCardStatus(card)` on each card in the import array before the batch save, not after. Cards should enter the store with correct status already set.

**No UI for editing individual cards pre-import**: Sprint 5 does not include the ability to edit card fields in the wizard preview. If the AI got a field wrong (e.g., wrong annual fee), the user imports and then edits via the normal card edit flow. A future sprint could add inline editing to the preview — but that is out of scope here to keep the story bounded.

**Concurrency with Story 5.3**: The "Import N cards" button in Story 5.3's Step 3 should call a callback (`onConfirmImport(cards: Card[])`) that is provided by the parent component. That parent component implements the deduplication + save logic from this story. This keeps the wizard UI (5.3) decoupled from the persistence logic (5.4) and makes both easier to test.

---

## Dependencies

- **Depends on**: Story 5.3 (wizard UI supplies the cards array to be imported)
- **Depends on**: Story 5.2 (API route must be functional for end-to-end testing)
- **Blocks**: Nothing

---

## Open Questions for FiremanDecko

1. **Duplicate detection edge case — same card, different issuerId format**: The Anthropic API may return `"american_express"` for a card that the app's issuer list stores as `"amex"`. Should deduplication normalize these? Product preference: use a lookup table of known issuer aliases (e.g. `"american_express" → "amex"`) when comparing. FiremanDecko to propose the normalization table.

2. **What happens to the duplicate check if the existing household has zero cards?** Deduplication should short-circuit to "no duplicates" in that case — no comparison needed. Confirm this is handled in the function.

---

## Mythology Frame

The Norns do not weave the same thread twice. When a chain already binds, the new strand finds another link — it does not replace. The ledger grows; it does not repeat.
