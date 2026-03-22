# Implementation Plan: Fenrir Ledger Sprint 1

## Prerequisites

- Node.js >= 18 (check: `node --version`)
- npm >= 9 (check: `npm --version`)
- Git configured with remote `origin` pointing to the GitHub repo
- Terminal with bash or zsh

## Tasks (ordered)

---

### Task 1: Scaffold Next.js Project

- **File(s)**: All files under `development/ledger/`
- **Depends on**: Nothing
- **Implementation Notes**:
  - Run from `development/ledger/`:
    ```bash
    npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
    ```
  - This creates: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `src/app/`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
  - Verify with `npm run dev` — app should start at `http://localhost:3000`
- **Edge Cases**: If `development/ledger/` has a `.gitkeep` file, remove it first
- **Definition of Done**: `npm run dev` starts without errors; visiting `http://localhost:3000` shows the Next.js default page

---

### Task 2: Initialize shadcn/ui

- **File(s)**: `development/ledger/components.json`, `development/ledger/src/lib/utils.ts`, updates to `development/ledger/src/app/globals.css`, `development/ledger/tailwind.config.ts`
- **Depends on**: Task 1
- **Implementation Notes**:
  - Run from `development/ledger/`:
    ```bash
    npx shadcn@latest init
    ```
  - When prompted: Style=Default, Base color=Neutral, CSS variables=yes
  - Then add required components:
    ```bash
    npx shadcn@latest add button card input label select badge dialog textarea
    ```
  - This creates `src/components/ui/` with copy-owned component files
- **Edge Cases**: If `components.json` already exists, the init will prompt to overwrite — confirm yes
- **Definition of Done**: `src/components/ui/button.tsx` exists; `npm run build` passes

---

### Task 3: Install Form Dependencies

- **File(s)**: `development/ledger/package.json`, `development/ledger/package-lock.json`
- **Depends on**: Task 1
- **Implementation Notes**:
  - Run from `development/ledger/`:
    ```bash
    npm install react-hook-form zod @hookform/resolvers
    ```
- **Edge Cases**: Version conflicts between react-hook-form and @hookform/resolvers — they must be compatible versions. The `@hookform/resolvers` v3.x works with `react-hook-form` v7.x.
- **Definition of Done**: `node_modules/react-hook-form` exists; `npm run build` passes

---

### Task 4: Write Types and Constants

- **File(s)**: `development/ledger/src/lib/types.ts`, `development/ledger/src/lib/constants.ts`
- **Depends on**: Task 1
- **Implementation Notes**:
  - `types.ts`: Define `Household`, `Card`, `SignUpBonus`, `CardStatus`, `BonusType` interfaces/types
  - `constants.ts`: Define `STORAGE_KEYS`, `DEFAULT_HOUSEHOLD_ID`, `FEE_APPROACHING_DAYS`, `PROMO_EXPIRING_DAYS`
  - Use `export type` for all type exports
- **Edge Cases**: Money fields (`annualFee`, `creditLimit`, `signUpBonus.spendRequirement`) are stored as integer cents; display layer divides by 100
- **Definition of Done**: Both files have zero TypeScript errors

---

### Task 5: Write Storage Layer

- **File(s)**: `development/ledger/src/lib/storage.ts`
- **Depends on**: Task 4
- **Implementation Notes**:
  - All reads: parse JSON, validate schema version, return typed arrays
  - All writes: serialize to JSON, write to localStorage
  - `initializeDefaultHousehold()`: check for existence, create if missing
  - `migrateIfNeeded()`: called on module import, handles version 0 → 1
  - Wrap all `localStorage` calls in try/catch (guards against SSR context and QuotaExceededError)
