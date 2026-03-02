# Plan: Playwright Test Suite Restructure & Full Coverage

## Task Description

Restructure the existing Playwright test suites from `quality/scripts/` into a classified directory structure under `quality/test-suites/`, and add comprehensive new tests covering all existing application functionality. Tests should be spec-driven (what the user experiences) not implementation-driven.

## Objective

When complete:
- All Playwright tests live under `quality/test-suites/<category>/` in classified subdirectories
- Every user-facing feature has E2E test coverage
- Duplicate and invalid tests are removed
- The `playwright.config.ts` testDir points to the new location
- All tests pass against localhost:9653

## Problem Statement

Current test coverage is narrow — only 28 tests across 2 files covering easter eggs and navigation. Major features like the card CRUD lifecycle, dashboard views, import wizard, Valhalla, sign-in, HowlPanel urgency, and accessibility have zero E2E coverage. The test files live in a flat `quality/scripts/` directory with no classification.

## Solution Approach

1. Create classified subdirectories under `quality/test-suites/`
2. Migrate existing tests (restructured, deduplicated) into their categories
3. Write new spec-driven tests for every uncovered feature area
4. Update `playwright.config.ts` to point to the new test root
5. Run all tests to confirm green

## Relevant Files

### Existing Test Files (to migrate/restructure)
- `quality/scripts/test-easter-eggs.spec.ts` — 22 tests, easter egg triggers/modals/fragments (KEEP, move)
- `quality/scripts/test-navigation.spec.ts` — 6 tests, marketing site + session archive nav (KEEP, move)

### Playwright Config (to update)
- `development/frontend/playwright.config.ts` — testDir currently points to `../../quality/scripts`

### Application Pages (test targets)
- `development/frontend/src/app/page.tsx` — Dashboard (/) — card grid, empty state, import wizard trigger, HowlPanel
- `development/frontend/src/app/cards/new/page.tsx` — Add Card form (/cards/new)
- `development/frontend/src/app/cards/[id]/edit/page.tsx` — Edit Card form (/cards/[id]/edit)
- `development/frontend/src/app/valhalla/page.tsx` — Valhalla (/valhalla) — closed cards
- `development/frontend/src/app/sign-in/page.tsx` — Sign-in page (/sign-in)
- `development/frontend/src/app/auth/callback/page.tsx` — OAuth callback

### Key Components (behavioural reference)
- `development/frontend/src/components/cards/CardForm.tsx` — Zod validation, issuer dropdown, bonus fields, close/delete dialogs
- `development/frontend/src/components/dashboard/Dashboard.tsx` — card grid, Loki mode, empty state
- `development/frontend/src/components/dashboard/CardTile.tsx` — card display, status badges, realm labels
- `development/frontend/src/components/dashboard/EmptyState.tsx` — empty state CTA, import trigger
- `development/frontend/src/components/layout/HowlPanel.tsx` — urgent deadlines sidebar, Ragnarok mode
- `development/frontend/src/components/layout/TopBar.tsx` — auth state, avatar, profile dropdown
- `development/frontend/src/components/layout/SideNav.tsx` — sidebar navigation, collapse
- `development/frontend/src/components/layout/Footer.tsx` — footer links, Loki trigger, copyright
- `development/frontend/src/components/sheets/ImportWizard.tsx` — import modal, 3 import paths
- `development/frontend/src/components/sheets/MethodSelection.tsx` — import method picker
- `development/frontend/src/components/layout/AboutModal.tsx` — about modal, Wolf Hunger meter

### Data Layer (for test setup helpers)
- `development/frontend/src/lib/types.ts` — Card, CardStatus, SignUpBonus types
- `development/frontend/src/lib/storage.ts` — localStorage CRUD operations
- `development/frontend/src/lib/constants.ts` — KNOWN_ISSUERS, threshold days
- `development/frontend/src/lib/card-utils.ts` — computeCardStatus, date helpers

### New Files to Create

