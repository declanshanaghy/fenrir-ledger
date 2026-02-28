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

---

# QA Handoff — Sprint 3, Story 3.2

**From**: FiremanDecko (Principal Engineer)
**To**: Loki (QA Tester)
**Sprint**: 3
**Story**: 3.2 — Norse Copy Pass + `getRealmLabel()`
**Date**: 2026-02-27

---

## What Was Implemented

### `getRealmLabel()` and `getRealmDescription()` in `realm-utils.ts`

New utility module at `development/src/src/lib/realm-utils.ts` provides the authoritative
mapping from `CardStatus` to Norse realm vocabulary.

- `getRealmLabel(status)` — returns the realm name string:
  - `active` → `"Asgard"`
  - `fee_approaching` → `"Muspelheim"`
  - `promo_expiring` → `"Jötunheimr"`
  - `closed` → `"Valhalla"`
- `getRealmDescription(status)` — returns atmospheric tooltip copy (Voice 2)

Both functions are switch-exhaustive with no default branch, so adding a new `CardStatus`
without updating `realm-utils.ts` produces a TypeScript compile error.

### `StatusBadge.tsx` — tooltip wired to `getRealmDescription()`

The badge tooltip now calls `getRealmDescription()` directly instead of looking up
`STATUS_TOOLTIPS[status]` from `constants.ts`. Badge labels are unchanged (Voice 1).

### `constants.ts` — `STATUS_TOOLTIPS` delegates to `realm-utils.ts`

`STATUS_TOOLTIPS` now builds its values from `getRealmDescription()`, making `realm-utils.ts`
the single source of truth. Type tightened from `Record<string, string>` to
`Record<CardStatus, string>`.

### Norse copy pass — page headings, empty state, loading states

| Location | Before | After |
|----------|--------|-------|
| Dashboard page heading (`/`) | "Cards" | "The Ledger of Fates" |
| Dashboard loading state | "Loading..." | "The Norns are weaving..." |
| Add card page heading (`/cards/new`) | "Add New Card" | "Forge a New Chain" |
| Add card page subheading | "Add this card to your portfolio." | "Add a card to your portfolio." |
| Edit card page heading (`/cards/[id]/edit`) | "Edit Card" | `{card.cardName}` |
| Edit card page subheading | `{card.cardName}` | "Card record" |
| Edit card loading state | "Loading..." | "Consulting the runes..." |
| Empty state heading | "No cards yet" | "Before Gleipnir was forged, Fenrir roamed free." |
| Empty state body | "Add your first card to start tracking fees, bonuses, and deadlines." | "Before your first card is added, no chain can be broken." |

**Not changed** (Voice 1 — functional, correct as-is):
- All button labels (Add Card, Save, Cancel, Delete, etc.)
- All form field labels and placeholders
- Status badge primary labels (Active, Fee Due Soon, Promo Expiring, Closed)
- Navigation item labels (Cards)
- Confirmation dialog copy (already aligned with `copywriting.md`)

---

## Files Created / Modified (Story 3.2)

| File | Action | Description |
|------|--------|-------------|
| `development/src/src/lib/realm-utils.ts` | Created | New: `getRealmLabel()` and `getRealmDescription()` |
| `development/src/src/lib/constants.ts` | Modified | `STATUS_TOOLTIPS` now delegates to `getRealmDescription()`; type tightened |
| `development/src/src/components/dashboard/StatusBadge.tsx` | Modified | Tooltip uses `getRealmDescription()` directly |
| `development/src/src/components/dashboard/EmptyState.tsx` | Modified | Norse copy: Gleipnir heading and body |
| `development/src/src/app/page.tsx` | Modified | Heading → "The Ledger of Fates"; loading → "The Norns are weaving..." |
| `development/src/src/app/cards/new/page.tsx` | Modified | Heading → "Forge a New Chain" |
| `development/src/src/app/cards/[id]/edit/page.tsx` | Modified | Heading → card name; subhead → "Card record"; loading → "Consulting the runes..." |
| `development/implementation-plan.md` | Modified | Story 3.2 section added |
| `development/qa-handoff.md` | Modified | This section |

---

## How to Deploy (Story 3.2)

Same as Sprint 2. No new environment variables.

```bash
cd development/src
npm run dev
# open http://localhost:9999
```

---

## Test Focus Areas (Story 3.2)

