# QA Handoff — Sprint 1

**From**: FiremanDecko (Principal Engineer)
**To**: Loki (QA Tester)
**Sprint**: 1
**Date**: 2026-02-23

---

## What Was Implemented

### Story 1.1 — Project Scaffold
Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui project scaffolded in `development/src/`. All configuration files are written by hand (create-next-app equivalent). TypeScript strict mode enabled.

### Story 1.2 — Data Model and Storage Layer
- `src/lib/types.ts` — TypeScript interfaces: `Household`, `Card`, `SignUpBonus`, `CardStatus`, `BonusType`
- `src/lib/constants.ts` — All magic values: storage keys, threshold days, issuer list
- `src/lib/storage.ts` — localStorage abstraction with `getCards`, `saveCard`, `deleteCard`, `initializeDefaultHousehold`, `migrateIfNeeded`
- `src/lib/card-utils.ts` — Pure functions: `computeCardStatus`, `formatCurrency`, `formatDate`, `daysUntil`, `dollarsToCents`, `centsToDollars`

### Story 1.3 — Card CRUD UI
- Add Card form at `/cards/new`
- Edit Card form at `/cards/[id]/edit`
- Shared `CardForm` component with react-hook-form + Zod validation
- Delete card with confirmation dialog
- All data persists in localStorage under `fenrir_ledger:*` keys

### Story 1.4 — Dashboard with Status Indicators
- Dashboard at `/` showing all cards in a responsive grid
- Card tiles with status badges (Active / Fee Approaching / Promo Expiring / Closed)
- Summary header showing total cards and attention count
- Empty state when no cards exist

### Story 1.5 — Idempotent Local Dev Setup
- `development/scripts/setup-local.sh` — idempotent setup script
- `development/src/.env.example` — environment variable template

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `development/src/package.json` | Project dependencies |
| `development/src/tsconfig.json` | TypeScript configuration |
| `development/src/next.config.ts` | Next.js configuration |
| `development/src/tailwind.config.ts` | Tailwind CSS configuration |
| `development/src/postcss.config.mjs` | PostCSS configuration |
| `development/src/components.json` | shadcn/ui configuration |
| `development/src/.eslintrc.json` | ESLint configuration |
| `development/src/.env.example` | Environment template (committed) |
| `development/src/.gitignore` | Git ignore rules |
| `development/src/src/app/globals.css` | Global styles + shadcn/ui CSS variables |
| `development/src/src/app/layout.tsx` | Root layout |
| `development/src/src/app/page.tsx` | Dashboard page (/) |
| `development/src/src/app/cards/new/page.tsx` | Add card page |
| `development/src/src/app/cards/[id]/edit/page.tsx` | Edit card page |
| `development/src/src/lib/types.ts` | TypeScript type definitions |
| `development/src/src/lib/constants.ts` | Application constants |
| `development/src/src/lib/storage.ts` | localStorage abstraction |
| `development/src/src/lib/card-utils.ts` | Card utility functions |
| `development/src/src/lib/utils.ts` | shadcn/ui cn() utility |
| `development/src/src/components/ui/button.tsx` | shadcn/ui Button |
| `development/src/src/components/ui/card.tsx` | shadcn/ui Card |
| `development/src/src/components/ui/input.tsx` | shadcn/ui Input |
| `development/src/src/components/ui/label.tsx` | shadcn/ui Label |
| `development/src/src/components/ui/select.tsx` | shadcn/ui Select |
| `development/src/src/components/ui/badge.tsx` | shadcn/ui Badge (with status variants) |
| `development/src/src/components/ui/dialog.tsx` | shadcn/ui Dialog |
| `development/src/src/components/ui/textarea.tsx` | shadcn/ui Textarea |
| `development/src/src/components/ui/checkbox.tsx` | shadcn/ui Checkbox |
| `development/src/src/components/dashboard/Dashboard.tsx` | Dashboard component |
| `development/src/src/components/dashboard/CardTile.tsx` | Card display tile |
| `development/src/src/components/dashboard/StatusBadge.tsx` | Status badge |
| `development/src/src/components/dashboard/EmptyState.tsx` | Empty state |
| `development/src/src/components/cards/CardForm.tsx` | Shared add/edit form |
| `development/scripts/setup-local.sh` | Idempotent setup script |
| `development/implementation-plan.md` | Implementation documentation |
| `development/qa-handoff.md` | This file |
| `architecture/sprint-plan.md` | Sprint 1 stories |
| `architecture/system-design.md` | System design documentation |
| `architecture/adrs/ADR-001-tech-stack.md` | Tech stack decision |
| `architecture/adrs/ADR-002-data-model.md` | Data model decision |
| `architecture/adrs/ADR-003-local-storage.md` | Storage approach decision |
| `README.md` | Updated with Sprint 1 artifacts |

---

## How to Deploy (Local)

```bash
# 1. Clone the repo
git clone https://github.com/declanshanaghy/fenrir-ledger.git
cd fenrir-ledger

# 2. Run setup script (installs dependencies, creates .env.local)
./development/scripts/setup-local.sh

# 3. Start the dev server
cd development/src
npm run dev

# 4. Open browser
open http://localhost:3000
```

