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