### 1. Realm tooltip copy on status badges

For each card status, hover the status badge and verify the tooltip:

| Badge label | Expected tooltip |
|-------------|-----------------|
| Active | "Asgard-bound — rewards flowing, no urgent deadlines" |
| Fee Due Soon | "Muspelheim — annual fee due soon, fire approaches" |
| Promo Expiring | "Hati approaches — promo deadline draws near" |
| Closed | "In Valhalla — rewards harvested, chain broken" |

To trigger each status:
- **Active**: add a card with no upcoming deadlines
- **Fee Due Soon**: add a card with annual fee date within 60 days
- **Promo Expiring**: add a card with bonus deadline within 30 days
- **Closed**: edit an existing card and set status to "Closed"

### 2. Badge labels unchanged (Voice 1)

Verify status badge text (not tooltip) still reads plain English:
- "Active" (not "Asgard")
- "Fee Due Soon" (not "Muspelheim")
- "Promo Expiring" (not "Jötunheimr")
- "Closed" (not "Valhalla")

### 3. Dashboard page heading

- Navigate to `/`
- Verify page heading reads "The Ledger of Fates" (not "Cards")

### 4. Dashboard loading state

- Hard refresh the page (Cmd+Shift+R / Ctrl+Shift+F5)
- Verify loading text reads "The Norns are weaving..." (not "Loading...")

### 5. Add card page heading

- Navigate to `/cards/new`
- Verify heading reads "Forge a New Chain"
- Verify subheading reads "Add a card to your portfolio."

### 6. Edit card page heading

- Navigate to `/cards/[id]/edit` for an existing card (e.g., "Sapphire Preferred")
- Verify heading reads the card name (e.g., "Sapphire Preferred")
- Verify subheading reads "Card record"
- Verify loading state (if briefly visible) reads "Consulting the runes..."

### 7. Empty state copy

- Open the app with no cards (or clear localStorage)
- Verify empty state heading reads: "Before Gleipnir was forged, Fenrir roamed free."
- Verify empty state body reads: "Before your first card is added, no chain can be broken."
- Verify the "Add Card" button is still present and functional

### 8. Loki Mode realm badges still work

- Click "Loki" in the footer 7 times
- Verify card grid shuffles and badges show random Norse realm names from `LOKI_REALM_NAMES`
- Verify the Loki Mode labels appear in the badge (not the normal status labels)
- Verify tooltips still show the realm description from `getRealmDescription()` regardless of Loki label

### 9. Build verification

```bash
cd development/src && npm run build
```

Expected: zero TypeScript errors, zero lint errors, all pages build successfully.

---

## Known Limitations (Story 3.2)

| Limitation | Impact |
|-----------|--------|
| Realm labels not on primary badges | By design — Voice 1 rule keeps badges functional |
| `active` maps to a single realm (Asgard) | Vanaheim/Midgard sub-states not yet differentiated — future work |
| Loading state flicker depends on device speed | The "Norns are weaving..." text may be too brief to read on fast devices — acceptable |

---

# QA Handoff — Sprint 3, Story 3.3

**From**: FiremanDecko (Principal Engineer)
**To**: Loki (QA Tester)
**Sprint**: 3
**Story**: 3.3 — Framer Motion + Card Animations
**Date**: 2026-02-27

---

## What Was Implemented

### `framer-motion` installed

`framer-motion` added to `dependencies` in `package.json`. All Framer Motion components
are in `"use client"` boundaries per ADR-001.

### `saga-shimmer` CSS keyframe + `.skeleton` class in `globals.css`

Gold-palette shimmer animation for skeleton loading tiles. The gradient sweeps from
void-black (`#0f1018`) through midnight blue (`#1e2235`) to slate (`#2a2d45`) and back,
giving a Norse gold-tinged pulse rather than a neutral gray flash.

### `CardSkeletonGrid` component — shimmer loading state

New component at `development/src/src/components/dashboard/CardSkeletonGrid.tsx`.

- Renders a configurable number of skeleton card tiles (default: 6)
- Each `SkeletonTile` is a structural mirror of `CardTile` — same height, same row layout
- Includes a skeleton summary header row (count + attention count placeholders)
- "The Norns are weaving..." italic caption appears beneath the skeleton grid
- No Framer Motion dependency — CSS animation only

### `AnimatedCardGrid` component — Framer Motion stagger + exit