---

## Test Focus Areas

### Critical Path Tests

1. **Add card — happy path**
   - Navigate to `/cards/new`
   - Fill all required fields (issuer, card name, open date)
   - Submit form
   - Verify card appears on dashboard
   - Verify data persists after page refresh

2. **Add card — validation**
   - Submit form with missing required fields (issuer, card name, open date)
   - Verify error messages appear on each missing required field
   - Verify form does not submit

3. **Add card with sign-up bonus**
   - Enable the sign-up bonus checkbox
   - Fill in bonus type, amount, spend requirement, deadline
   - Submit and verify bonus data saved correctly

4. **Edit card**
   - Click a card tile on the dashboard
   - Verify form pre-populated with existing values
   - Modify card name and save
   - Verify updated name on dashboard

5. **Delete card**
   - Open edit form for a card
   - Click "Delete card"
   - Verify confirmation dialog appears
   - Confirm deletion
   - Verify card removed from dashboard

6. **Status badge colors**
   - Add a card with annual fee date within 60 days
   - Verify "Fee Approaching" badge in amber
   - Add a card with sign-up bonus deadline within 30 days
   - Verify "Promo Expiring" badge in amber
   - Add a card with no approaching deadlines
   - Verify "Active" badge in green

7. **Empty state**
   - Open app with no cards in localStorage
   - Verify empty state message and "Add your first card" button

8. **Data persistence**
   - Add 3 cards
   - Reload the page (F5)
   - Verify all 3 cards still appear

9. **Responsive layout**
   - Verify dashboard is 1 column on mobile viewport (< 640px)
   - Verify dashboard is 2 columns on tablet viewport (640px–1024px)
   - Verify dashboard is 3 columns on desktop viewport (> 1024px)

10. **Setup script**
    - Run `./development/scripts/setup-local.sh` on a clean checkout
    - Verify it completes without errors
    - Verify `.env.local` is created
    - Run it a second time — verify it completes without errors (idempotency)

---

## Known Limitations (Sprint 1)

| Limitation | Impact |
|-----------|--------|
| localStorage only | Data does not sync across devices or browsers |
| No auth | Single implicit household; no user accounts |
| No reminders | No notifications for upcoming deadlines |
| No timeline view | Dashboard only; no visual timeline |
| No data export | Cannot backup or export card data |
| No action recommendations | No "close / downgrade / keep" suggestions |
| No reward tracking | Cannot track rewards earned per card |
| Requires Node.js 18+ | May not work on older environments |

## Sprint 1 Environment Variables

Sprint 1 requires no environment variables. The `.env.example` file documents the template for future sprints.

---

## Suggested QA Script Commands

```bash
# Verify build passes
cd development/src && npm run build

# Verify TypeScript (no errors)
cd development/src && npx tsc --noEmit

# Verify lint
cd development/src && npm run lint

# Run setup script twice (idempotency check)
./development/scripts/setup-local.sh
./development/scripts/setup-local.sh
```

---

# QA Handoff — Sprint 2

**From**: FiremanDecko (Principal Engineer)
**To**: Loki (QA Tester)
**Sprint**: 2
**Date**: 2026-02-27

---

## What Was Implemented

### Story 2.1 — Saga Ledger Theme
Dark Nordic War Room aesthetic applied across the entire app. Void-black background (`#07070d`), gold accent (`#c9920a`), Norse typography (Cinzel Decorative, Cinzel, Source Serif 4, JetBrains Mono). CSS variables replaced in `globals.css`; Tailwind extended in `tailwind.config.ts`.

### Story 2.2 — App Shell and Layout Components
Full application shell with `AppShell.tsx`, `SiteHeader.tsx`, `SideNav.tsx`, `TopBar.tsx`, and `Footer.tsx`. Three-column footer hosts easter egg trigger points. All pages render within the shell.

### Story 2.3 — Easter Eggs Layer
Five easter eggs implemented:
- **Egg #4** (Console ASCII): FENRIR rune art in browser console via `ConsoleSignature.tsx`
- **Egg #5** (HTML Source Signature): JSDoc comment in page source via `layout.tsx`
- **Egg #7** (Runic Meta Tag): `fenrir:runes` meta tag in `<head>` via `layout.tsx`
- **Egg #2** (Konami Code Howl): ↑↑↓↓←→←→BA triggers howl overlay via `KonamiHowl.tsx`
- **Egg #3** (Loki Mode): 7 clicks on "Loki" in footer shuffles card grid + random realm badges for 5 s
- **Egg #1 Fragment 5** (Fish Breath): Hovering © in footer reveals `GleipnirFishBreath` modal

### Story 2.4 — Shared Easter Egg Modal
Reusable `EasterEggModal.tsx` component used by all Gleipnir fragment modals. Accepts title, rune, and content as props. Keyboard accessible.

### Story 2.5 — Forgemaster Egg
`ForgeMasterEgg.tsx` extracted into its own component and wired into the footer area.

