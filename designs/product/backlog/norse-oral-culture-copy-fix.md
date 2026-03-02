# Backlog Item: Norse Oral Culture — Import Wizard Copy Fix

**Status:** Backlog
**Priority:** P3-Medium
**Owner:** Freya (Product Owner) + Luna (UX Designer)
**Sprint:** Unscheduled

---

## Summary

The Import Wizard uses "scroll" terminology (e.g., "Share a Scroll") which is historically inaccurate for Norse culture. The Norse were primarily an oral culture — written communication relied on runes carved into wood, stone, or metal, not scrolls. Sagas and stories were passed down orally through skalds and elders.

Update all import-related copy to replace scroll/parchment metaphors with Norse-accurate alternatives: rune carvings, stone tablets, saga recitations, or skaldic references.

## Creative Direction

**Voice of the Wolf:** Fenrir does not read scrolls — he reads the runes his enemies carved into stone and bone. The records of the chain-makers are etched, not written. A skald speaks the saga aloud; a rune-carver cuts it into wood.

**Terminology mapping:**
| Current (inaccurate) | Replacement (Norse-accurate) | Rationale |
|---|---|---|
| "Share a Scroll" | "Share a Rune Tablet" or "Share a Carving" | Runes were carved, not written on scrolls |
| "scroll" (generic) | "tablet", "carving", "inscription", "rune-stone" | Physical Norse writing surfaces |
| "sacred scrolls" | "sacred inscriptions" or "carved records" | Maintains reverence, fixes medium |
| "Fetching the sacred scrolls from your archives..." | "Reading the rune-stones from your archives..." | Loading text during Picker fetch |

## Scope

Audit all user-facing copy in the import workflow for scroll/parchment references:
- `MethodSelection.tsx` — method card titles, descriptions, disabled labels
- `ImportWizard.tsx` — step headings, loading text, success messages
- `PickerStep.tsx` — consent prompt, fetching state text (if built by then)
- `designs/product/copywriting.md` — master copy doc
- `designs/ux-design/interactions/import-workflow-v2.md` — interaction spec copy

## Acceptance Criteria

- [ ] No references to "scroll" or "parchment" remain in import wizard UI copy
- [ ] Replacement terms are historically consistent with Norse runic culture
- [ ] Copy still feels evocative and on-brand (Saga Ledger aesthetic)
- [ ] Build passes, no TypeScript errors from string changes