```
quality/test-suites/
  helpers/
    test-fixtures.ts          — shared card factories, localStorage helpers
    seed-data.ts              — pre-built card sets (empty, few, many, urgent, mixed)
  dashboard/
    dashboard.spec.ts         — empty state, card grid, summary stats, filters
  card-lifecycle/
    add-card.spec.ts          — add card form, validation, save, redirect
    edit-card.spec.ts         — edit existing card, pre-populated fields
    close-card.spec.ts        — close card flow, Valhalla transfer
    delete-card.spec.ts       — delete card, confirmation dialog
  valhalla/
    valhalla.spec.ts          — closed cards display, empty state, filters
  navigation/
    navigation.spec.ts        — (migrated from test-navigation.spec.ts)
  layout/
    topbar.spec.ts            — auth states, avatar, dropdown, sign-out
    sidebar.spec.ts           — nav links, collapse/expand, active state
    footer.spec.ts            — links, copyright, about modal trigger
    howl-panel.spec.ts        — urgent cards sidebar, Ragnarok overlay
  import/
    import-wizard.spec.ts     — method selection, URL entry (Path A), CSV upload (Path C)
  easter-eggs/
    easter-eggs.spec.ts       — (migrated from test-easter-eggs.spec.ts)
  accessibility/
    a11y.spec.ts              — ARIA labels, focus traps, keyboard nav, reduced motion
  responsive/
    mobile.spec.ts            — 375px viewport, sidebar collapse, touch targets
```

## Implementation Phases

### Phase 1: Foundation
- Create directory structure under `quality/test-suites/`
- Create shared helpers (`test-fixtures.ts`, `seed-data.ts`) with card factories and localStorage seeding
- Update `playwright.config.ts` testDir to `../../quality/test-suites`
- Verify existing tests still pass from new location

### Phase 2: Core Implementation
- Migrate existing tests into their classified directories
- Write new test suites for all uncovered features
- Each suite is independent and can be developed in parallel

### Phase 3: Integration & Polish
- Run full test suite, fix any flaky tests
- Remove old `quality/scripts/` directory
- Final validation: all tests pass

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Agent` and `Task*` tools to deploy team members to do the building, validating, testing, deploying, and other tasks.

### Team Members

- Validator (x5 parallel instances)
  - Name: loki-1 through loki-5
  - Role: QA test development — each Loki implements one test suite category
  - Agent Type: loki-qa-tester
  - Resume: false (each gets a fresh task)

### Notes on Test Approach

All tests should:
- Use `page.evaluate()` to seed localStorage with test card data (no API mocking needed — app uses localStorage)
- Be fully idempotent — clean localStorage before each test
- Use the Playwright config's `baseURL` (default `http://localhost:9653`)
- NOT hardcode `http://localhost:3000` (the old port in existing tests — this is a bug to fix)
- Target accessibility selectors (`role`, `aria-label`, `data-testid`) over CSS classes where possible
- Set `NODE_PATH` for module resolution when running from the frontend directory

## Step by Step Tasks

### 1. Create Foundation (Config + Helpers + Directory Structure)
- **Task ID**: foundation
- **Depends On**: none
- **Assigned To**: loki-1
- **Agent Type**: loki-qa-tester
- **Parallel**: true (launches with task 2-5)
- Create `quality/test-suites/` directory structure with all subdirectories
- Create `quality/test-suites/helpers/test-fixtures.ts`:
  - `makeCard(overrides)` factory that returns a valid `Card` object with sensible defaults
  - `makeUrgentCard()` — card with fee due in 30 days (status: fee_approaching)
  - `makePromoCard()` — card with promo expiring in 20 days (status: promo_expiring)
  - `makeClosedCard()` — card with closedAt set and status: closed
  - `seedCards(page, householdId, cards[])` — writes cards to localStorage via `page.evaluate()`
  - `clearAllStorage(page)` — clears all fenrir_ledger keys from localStorage
  - `ANONYMOUS_HOUSEHOLD_ID` constant for the anonymous localStorage key
- Create `quality/test-suites/helpers/seed-data.ts`:
  - Pre-built card arrays: `EMPTY_CARDS`, `FEW_CARDS` (3), `MANY_CARDS` (10), `URGENT_CARDS` (3 fee_approaching + 2 promo_expiring), `MIXED_CARDS` (active + urgent + closed)