### Supporting Components
- `AboutModal.tsx` — "About" dialog accessible from the nav
- `SyncIndicator.tsx` — data sync state indicator (idle state in Sprint 2)

---

## Files Created / Modified (Sprint 2)

| File | Description |
|------|-------------|
| `development/src/src/app/globals.css` | Saga Ledger CSS variables (replaced shadcn defaults) |
| `development/src/tailwind.config.ts` | Extended with Norse color palette and font families |
| `development/src/src/app/layout.tsx` | HTML source signature (JSDoc) + runic meta tag added |
| `development/src/src/components/layout/AppShell.tsx` | Root application shell wrapper |
| `development/src/src/components/layout/SiteHeader.tsx` | Brand header component |
| `development/src/src/components/layout/SideNav.tsx` | Left navigation rail |
| `development/src/src/components/layout/TopBar.tsx` | Secondary top bar |
| `development/src/src/components/layout/Footer.tsx` | Three-column footer with egg trigger points |
| `development/src/src/components/layout/ConsoleSignature.tsx` | FENRIR rune art console output (Egg #4) |
| `development/src/src/components/layout/KonamiHowl.tsx` | Konami code howl overlay (Egg #2) |
| `development/src/src/components/layout/ForgeMasterEgg.tsx` | Forgemaster easter egg component |
| `development/src/src/components/layout/AboutModal.tsx` | About dialog modal |
| `development/src/src/components/layout/SyncIndicator.tsx` | Sync state indicator |
| `development/src/src/components/easter-eggs/EasterEggModal.tsx` | Shared modal for Gleipnir fragments |
| `development/src/src/components/cards/GleipnirFishBreath.tsx` | Fragment 5: Breath of a Fish (Egg #1) |
| `development/src/src/components/cards/GleipnirMountainRoots.tsx` | Fragment 1: Roots of a Mountain |
| `development/src/src/components/cards/GleipnirCatFootfall.tsx` | Fragment 2: Sound of a Cat's Footfall |
| `development/src/src/components/cards/GleipnirBirdSpittle.tsx` | Fragment 3: Spittle of a Bird |
| `development/src/src/components/cards/GleipnirBearSinews.tsx` | Fragment 4: Sinews of a Bear |
| `development/src/src/components/cards/GleipnirWomansBeard.tsx` | Fragment 6: Beard of a Woman |

---

## How to Deploy (Sprint 2 — Local)

Same as Sprint 1. The dev server port is `9999` (configured in `package.json`).

```bash
# From repo root
./development/scripts/setup-local.sh

# Start dev server
cd development/src
npm run dev

# Open browser
open http://localhost:9999
```

---

## Test Focus Areas (Sprint 2)

### Easter Eggs

1. **Egg #4 — Console ASCII**
   - Open browser DevTools console
   - Load or refresh the page
   - Verify FENRIR rune art appears (6 glyphs, 7 lines each, followed by rune label line)

2. **Egg #5 — HTML Source Signature**
   - Press Cmd+U (macOS) or Ctrl+U (Windows/Linux) to view page source
   - Verify JSDoc signature comment is present in the HTML

3. **Egg #7 — Runic Meta Tag**
   - View page source
   - Verify `<meta name="fenrir:runes" ...>` is present in the `<head>`

4. **Egg #2 — Konami Code Howl**
   - Focus the page
   - Enter sequence: ↑ ↑ ↓ ↓ ← → ← → B A
   - Verify howl overlay animation appears and dismisses

5. **Egg #3 — Loki Mode**
   - Click the "Loki" text in the footer exactly 7 times rapidly
   - Verify card grid shuffles and realm badges randomize
   - Verify effect lasts approximately 5 seconds then reverts

6. **Egg #1 Fragment 5 — Fish Breath**
   - Hover over the copyright symbol (©) in the footer
   - Verify `GleipnirFishBreath` modal appears
   - Verify modal closes on dismiss

### Theme / Layout

7. **Dark Norse theme active**
   - Verify background is near-black (void-black `#07070d`)
   - Verify gold accent (`#c9920a`) on interactive elements
   - Verify Norse fonts applied (Cinzel for headings, JetBrains Mono for data)

8. **App shell layout**
   - Verify sidebar navigation renders
   - Verify all Sprint 1 pages (/, /cards/new, /cards/[id]/edit) render within the shell
   - Verify mobile layout collapses correctly (no horizontal overflow at 375px)

9. **About modal**
   - Verify "About" trigger opens the modal
   - Verify modal closes on Escape or close button

---

## Known Limitations (Sprint 2)

| Limitation | Impact |
|-----------|--------|
| All Sprint 1 limitations | Carry forward unchanged |
| No Framer Motion animations | Saga-enter stagger, StatusRing, HowlPanel planned for Sprint 3 |
| No Valhalla route | Closed cards archive planned for Sprint 3 |
| Gleipnir Hunt incomplete | Only Fragment 5 (Fish Breath) is fully wired; other 5 fragments have components but may lack trigger points |
| SyncIndicator always idle | Real sync state requires backend (future sprint) |

## Sprint 2 Environment Variables

Sprint 2 requires no additional environment variables. No secrets introduced.
