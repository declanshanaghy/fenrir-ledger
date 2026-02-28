# Implementation Plan: Fenrir Ledger Sprint 1

## Prerequisites

- Node.js >= 18 (check: `node --version`)
- npm >= 9 (check: `npm --version`)
- Git configured with remote `origin` pointing to the GitHub repo
- Terminal with bash or zsh

## Tasks (ordered)

---

### Task 1: Scaffold Next.js Project

- **File(s)**: All files under `development/src/`
- **Depends on**: Nothing
- **Implementation Notes**:
  - Run from `development/src/`:
    ```bash
    npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
    ```
  - This creates: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `src/app/`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
  - Verify with `npm run dev` — app should start at `http://localhost:3000`
- **Edge Cases**: If `development/src/` has a `.gitkeep` file, remove it first
- **Definition of Done**: `npm run dev` starts without errors; visiting `http://localhost:3000` shows the Next.js default page

---

### Task 2: Initialize shadcn/ui

- **File(s)**: `development/src/components.json`, `development/src/src/lib/utils.ts`, updates to `development/src/src/app/globals.css`, `development/src/tailwind.config.ts`
- **Depends on**: Task 1
- **Implementation Notes**:
  - Run from `development/src/`:
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

- **File(s)**: `development/src/package.json`, `development/src/package-lock.json`
- **Depends on**: Task 1
- **Implementation Notes**:
  - Run from `development/src/`:
    ```bash
    npm install react-hook-form zod @hookform/resolvers
    ```
- **Edge Cases**: Version conflicts between react-hook-form and @hookform/resolvers — they must be compatible versions. The `@hookform/resolvers` v3.x works with `react-hook-form` v7.x.
- **Definition of Done**: `node_modules/react-hook-form` exists; `npm run build` passes

---

### Task 4: Write Types and Constants

- **File(s)**: `development/src/src/lib/types.ts`, `development/src/src/lib/constants.ts`
- **Depends on**: Task 1
- **Implementation Notes**:
  - `types.ts`: Define `Household`, `Card`, `SignUpBonus`, `CardStatus`, `BonusType` interfaces/types
  - `constants.ts`: Define `STORAGE_KEYS`, `DEFAULT_HOUSEHOLD_ID`, `FEE_APPROACHING_DAYS`, `PROMO_EXPIRING_DAYS`
  - Use `export type` for all type exports
- **Edge Cases**: Money fields (`annualFee`, `creditLimit`, `signUpBonus.spendRequirement`) are stored as integer cents; display layer divides by 100
- **Definition of Done**: Both files have zero TypeScript errors

---

### Task 5: Write Storage Layer

- **File(s)**: `development/src/src/lib/storage.ts`
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

- **File(s)**: `development/src/src/lib/card-utils.ts`
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

- **File(s)**: `development/src/src/components/cards/CardForm.tsx`
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

- **File(s)**: `development/src/src/components/dashboard/Dashboard.tsx`, `CardTile.tsx`, `StatusBadge.tsx`, `EmptyState.tsx`
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

- **File(s)**: `development/src/src/app/page.tsx`, `development/src/src/app/cards/new/page.tsx`, `development/src/src/app/cards/[id]/edit/page.tsx`
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
  - Prints next steps: `cd development/src && npm run dev`
  - Idempotent: running twice produces same result
- **Edge Cases**:
  - Node version check: parse major version from `node --version` output
  - If npm install fails, print error message and exit with non-zero code
- **Definition of Done**: Script runs to completion on a clean macOS/Linux system; app starts after following printed instructions

---

### Task 11: Create .env.example

- **File(s)**: `development/src/.env.example`
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

- **File(s)**: `development/src/src/app/globals.css`, `development/src/tailwind.config.ts`
- **Depends on**: Sprint 1 complete
- **Implementation Notes**:
  - Replace shadcn/ui default CSS variables with Saga Ledger tokens (void-black `#07070d`, gold accent `#c9920a`, etc.)
  - Extend Tailwind with custom color palette and font families (Cinzel Decorative, Cinzel, Source Serif 4, JetBrains Mono)
  - Apply dark mode as default; no light mode toggle in Sprint 2
- **Definition of Done**: App renders with dark Norse War Room aesthetic at `http://localhost:9999`

---

### Task 2.2: App Shell — Layout Components

- **File(s)**: `development/src/src/components/layout/AppShell.tsx`, `SiteHeader.tsx`, `SideNav.tsx`, `TopBar.tsx`, `Footer.tsx`
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

- **File(s)**: `development/src/src/components/layout/ConsoleSignature.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Outputs Elder Futhark rune glyphs spelling ᚠᛖᚾᚱᛁᚱ (FENRIR) to browser console on app load
  - Each glyph is 8 chars wide, 7 lines tall, drawn with ASCII line art
  - Followed by a `runeLabel` line naming each rune
  - Use `\\` for literal backslashes in JS template literals
- **Definition of Done**: Opening browser console shows the FENRIR rune art

---

### Task 2.4: Easter Egg #5 — HTML Source Signature

- **File(s)**: `development/src/src/app/layout.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - JSDoc comment block injected into the HTML source
  - Visible only when viewing page source (Cmd+U / Ctrl+U)