- **Edge Cases**:
  - SSR context: `typeof window === "undefined"` check before any `localStorage` access
  - Corrupt data: if JSON.parse throws, log error and return empty array (don't crash)
  - QuotaExceededError: catch and rethrow with a user-friendly message
- **Definition of Done**: Storage functions work correctly in browser; no TypeScript errors

---

### Task 6: Write Card Utilities

- **File(s)**: `development/ledger/src/lib/card-utils.ts`
- **Depends on**: Task 4
- **Implementation Notes**:
  - `computeCardStatus(card: Card, today?: Date): CardStatus` — pure function, deterministic
  - `formatCurrency(cents: number): string` — formats integer cents as "$X.XX"
  - `formatDate(isoDate: string): string` — formats ISO date as "Jan 15, 2026"
  - `daysUntil(isoDate: string, today?: Date): number` — days until a future date
- **Edge Cases**:
  - `computeCardStatus`: if card is closed, return `"closed"` regardless of dates
  - `daysUntil`: negative values mean the date is in the past
  - `formatDate`: handle empty string input gracefully (return empty string)
- **Definition of Done**: Functions are pure, fully typed, and handle edge cases

---

### Task 7: Build CardForm Component

- **File(s)**: `development/ledger/src/components/cards/CardForm.tsx`
- **Depends on**: Tasks 2, 3, 4, 5, 6
- **Implementation Notes**:
  - `"use client"` directive at top
  - Props: `initialValues?: Card`, `onSuccess: () => void`
  - Zod schema validates all required fields and date formats
  - Sign-up bonus section is conditionally shown/hidden with a checkbox toggle
  - Submit: generate UUID for new cards, compute status, save via `storage.ts`, call `onSuccess`
  - Delete button visible only in edit mode, shows confirmation Dialog before deleting
  - All money inputs show dollar amounts in the form but store/read cents in the data model
- **Edge Cases**:
  - New card: generate ID with `crypto.randomUUID()`
  - Edit card: preserve original `id`, `householdId`, `createdAt`
  - Date inputs: HTML `<input type="date">` returns YYYY-MM-DD strings natively — matches our storage format
- **Definition of Done**: Form renders, validates, saves, and redirects correctly in both add and edit modes

---

### Task 8: Build Dashboard Components

- **File(s)**: `development/ledger/src/components/dashboard/Dashboard.tsx`, `CardTile.tsx`, `StatusBadge.tsx`, `EmptyState.tsx`
- **Depends on**: Tasks 2, 4, 6
- **Implementation Notes**:
  - `Dashboard.tsx`: `"use client"`, receives `cards: Card[]` as props, renders grid + summary header
  - `CardTile.tsx`: clicking navigates to `/cards/[id]/edit` using `next/navigation`'s `useRouter`
  - `StatusBadge.tsx`: maps `CardStatus` to color class and label
  - `EmptyState.tsx`: shown when `cards.length === 0`, includes a "Add your first card" button
  - Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- **Edge Cases**:
  - Dashboard must not crash if localStorage has no cards key (returns empty array from storage)
  - Cards with no annual fee date should not show "Fee Approaching" (check for nullish date)
- **Definition of Done**: Dashboard renders all cards, empty state shows when no cards exist

---

### Task 9: Wire Up Pages

- **File(s)**: `development/ledger/src/app/page.tsx`, `development/ledger/src/app/cards/new/page.tsx`, `development/ledger/src/app/cards/[id]/edit/page.tsx`
- **Depends on**: Tasks 7, 8
- **Implementation Notes**:
  - `page.tsx` (dashboard): `"use client"`, `useEffect` to load cards on mount, render `<Dashboard cards={cards} />`
  - `cards/new/page.tsx`: `"use client"`, render `<CardForm onSuccess={() => router.push("/")} />`
  - `cards/[id]/edit/page.tsx`: `"use client"`, read `params.id`, load card from storage, render `<CardForm initialValues={card} onSuccess={() => router.push("/")} />`
  - Add a navigation header: app name "Fenrir Ledger" + "Add Card" button
- **Edge Cases**:
  - Edit page: if card with `params.id` not found in storage, redirect to `/`
  - All pages: call `initializeDefaultHousehold()` on mount (idempotent — safe to call multiple times)
- **Definition of Done**: Full CRUD flow works end-to-end in browser

---

### Task 10: Write Setup Script

- **File(s)**: `development/scripts/setup-local.sh`
- **Depends on**: Task 1
- **Implementation Notes**:
  - Bash script, executable (`chmod +x`)
  - Checks Node.js >= 18 and npm availability
  - Runs `npm ci` (or `npm install` if no lockfile)
  - Copies `.env.example` to `.env.local` if `.env.local` doesn't exist
  - Prints next steps: `cd development/ledger && npm run dev`
  - Idempotent: running twice produces same result
- **Edge Cases**:
  - Node version check: parse major version from `node --version` output
  - If npm install fails, print error message and exit with non-zero code
- **Definition of Done**: Script runs to completion on a clean macOS/Linux system; app starts after following printed instructions

---

### Task 11: Create .env.example

- **File(s)**: `development/ledger/.env.example`
- **Depends on**: Task 1
- **Implementation Notes**:
  - Sprint 1 has no secrets. The file serves as documentation and a template.
  - Add a comment explaining the file's purpose
  - Add `NEXT_PUBLIC_APP_VERSION=1.0.0-sprint1` as a non-secret example
- **Edge Cases**: Ensure `.env.local` and `.env` are in `.gitignore` (Next.js default `.gitignore` already includes these)
- **Definition of Done**: `.env.example` committed; `.env.local` is gitignored

---

### Task 12: Update README

- **File(s)**: `README.md`
- **Depends on**: All tasks
- **Implementation Notes**:
  - Update the FiremanDecko section with links to all Sprint 1 artifacts
  - Add a "Quick Start" section
  - Update status from "Sprint 1 not started" to "Sprint 1 complete"
- **Definition of Done**: README accurately describes the project state and links to all artifacts

---

## Known Limitations (Sprint 1)

| Limitation | Notes |
|-----------|-------|
| Single-device only | localStorage is browser-local; no sync across devices |
| No auth | Single implicit household; no user accounts |
| No reminders | Smart reminder engine is a future sprint feature |
| No timeline view | Dashboard only; timeline is a future sprint feature |
| No data export | Future sprint feature |
| No action recommendations | Future sprint feature |
| No reward tracking | Future sprint feature |
| Mobile-responsive but not a native app | Web app only in Sprint 1 |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_VERSION` | No | App version string for display |

Sprint 1 has no required environment variables. The `.env.example` file documents the template.

---

# Implementation Plan: Fenrir Ledger Sprint 2

Sprint 2 delivered the Saga Ledger design system (dark Nordic War Room aesthetic) and the Easter Eggs layer. All Sprint 1 features remain intact.

## Sprint 2 Tasks (ordered)

---

### Task 2.1: Saga Ledger Theme — Globals and Tailwind

- **File(s)**: `development/ledger/src/app/globals.css`, `development/ledger/tailwind.config.ts`
- **Depends on**: Sprint 1 complete
- **Implementation Notes**:
  - Replace shadcn/ui default CSS variables with Saga Ledger tokens (void-black `#07070d`, gold accent `#c9920a`, etc.)
  - Extend Tailwind with custom color palette and font families (Cinzel Decorative, Cinzel, Source Serif 4, JetBrains Mono)
  - Apply dark mode as default; no light mode toggle in Sprint 2
- **Definition of Done**: App renders with dark Norse War Room aesthetic at `http://localhost:9999`

---

### Task 2.2: App Shell — Layout Components

- **File(s)**: `development/ledger/src/components/layout/AppShell.tsx`, `SiteHeader.tsx`, `SideNav.tsx`, `TopBar.tsx`, `Footer.tsx`
- **Depends on**: Task 2.1
- **Implementation Notes**:
  - `AppShell.tsx` wraps all pages; provides sidebar + main content layout
  - `SiteHeader.tsx` — top-level brand header
  - `SideNav.tsx` — left navigation rail
  - `TopBar.tsx` — secondary top bar with utility actions
  - `Footer.tsx` — three-column footer; hosts easter egg trigger points
- **Definition of Done**: All pages render within the shell; no layout regressions on mobile

---

### Task 2.3: Easter Egg #4 — Console ASCII Art (FENRIR Runes)

- **File(s)**: `development/ledger/src/components/layout/ConsoleSignature.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Outputs Elder Futhark rune glyphs spelling ᚠᛖᚾᚱᛁᚱ (FENRIR) to browser console on app load
  - Each glyph is 8 chars wide, 7 lines tall, drawn with ASCII line art
  - Followed by a `runeLabel` line naming each rune
  - Use `\\` for literal backslashes in JS template literals
- **Definition of Done**: Opening browser console shows the FENRIR rune art

---

### Task 2.4: Easter Egg #5 — HTML Source Signature

- **File(s)**: `development/ledger/src/app/layout.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - JSDoc comment block injected into the HTML source
  - Visible only when viewing page source (Cmd+U / Ctrl+U)
- **Definition of Done**: Viewing page source reveals the signature comment

---

### Task 2.5: Easter Egg #7 — Runic Meta Tag Cipher

- **File(s)**: `development/ledger/src/app/layout.tsx`
- **Depends on**: Task 2.4
- **Implementation Notes**:
  - `metadata.other["fenrir:runes"]` contains an Elder Futhark encoded message
  - Rendered as a `<meta>` tag in the HTML head
- **Definition of Done**: `<meta name="fenrir:runes" ...>` present in page source

---

### Task 2.6: Easter Egg #2 — Konami Code Howl

- **File(s)**: `development/ledger/src/components/layout/KonamiHowl.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Listens for the Konami sequence: ↑↑↓↓←→←→BA
  - On match: displays a full-screen howl overlay animation
  - Wired into `AppShell.tsx`
- **Definition of Done**: Entering the Konami sequence triggers the howl overlay

---

### Task 2.7: Easter Egg #3 — Loki Mode

- **File(s)**: `development/ledger/src/components/layout/Footer.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Clicking the "Loki" span in the footer 7 times triggers Loki Mode
  - Effect: shuffles the card grid and displays random realm badges for 5 seconds
- **Definition of Done**: Seven rapid clicks on "Loki" in the footer triggers the shuffle

---

### Task 2.8: Easter Egg #1 Fragments — Gleipnir Hunt

- **File(s)**: `development/ledger/src/components/cards/GleipnirFishBreath.tsx`, `GleipnirMountainRoots.tsx`, `GleipnirCatFootfall.tsx`, `GleipnirBirdSpittle.tsx`, `GleipnirBearSinews.tsx`, `GleipnirWomansBeard.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Six fragment components, each representing one ingredient of Gleipnir
  - Fragment 5 (Fish Breath) triggered by hovering the footer copyright (©)
  - Each fragment uses the shared `EasterEggModal` component
- **Definition of Done**: Hovering © in footer reveals Fish Breath modal; other fragments have trigger points wired

---

### Task 2.9: Shared Easter Egg Modal

- **File(s)**: `development/ledger/src/components/easter-eggs/EasterEggModal.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Reusable modal wrapper for all Gleipnir fragment reveals
  - Accepts title, rune, and content as props
  - Handles open/close state; accessible via keyboard
- **Definition of Done**: All Gleipnir fragments render correctly through this modal

---

### Task 2.10: Forgemaster Easter Egg

- **File(s)**: `development/ledger/src/components/layout/ForgeMasterEgg.tsx`
- **Depends on**: Task 2.9
- **Implementation Notes**:
  - Extracted from Footer.tsx into its own component for clarity
  - Wired into the app shell footer area
- **Definition of Done**: Forgemaster egg triggers and displays correctly

---

### Task 2.11: Supporting Layout Components

- **File(s)**: `development/ledger/src/components/layout/AboutModal.tsx`, `SyncIndicator.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - `AboutModal.tsx` — "About" dialog accessible from the nav
  - `SyncIndicator.tsx` — visual indicator for data sync state (future use; renders idle state in Sprint 2)
- **Definition of Done**: About modal opens and closes correctly; SyncIndicator renders without errors

## Known Limitations (Sprint 2)

| Limitation | Notes |
|-----------|-------|
| All Sprint 1 limitations | Carry forward unchanged |
| No Framer Motion animations | Motion planned for Sprint 3 (saga-enter stagger, StatusRing, HowlPanel) |
| No Valhalla route | Closed cards archive planned for Sprint 3 |
| Gleipnir Hunt incomplete | Not all 6 fragment trigger points are fully wired; tracked in QA handoff |

---

# Implementation Plan: Fenrir Ledger Sprint 3 — Story 3.2

## Story 3.2: Norse Copy Pass + `getRealmLabel()`

### Prerequisites

- Sprint 2 complete (Saga Ledger theme, App Shell, Easter Eggs layer)
- `product/mythology-map.md` and `product/copywriting.md` reviewed

### Tasks (ordered)

---

### Task 3.2.1: Create `realm-utils.ts`

- **File(s)**: `development/ledger/src/lib/realm-utils.ts`
- **Depends on**: Nothing (pure utility, no component dependencies)
- **Implementation Notes**:
  - `getRealmLabel(status: CardStatus): string` — returns Norse realm name for each status
    - `active` → `"Asgard"`
    - `fee_approaching` → `"Muspelheim"`
    - `promo_expiring` → `"Jötunheimr"`
    - `closed` → `"Valhalla"`
  - `getRealmDescription(status: CardStatus): string` — returns atmospheric tooltip copy
  - Both functions are switch-exhaustive over `CardStatus`; TypeScript enforces coverage
  - No default branch — intentional: TypeScript will error if a new status is added but not handled
- **Edge Cases**: New `CardStatus` values added in future sprints must have entries here; omitting them causes a TypeScript compile error (desired)
- **Definition of Done**: File exists, both functions exported, `npm run build` passes

---

### Task 3.2.2: Wire `realm-utils.ts` into `constants.ts`

- **File(s)**: `development/ledger/src/lib/constants.ts`
- **Depends on**: Task 3.2.1
- **Implementation Notes**:
  - `STATUS_TOOLTIPS` record delegates to `getRealmDescription()` instead of duplicating strings
  - Type tightened from `Record<string, string>` to `Record<CardStatus, string>`
  - This ensures `STATUS_TOOLTIPS` always stays in sync with `realm-utils.ts`
- **Edge Cases**: Circular import — `realm-utils.ts` must NOT import from `constants.ts`
- **Definition of Done**: `constants.ts` compiles; `STATUS_TOOLTIPS` values match `getRealmDescription()` output

---

### Task 3.2.3: Update `StatusBadge.tsx` to use `realm-utils.ts`

- **File(s)**: `development/ledger/src/components/dashboard/StatusBadge.tsx`
- **Depends on**: Task 3.2.1
- **Implementation Notes**:
  - Replace `STATUS_TOOLTIPS[status]` lookup with direct call to `getRealmDescription(status)`
  - Badge label remains `STATUS_LABELS[status]` (Voice 1: functional, plain English)
  - Loki Mode `lokiLabel` override still works — it only replaces the label, not the tooltip
- **Edge Cases**: `lokiLabel` is display-only; tooltip always shows realm description regardless
- **Definition of Done**: Tooltip on each badge shows atmospheric realm copy; no regression in badge colors or labels

---

### Task 3.2.4: Norse Copy Pass — Empty State, Page Headings, Loading States

- **File(s)**:
  - `development/ledger/src/components/dashboard/EmptyState.tsx`
  - `development/ledger/src/app/page.tsx`
  - `development/ledger/src/app/cards/new/page.tsx`
  - `development/ledger/src/app/cards/[id]/edit/page.tsx`
- **Depends on**: Nothing (copy-only changes)
- **Implementation Notes**:
  - `EmptyState.tsx`: heading → "Before Gleipnir was forged, Fenrir roamed free." / body → "Before your first card is added, no chain can be broken." (from `copywriting.md` no-cards empty state)
  - `page.tsx` heading: "Cards" → "The Ledger of Fates" (from `copywriting.md` navigation labels)
  - `page.tsx` loading: "Loading..." → "The Norns are weaving..."
  - `cards/new/page.tsx` heading: "Add New Card" → "Forge a New Chain" / subhead: "Add a card to your portfolio."
  - `cards/[id]/edit/page.tsx` heading: "Edit Card" → `{card.cardName}` / subhead: "Card record" / loading: "Consulting the runes..."
  - All button labels unchanged (Voice 1: functional)
  - All form field labels unchanged (Voice 1: functional)
- **Edge Cases**: Long card names in the edit page heading — existing `font-display` truncates gracefully; no change needed
- **Definition of Done**: All changed text matches `copywriting.md` canonical copy exactly

---

### Task 3.2.5: Build Verification

- **File(s)**: N/A (verification step)
- **Depends on**: Tasks 3.2.1–3.2.4
- **Implementation Notes**:
  - `cd development/ledger && npm run build`
  - Zero TypeScript errors, zero lint errors
- **Definition of Done**: `npm run build` completes with no errors

---

## Known Limitations (Sprint 3 — Story 3.2)

| Limitation | Notes |
|-----------|-------|
| All Sprint 1 + Sprint 2 limitations | Carry forward unchanged |
| Realm labels not shown on primary badges | By design — Voice 1 rule; realm names are tooltip/atmospheric only |
| No per-card sub-realm differentiation | `active` maps to one realm; Vanaheim/Midgard/Asgard sub-states are future work |

---

# Implementation Plan: Fenrir Ledger Sprint 3 — Story 3.3

## Story 3.3: Framer Motion + Card Animations

### Prerequisites

- Sprint 3, Story 3.2 complete (realm-utils, Norse copy pass)
- `framer-motion` installed as a production dependency
- `ux/interactions.md` reviewed — animation specs and timings

### Tasks (ordered)

---

### Task 3.3.1: Install framer-motion

- **File(s)**: `development/ledger/package.json`, `development/ledger/package-lock.json`
- **Depends on**: Nothing
- **Implementation Notes**:
  - `cd development/ledger && npm install framer-motion`
  - Installs as a production dependency (not devDependency)
  - All Framer Motion components must be in `"use client"` boundaries (per ADR-001)
- **Definition of Done**: `framer-motion` appears in `dependencies` in `package.json`; `npm run build` passes

---

### Task 3.3.2: Add `saga-shimmer` CSS keyframe to globals.css

- **File(s)**: `development/ledger/src/app/globals.css`
- **Depends on**: Nothing
- **Implementation Notes**:
  - Add `@keyframes saga-shimmer` and `.skeleton` class
  - Gradient: `#0f1018 → #1e2235 → #2a2d45 → #1e2235 → #0f1018` (gold-tinted Norse palette)
  - `background-size: 800px 100%` with `animation: saga-shimmer 1.4s ease-in-out infinite`
  - Spec from `ux/interactions.md` — Loading States section
- **Edge Cases**: Gradient colors must be hex literals (not CSS variables) to allow background-position animation
- **Definition of Done**: `.skeleton` class animates a gold shimmer in the browser

---

### Task 3.3.3: Create `CardSkeletonGrid` component

- **File(s)**: `development/ledger/src/components/dashboard/CardSkeletonGrid.tsx`
- **Depends on**: Task 3.3.2
- **Implementation Notes**:
  - Pure client component (`"use client"`)
  - `CardSkeletonGrid({ count = 6 })` — renders `count` skeleton tiles in the card grid layout
  - `SkeletonTile` — structural mirror of `CardTile` with `.skeleton` divs replacing data
  - Includes summary header skeleton and "The Norns are weaving..." caption beneath grid
  - Grid breakpoints match real card grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
  - No external library dependencies — CSS animation only
- **Edge Cases**: `count` should default to 6 (two rows on desktop); do not render more than 12
- **Definition of Done**: Component renders a shimmer skeleton grid that structurally matches the real card grid

---

### Task 3.3.4: Create `AnimatedCardGrid` component

- **File(s)**: `development/ledger/src/components/dashboard/AnimatedCardGrid.tsx`
- **Depends on**: Task 3.3.1
- **Implementation Notes**:
  - `"use client"` directive required (Framer Motion)
  - Uses `AnimatePresence mode="popLayout"` + `motion.div` with `variants`
  - Per-card variant factory `makeCardVariants(staggerDelay)` returns:
    - `hidden`: `opacity:0, y:20, scale:1`
    - `visible`: `opacity:1, y:0, scale:1` with stagger delay + expo-out easing
    - `exit`: `opacity:0, y:24, scale:0.95, filter:"sepia(1) brightness(0.4)"` duration 0.5s ease-in
  - Stagger: `index * 0.07s`, capped at 0.56s (8 cards) to prevent sluggish feeling on large portfolios
  - `layout` prop on `motion.div` enables smooth grid reflow when a card is deleted
  - `renderCard` prop pattern avoids prop drilling; renders any card node
- **Edge Cases**:
  - Variant factory pattern (not inline initial/animate/exit + transition) required to give enter and exit different durations — `exit` is not a valid key in Framer Motion's per-property `Transition` type
  - `filter` exit value is a valid CSS filter string; Framer Motion forwards it to inline style
- **Definition of Done**: Cards stagger in on load; deleted card descends with sepia fade before DOM removal

---

### Task 3.3.5: Wire `AnimatedCardGrid` into `Dashboard.tsx`

- **File(s)**: `development/ledger/src/components/dashboard/Dashboard.tsx`
- **Depends on**: Task 3.3.4
- **Implementation Notes**:
  - Replace the raw `<div className="grid ...">` with `<AnimatedCardGrid>`
  - `renderCard` callback passes `card` and `lokiLabel` to `CardTile` — Loki Mode unaffected
  - Remove `key` from `CardTile` (now owned by `motion.div` in `AnimatedCardGrid`)
- **Edge Cases**: `AnimatedCardGrid` must receive the same `displayCards` (loki-shuffled or normal) — no change to Loki Mode logic
- **Definition of Done**: Dashboard renders animated grid; Loki Mode still works

---

### Task 3.3.6: Wire `CardSkeletonGrid` into `page.tsx`

- **File(s)**: `development/ledger/src/app/page.tsx`
- **Depends on**: Task 3.3.3
- **Implementation Notes**:
  - Replace `isLoading` branch (plain "The Norns are weaving..." div) with `<CardSkeletonGrid count={6} />`
  - Remove the `.saga-reveal` wrapper div from the loaded branch — Framer Motion handles stagger now
  - The "The Norns are weaving..." copy moves to a caption inside `CardSkeletonGrid`
- **Edge Cases**: `.saga-reveal` CSS class remains in `globals.css` (used elsewhere potentially); only the wrapper div in `page.tsx` is removed
- **Definition of Done**: Dashboard page shows shimmer skeleton during load, then transitions to animated card grid

---

### Task 3.3.7: Build Verification

- **File(s)**: N/A (verification step)
- **Depends on**: Tasks 3.3.1–3.3.6
- **Implementation Notes**:
  - `cd development/ledger && npm run build`
  - Zero TypeScript errors, zero lint errors
- **Definition of Done**: `npm run build` completes with no errors

---

## Known Limitations (Sprint 3 — Story 3.3)

| Limitation | Notes |
|-----------|-------|
| All Sprint 1 + Sprint 2 + Story 3.2 limitations | Carry forward unchanged |
| Skeleton loading window is very brief on fast devices | localStorage read is synchronous; skeleton may flash for < 1 frame — acceptable |
| Tiwaz rune (ᛏ) placeholder after Valhalla exit not implemented | Spec mentions a brief ᛏ rune where the card was; deferred to S3/S4 easter egg layer |
| No `prefers-reduced-motion` guard on card animations | Framer Motion respects `useReducedMotion` hook; not wired in this story — future work |

---

# Implementation Plan: Fenrir Ledger Sprint 3 — Story 3.5

## Story 3.5: Valhalla Archive + Close Card Action

### Prerequisites

- Sprint 3, Stories 3.2 and 3.3 complete (realm-utils, Framer Motion animations)
- `development/ledger/src/lib/types.ts` — `Card` interface reviewed
- `development/ledger/src/lib/storage.ts` — existing CRUD functions reviewed
- `ux/wireframes/valhalla.html`, `product/copywriting.md`, `ux/interactions.md` reviewed

### Tasks (ordered)

---

### Task 3.5.1: Add `closedAt` field to `Card` type

- **File(s)**: `development/ledger/src/lib/types.ts`
- **Depends on**: Nothing
- **Implementation Notes**:
  - Add `closedAt?: string` (UTC ISO 8601 timestamp) to the `Card` interface
  - JSDoc: records when the user explicitly closed the card via "Close Card" action
  - Distinct from `deletedAt`: a closed card is honored in Valhalla; a deleted card is gone forever
  - No schema migration needed — absent field === undefined === not closed (same pattern as `deletedAt`)
- **Edge Cases**: Existing cards without `closedAt` still show in Valhalla if `status === "closed"` (set via edit form)
- **Definition of Done**: Field added, JSDoc written, `npm run build` passes

---

### Task 3.5.2: Add `closeCard()` and `getClosedCards()` to `storage.ts`

- **File(s)**: `development/ledger/src/lib/storage.ts`
- **Depends on**: Task 3.5.1
- **Implementation Notes**:
  - `closeCard(householdId, cardId)`:
    - Finds card by ID + householdId (scope check)
    - No-op if card is soft-deleted (`deletedAt` set), already closed, or not found
    - Sets `card.status = "closed"`, `card.closedAt = now`, `card.updatedAt = now`
    - Calls `setAllCards()` directly (bypasses `saveCard()` to avoid `computeCardStatus()` overriding the "closed" status — though `computeCardStatus` already short-circuits on "closed")
  - `getClosedCards(householdId)`:
    - Returns all non-deleted cards for the household with `status === "closed"`
    - Sorted by `closedAt` desc (falls back to `updatedAt` for cards without `closedAt`)
  - `getCards(householdId)` modified:
    - Now excludes `status === "closed"` cards — they belong in Valhalla, not the active dashboard
- **Edge Cases**:
  - A card manually set to `status: "closed"` via the edit form before this story will appear in Valhalla (no `closedAt` set, but `status === "closed"` is the filter)
  - `getClosedCards` must NOT return soft-deleted cards (same `!c.deletedAt` guard as `getCards`)
- **Definition of Done**: `closeCard()` and `getClosedCards()` exported; `getCards()` excludes closed; `npm run build` passes

---

### Task 3.5.3: Verify `computeCardStatus()` — "closed" short-circuit

- **File(s)**: `development/ledger/src/lib/card-utils.ts` (read-only verification)
- **Depends on**: Nothing
- **Implementation Notes**:
  - `computeCardStatus()` already checks `card.status === "closed"` first and returns "closed" immediately
  - No date logic can override a closed card — confirmed correct
  - `saveCard()` calls `computeCardStatus()` which preserves "closed" — confirmed correct
- **Edge Cases**: None — logic already correct as implemented in Story 1.2
- **Definition of Done**: No changes needed; confirmed via code review and build

---

### Task 3.5.4: Add "Close Card" action to `CardForm.tsx`

- **File(s)**: `development/ledger/src/components/cards/CardForm.tsx`
- **Depends on**: Task 3.5.2
- **Implementation Notes**:
  - Import `closeCard` from `@/lib/storage`
  - Add `closeDialogOpen` state alongside `deleteDialogOpen`
  - Add `handleClose()` handler: calls `closeCard(householdId, cardId)`, routes to `/`
  - "Close Card" button visible in edit mode only, AND only when card is NOT already closed
    (`initialValues?.status !== "closed"`)
  - Confirmation dialog per `product/copywriting.md` — "Close this card?" / body references card name and preservation in Closed Cards
  - Button label: "Close Card" (Voice 1: functional)
  - Dialog action button label: "Close Card"
  - For already-closed cards: only the "Delete" button is shown (no close button — card is already closed)
  - Placed in the actions row, to the left of "Delete card" (less destructive → more destructive order)
- **Edge Cases**:
  - Must not show Close button for cards already `status: "closed"` — they're in Valhalla
  - `initialValues?.householdId` must be passed to `closeCard()`; if undefined, handler no-ops
- **Definition of Done**: Edit form shows "Close Card" button for active cards; confirmation dialog works; card moves to Valhalla after confirmation

---

### Task 3.5.5: Create `/valhalla` route — `app/valhalla/page.tsx`

- **File(s)**: `development/ledger/src/app/valhalla/page.tsx` (new)
- **Depends on**: Task 3.5.2
- **Implementation Notes**:
  - `"use client"` — localStorage read happens client-side
  - On mount: `migrateIfNeeded()`, `initializeDefaultHousehold()`, `getClosedCards(DEFAULT_HOUSEHOLD_ID)`
  - Page title: "Valhalla — Fenrir Ledger" (handled by Next.js metadata — not wired in this story; page heading is sufficient)
  - Page heading: "Valhalla" (Voice 2: atmospheric, gold, Cinzel Display)
  - Subheading: "Hall of the Honored Dead" (italic, muted)
  - Quote: "Here lie the chain-breakers. Their rewards were harvested." (atmospheric, italic)
  - Sepia tint: `style={{ filter: "sepia(0.15) brightness(0.95)" }}` on outermost wrapper div
  - Filter bar (shown only when closed cards exist):
    - Issuer dropdown — derived from unique issuers in closed cards; "All issuers" default
    - Sort dropdown — closed date desc/asc, alpha A→Z, alpha Z→A
  - TombstoneCard component (per card):
    - `border-l-4 border-l-[#8a8578]` (stone-hel left accent per wireframe)
    - `ᛏ` Tiwaz rune (aria-hidden, title="Valhalla")
    - Card name (uppercase, Cinzel heading)
    - Closed date (font-mono, muted)
    - Meta line: issuer · Opened {date} · Held {duration}
    - Hairline rule
    - Plunder grid: Rewards (bonus summary if present) + Fee avoided rows
    - Epitaph (atmospheric italic: fee avoided message)
  - Framer Motion `motion.article` with saga-enter stagger (same constants as `AnimatedCardGrid`)
  - Empty state: `ValhallaEmptyState` — ᛏ rune, heading, body (from `copywriting.md`)
    - `aria-description="the spittle of a bird"` — Gleipnir Hunt fragment #6 hidden attribute
  - Filter no-results state: "No cards bear this issuer's mark." (from `copywriting.md`)
  - Loading state: "Consulting the runes..." (atmospheric)
  - `max-w-3xl` column width — narrower than dashboard per wireframe spec
- **Edge Cases**:
  - Cards closed before `closedAt` field existed show "—" for closed date; `formatHeldDuration` handles missing `closedAt` gracefully
  - `issuerFilter` resets visually but not programmatically on card list change — acceptable for Sprint 3
- **Definition of Done**: Page renders at `/valhalla`; all closed cards shown; filter/sort work; empty state correct; `npm run build` passes

---

### Task 3.5.6: Add Valhalla nav link to `SideNav.tsx`

- **File(s)**: `development/ledger/src/components/layout/SideNav.tsx`
- **Depends on**: Task 3.5.5
- **Implementation Notes**:
  - Add `RuneIcon` helper component: renders an Elder Futhark rune glyph in a `<span>` sized to match the 16×16 Lucide icon footprint
  - Extend `NavItem` interface with optional `iconNode?: React.ReactNode` field — used when a custom icon replaces the standard Lucide `icon` component
  - Add nav item: `{ label: "Valhalla", href: "/valhalla", icon: CreditCard, iconNode: <RuneIcon rune="ᛏ" /> }`
  - Nav item render: if `iconNode` is present, render it instead of `<Icon className="h-4 w-4 shrink-0" />`
  - Active state highlighting (gold left border) works via `pathname === item.href` — no change needed
  - Collapsed state (icon-only rail): native `title` tooltip shows "Valhalla" — no change needed
- **Edge Cases**: `iconNode` is rendered outside the `Lucide Icon` pattern; it must match the same visual footprint (h-4 w-4 shrink-0) so collapsed/expanded nav item alignment stays consistent
- **Definition of Done**: "Valhalla" nav item with ᛏ rune icon appears in sidebar; clicking navigates to `/valhalla`; active state highlights correctly; collapsed state shows rune in tooltip

---

### Task 3.5.7: Build Verification

- **File(s)**: N/A (verification step)
- **Depends on**: Tasks 3.5.1–3.5.6
- **Implementation Notes**:
  - `cd development/ledger && npm run build`
  - Zero TypeScript errors, zero lint errors
  - All 7 routes present in build output: `/`, `/_not-found`, `/cards/[id]/edit`, `/cards/new`, `/icon.svg`, `/valhalla`, plus any existing routes
- **Definition of Done**: `npm run build` completes with no errors; `/valhalla` route present in build output

---

## Known Limitations (Sprint 3 — Story 3.5)

| Limitation | Notes |
|-----------|-------|
| All prior sprint limitations | Carry forward unchanged |
| No Valhalla metadata (`<title>` tag) | Next.js `export const metadata` requires a server component; the page is `"use client"` for localStorage. Title deferred to Sprint 4 when a server wrapper can be added. |
| No "View full record" action on tombstones | Wireframe shows a "View full record" button; deferred — edit route at `/cards/[id]/edit` would need to render closed-card data which requires updating the edit page guard. Sprint 4 work. |
| No reward tracking totals in plunder | Plunder section shows fee avoided and bonus summary but not a computed "net gain" — accurate totals require reward value tracking (future sprint). |
| `closedAt` absent on cards closed via the old status dropdown | Cards manually set to `status: "closed"` before this story have no `closedAt`; they appear in Valhalla but show "—" for closed date. Acceptable. |
| Gleipnir fragment #6 (`aria-description`) not yet wired to hunt mechanic | The `aria-description` attribute on the empty state carries the fragment text but the Gleipnir Hunt detection system is Sprint 4 work. |
| `prefers-reduced-motion` not guarded | Framer Motion `useReducedMotion` hook not wired — deferred from Story 3.3, still open. |

---

# Implementation Plan: Fenrir Ledger Sprint 3 — Story 3.1

## Story 3.1: Google OIDC Auth (Auth.js v5 + localStorage scoped to householdId)

### Prerequisites

- Sprint 3, Stories 3.2, 3.3, and 3.5 complete
- Google Cloud project with OAuth consent screen configured
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `AUTH_URL` in `.env.local`

### Tasks (ordered)

---

### Task 3.1.1: Write ADR-004

- **File(s)**: `architecture/adrs/ADR-004-oidc-auth-localStorage.md`
- **Depends on**: Nothing
- **Implementation Notes**:
  - Documents five sub-decisions: auth library (Auth.js v5), session strategy (JWT), householdId derivation (Google sub), localStorage key namespacing (per-household), GKE preview deployment approach
  - Auth.js v5 chosen over Clerk (vendor lock-in), Lucia (needs DB), custom OAuth (security risk)
  - JWT strategy chosen over DB sessions (no additional infrastructure)
  - `sub` claim chosen as householdId for stability across email/name changes
  - Per-household keys (`fenrir_ledger:{householdId}:cards`) chosen over flat keys
- **Definition of Done**: ADR-004 file exists; covers all five sub-decisions

---

### Task 3.1.2: Install next-auth@beta

- **File(s)**: `development/ledger/package.json`, `development/ledger/package-lock.json`
- **Depends on**: Nothing
- **Implementation Notes**:
  - `cd development/ledger && npm install next-auth@beta`
  - Installs as a production dependency
- **Definition of Done**: `next-auth` at version `^5.0.0-beta.x` in `dependencies`

---

### Task 3.1.3: Create `auth.ts` and API route handler

- **File(s)**:
  - `development/ledger/src/auth.ts`
  - `development/ledger/src/app/api/auth/[...nextauth]/route.ts`
  - `development/ledger/next-auth.d.ts` (TypeScript augmentation — project root, not `src/`)
- **Depends on**: Task 3.1.2
- **Implementation Notes**:
  - `auth.ts`: Google provider, `session: { strategy: "jwt" }`, JWT callback embeds `token.householdId = profile.sub`, session callback surfaces `session.user.householdId`
  - `route.ts`: re-exports `{ GET, POST } = handlers` from `@/auth`
  - `next-auth.d.ts`: augments `@auth/core/types` Session and User interfaces; augments `next-auth/jwt` JWT interface
  - Type augmentation file must live at project root (not in `src/`) for the tsconfig `include` patterns to pick it up at compile time
- **Edge Cases**: `auth.d.ts` inside `src/` is not reliably picked up by the bundler compilation; the project-root placement is required
- **Definition of Done**: `npm run build` passes; `session.user.householdId` is typed correctly

---

### Task 3.1.4: Create `AuthProvider.tsx` and wrap root layout

- **File(s)**:
  - `development/ledger/src/components/layout/AuthProvider.tsx`
  - `development/ledger/src/app/layout.tsx` (modified)
- **Depends on**: Task 3.1.3
- **Implementation Notes**:
  - `AuthProvider.tsx`: thin `"use client"` wrapper around `SessionProvider` from `next-auth/react`
  - `layout.tsx`: wraps `<AppShell>` and `<ConsoleSignature>` inside `<AuthProvider>`
  - Required because `SessionProvider` uses React Context — must be a client component
  - The root layout is a Server Component; `AuthProvider` is the client boundary
- **Definition of Done**: All pages that call `useSession()` have a `SessionProvider` ancestor

---

### Task 3.1.5: Create middleware for route protection

- **File(s)**: `development/ledger/src/middleware.ts`
- **Depends on**: Task 3.1.3
- **Implementation Notes**:
  - Uses Auth.js `auth()` as the middleware wrapper
  - `/api/auth/*` passes through without auth check
  - All other routes: if no session, redirect to `/api/auth/signin?callbackUrl=...`
  - Matcher excludes Next.js internals, static assets, and image files
  - `AUTH_TRUST_HOST=true` in env allows preview deployments to not reject the dynamic hostname
- **Edge Cases**: Sign-in redirect must include the `callbackUrl` parameter so users land back on the originally requested page after Google authentication
- **Definition of Done**: Unauthenticated requests to `/`, `/cards/new`, `/valhalla` redirect to Google sign-in

---

### Task 3.1.6: Refactor `storage.ts` — per-household keys

- **File(s)**: `development/ledger/src/lib/storage.ts`, `development/ledger/src/lib/constants.ts`
- **Depends on**: Nothing (independent of auth wiring)
- **Implementation Notes**:
  - New private key builders: `cardsKey(householdId)` → `fenrir_ledger:{householdId}:cards`, `householdKey(householdId)` → `fenrir_ledger:{householdId}:household`
  - Schema version key remains global: `fenrir_ledger:schema_version`
  - `getAllCards(householdId)` and `setAllCards(householdId, cards)` now take `householdId` as first argument
  - `deleteCard` signature changes from `(id)` to `(householdId, id)`
  - `getCardById` signature changes from `(id)` to `(householdId, id)`
  - `getAllCardsGlobal` signature changes from `()` to `(householdId)` (easter egg compatibility)
  - `initializeDefaultHousehold()` replaced by `initializeHousehold(householdId)`
  - `constants.ts`: `DEFAULT_HOUSEHOLD_ID` and `DEFAULT_HOUSEHOLD` removed; `STORAGE_KEYS` reduced to `SCHEMA_VERSION` only
  - Old flat keys (`fenrir_ledger:cards`, `fenrir_ledger:households`) abandoned — no migration (no real users)
- **Edge Cases**: `getHouseholds()` retained for API compatibility but returns `[]` — callers should use `initializeHousehold()` directly
- **Definition of Done**: `npm run build` passes; no references to `DEFAULT_HOUSEHOLD_ID` remain

---

### Task 3.1.7: Thread `householdId` from session through all pages and components

- **File(s)**:
  - `development/ledger/src/app/page.tsx`
  - `development/ledger/src/app/valhalla/page.tsx`
  - `development/ledger/src/app/cards/new/page.tsx`
  - `development/ledger/src/app/cards/[id]/edit/page.tsx`
  - `development/ledger/src/components/cards/CardForm.tsx`
  - `development/ledger/src/components/layout/KonamiHowl.tsx`
  - `development/ledger/src/components/layout/TopBar.tsx`
- **Depends on**: Tasks 3.1.4, 3.1.6
- **Implementation Notes**:
  - All pages: `const { data: session, status } = useSession()` to get `householdId`; `useEffect` waits for `status !== "loading"` before reading localStorage
  - `CardForm.tsx`: `householdId` added as required prop; `DEFAULT_HOUSEHOLD_ID` import removed; `deleteCard(householdId, id)` updated to new signature
  - `KonamiHowl.tsx`: `useSession()` to get householdId for `getAllCardsGlobal(householdId)`
  - `TopBar.tsx`: `useSession()` to get user name for display; `signOut()` for logout
  - Pages render `<CardForm householdId={householdId} />` only when householdId is available
- **Edge Cases**: Pages must show loading skeleton while `status === "loading"` to avoid a flash of empty state before session resolves
- **Definition of Done**: No uses of `DEFAULT_HOUSEHOLD_ID` remain; all storage calls pass `householdId` from session

---

### Task 3.1.8: Update `.env.example`

- **File(s)**: `development/ledger/.env.example`
- **Depends on**: Task 3.1.3
- **Implementation Notes**:
  - Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`
  - Include setup instructions for Google Cloud Console credentials
  - Include the correct callback URL format for both local dev and production
- **Definition of Done**: `.env.example` committed; `.env.local` is gitignored

---

### Task 3.1.9: Build verification

- **File(s)**: N/A (verification step)
- **Depends on**: Tasks 3.1.1–3.1.8
- **Implementation Notes**:
  - `cd development/ledger && npm run build`
  - Zero TypeScript errors, zero lint errors
  - Build output must include `/api/auth/[...nextauth]` route
- **Definition of Done**: `npm run build` completes with no errors; all 7 routes present

---

## Known Limitations (Sprint 3 — Story 3.1)

| Limitation | Notes |
|-----------|-------|
| Google OAuth only works on production domain | Preview GKE deployments cannot complete the OAuth flow (no dynamic redirect URI support in Google Console). `AUTH_TRUST_HOST=true` mitigates the host validation issue but the redirect URI mismatch remains. |
| No sign-in page UI | Auth.js redirects directly to Google's hosted consent screen. No custom branded sign-in page. |
| Old flat-key localStorage data orphaned | Data written by Sprints 1–2 under `fenrir_ledger:cards` is unreachable after this change. Acceptable — no production users. |
| JWT cannot be individually revoked | Revoking access requires signing out of Google or waiting for token expiry. Acceptable for a personal tool. |
| `householdId` is opaque in DevTools | The Google `sub` value (e.g. "115304845638166398388") is not human-readable in localStorage DevTools. Acceptable. |
