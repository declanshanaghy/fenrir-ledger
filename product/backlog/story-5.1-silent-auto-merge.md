# Story 5.1: Silent Auto-Merge on Google Sign-In

- **As a**: Credit card churner and rewards optimizer
- **I want**: My locally-tracked cards to automatically merge into my Google account whenever I sign in — whether for the first time or returning after using the app offline
- **So that**: I never lose card data and never have to make a decision about whether to import or start fresh; the app always does the right thing
- **Priority**: P1-Critical
- **Sprint Target**: 5
- **Status**: Ready

---

## Context / Problem

The current migration prompt (wireframe `ux/wireframes/auth/migration-prompt.html`) presents two choices after Google OAuth completes: "Import N cards" or "Start fresh." This two-choice dialog was designed to give users control, but it creates a friction point and a footgun — a user who accidentally taps "Start fresh" loses the connection between their local data and their cloud account.

The product direction for Sprint 5 is: **always merge, never ask.** The merge is the only correct behavior in both scenarios:

**Scenario A — First sign-in (new Google household):** The user has been using the app anonymously. They now sign in with Google. Their anonymous localStorage cards must be merged into the new Google-scoped household automatically. No dialog. No choice.

**Scenario B — Returning sign-in (existing Google household has cards, AND localStorage also has cards):** The user has signed in before. They signed out or used a different device, and new cards were added to localStorage under the anonymous householdId. When they sign back in, those localStorage cards must be merged into the existing Google household — again, automatically.

Both scenarios use the same merge function. The trigger differs (new vs. existing household), but the merge logic is identical.

---

## Desired Outcome

After this ships:

1. User completes Google OAuth (first time or returning).
2. App silently checks: does `fenrir:household` in localStorage contain cards not already in the Google household?
3. If yes: merge all non-duplicate cards into the Google household automatically. No dialog. No user decision required.
4. If no: proceed directly to the signed-in dashboard. No change in behavior.
5. A brief non-blocking toast confirms the merge ("N cards carried into your ledger.") — informational only, not a decision gate.
6. The anonymous `fenrir:household` key is cleared completely after a successful merge to prevent re-merging the same cards on next sign-in.

---

## Interactions and User Flow

```
OAuth callback received
        │
        ▼
Establish FenrirSession (existing behavior)
        │
        ▼
Does fenrir:household exist with card count > 0?
        │
    NO  │                       │ YES
        │                       ▼
        │           Load anonymous cards (getAllCards(anonHouseholdId))
        │                       │
        │                       ▼
        │           Load Google household cards (getAllCards(googleSub))
        │                       │
        │                       ▼
        │           Deduplicate: filter anonymous cards not already present
        │           in Google household (match on card ID first; if new ID,
        │           treat as a new card to import)
        │                       │
        │           merged cards > 0?
        │               │             │
        │           YES │             │ NO (all were duplicates or list was empty)
        │               ▼             │
        │       Bulk-save merged      │
        │       cards under           │
        │       Google householdId    │
        │               │             │
        │               ▼             │
        │       Show toast:           │
        │       "N cards carried      │
        │       into your ledger."    │
        │               │             │
        │               ▼             ▼
        │       Clear fenrir:household completely (remove key)
        │               │
        └───────────────┤
                        ▼
               Dashboard (signed-in state)
               Avatar transition fires
```

---

## Deduplication Rules

When merging anonymous cards into the Google household, the following rules apply:

1. **Same card ID**: If a card in the anonymous household shares a UUID with a card already in the Google household, the Google household version wins. The anonymous version is dropped — not merged, not overwritten. This prevents accidental data overwrites.
2. **Different card ID**: The anonymous card is treated as a new card and copied into the Google household with its `householdId` updated to the Google `sub`.
3. **Deleted anonymous cards**: Cards with `deletedAt` set in the anonymous household are not imported. Soft-deleted cards stay soft-deleted in their source household and do not cross over.
4. **Closed anonymous cards**: Closed cards (`status === "closed"`, `closedAt` set) ARE imported. They belong in Valhalla under the signed-in household.

---

## Behavior Change: Removing the Migration Dialog

The existing migration prompt dialog (`MigrationPrompt` component, if it exists) must be removed or disabled. The "Start fresh" path is eliminated by product decision. There is no migration dialog in Sprint 5 onward.

**Impact on Luna's wireframe**: The `ux/wireframes/auth/migration-prompt.html` file documents the old two-choice dialog. Luna will need to produce a new wireframe for the auto-merge toast/confirmation surface. The old wireframe is not deleted — it is superseded.

---

## Acceptance Criteria

