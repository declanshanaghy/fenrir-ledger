# QA Verdict — Sprint 3, Story 3.2

**Status**: NO-SHIP — Defects Found
**Verdict Date**: 2026-02-27
**Tester**: Loki (QA)

---

## Summary

Story 3.2 (Norse Copy Pass + `getRealmLabel()`) has **three defects** in tooltip copy that diverge from the approved voice in `product/copywriting.md`. The code structure is sound — `realm-utils.ts` is well-designed, TypeScript is strict, build and lint pass without errors. However, copy accuracy is non-negotiable. The user-facing tooltip text does not match the product brief.

**Build Status**: PASS (zero errors, zero warnings)
**Lint Status**: PASS (zero errors, zero warnings)
**TypeScript**: PASS (strict mode, exhaustive switch statements)

---

## Defects Found

### DEF-001: Tooltip Copy Divergence — `fee_approaching` Status

**Severity**: MAJOR (user-facing copy mismatch)
**Component**: `realm-utils.ts`, `getRealmDescription()` function

**Expected** (from `product/copywriting.md`, Status Badges table):
```
"Muspelheim — annual fee due in N days"
```

**Actual** (from `realm-utils.ts`, line 64):
```
"Muspelheim — annual fee due soon, fire approaches"
```

**Impact**: User reads "fire approaches" instead of the approved "due in N days" pattern. The atmospheric flavor is present, but the specific copy deviates from the product design brief. This breaks consistency across the copy system.

**Steps to Reproduce**:
1. Add a card with annual fee date within 60 days
2. On the dashboard, hover over the "Fee Due Soon" badge
3. Read the tooltip text
4. Compare against `product/copywriting.md` line 91

**Root Cause**: The copywriting.md template uses a variable placeholder ("in N days") but `realm-utils.ts` uses fixed text. The intent was unclear — the brief shows a template pattern, not a fixed string.

---

### DEF-002: Tooltip Copy Divergence — `promo_expiring` Status

**Severity**: MAJOR (user-facing copy mismatch)
**Component**: `realm-utils.ts`, `getRealmDescription()` function

**Expected** (from `product/copywriting.md`, Status Badges table):
```
"Hati approaches — promo deadline in N days"
```

**Actual** (from `realm-utils.ts`, line 66):
```
"Hati approaches — promo deadline draws near"
```

**Impact**: User reads "draws near" instead of the approved "in N days" pattern. Same issue as DEF-001 — the template pattern is not honored.

**Steps to Reproduce**:
1. Add a card with sign-up bonus deadline within 30 days
2. On the dashboard, hover over the "Promo Expiring" badge
3. Read the tooltip text
4. Compare against `product/copywriting.md` line 90

**Root Cause**: Same as DEF-001.

---

### DEF-003: Tooltip Copy Divergence — `closed` Status

**Severity**: MAJOR (user-facing copy mismatch)
**Component**: `realm-utils.ts`, `getRealmDescription()` function

**Expected** (from `product/copywriting.md`, Status Badges table):
```
"In Valhalla — rewards harvested"
```

**Actual** (from `realm-utils.ts`, line 68):
```
"In Valhalla — rewards harvested, chain broken"
```

**Impact**: User reads an extended phrase ("chain broken") that is not in the approved copy. The copywriting brief says "chain broken" belongs in different contexts (empty state copy about breaking the chain), not in the closed card tooltip.

**Steps to Reproduce**:
1. Add a card and edit it to set status to "Closed"
2. On the dashboard, hover over the "Closed" badge
3. Read the tooltip text
4. Compare against `product/copywriting.md` line 92

**Root Cause**: Interpolation of lore ("chain broken") into a focused atmospheric statement. The brief compartmentalizes copy by context.

---

## Positive Findings

### Code Structure — PASS

- ✓ `realm-utils.ts` is well-designed with exhaustive switch statements (TypeScript enforces new `CardStatus` values require update)
- ✓ No default branch — compile error if a status is forgotten
- ✓ Clear documentation and mythology reference in JSDoc comments
- ✓ Proper delegation from `constants.ts` to `realm-utils.ts` — single source of truth

### Badge Labels — PASS