- Update `development/frontend/playwright.config.ts`: change testDir to `../../quality/test-suites`
- Migrate `test-easter-eggs.spec.ts` → `quality/test-suites/easter-eggs/easter-eggs.spec.ts` (fix BASE_URL to use baseURL from config, not hardcoded port 3000)
- Migrate `test-navigation.spec.ts` → `quality/test-suites/navigation/navigation.spec.ts` (fix BASE_URL to use baseURL from config, not hardcoded port 3000)
- Run migrated tests to verify they pass: `cd development/frontend && NODE_PATH=node_modules npx playwright test --headed`
- Delete old `quality/scripts/` directory after confirming migration
- Commit on branch `chore/playwright-test-restructure`

### 2. Dashboard + Card Lifecycle Tests
- **Task ID**: dashboard-cards
- **Depends On**: foundation
- **Assigned To**: loki-2
- **Agent Type**: loki-qa-tester
- **Parallel**: true (launches with tasks 3-5 after foundation completes)
- Read `quality/test-suites/helpers/test-fixtures.ts` and `seed-data.ts` for shared helpers
- Create `quality/test-suites/dashboard/dashboard.spec.ts`:
  - **Empty state**: loads with "Before Gleipnir was forged" heading, "Add Card" CTA link
  - **Card grid**: seed 5 cards → verify 5 card tiles render with correct names, issuers, fees
  - **Summary stats**: verify "X cards" count, "Y need attention" count when urgent cards exist
  - **Status badges**: verify Active / Fee Due Soon / Promo Expiring badges render per card status
  - **Card tile links**: verify each card tile links to `/cards/{id}/edit`
  - **Sorting**: verify cards display in expected order (active before urgent)
- Create `quality/test-suites/card-lifecycle/add-card.spec.ts`:
  - **Form loads**: navigate to /cards/new, verify form fields (issuer dropdown, card name, open date, credit limit, annual fee, fee date, bonus section, notes)
  - **Validation errors**: submit empty form → verify "Issuer is required", "Card name is required", "Open date is required" errors appear
  - **Successful save**: fill all required fields + some optional → submit → verify redirect to / → verify new card appears in grid
  - **Issuer dropdown**: verify all KNOWN_ISSUERS appear in dropdown
  - **Annual fee date auto-populate**: when annual fee > 0, fee date should default to 1 year from open date
  - **Bonus fields toggle**: bonus section fields appear/disappear based on toggle
- Create `quality/test-suites/card-lifecycle/edit-card.spec.ts`:
  - **Pre-populated fields**: seed a card → navigate to /cards/{id}/edit → verify all fields match seeded data
  - **Edit and save**: change card name → save → verify updated on dashboard
  - **Cancel returns to dashboard**: click back/cancel → verify redirect to /
- Create `quality/test-suites/card-lifecycle/close-card.spec.ts`:
  - **Close dialog**: on edit page → click "Close Card" → confirm dialog appears
  - **Confirm close**: confirm → card moves to Valhalla, removed from active dashboard
  - **Cancel close**: cancel → card remains active
- Create `quality/test-suites/card-lifecycle/delete-card.spec.ts`:
  - **Delete dialog**: on edit page → click "Delete Card" → confirm dialog appears
  - **Confirm delete**: confirm → card is removed entirely (not in dashboard, not in Valhalla)
  - **Cancel delete**: cancel → card remains
- All tests use `seedCards()` helper for setup
- Run: `cd development/frontend && NODE_PATH=node_modules npx playwright test quality/test-suites/dashboard/ quality/test-suites/card-lifecycle/ --headed`
- Commit on same branch `chore/playwright-test-restructure`

### 3. Valhalla + Layout Tests
- **Task ID**: valhalla-layout
- **Depends On**: foundation
- **Assigned To**: loki-3
- **Agent Type**: loki-qa-tester
- **Parallel**: true (launches with tasks 2, 4, 5 after foundation completes)
- Read `quality/test-suites/helpers/test-fixtures.ts` and `seed-data.ts` for shared helpers
- Create `quality/test-suites/valhalla/valhalla.spec.ts`:
  - **Empty state**: no closed cards → verify empty Valhalla message
  - **Closed cards display**: seed 3 closed cards → navigate to /valhalla → verify tombstone entries with ᛏ rune, card name, closed date
  - **Sepia tint**: verify page has sepia CSS filter applied
  - **No active cards**: verify active cards do NOT appear in Valhalla
  - **No deleted cards**: verify soft-deleted cards (deletedAt set) do NOT appear
  - **Gleipnir fragment #6**: verify idle timer triggers on empty Valhalla (15s — may need to stub or accept long test)