- [ ] When a user completes Google OAuth and `fenrir:household` contains ≥ 1 non-deleted card not in the Google household, all such cards are automatically merged into the Google household without presenting any dialog or choice to the user
- [ ] Cards with `deletedAt` set in the anonymous household are NOT imported into the Google household
- [ ] Cards with `status === "closed"` in the anonymous household ARE imported into the Google household
- [ ] If a card in the anonymous household shares an ID with a card already in the Google household, the Google household version is preserved; the anonymous version is discarded
- [ ] Each imported card has its `householdId` field updated to the Google `sub` before being saved
- [ ] After a successful merge, a non-blocking toast displays: "N card(s) carried into your ledger." where N is the count of merged cards
- [ ] If no mergeable cards are found (anonymous household is empty or all cards already exist in Google household), no toast is shown and the user proceeds directly to the signed-in dashboard
- [ ] After merge, the anonymous `fenrir:household` localStorage key is removed completely so the same cards are not re-imported on the next sign-in
- [ ] The migration is idempotent: signing out and signing back in does not re-import already-merged cards
- [ ] If the merge operation fails (e.g., localStorage write error), the sign-in still completes and an error toast is shown; cards are not lost from the anonymous household
- [ ] The signed-in dashboard renders correctly after a merge with the full portfolio visible
- [ ] `npm run build` passes with zero errors
- [ ] TypeScript strict mode: zero new type errors introduced

---

## Technical Notes for FiremanDecko

**Where to trigger the merge**: The `/auth/callback` page — confirmed as the location where `FenrirSession` is written to localStorage after the Google token exchange completes. After writing `fenrir:auth`, before redirecting to the dashboard, run the merge logic.

**Anonymous householdId source**: Read `fenrir:household` from localStorage to get the anonymous UUID. This is the source household for the merge.

**Google householdId source**: `FenrirSession.user.sub` — the immutable Google account ID used as the Google household's ID.

**Deduplication key**: `Card.id` (UUID). Use a `Set<string>` of existing Google household card IDs to do an O(n) membership check.

**householdId rewrite**: Each imported card must have `householdId` set to the Google `sub` before `saveCard()` is called. Do not write the anonymous card to the Google namespace without this field update.

**Clearing anonymous storage**: After a successful merge, remove the `fenrir:household` key from localStorage completely (`localStorage.removeItem("fenrir:household")`). Do not use a tombstone — a clean removal is the correct behavior. Since all anonymous data has UUID primary keys and is bulk-copied into the Google household, there is no risk of re-merge: the anonymous household is simply empty after sign-in. The merge is idempotent because re-running it on an empty anonymous household is a no-op.

**Merge utility module**: Implement all merge logic in a standalone utility module in the storage layer — e.g. `development/src/src/lib/merge-anonymous.ts`. This module must be the single source of truth for merging anonymous data into a signed-in household. Exporting it as a discrete module makes it testable and ensures future data types (not just cards) can be merged by adding to this one file. The `/auth/callback` page imports and calls this module — it does not inline the merge logic.

**Toast pattern**: Reuse the existing toast infrastructure (Sprint 4.2 milestone toasts established the pattern). This toast is informational, auto-dismisses, does not require user action.

**Bulk save strategy**: Do not call `saveCard()` in a loop — each call dispatches `fenrir:sync`. Instead, load all Google household cards, append the merged cards, and call `setAllCards()` once. Then dispatch `fenrir:sync` once.

**Race condition guard**: If the user somehow triggers the OAuth callback while the dashboard is open in another tab and already writing to the Google household, the merge operation should load the freshest state from localStorage immediately before writing, not from a cached copy loaded at callback init.

---

## Open Questions for FiremanDecko

1. ~~**OAuth callback location**~~ — **Resolved**: The merge fires in the `/auth/callback` page, which is the confirmed location where `FenrirSession` is written to localStorage after the Google OIDC token exchange.

2. **Toast infrastructure**: Sprint 4.2 introduced milestone toasts. Is there a reusable `showToast()` utility or does this story need to integrate with a toast library (e.g. sonner, react-hot-toast)? The merge toast must use the same system.

3. **Anonymous householdId stability**: If the user clears their browser between sign-ins, `fenrir:household` will be a new UUID on re-visit (no anonymous cards). Confirm the merge logic handles this gracefully — a fresh anonymous household with zero cards should result in a no-op, not an error.

---

## Mythology Frame

The wolf does not scatter its prey across two lairs. What the wolf has hunted belongs to the wolf's hall — always. Signing in is not abandonment; it is homecoming. The chains are carried with you.

*"Before you named yourself, the wolf's chains were already counted here."* — migration prompt copy, repurposed as toast footnote if desired.

---

## UX Notes

Luna to produce:
1. Updated `ux/wireframes/auth/migration-prompt.html` (or a new `auto-merge-toast.html`) showing the auto-merge toast surface — positioning, copy, timing, dismiss behavior.
2. The old two-choice dialog wireframe is now superseded. Luna should annotate or archive it.

Toast copy direction (Voice 1 with atmospheric tail):
- Main: "N card(s) carried into your ledger."
- Optional sub-line (Voice 2, smaller): *"The pack is whole."*
- No action required. Auto-dismiss at 4 seconds.
