# QA Handoff -- Import Wizard Wireframe Fixes

**Branch:** `fix/import-wireframe-fixes`
**Date:** 2026-03-04
**Engineer:** FiremanDecko
**PR:** https://github.com/declanshanaghy/fenrir-ledger/pull/136

## What was implemented

Three wireframe alignment fixes for the import wizard.

### Fix 1: Compact SafetyBanner expandable Details link
- Added a "Details" button to the compact safety banner variant
- Clicking toggles inline expansion showing include/exclude column lists (same content as the full variant)
- Uses local React state -- not persisted to localStorage
- Button text toggles between "Details" and "Hide"
- 44px minimum touch target on the button
- `aria-label="View full safety details"` and `aria-expanded` attributes for accessibility

### Fix 2: CSV format help section
- Added always-visible "How to export CSV" section below the drop zone in CsvUpload
- Includes instructions for Google Sheets, Excel, and Numbers
- Not collapsible -- always displayed

### Fix 3: Standardized button text
- CsvUpload: "Import CSV" changed to "Begin Import"
- ShareUrlEntry: "Import" changed to "Begin Import"

## Files modified

| File | Description |
|------|-------------|
| `development/frontend/src/components/sheets/SafetyBanner.tsx` | Added `CompactBanner` component with expandable details; added `useState` import |
| `development/frontend/src/components/sheets/CsvUpload.tsx` | Added format help section; changed button text to "Begin Import" |
| `development/frontend/src/components/sheets/ShareUrlEntry.tsx` | Changed button text to "Begin Import" |

## How to deploy

1. `cd development/frontend && npm install && npx next build`
2. `npx next dev` or use worktree dev server

## How to test

### Port and URL
- Dev server: http://localhost:49460
- Worktree path: `/Users/declanshanaghy/src/github.com/declanshanaghy/fenrir-ledger-trees/fix/import-wireframe-fixes`

### Test steps

1. Navigate to the import wizard (click import button on dashboard)
2. Select URL import method -- verify compact banner shows "Details" link
3. Click "Details" -- include/exclude lists expand inline with a border separator
4. Click "Hide" -- lists collapse
5. Verify the URL entry button reads "Begin Import"
6. Go back, select CSV upload method
7. Verify compact banner shows "Details" link (same behavior)
8. Verify "How to export CSV" section is visible below the drop zone with three bullet items
9. Verify the CSV upload button reads "Begin Import"

### Accessibility checks
- Details button has `aria-label="View full safety details"`
- `aria-expanded` toggles between `true` and `false`
- Details button meets 44px min-height/min-width touch target (inspect element)
- Test on mobile viewport (375px) -- layout should not break

## Build verification

- `npx tsc --noEmit` -- PASS
- `npx next lint` -- PASS (no warnings or errors)
- `npx next build` -- PASS

## Known limitations

None. All three fixes are straightforward UI changes with no backend impact.