- Create `quality/test-suites/layout/topbar.spec.ts`:
  - **Anonymous state**: verify ᛟ rune avatar, no email shown
  - **Logo link**: verify Fenrir Ledger link in header points to /static with target="_blank"
  - **Anonymous avatar click**: click avatar → verify upsell dialog opens with "Sign in to Google" and "Not now" buttons
- Create `quality/test-suites/layout/sidebar.spec.ts`:
  - **Navigation links**: verify "Cards" link (/) and "Valhalla" link (/valhalla) exist
  - **Active state**: on /, "Cards" link should be active; on /valhalla, "Valhalla" link should be active
  - **Collapse/expand**: click collapse → sidebar collapses; click expand → sidebar expands
- Create `quality/test-suites/layout/footer.spec.ts`:
  - **Footer content**: verify "FENRIR LEDGER" brand, "Break free. Harvest every reward." tagline
  - **About modal**: click "ᛟ FENRIR LEDGER" → verify About modal opens with team credits
  - **Copyright**: verify © 2026 Fenrir Ledger text
- Create `quality/test-suites/layout/howl-panel.spec.ts`:
  - **Hidden when no urgent**: seed only active cards → verify HowlPanel is NOT visible
  - **Visible when urgent**: seed 2 fee_approaching cards → verify HowlPanel renders with card names and days remaining
  - **Sorted by urgency**: verify most urgent card (fewest days) appears first
  - **Bell button on mobile**: set viewport to 375px → verify ᚲ bell button appears
  - **Ragnarok mode**: seed 5+ urgent cards → verify Ragnarok overlay/title change triggers
- Run: `cd development/frontend && NODE_PATH=node_modules npx playwright test quality/test-suites/valhalla/ quality/test-suites/layout/ --headed`
- Commit on same branch `chore/playwright-test-restructure`

### 4. Import Wizard Tests
- **Task ID**: import-wizard
- **Depends On**: foundation
- **Assigned To**: loki-4
- **Agent Type**: loki-qa-tester
- **Parallel**: true (launches with tasks 2, 3, 5 after foundation completes)
- Read `quality/test-suites/helpers/test-fixtures.ts` and `seed-data.ts` for shared helpers
- Create `quality/test-suites/import/import-wizard.spec.ts`:
  - **NOTE**: Import wizard requires authentication. Tests that need the wizard open should seed a fake session in localStorage under "fenrir:auth" with a mock user. If the wizard still gates behind real OAuth, test only what's reachable without auth.
  - **Method selection (anonymous)**: seed cards → click Import → verify 3 methods visible: "Share a Scroll", "Browse the Archives", "Deliver a Rune-Stone"
  - **Safety banner**: verify "Protect Your Secrets" banner shows safe-to-include and never-include lists
  - **URL entry (Path A)**: select "Share a Scroll" → verify URL input appears → type invalid URL → verify error → type valid Google Sheets URL → verify Submit enabled
  - **CSV upload (Path C)**: select "Deliver a Rune-Stone" → verify file upload area appears → verify drag-and-drop hint text
  - **Back button**: from any step → click "Back to import methods" → verify return to method selection
  - **Step indicator**: verify step indicator shows Method → Import → Preview → Confirm progression
  - **Dialog stays open (onInteractOutside)**: verify the import wizard doesn't close when clicking outside (PR #79 fix)
  - **Close via X button**: verify X button closes the wizard
  - **Close via Cancel**: verify Cancel button closes the wizard at every step
  - **Close via ESC**: verify ESC key closes the wizard
  - **Empty state import trigger**: with no cards + authenticated → verify "Import from Google Sheets" button appears in empty state
- Run: `cd development/frontend && NODE_PATH=node_modules npx playwright test quality/test-suites/import/ --headed`
- Commit on same branch `chore/playwright-test-restructure`