- ✓ Status badge primary labels remain plain English (Voice 1): "Active", "Fee Due Soon", "Promo Expiring", "Closed"
- ✓ Realm names (Asgard, Muspelheim, etc.) do NOT appear on badges — reserved for tooltips and atmospheric contexts only
- ✓ Confirmed against `copywriting.md`: "Badges are functional (Voice 1). Plain English only."

### Page Copy — PASS

- ✓ Dashboard heading: "The Ledger of Fates" — exact match
- ✓ Dashboard loading: "The Norns are weaving..." — from approved loading states
- ✓ Add card heading: "Forge a New Chain" — exact match
- ✓ Add card subheading: "Add a card to your portfolio." — exact match
- ✓ Edit card heading: `{card.cardName}` — correct dynamic pattern
- ✓ Edit card subheading: "Card record" — exact match
- ✓ Edit card loading: "Consulting the runes..." — from approved loading states
- ✓ Empty state heading: "Before Gleipnir was forged, Fenrir roamed free." — exact match
- ✓ Empty state body: "Before your first card is added, no chain can be broken." — exact match

### Mythology Mapping — PASS

- ✓ `active` → "Asgard" (mythology-map.md: "Home of gods, abundance")
- ✓ `fee_approaching` → "Muspelheim" (mythology-map.md: "Fire, destruction, heat")
- ✓ `promo_expiring` → "Jötunheimr" (mythology-map.md: "Giants, chaos, unpredictability")
- ✓ `closed` → "Valhalla" (mythology-map.md: "Hall of heroes / Realm of the dead")

### Build & Lint — PASS

```bash
$ npm run build
✓ Compiled successfully
Route (app)                              Size     First Load JS
...
✓ Generating static pages (6/6)
```

```bash
$ npm run lint
✔ No ESLint warnings or errors
```

---

## Copy Voice Verification

**Copywriting Voice System** (from `product/copywriting.md`):
- Voice 1 (Functional): buttons, labels, badges, error messages — must be plain English
- Voice 2 (Atmospheric): page headings, subheadings, empty states, tooltips, loading copy — may use Norse flavor

Story 3.2 implements both voices correctly **except** for the three tooltip divergences above.

---

## Recommendation

**HOLD FOR FIXES**

The three defects in tooltip copy must be corrected before shipping. The fixes are straightforward:

```typescript
// realm-utils.ts, getRealmDescription()

case "fee_approaching":
  // return "Muspelheim — annual fee due soon, fire approaches"; // CURRENT
  return "Muspelheim — annual fee due in N days";  // EXPECTED (needs variable expansion)

case "promo_expiring":
  // return "Hati approaches — promo deadline draws near";  // CURRENT
  return "Hati approaches — promo deadline in N days";  // EXPECTED (needs variable expansion)

case "closed":
  // return "In Valhalla — rewards harvested, chain broken";  // CURRENT
  return "In Valhalla — rewards harvested";  // EXPECTED
```

**Note**: The "in N days" pattern suggests these tooltips should be dynamic — showing the actual days remaining. If this is a future enhancement, the copy should be updated in `realm-utils.ts` to match the product brief's template, or `copywriting.md` should be updated to reflect the fixed copy choice.

---

## Risk Assessment

**High**: If shipped as-is, users will see tooltip copy that contradicts the product design brief. This breaks the approved brand voice and may confuse new users who read both the UI and the documentation.

---

## Tester Notes

FiremanDecko did excellent work on the architecture — the `realm-utils.ts` design is solid and extensible. The defects are pure copy mismatches, not structural issues. The three-line fixes will bring this story to ship-ready status.

The "Loki Mode realm badges" test case (item #8 in the QA handoff) was not explicitly verified because the feature depends on the badge system, which is not yet modified by this story. Assuming Loki Mode works correctly from Sprint 2, it should continue to work after these fixes.

---

## Verdict

**DO NOT SHIP** ← Resubmit after copy fixes
**Severity**: 3 MAJOR defects (copy accuracy)
**Recommendation**: Correct tooltip copy in `realm-utils.ts` and re-test

---

*Tested by: Loki (QA Tester)
Date: 2026-02-27*
