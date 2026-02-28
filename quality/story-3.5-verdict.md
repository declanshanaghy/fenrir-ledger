# Quality Report: Story 3.5 — Valhalla Archive + Close Card Action

**QA Tester**: Loki
**Sprint**: 3
**Story**: 3.5 — Valhalla Archive + Close Card Action
**Date**: 2026-02-27
**Verdict**: **HOLD FOR FIX** (1 defect found)

---

## Executive Summary

Story 3.5 implements the Valhalla archive route (`/valhalla`) and a "Close Card" action that moves cards to a memorial hall instead of deleting them. The implementation is **functionally sound** with excellent data integrity and UI logic. However, a **single defect** has been identified in the Gleipnir Hunt easter egg layer: the wrong fragment string is embedded in the Valhalla empty state.

The defect is **low-severity** (P3) but must be fixed before ship because it directly affects the Sprint 4 easter egg hunt mechanic.

---

## Test Execution Summary

| Category | Count |
|----------|-------|
| **Test Areas Audited** | 9 |
| **Passed** | 8 |
| **Failed** | 1 |
| **Build Status** | ✓ Success |

---

## What Was Tested

### 1. Data Integrity Checks
- ✓ `closeCard()` sets both `status: "closed"` AND `closedAt` timestamp simultaneously
- ✓ `getCards()` correctly excludes closed cards from the active dashboard
- ✓ `getClosedCards()` returns ONLY closed, non-deleted cards sorted by closedAt descending
- ✓ `closeCard()` is a safe no-op on already-closed cards and deleted cards
- ✓ `saveCard()` preserves `closedAt` field on subsequent edits via spread operator
- ✓ `computeCardStatus()` correctly short-circuits on existing "closed" status

### 2. Card Type Integrity
- ✓ `closedAt` field is correctly optional (`closedAt?: string`)
- ✓ Legacy cards without `closedAt` do not break the system
- ✓ Valhalla page gracefully handles missing `closedAt` by displaying "—"
- ✓ `getClosedCards()` fallback to `updatedAt` when `closedAt` is absent

### 3. UI / Product Logic
- ✓ "Close Card" button appears ONLY on edit form (`isEditMode`), not add form
- ✓ "Close Card" button hidden when `status === "closed"` (already-closed cards show Delete only)
- ✓ Close Card action requires confirmation dialog before execution
- ✓ Deleted cards do NOT appear in Valhalla (filtered by `!c.deletedAt`)
- ✓ Dialog copy correctly states card will move to Closed Cards with record preserved

### 4. Valhalla Page Rendering
- ✓ Page uses `getClosedCards()` not `getCards()`
- ✓ Tombstone cards display: ᛏ rune, card name (uppercase), "Closed {date}" in font-mono
- ✓ Meta line shows: issuer · opened date · held duration
- ✓ Plunder grid shows: rewards summary (if present) and fee avoided
- ✓ Epitaph copy is atmospheric and contextual
- ✓ Empty state displays when `allClosed.length === 0`
- ✓ Page heading "Valhalla" in gold display font
- ✓ Subheading "Hall of the Honored Dead" in italic muted text
- ✓ Atmospheric quote "Here lie the chain-breakers. Their rewards were harvested."
- ✓ Sepia tint filter applied to page wrapper

### 5. Filters & Sorting
- ✓ Issuer filter dropdown present with "All issuers" default
- ✓ Issuer dropdown correctly built from unique issuers in closed cards
- ✓ Filter "no results" message displayed when filter matches zero cards
- ✓ Sort options: Closed date (newest/oldest), A→Z, Z→A all functional
- ✓ Default sort: "Closed date (newest)"

### 6. Navigation
- ✓ Valhalla nav item present in `SideNav` with ᛏ rune icon
- ✓ Nav item links to `/valhalla`
- ✓ Gold left border active state highlights when on `/valhalla`
- ✓ Collapsed sidebar shows ᛏ rune with native title tooltip "Valhalla"

### 7. Animations
- ✓ Tombstone cards animate in with saga-enter stagger (0.07s delay per card, capped 0.56s)
- ✓ Opacity and Y-axis transform applied
- ✓ Expo-out easing matches globals.css cubic-bezier

### 8. Regression Tests
- ✓ Dashboard continues to render active/fee_approaching/promo_expiring cards
- ✓ Loki Mode not affected (not implemented for Valhalla per spec)
- ✓ Story 3.2 (Norse copy) not affected
- ✓ Story 3.3 (Framer Motion) not affected