### 5. Accessibility + Responsive Tests
- **Task ID**: a11y-responsive
- **Depends On**: foundation
- **Assigned To**: loki-5
- **Agent Type**: loki-qa-tester
- **Parallel**: true (launches with tasks 2-4 after foundation completes)
- Read `quality/test-suites/helpers/test-fixtures.ts` and `seed-data.ts` for shared helpers
- Create `quality/test-suites/accessibility/a11y.spec.ts`:
  - **Page landmarks**: verify `<main>`, `<nav>`, `<header>`, `<footer>` landmarks exist on /
  - **Heading hierarchy**: verify h1 "The Ledger of Fates" on /, h1 "Valhalla" on /valhalla
  - **StatusRing aria-labels**: seed cards with various statuses → verify StatusRing SVGs have descriptive aria-labels
  - **Focus trap on modals**: open About modal → verify Tab key cycles within modal (doesn't escape)
  - **Skip to content**: verify skip-to-content link exists (if implemented) or main is focusable
  - **Form labels**: navigate to /cards/new → verify all inputs have associated labels
  - **Card tile keyboard access**: verify card tiles are keyboard-navigable (Tab + Enter)
- Create `quality/test-suites/responsive/mobile.spec.ts`:
  - Set viewport to 375x667 (iPhone SE)
  - **Sidebar collapses**: verify sidebar is collapsed or hidden at mobile width
  - **Card grid single column**: seed cards → verify grid is single column at 375px
  - **Touch targets**: verify all interactive elements are at least 44x44px
  - **Import wizard sizing**: open import wizard → verify it uses w-[92vw] sizing
  - **HowlPanel bottom sheet**: seed urgent cards → verify bell button visible, HowlPanel opens as bottom sheet
- Run: `cd development/frontend && NODE_PATH=node_modules npx playwright test quality/test-suites/accessibility/ quality/test-suites/responsive/ --headed`
- Commit on same branch `chore/playwright-test-restructure`

### 6. Final Validation
- **Task ID**: validate-all
- **Depends On**: foundation, dashboard-cards, valhalla-layout, import-wizard, a11y-responsive
- **Assigned To**: loki-1 (resumed)
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Pull all changes from the branch
- Run FULL test suite: `cd development/frontend && NODE_PATH=node_modules npx playwright test --headed`
- Fix any failures
- Verify old `quality/scripts/` is removed
- Run TypeScript check: `cd development/frontend && npx tsc --noEmit`
- Report final test count and pass/fail status
- Commit final fixes on same branch

## Acceptance Criteria

1. All tests live under `quality/test-suites/<category>/` — no tests in `quality/scripts/`
2. `playwright.config.ts` testDir updated to point to new location
3. All hardcoded `localhost:3000` references replaced with config-driven baseURL
4. Shared helpers exist in `quality/test-suites/helpers/` and are used by all suites
5. Every test is idempotent (cleans up localStorage before running)
6. Test categories cover: dashboard, card-lifecycle, valhalla, navigation, layout, import, easter-eggs, accessibility, responsive
7. All tests pass against localhost:9653
8. No duplicate tests across suites
9. Total test count >= 80 (currently 28, adding ~60+ new tests)

## Validation Commands

- `cd development/frontend && npx tsc --noEmit` — Type-check the codebase (including test files)
- `cd development/frontend && NODE_PATH=node_modules npx playwright test --headed` — Run all tests headed
- `cd development/frontend && NODE_PATH=node_modules npx playwright test` — Run all tests headless
- `cd development/frontend && npx next build` — Verify the app build succeeds

## Notes

- The existing tests hardcode `BASE_URL = process.env.SERVER_URL || "http://localhost:3000"` — this should use Playwright's `baseURL` from config instead (port 9653, not 3000)
- The `@playwright/test` module lives in `development/frontend/node_modules/` but test files are in `quality/` — `NODE_PATH=$(pwd)/node_modules` is needed when running from the frontend directory
- Import wizard tests (Path A URL, Path C CSV) can test the UI flow without actually hitting the API — just verify the form states and navigation. Path B (Google Picker) requires real OAuth and is tested manually.
- For seeding localStorage: use `page.evaluate()` to write directly to `localStorage` before navigating. The app reads cards from `fenrir_ledger:{householdId}:cards`.
- The anonymous household ID can be read from `localStorage.getItem("fenrir:household")` or set to a known UUID in tests.
