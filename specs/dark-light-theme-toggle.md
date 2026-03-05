# Plan: Dark/Light/System Theme Toggle

## Task Description
Add a theme toggle to Fenrir Ledger that supports three modes: **Dark** (current Norse war-room aesthetic), **Light** (Norse parchment/manuscript aesthetic), and **System** (follows OS preference). The toggle lives in the TopBar user dropdown menu. Default mode is "System". Preference persists via localStorage. Every component in the app must support both themes — no exceptions. The theme CSS system must be designed so future features automatically inherit theme support with minimal effort.

## Objective
When this plan is complete, users can switch between dark, light, and system themes from the TopBar dropdown. The light theme has a Norse parchment aesthetic (aged parchment backgrounds, leather-brown accents, adapted gold). All existing and future components respect the active theme via CSS custom properties. The design system docs are updated to mandate theme support for all new work.

## Problem Statement
Fenrir Ledger is currently dark-only. The `:root` CSS custom properties define a single dark palette with no `.dark`/`.light` class-based variants. The `<html>` element has a hardcoded `"dark"` class in `layout.tsx`. There is no theme provider, no `next-themes` package, and no light mode color palette. Users who prefer light mode or who work in bright environments have no option.

## Solution Approach
Use the `next-themes` library — the de facto standard for Next.js App Router theme management. It handles:
- Class-based toggling on `<html>` (works with Tailwind's `darkMode: ["class"]`)
- System preference detection via `prefers-color-scheme` media query
- localStorage persistence with configurable key
- SSR-safe hydration (avoids flash of wrong theme)
- Attribute-based theming (`class` or `data-theme`)

The CSS architecture shifts from a single `:root` palette to `:root` (light) + `.dark` (dark) variable blocks — the standard shadcn/ui pattern. All existing hardcoded dark colors in CSS (hex values in animations, shadows, backgrounds) must be converted to use CSS variables so they respond to theme changes.

Odin's requirements (from Freya interview):
1. **Norse parchment** light aesthetic — aged parchment backgrounds, leather-brown accents, gold adapts
2. **TopBar dropdown** placement — in the existing profile/user menu
3. **localStorage persistence** — survives sessions
4. **Everything switchable** — no dark-only exceptions, not even easter eggs
5. **Design system rules** — update docs so all future features know the requirement

## Relevant Files
Use these files to complete the task:

### Existing Files to Modify
- `development/frontend/src/app/globals.css` — Restructure `:root` into light/dark variable blocks; convert all hardcoded hex in animations/shadows to CSS variables
- `development/frontend/src/app/layout.tsx` — Remove hardcoded `"dark"` class; wrap app in `next-themes` ThemeProvider; add `suppressHydrationWarning` to `<html>`
- `development/frontend/tailwind.config.ts` — Already has `darkMode: ["class"]` — no change needed (just verify)
- `development/frontend/src/components/layout/TopBar.tsx` — Add theme toggle to both the signed-in dropdown and the anonymous upsell panel (or as a separate icon button)
- `development/frontend/src/components/dashboard/CardTile.tsx` — Remove stray `dark:text-amber-400` classes (3 instances)
- `development/frontend/src/components/dashboard/Dashboard.tsx` — Remove stray `dark:text-amber-400` class (1 instance)
- `development/frontend/package.json` — Add `next-themes` dependency

### New Files to Create
- `development/frontend/src/components/layout/ThemeToggle.tsx` — The toggle component (Sun/Moon/Monitor icons from lucide-react)
- `development/frontend/src/hooks/useThemeMount.ts` — SSR-safe hook to avoid hydration mismatch on theme-dependent rendering (thin wrapper if needed)

### Design System Docs to Update
- `designs/ux-design/theme-system.md` — Create or update with dual-theme design rules, light palette specification, and mandate for all future components

## Implementation Phases
### Phase 1: Foundation
Install `next-themes`. Restructure `globals.css` to define both `:root` (light/parchment) and `.dark` (current palette) variable blocks. Update `layout.tsx` to use `ThemeProvider` from `next-themes` instead of hardcoded `"dark"` class. Verify Tailwind dark mode still works.

### Phase 2: Core Implementation
Build `ThemeToggle` component with three states (light/dark/system). Integrate into TopBar dropdown menus (both anonymous and signed-in states). Design the Norse parchment light palette — surfaces, text, accents, status colors all need light variants that maintain WCAG AA contrast. Convert all hardcoded hex values in `globals.css` animations and shadows to CSS variables.

### Phase 3: Integration & Polish
Audit every component for hardcoded dark colors (inline styles, direct hex references). Update design system docs. Ensure easter eggs, overlays, modals, and all existing features render correctly in both themes. Verify WCAG AA contrast ratios for the light palette.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to to the building, validating, testing, deploying, and other tasks.
  - This is critical. You're job is to act as a high level director of the team, not a builder.
  - You're role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate this by using the Task* Tools to manage coordination between the team members.
  - Communication is paramount. You'll use the Task* Tools to communicate with the team members and ensure they're on track to complete the plan.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Builder
  - Name: fireman-decko
  - Role: Architecture, system design, implementation
  - Agent Type: fireman-decko-principal-engineer
  - Resume: true
- Validator
  - Name: loki
  - Role: QA testing, validation, ship/no-ship decision
  - Agent Type: loki-qa-tester
  - Resume: true

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Install next-themes and restructure CSS variables
- **Task ID**: theme-foundation
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Install `next-themes`: `cd development/frontend && npm install next-themes`
- Restructure `globals.css`:
  - Move current `:root` dark palette into `.dark { }` block
  - Create new `:root` block with Norse parchment light palette:
    - `--background`: warm parchment (~`36 33% 88%` / `#e8dcc8`)
    - `--foreground`: deep brown-black (~`25 30% 12%` / `#2a1f14`)
    - `--card`: lighter parchment (~`35 30% 83%` / `#ddd0b8`)
    - `--popover`: warm cream (~`37 35% 90%` / `#ede2d0`)
    - `--primary`: darker gold for light bg (~`42 80% 38%` / `#ae8510`) — must maintain WCAG AA on parchment
    - `--secondary`: leather tan (~`28 20% 72%` / `#c4b5a0`)
    - `--muted`: faded leather (~`30 15% 65%` / `#b0a494`)
    - `--muted-foreground`: dark stone (~`25 12% 42%` / `#6b5f52`)
    - `--border`: leather seam (~`28 18% 65%` / `#b5a590`)
    - `--input`: light stone (~`25 12% 78%` / `#ccc2b4`)
    - `--ring`: gold (~`42 80% 38%`)
    - `--destructive`: blood orange adapted for light bg (~`15 85% 42%`)
    - Chart colors: adapt for light background contrast
  - Keep `--radius` the same in both themes
- Convert hardcoded hex values in animation keyframes to CSS variables:
  - `.card-chain:hover` shadow colors → use `hsl(var(--primary) / 0.2)` pattern
  - `.skeleton` shimmer gradient → light variant using parchment tones
  - `.milestone-toast` → use theme variables instead of hardcoded `#0f1018`, `#c9920a`, `#e8e4d4`
  - `.ragnarok-overlay` → use theme-aware red tones
  - `.gleipnir-copyright-symbol::after` color → `hsl(var(--primary))`
  - `.myth-link` border color → `hsl(var(--primary) / 0.38)`
- Update `layout.tsx`:
  - Remove hardcoded `"dark"` from `<html>` className
  - Add `suppressHydrationWarning` to `<html>` (required by next-themes)
  - Wrap app content in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="fenrir-theme">`
  - Import `ThemeProvider` from `next-themes`
- Remove stray `dark:` prefixed classes:
  - `CardTile.tsx` line 189, 208: remove `dark:text-amber-400`
  - `Dashboard.tsx` line 103: remove `dark:text-amber-400`
- Update body background-image in `globals.css`:
  - Dark: keep current gold radial glow + stone grain texture
  - Light: adapt to subtle warm glow on parchment (lower opacity, warmer tones)

### 2. Build ThemeToggle component and integrate into TopBar
- **Task ID**: theme-toggle-ui
- **Depends On**: theme-foundation
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Create `ThemeToggle.tsx`:
  - Uses `useTheme()` from `next-themes`
  - Three options: Light (Sun icon), Dark (Moon icon), System (Monitor icon)
  - Render as a segmented button group or a cycling icon button (space-efficient for TopBar)
  - Norse styling: border-border, text-muted-foreground, active state uses text-gold
  - Touch-friendly: min 44x44px tap targets
  - SSR-safe: render placeholder until mounted (avoid hydration mismatch)
  - `aria-label="Theme"` with clear labels for each option
- Integrate into TopBar:
  - **Signed-in dropdown**: Add "Theme" section above "Sign out" with the three-way toggle
  - **Anonymous state**: Add the toggle as a standalone icon button in the TopBar header area (left of avatar), since anonymous users have no dropdown for settings. Alternatively, add it to the anonymous upsell panel.
  - The toggle should work identically in both states
- Verify all shadcn/ui components (Button, Dialog, Select, Card, etc.) respond correctly to theme class changes — they should, since they use CSS variables

### 3. Audit and fix hardcoded colors across all components
- **Task ID**: color-audit
- **Depends On**: theme-toggle-ui
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Search for hardcoded hex colors and rgba values in all `.tsx` files under `src/`
- Convert inline `style={{ color: "#hex" }}` to Tailwind classes or CSS variables
- Key files to audit:
  - `LcarsOverlay.tsx` — LCARS easter egg uses inline hex colors extensively; convert to CSS variables with light variants
  - `KonamiHowl.tsx` — wolf silhouette and red flash colors
  - `StatusRing.tsx` — realm status colors (these use Tailwind `realm-*` tokens, should be fine)
  - `HowlPanel.tsx` — raven icon and urgent indicators
  - `AboutModal.tsx` — any hardcoded colors
  - `Footer.tsx` — gleipnir copyright symbol
  - `SideNav.tsx` — navigation styling
  - All easter egg modals — Gleipnir fragment modals
- For realm status colors (asgard, hati, muspel, ragnarok, hel): these may need light-mode variants in Tailwind config if contrast is insufficient on parchment backgrounds
- Update `tailwind.config.ts` direct color tokens if any need light variants:
  - `void`, `forge`, `chain` — these surface colors are dark-specific; add light equivalents or ensure components use semantic tokens (`bg-background`, `bg-card`) instead

### 4. Update design system documentation
- **Task ID**: design-docs
- **Depends On**: color-audit
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Create or update `designs/ux-design/theme-system.md` with:
  - **Theme Architecture**: CSS variable system, `:root` (light) + `.dark` (dark)
  - **Light Palette Spec**: Full list of CSS variables with hex values and rationale
  - **Dark Palette Spec**: Current values (for reference)
  - **WCAG Contrast Ratios**: Key color pairs for both themes
  - **Design Rules for Future Features**:
    - MUST use semantic Tailwind classes (`bg-background`, `text-foreground`, `border-border`) — never hardcoded hex
    - MUST NOT use `dark:` Tailwind prefix — the CSS variable system handles both themes automatically
    - MUST test new components in both light and dark modes before shipping
    - Inline `style` with colors is forbidden unless absolutely necessary (and must use CSS variables)
  - **Theme Toggle Spec**: Three-way toggle, localStorage key `fenrir-theme`, default "system"
- Update globals.css header comment to reflect dual-theme support (remove "Dark-only. No light mode. The wolf does not need the sun.")

### 5. Write Playwright Tests
- **Task ID**: write-playwright-tests
- **Depends On**: design-docs
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Write Playwright tests covering acceptance criteria for each PR
- Tests in `quality/test-suites/theme-toggle/`
- Test cases:
  - TC-TH-001: Theme toggle is visible in TopBar dropdown (signed-in state)
  - TC-TH-002: Theme toggle is accessible in anonymous state
  - TC-TH-003: Clicking "Dark" applies `.dark` class to `<html>`
  - TC-TH-004: Clicking "Light" removes `.dark` class from `<html>`
  - TC-TH-005: Clicking "System" follows OS preference (use `page.emulateMedia({ colorScheme })`)
  - TC-TH-006: Default is "System" on fresh visit (no localStorage)
  - TC-TH-007: Theme persists after page reload (localStorage)
  - TC-TH-008: Light mode renders parchment background (not dark)
  - TC-TH-009: Dark mode renders void-black background
  - TC-TH-010: WCAG AA contrast check on key light-mode color pairs
  - TC-TH-011: No visual flash of wrong theme on page load (SSR hydration)
- Assertions derived from acceptance criteria, NOT from current code behavior
- Run tests, verify all pass, commit to each PR's branch

### 6. Final Validation
- **Task ID**: validate-all
- **Depends On**: write-playwright-tests
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Verify Playwright test coverage exists for all new functionality
- Check that `next build` succeeds with no TypeScript errors
- Visual review: screenshot both themes at key pages (dashboard, settings, valhalla)

## Stories

Group the tasks above into max 5 PR-sized stories. Each story becomes one branch + one PR.
The orchestrator (`/orchestrate`) reads this section to know how to execute.

### Story 1: Theme Foundation + CSS Variables
- **Slug**: theme-foundation
- **Branch**: feat/theme-foundation
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Tasks**: theme-foundation
- **Acceptance Criteria**:
  - `next-themes` is installed and `ThemeProvider` wraps the app in `layout.tsx`
  - `globals.css` has `:root` (light) and `.dark` (dark) variable blocks
  - Hardcoded `"dark"` class is removed from `<html>`; `suppressHydrationWarning` is added
  - Default theme is "system" with localStorage key `fenrir-theme`
  - App renders correctly in dark mode (no visual regression)
  - `cd development/frontend && npx tsc --noEmit` passes
  - `cd development/frontend && npx next build` succeeds

### Story 2: Theme Toggle UI + Color Audit + Docs
- **Slug**: theme-toggle-ui
- **Branch**: feat/theme-toggle-ui
- **Depends On**: Story 1
- **Assigned To**: fireman-decko
- **Tasks**: theme-toggle-ui, color-audit, design-docs
- **Acceptance Criteria**:
  - `ThemeToggle` component renders in TopBar dropdown (both auth states)
  - Three options: Light (Sun), Dark (Moon), System (Monitor)
  - Clicking each option changes the theme immediately
  - Light mode uses Norse parchment aesthetic (not white/modern)
  - No hardcoded hex colors remain in component inline styles (all use CSS variables or Tailwind tokens)
  - `designs/ux-design/theme-system.md` documents both palettes and the "all future features must support both themes" rule
  - Easter eggs (LCARS, Konami, Gleipnir) render correctly in both themes
  - WCAG AA contrast maintained in both themes
  - `cd development/frontend && npx tsc --noEmit` passes
  - `cd development/frontend && npx next build` succeeds

## Acceptance Criteria
- Three-way theme toggle (Dark / Light / System) is accessible from the TopBar dropdown
- Default theme is "System" (follows OS `prefers-color-scheme`)
- Theme preference persists across sessions via localStorage (key: `fenrir-theme`)
- Light mode has Norse parchment aesthetic: aged parchment backgrounds, leather-brown accents, adapted gold
- Dark mode is unchanged from current aesthetic
- ALL components support both themes — no dark-only exceptions
- No hardcoded hex colors in component files — all use CSS variables or semantic Tailwind tokens
- `designs/ux-design/theme-system.md` documents the dual-theme system and mandates theme support for future features
- WCAG AA contrast ratios maintained in both themes
- No flash of incorrect theme on page load (SSR hydration handled correctly)
- `npx tsc --noEmit` passes
- `npx next build` succeeds
- Playwright tests verify theme toggle behavior and persistence

## Validation Commands
Execute these commands to validate the task is complete:

- `cd development/frontend && npx tsc --noEmit` - Type-check the codebase
- `cd development/frontend && npx next lint` - Lint the codebase
- `cd development/frontend && npx next build` - Verify the build succeeds
- `cd development/frontend && npx playwright test quality/test-suites/theme-toggle/` - Run theme toggle tests
- `grep -rn 'dark:' development/frontend/src/ --include='*.tsx' --include='*.ts'` - Verify no stray `dark:` prefixes remain

## Notes
- **New dependency**: `next-themes` — lightweight, well-maintained, 500k+ weekly npm downloads, native Next.js App Router support
- **Body background-image**: The textured stone grain SVG in `globals.css` body needs a light variant. Consider a warmer, lighter noise texture for parchment feel.
- **Realm status colors**: The realm status palette (asgard teal, hati amber, muspel orange, ragnarok red, hel stone) may need tweaked light-mode variants to maintain contrast on parchment backgrounds. Verify each against the light `--background` value.
- **LCARS overlay**: Currently uses extensive inline hex colors. These should be converted to CSS variables so the overlay automatically adapts to theme. The LCARS aesthetic naturally works in both dark (original Star Trek) and light modes.
- **Skeleton shimmer**: The dark gradient shimmer will need a parchment-toned variant for light mode.
- **`suppressHydrationWarning`**: Required on `<html>` because `next-themes` modifies the class attribute client-side. This is standard practice and does not suppress other hydration warnings.