### 9. Build Verification
- ✓ `npm run build` completes successfully
- ✓ Zero TypeScript errors
- ✓ Zero lint errors
- ✓ `/valhalla` route present in build output
- ✓ No bundle size regressions

---

## Defects Found

### DEF-001: Wrong Gleipnir Fragment in Valhalla Empty State

**Severity**: P3 Medium
**Category**: Easter Eggs / Product Design
**Type**: Data Integrity
**Status**: Open

#### Description

The Valhalla empty state (when no cards have been closed) embeds the wrong Gleipnir Hunt fragment in its `aria-description` attribute.

#### Current Implementation

`development/src/src/app/valhalla/page.tsx` line 234:

```typescript
aria-description="the spittle of a bird"
```

#### Expected Implementation

Per the product design and mythology map, the Valhalla empty state should embed **Fragment 6: Beard of a Woman**.

From `design/easter-eggs.md` and sprint 2 handoff (lines 271-272):
- Fragment 1: Roots of a Mountain (GleipnirMountainRoots.tsx)
- Fragment 2: Sound of a Cat's Footfall (GleipnirCatFootfall.tsx)
- Fragment 3: Spittle of a Bird (GleipnirBirdSpittle.tsx) ← Current (WRONG)
- Fragment 4: Sinews of a Bear (GleipnirBearSinews.tsx)
- Fragment 5: Breath of a Fish (GleipnirFishBreath.tsx)
- Fragment 6: Beard of a Woman (GleipnirWomansBeard.tsx) ← Expected (CORRECT)

#### Root Cause

The developer mistakenly used the aria-description string from Fragment 3 instead of Fragment 6. This is likely a copy-paste error during implementation.

#### Impact

1. **Immediate**: Screen reader users will encounter the wrong fragment text when the Valhalla empty state is announced.
2. **Sprint 4**: The Gleipnir Hunt detection mechanic (scheduled for Sprint 4) will be designed to hunt for all 6 fragments. When the hunt system scans the app for `aria-description="the spittle of a bird"`, it will find both:
   - GleipnirBirdSpittle.tsx (correct, Fragment 3)
   - ValhallaEmptyState (incorrect, Fragment 3 again)

   This creates a duplicate hunt target and breaks the intended 1:1 fragment-to-location mapping.

#### Steps to Reproduce

1. Open the app with zero closed cards in localStorage
2. Navigate to `/valhalla`
3. Inspect the empty state `<div>` element
4. Read the `aria-description` attribute
5. Verify it reads "the spittle of a bird" (current, wrong)

#### Fix Required

Change line 234 in `development/src/src/app/valhalla/page.tsx`:

```typescript
// Before:
aria-description="the spittle of a bird"

// After:
aria-description="the beard of a woman"
```

---

## Risk Assessment

### Overall Quality Risk: LOW (after fix)

**Strengths**:
- Data integrity is solid: no orphaned state, no data loss
- UI logic is correct: close/delete distinction is clear and properly enforced
- Navigation is properly integrated
- Animations are smooth and consistent
- Build passes with no errors
- All core functionality works as specified

**Weaknesses**:
- One defect in the easter egg layer (critical for Sprint 4)
- No prefers-reduced-motion guard (acceptable per handoff limitations)
- No real-time sync (acceptable per architecture)
- No page title metadata (deferred to Sprint 4)

### What Can Proceed Without Fix:
- All user-facing features (close card, Valhalla archive, filtering, sorting)
- Navigation and active state highlighting
- Data persistence and localStorage operations

### What Requires Fix Before Ship:
- Gleipnir Hunt fragment string (defect DEF-001)

---

## Recommendation

**HOLD FOR FIX** — Ship only after DEF-001 is corrected.

The fix is trivial (one-line string change) but must be completed before merge to avoid creating a ghost duplicate in the easter egg hunt system. After the fix is applied and verified, the story is production-ready.

---

## Test Artifacts

- **Build log**: Zero errors (verified via `npm run build`)
- **Code review**: All 8 files reviewed for data integrity, UI logic, and navigation
- **Edge case audit**: 8 scenarios tested (missing closedAt, double-close, no issuers, empty states, 100+ cards)
- **Type safety**: TypeScript strict mode, all optional fields handled correctly

---

## Sign-Off

**QA Tester**: Loki (devil's advocate)
**Test Date**: 2026-02-27
**Next Action**: Developer fixes DEF-001, Loki re-verifies, story proceeds to merge.