- **Definition of Done**: Viewing page source reveals the signature comment

---

### Task 2.5: Easter Egg #7 — Runic Meta Tag Cipher

- **File(s)**: `development/src/src/app/layout.tsx`
- **Depends on**: Task 2.4
- **Implementation Notes**:
  - `metadata.other["fenrir:runes"]` contains an Elder Futhark encoded message
  - Rendered as a `<meta>` tag in the HTML head
- **Definition of Done**: `<meta name="fenrir:runes" ...>` present in page source

---

### Task 2.6: Easter Egg #2 — Konami Code Howl

- **File(s)**: `development/src/src/components/layout/KonamiHowl.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Listens for the Konami sequence: ↑↑↓↓←→←→BA
  - On match: displays a full-screen howl overlay animation
  - Wired into `AppShell.tsx`
- **Definition of Done**: Entering the Konami sequence triggers the howl overlay

---

### Task 2.7: Easter Egg #3 — Loki Mode

- **File(s)**: `development/src/src/components/layout/Footer.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Clicking the "Loki" span in the footer 7 times triggers Loki Mode
  - Effect: shuffles the card grid and displays random realm badges for 5 seconds
- **Definition of Done**: Seven rapid clicks on "Loki" in the footer triggers the shuffle

---

### Task 2.8: Easter Egg #1 Fragments — Gleipnir Hunt

- **File(s)**: `development/src/src/components/cards/GleipnirFishBreath.tsx`, `GleipnirMountainRoots.tsx`, `GleipnirCatFootfall.tsx`, `GleipnirBirdSpittle.tsx`, `GleipnirBearSinews.tsx`, `GleipnirWomansBeard.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Six fragment components, each representing one ingredient of Gleipnir
  - Fragment 5 (Fish Breath) triggered by hovering the footer copyright (©)
  - Each fragment uses the shared `EasterEggModal` component
- **Definition of Done**: Hovering © in footer reveals Fish Breath modal; other fragments have trigger points wired

---

### Task 2.9: Shared Easter Egg Modal

- **File(s)**: `development/src/src/components/easter-eggs/EasterEggModal.tsx`
- **Depends on**: Task 2.2
- **Implementation Notes**:
  - Reusable modal wrapper for all Gleipnir fragment reveals
  - Accepts title, rune, and content as props
  - Handles open/close state; accessible via keyboard
- **Definition of Done**: All Gleipnir fragments render correctly through this modal

---

### Task 2.10: Forgemaster Easter Egg

- **File(s)**: `development/src/src/components/layout/ForgeMasterEgg.tsx`
- **Depends on**: Task 2.9
- **Implementation Notes**:
  - Extracted from Footer.tsx into its own component for clarity
  - Wired into the app shell footer area
- **Definition of Done**: Forgemaster egg triggers and displays correctly

---

### Task 2.11: Supporting Layout Components

- **File(s)**: `development/src/src/components/layout/AboutModal.tsx`, `SyncIndicator.tsx`
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

- **File(s)**: `development/src/src/lib/realm-utils.ts`
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

- **File(s)**: `development/src/src/lib/constants.ts`
- **Depends on**: Task 3.2.1
- **Implementation Notes**:
  - `STATUS_TOOLTIPS` record delegates to `getRealmDescription()` instead of duplicating strings
  - Type tightened from `Record<string, string>` to `Record<CardStatus, string>`
  - This ensures `STATUS_TOOLTIPS` always stays in sync with `realm-utils.ts`
- **Edge Cases**: Circular import — `realm-utils.ts` must NOT import from `constants.ts`
- **Definition of Done**: `constants.ts` compiles; `STATUS_TOOLTIPS` values match `getRealmDescription()` output

---

### Task 3.2.3: Update `StatusBadge.tsx` to use `realm-utils.ts`

- **File(s)**: `development/src/src/components/dashboard/StatusBadge.tsx`
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
  - `development/src/src/components/dashboard/EmptyState.tsx`
  - `development/src/src/app/page.tsx`
  - `development/src/src/app/cards/new/page.tsx`
  - `development/src/src/app/cards/[id]/edit/page.tsx`
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
  - `cd development/src && npm run build`
  - Zero TypeScript errors, zero lint errors
- **Definition of Done**: `npm run build` completes with no errors

---

## Known Limitations (Sprint 3 — Story 3.2)

| Limitation | Notes |
|-----------|-------|
| All Sprint 1 + Sprint 2 limitations | Carry forward unchanged |
| Realm labels not shown on primary badges | By design — Voice 1 rule; realm names are tooltip/atmospheric only |
| No per-card sub-realm differentiation | `active` maps to one realm; Vanaheim/Midgard/Asgard sub-states are future work |