New component at `development/src/src/components/dashboard/AnimatedCardGrid.tsx`.

Two animations:

**Saga-enter stagger (page load)**
- Initial: `opacity: 0, y: 20`
- Animate: `opacity: 1, y: 0`
- Duration: 400ms, easing: `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out)
- Stagger: each card delays by `index × 0.07s`, capped at 0.56s

**Card Sent to Valhalla exit (delete)**
- Exit: `opacity: 0, y: 24, scale: 0.95, filter: sepia(1) brightness(0.4)`
- Duration: 500ms, easing: `ease-in`
- Card descends and desaturates before DOM removal
- `mode="popLayout"` ensures the grid reflows smoothly after exit

### `Dashboard.tsx` — wired to `AnimatedCardGrid`

Replaced the raw `<div className="grid ...">` with `<AnimatedCardGrid>`.
Loki Mode logic unchanged — `displayCards` (shuffled or normal) passes through identically.

### `page.tsx` — wired to `CardSkeletonGrid`

Replaced the plain "The Norns are weaving..." div loading state with `<CardSkeletonGrid count={6} />`.
Removed the `.saga-reveal` wrapper div — Framer Motion now owns the stagger.

---

## Files Created / Modified (Story 3.3)

| File | Action | Description |
|------|--------|-------------|
| `development/src/package.json` | Modified | Added `framer-motion` to dependencies |
| `development/src/package-lock.json` | Modified | Lock file updated for `framer-motion` |
| `development/src/src/app/globals.css` | Modified | Added `@keyframes saga-shimmer` and `.skeleton` class |
| `development/src/src/components/dashboard/CardSkeletonGrid.tsx` | Created | Shimmer skeleton loading grid |
| `development/src/src/components/dashboard/AnimatedCardGrid.tsx` | Created | Framer Motion stagger entrance + Valhalla exit |
| `development/src/src/components/dashboard/Dashboard.tsx` | Modified | Uses `AnimatedCardGrid` instead of raw grid div |
| `development/src/src/app/page.tsx` | Modified | Uses `CardSkeletonGrid` for loading state; removed `.saga-reveal` wrapper |
| `development/implementation-plan.md` | Modified | Story 3.3 tasks documented |
| `development/qa-handoff.md` | Modified | This section |

---

## How to Deploy (Story 3.3)

Same as Story 3.2. No new environment variables.

```bash
cd development/src
npm run dev
# open http://localhost:9653
```

---

## Test Focus Areas (Story 3.3)

### 1. Skeleton loading state

The skeleton is only visible during the brief window between page mount and
the `useEffect` localStorage read completing. On most devices this is < 50ms.

**To reliably observe the skeleton:**
1. Open DevTools → Network tab → set throttling to "Slow 3G"
2. Hard-refresh the dashboard (`Cmd+Shift+R` / `Ctrl+Shift+F5`)
3. The skeleton grid should be visible for 1–2 seconds before cards appear

**Expected skeleton behavior:**
- 6 skeleton tiles render in the card grid layout (1 col / 2 col / 3 col responsive)
- Each tile has the same height as a real `CardTile` (~216px)
- Shimmer animation sweeps left-to-right with a gold-tinted dark gradient
- "The Norns are weaving..." italic caption appears beneath the skeleton grid
- Skeleton is replaced by the real card grid once loading completes

**Regression check:**
- Verify "The Norns are weaving..." text no longer appears as a standalone centered div (it now lives inside `CardSkeletonGrid`)

---

### 2. Saga-enter stagger animation (page load)

After the skeleton resolves and cards appear:

- Cards animate in sequentially — first card appears immediately, each subsequent card staggered by ~70ms
- Each card starts at `opacity: 0, y: 20px` and resolves to `opacity: 1, y: 0`
- Duration: ~400ms per card; expo-out easing (fast settle, no bounce)
- With 6 cards: last card begins animating at ~350ms; full grid visible by ~750ms

**How to test with a full portfolio:**
1. Ensure several cards exist in localStorage
2. Hard-refresh the page
3. Observe sequential card appearance (not simultaneous)

**Edge case — large portfolio:**
- Add 9+ cards
- Verify stagger delay caps at ~560ms for cards beyond index 8 (all appear in a cluster)

---

### 3. Card exit animation (delete → Valhalla)

When a card is deleted:

1. Navigate to `/cards/[id]/edit` for any existing card
2. Click "Delete card" → confirm in the dialog
3. Observe the dashboard after redirect

**Expected behavior:**
- After the delete redirect, the deleted card should no longer appear
- When cards are deleted while already on the dashboard (if future implementation allows inline delete), the card should animate out: descend with sepia desaturation before disappearing from the grid

**Note for this sprint:** Card deletion navigates to the dashboard via redirect, so the exit animation fires after the redirect when the grid reloads without the deleted card. The remaining cards re-enter with the stagger animation. This is the correct behavior for the current architecture.

**To test the exit animation more directly:**
- Observe the Framer Motion animation in a local dev build where you can add a `console.log` in `makeCardVariants` to confirm the `exit` variant is being applied. Alternatively, use React DevTools → Framer Motion panel.

---

### 4. Loki Mode regression — animated grid

Loki Mode must still function after the `AnimatedCardGrid` integration:

1. Click "Loki" in the footer 7 times rapidly
2. Verify the card grid shuffles into a new order (cards re-animate with stagger)
3. Verify status badges show random Norse realm names
4. Wait ~5 seconds — verify order restores (cards re-animate back into original order)

---

### 5. Responsive layout — skeleton + animated grid

At each breakpoint, verify both the skeleton and real grid use the correct column count:

| Viewport | Skeleton columns | Real grid columns |
|----------|-----------------|-------------------|
| < 640px (mobile) | 1 | 1 |
| 640px–1023px (tablet) | 2 | 2 |
| ≥ 1024px (desktop) | 3 | 3 |

---

### 6. Build verification

```bash
cd development/src && npm run build
```

Expected: zero TypeScript errors, zero lint errors, all pages build successfully.
`framer-motion` bundle contributes ~43 kB to the `/` route First Load JS (see build output).

---

## Known Limitations (Story 3.3)

| Limitation | Impact |
|-----------|--------|
| Skeleton window is very brief on fast devices | localStorage read is synchronous; skeleton may flash for < 1 frame — use network throttling to observe |
| Card exit animation not visible on delete-then-redirect flow | Delete navigates away; exit plays when the new card list renders (without the deleted card). No user-visible regression. |
| Tiwaz rune (ᛏ) placeholder after Valhalla exit not implemented | Spec calls for a brief ᛏ rune appearing where the card was; deferred to S3/S4 easter egg layer |
| No `prefers-reduced-motion` guard | Framer Motion's `useReducedMotion` hook not wired; animations play regardless of OS accessibility setting — deferred |

---

# QA Handoff — Sprint 3, Story 3.5

**From**: FiremanDecko (Principal Engineer)
**To**: Loki (QA Tester)
**Sprint**: 3
**Story**: 3.5 — Valhalla Archive + Close Card Action
**Date**: 2026-02-27

---

## What Was Implemented

### 1. `closedAt` field added to `Card` type (`types.ts`)

New optional field `closedAt?: string` (UTC ISO 8601 timestamp) records when a card was explicitly closed. Distinct from `deletedAt`: a closed card is honored in Valhalla; a deleted card is gone forever.

### 2. `closeCard()` and `getClosedCards()` in `storage.ts`

- **`closeCard(householdId, cardId)`**: Sets `card.status = "closed"` and `card.closedAt = now`. Persists to localStorage. No-op if card is already closed, soft-deleted, or not found.
- **`getClosedCards(householdId)`**: Returns all non-deleted cards with `status === "closed"` for the household, sorted by `closedAt` descending.
- **`getCards(householdId)` updated**: Now excludes `status === "closed"` cards. Closed cards no longer appear in the active dashboard; they live in Valhalla only.

### 3. "Close Card" action on `CardForm.tsx`

In edit mode, two separate destructive actions are now available:

| Action | Effect | Dialog |
|--------|--------|--------|
| **Close Card** | Sets `status: "closed"`, records `closedAt`, moves card to Valhalla | "Close this card? [Card Name] will be moved to Closed Cards. Its record and rewards will be preserved." |
| **Delete card** | Hard-deletes (sets `deletedAt`), card disappears everywhere including Valhalla | "Delete this card? This will permanently remove [Card Name]. This cannot be undone." |

- "Close Card" button is only shown when the card is NOT already closed (`status !== "closed"`)
- For already-closed cards, only "Delete card" appears (no redundant Close button)
- Both actions route back to `/` on confirmation

### 4. Valhalla route — `/valhalla`

New page at `development/src/src/app/valhalla/page.tsx`.

- **Page heading**: "Valhalla" (Voice 2, gold, Cinzel Display)
- **Subheading**: "Hall of the Honored Dead" (italic, muted)
- **Atmospheric quote**: "Here lie the chain-breakers. Their rewards were harvested."
- **Sepia tint**: `filter: sepia(0.15) brightness(0.95)` on page wrapper — distinct memorial aesthetic vs. active dashboard
- **Filter bar**: Issuer dropdown (derived from closed card set) + Sort dropdown (closed date newest/oldest, A→Z, Z→A)
- **Tombstone cards**:
  - Thick left border accent `border-l-4 border-l-[#8a8578]` (stone-hel color)
  - ᛏ Tiwaz rune + card name (uppercase) + "Closed {date}" in font-mono
  - Meta line: `{Issuer} · Opened {date} · Held {duration}`
  - Hairline rule
  - Plunder grid: Rewards row (bonus summary if present) + Fee avoided row
  - Italic epitaph copy (atmospheric)
- **Animation**: Framer Motion `motion.article` with saga-enter stagger (same 0.07s × index, capped 0.56s, expo-out easing as `AnimatedCardGrid`)
- **Empty state**: ᛏ rune + "The hall waits. No chain has yet been broken." + subtext — per `product/copywriting.md`
  - `aria-description="the spittle of a bird"` — Gleipnir Hunt fragment #6 (Sprint 4 mechanic)
- **Filter no-results**: "No cards bear this issuer's mark."
- **Loading state**: "Consulting the runes..."

### 5. Sidebar nav link to `/valhalla` in `SideNav.tsx`

- New `RuneIcon` helper component renders ᛏ rune at 16×16 footprint
- Nav item: `{ label: "Valhalla", href: "/valhalla", iconNode: <RuneIcon rune="ᛏ" /> }`
- Active state highlights with gold left border on `/valhalla` route
- Collapsed sidebar shows ᛏ with native title tooltip "Valhalla"

---

## Files Created / Modified (Story 3.5)

| File | Action | Description |
|------|--------|-------------|
| `development/src/src/lib/types.ts` | Modified | Added `closedAt?: string` field to `Card` interface |
| `development/src/src/lib/storage.ts` | Modified | Added `closeCard()` and `getClosedCards()`; `getCards()` now excludes closed cards |
| `development/src/src/components/cards/CardForm.tsx` | Modified | Added "Close Card" button + confirmation dialog; imports `closeCard` |
| `development/src/src/app/valhalla/page.tsx` | Created | Valhalla archive route — tombstone cards, filter bar, empty state |
| `development/src/src/components/layout/SideNav.tsx` | Modified | Added `RuneIcon` component, `iconNode` nav item field, Valhalla nav link |
| `development/implementation-plan.md` | Modified | Story 3.5 section added |
| `development/qa-handoff.md` | Modified | This section |

---

## How to Deploy (Story 3.5)

Same as Story 3.3. No new environment variables.

```bash
cd development/src
npm run dev
# open http://localhost:9653
```

Navigate to `/valhalla` directly, or click "Valhalla" in the sidebar.

---

## Test Focus Areas (Story 3.5)

### 1. Close Card action — happy path

1. Add a new card (issuer, name, date — any values)
2. Navigate to `/cards/[id]/edit` for that card
3. Verify "Close Card" button is visible in the actions row (to the left of "Delete card")
4. Click "Close Card"
5. Verify confirmation dialog appears with:
   - Title: "Close this card?"
   - Body mentions the card name
   - Body says record and rewards will be preserved
   - Buttons: "Close Card" and "Cancel"
6. Click "Cancel" — verify dialog closes, card unchanged
7. Click "Close Card" again → confirm "Close Card"
8. Verify redirect to dashboard `/`
9. Verify the closed card is **absent** from the dashboard card grid

### 2. Close Card — card appears in Valhalla

1. After closing a card (test 1 above), navigate to `/valhalla`
2. Verify the tombstone entry is present:
   - ᛏ rune displayed
   - Card name shown in uppercase
   - "Closed {date}" shown in font-mono (today's date)
   - Issuer name in meta line
   - "Opened {date}" in meta line
   - "Held {duration}" in meta line
   - Fee avoided in plunder row (or "$0 (no-fee card)" if no annual fee)
   - Italic epitaph copy present

### 3. Delete vs. Close distinction

1. Add two cards: Card A and Card B
2. Close Card A (using "Close Card")
3. Delete Card B (using "Delete card")
4. Verify:
   - Dashboard: neither card appears (both gone from active view)
   - Valhalla `/valhalla`: Card A appears; Card B does NOT appear
5. Reload page — verify same result (persistence)

### 4. Already-closed card in edit form

1. Navigate to `/cards/[id]/edit` for a closed card
2. Verify "Close Card" button is **NOT shown** (card already closed)
3. Verify "Delete card" button IS shown
4. Verify status dropdown shows "Closed" as the current value

### 5. Valhalla page — empty state

1. Open app with no closed cards (fresh install or all cards deleted/active)
2. Navigate to `/valhalla`
3. Verify:
   - ᛏ rune displayed in the empty state
   - Text: "The hall waits. No chain has yet been broken."
   - Subtext about closing a card to archive it here
   - No filter bar visible (filter bar only appears when closed cards exist)

### 6. Valhalla filter — by issuer

1. Close two cards from different issuers (e.g., Chase and Amex)
2. Navigate to `/valhalla`
3. Verify both tombstones appear with "All issuers" selected (default)
4. Select Chase from the issuer dropdown
5. Verify only the Chase card tombstone is shown
6. Select Amex — verify only the Amex card shown
7. Select "All issuers" again — verify both shown

### 7. Valhalla sort

1. Close three cards at different times
2. Navigate to `/valhalla`
3. Verify default sort: "Sort: Closed date (newest)" — most recently closed card is at the top
4. Switch to "Sort: Closed date (oldest)" — verify order reverses
5. Switch to "Sort: A → Z" — verify alphabetical order by card name (ascending)
6. Switch to "Sort: Z → A" — verify reverse alphabetical

### 8. Valhalla stagger animation

1. Close 4+ cards
2. Navigate to `/valhalla`
3. Observe tombstone cards animating in with stagger:
   - First card appears immediately
   - Each subsequent card appears ~70ms after the previous
   - Cards animate from `opacity: 0, y: 20px` to `opacity: 1, y: 0`
   - Expo-out easing (cards settle quickly without bounce)

### 9. Sidebar navigation

1. Verify "Valhalla" nav item with ᛏ rune appears below "Cards" in the left sidebar
2. Click "Valhalla" — verify navigation to `/valhalla`
3. Verify the "Valhalla" nav item has the gold left border active state at `/valhalla`
4. Verify "Cards" nav item has the gold active state at `/`
5. Collapse the sidebar — verify ᛏ rune shows as the icon-only state
6. Hover the collapsed ᛏ icon — verify native tooltip reads "Valhalla"

### 10. Dashboard — closed cards excluded

1. Close a card
2. Navigate to `/` (dashboard)
3. Verify the closed card does NOT appear in the card grid
4. Verify the card count in the summary header reflects only active (non-closed) cards
5. Reload page — confirm the closed card is still absent

### 11. Sepia tint on Valhalla page

1. Navigate to `/valhalla`
2. Visually verify the page has a slightly sepia/warm-tinted, slightly dimmed background
   compared to the active dashboard — the memorial aesthetic should be noticeable but subtle

### 12. Build verification

```bash
cd development/src && npm run build
```

Expected: zero TypeScript errors, zero lint errors, `/valhalla` route present in build output.

---

## Known Limitations (Story 3.5)

| Limitation | Impact |
|-----------|--------|
| No `<title>` metadata on Valhalla page | Page title in browser tab shows "Fenrir Ledger" not "Valhalla — Fenrir Ledger" — deferred to Sprint 4 (requires server component wrapper) |
| No "View full record" button on tombstones | Edit route exists but needs a guard update for closed-card access — Sprint 4 |
| Plunder rows are simple, not computed totals | "Net gain" calculation requires reward value tracking — future sprint |
| Cards closed via old status dropdown lack `closedAt` | Show "—" for closed date; still appear in Valhalla — acceptable |
| Gleipnir fragment #6 `aria-description` not yet wired | Text is embedded; hunt detection mechanic is Sprint 4 |
| No `prefers-reduced-motion` guard on stagger | Framer Motion `useReducedMotion` deferred — same as Story 3.3 |
