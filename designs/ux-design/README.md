# Luna — UX Designer

UX design artifacts for Fenrir Ledger.

---

## Theme System

- [Theme system architecture](theme-system.md) — dual-theme overview, CSS variable groups, design rules
- [Light theme spec](light-theme-stone.md) — Stone/Marble palette, rationale, WCAG contrast ratios

## Wireframes

- [Light Theme Stone prototype](wireframes/light-theme-stone.html)
- [Profile Dropdown — My Cards Nav Entry](wireframes/profile-dropdown-my-cards.html) — Issue #441: adds "My Cards" link to `/ledger` in ProfileDropdown, with active state and interaction spec

## Import Workflow v2 (Sprint 6)

- [Import Workflow v2 interaction spec](interactions/import-workflow-v2.md)
- [Method Selection wireframe](wireframes/import/import-method-selection.html)
- [CSV Upload wireframe](wireframes/import/csv-upload.html)
- [Safety Banner wireframe (all variants)](wireframes/import/safety-banner.html)

## Claude Code Terminal Skin

- [Terminal skin interaction spec](interactions/claude-terminal-skin.md) — statusline, splash screen, color mapping, responsive behavior
- **Status**: Design complete. Not yet implemented. See [`designs/product/backlog/claude-terminal-skin.md`](../product/backlog/claude-terminal-skin.md) for product brief.

---

## Easter Eggs

The following easter egg components are implemented and documented inline:

| Component | File | Trigger |
|-----------|------|---------|
| LCARS Overlay | `components/easter-eggs/LcarsOverlay.tsx` | Konami code (Star Trek) |
| Easter Egg Modal | `components/easter-eggs/EasterEggModal.tsx` | Shared modal for all easter eggs |
| Gleipnir cards | `components/cards/Gleipnir*.tsx` (6 files) | CardForm easter egg entries |
| ForgeMaster Egg | `components/layout/ForgeMasterEgg.tsx` | Hidden layout trigger |
| Konami Howl | `components/layout/KonamiHowl.tsx` | Konami code (wolf) |

Easter egg color tokens (`--egg-*`, `--lcars-*`, `--howl-*`, `--loki-toast-*`) are defined in `globals.css` and documented in `light-theme-stone.md`. These tokens remain dark in both themes (design decision: immersive easter eggs are always dark-themed).
