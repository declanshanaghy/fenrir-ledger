# Plan: Settings Page Soft Gate

## Task Description
Change the Settings page from a hard gate (hiding premium features entirely for non-subscribers) to a soft gate (showing all features with a subscribe banner above them). Currently, `SubscriptionGate` hides its children when the user lacks entitlement. The new behavior should show the content but overlay a prompt to subscribe.

## Objective
After this plan is complete, the Settings page will show all premium features to all users. Non-subscribers will see a subscribe banner above the gated sections, encouraging them to subscribe while still being able to see what they're missing.

## Problem Statement
Issue #126: The Settings page uses `SubscriptionGate` to completely hide premium features (Cloud Sync, Import, Notifications) from non-subscribers. This reduces the product's ability to upsell — users can't see what they're missing if the features are hidden.

## Solution Approach
Add a `soft` mode to `SubscriptionGate` that renders children with a subscribe banner instead of hiding them. The Settings page switches its 3 gate wrappers to use `mode="soft"`. The subscribe banner links to the Stripe checkout flow.

## Relevant Files
Use these files to complete the task:

- `development/frontend/src/components/entitlement/SubscriptionGate.tsx` — needs `mode` prop ("hard" | "soft"), soft mode renders children + banner
- `development/frontend/src/app/settings/page.tsx` — switch 3 `<SubscriptionGate>` usages to `mode="soft"`
- `development/frontend/src/components/entitlement/UpsellBanner.tsx` — may be reusable as the soft gate banner
- `development/frontend/src/components/entitlement/SealedRuneModal.tsx` — Stripe CTA reference

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

### 1. Add Soft Mode to SubscriptionGate
- **Task ID**: soft-gate-mode
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Add `mode?: "hard" | "soft"` prop to `SubscriptionGate` (default "hard" for backward compat)
- In soft mode: always render children, but prepend a subscribe banner when `!hasFeature()`
- The banner should show a brief message ("Unlock this feature") and a "Subscribe" button linking to Stripe checkout
- Banner should use existing design system classes (gold border, Norse voice)
- Mobile responsive: banner full-width, 44px min touch target on subscribe button

### 2. Update Settings Page to Use Soft Mode
- **Task ID**: settings-soft-gate
- **Depends On**: soft-gate-mode
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Change all 3 `<SubscriptionGate>` usages in `settings/page.tsx` to `mode="soft"`
- Verify the page renders all feature sections for non-subscribers
- Verify subscribers see no banner (gate passes, no banner shown)

### 3. Write Playwright Tests
- **Task ID**: write-playwright-tests
- **Depends On**: settings-soft-gate
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Write Playwright tests covering acceptance criteria for each PR
- Tests in `quality/test-suites/settings-soft-gate/`
- Assertions derived from acceptance criteria, not current code behavior
- Run tests, verify all pass, commit to each PR's branch

### 4. Final Validation
- **Task ID**: validate-all
- **Depends On**: write-playwright-tests
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Verify Playwright test coverage exists for all new functionality

## Stories

### Story 1: Settings Page Soft Gate
- **Slug**: settings-soft-gate
- **Branch**: fix/settings-soft-gate
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Tasks**: soft-gate-mode, settings-soft-gate
- **Acceptance Criteria**:
  - `SubscriptionGate` accepts `mode="soft"` prop
  - In soft mode, children are always rendered
  - In soft mode, a subscribe banner appears above children when user lacks entitlement
  - Settings page shows all 3 feature sections to non-subscribers
  - Subscribe button in banner links to Stripe checkout
  - Subscribers see no banner
  - `npx tsc --noEmit` passes
  - `npx next lint` passes
  - `npx next build` succeeds

### Story 2: QA Validation
- **Slug**: settings-soft-gate-qa
- **Branch**: test/settings-soft-gate-qa
- **Depends On**: Story 1
- **Assigned To**: loki
- **Tasks**: write-playwright-tests, validate-all
- **Acceptance Criteria**:
  - Playwright tests verify all feature sections visible for non-subscribers
  - Playwright tests verify subscribe banner appears for non-subscribers
  - Playwright tests verify no banner for subscribers
  - All existing tests pass

## Acceptance Criteria
- Settings page shows all premium features to all users
- Non-subscribers see a subscribe banner above gated sections
- Subscribe banner links to Stripe checkout
- Subscribers see no banner — identical experience to current behavior
- No regressions in SubscriptionGate hard mode (used elsewhere)
- TypeScript compiles, lint passes, build succeeds

## Validation Commands
Execute these commands to validate the task is complete:

- `cd development/frontend && npx tsc --noEmit` - Type-check the codebase
- `cd development/frontend && npx next lint` - Lint the codebase
- `cd development/frontend && npx next build` - Verify the build succeeds

## Notes
- The soft mode should be additive — hard mode remains the default and is unchanged
- Consider reusing `UpsellBanner` or its design patterns for the soft gate banner
- The subscribe banner should use Norse voice ("Unlock the forge's full power" or similar)
- Closes #126
