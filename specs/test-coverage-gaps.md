# Plan: Fill Playwright Test Coverage Gaps

## Task Description
Add Playwright test coverage for 3 pages that currently have zero tests: `/sign-in`, `/auth/callback`, and `/cards/[id]/edit`.

## Objective
After this plan is complete, every user-facing page in the app will have at least basic Playwright smoke tests ensuring the page renders, key elements are visible, and navigation works.

## Relevant Files
Use these files to complete the task:

- `development/frontend/src/app/sign-in/page.tsx` — sign-in page (needs tests)
- `development/frontend/src/app/auth/callback/page.tsx` — OAuth callback (needs tests)
- `development/frontend/src/components/cards/CardForm.tsx` — card form component used by edit page
- `quality/test-suites/` — existing test suites for reference patterns

### New Files
- `quality/test-suites/auth/sign-in.spec.ts` — sign-in page tests
- `quality/test-suites/auth/auth-callback.spec.ts` — auth callback tests
- `quality/test-suites/card-crud/edit-card.spec.ts` — card edit page tests

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

- Validator
  - Name: loki
  - Role: QA testing, validation, ship/no-ship decision
  - Agent Type: loki-qa-tester
  - Resume: true

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Write Sign-In Page Tests
- **Task ID**: sign-in-tests
- **Depends On**: none
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: true (with task 2 and 3)
- Create `quality/test-suites/auth/sign-in.spec.ts`
- Test: page renders without errors
- Test: Google sign-in button is visible and has correct aria-label
- Test: page title/heading is present
- Test: page is responsive at 375px viewport

### 2. Write Auth Callback Tests
- **Task ID**: auth-callback-tests
- **Depends On**: none
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: true (with task 1 and 3)
- Create `quality/test-suites/auth/auth-callback.spec.ts`
- Test: callback page handles missing params gracefully (no crash)
- Test: callback page shows loading/redirect state
- Note: real OAuth flow can't be tested — test graceful degradation only

### 3. Write Card Edit Tests
- **Task ID**: edit-card-tests
- **Depends On**: none
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: true (with task 1 and 2)
- Create `quality/test-suites/card-crud/edit-card.spec.ts`
- Test: edit form renders with pre-populated data (create a card first, then navigate to edit)
- Test: form fields are editable
- Test: save button is present and functional
- Reference existing pattern in `quality/test-suites/card-crud/`

### 4. Final Validation
- **Task ID**: validate-all
- **Depends On**: sign-in-tests, auth-callback-tests, edit-card-tests
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Run all new tests: `npx playwright test quality/test-suites/auth/ quality/test-suites/card-crud/edit-card.spec.ts`
- Verify all pass
- Run full test suite to check no regressions

## Stories

### Story 1: Fill Test Coverage Gaps
- **Slug**: test-coverage-gaps
- **Branch**: test/coverage-gaps
- **Depends On**: none
- **Assigned To**: loki
- **Tasks**: sign-in-tests, auth-callback-tests, edit-card-tests, validate-all
- **Acceptance Criteria**:
  - `quality/test-suites/auth/sign-in.spec.ts` exists and passes
  - `quality/test-suites/auth/auth-callback.spec.ts` exists and passes
  - `quality/test-suites/card-crud/edit-card.spec.ts` exists and passes
  - No regressions in existing test suites

## Acceptance Criteria
- Every user-facing page has at least one Playwright smoke test
- All new tests pass
- No regressions in existing tests

## Validation Commands
Execute these commands to validate the task is complete:

- `cd development/frontend && npx playwright test quality/test-suites/auth/` - Run auth page tests
- `cd development/frontend && npx playwright test quality/test-suites/card-crud/edit-card.spec.ts` - Run card edit tests
- `cd development/frontend && npx playwright test` - Full regression suite

## Notes
- Auth callback testing is limited since we can't trigger real OAuth — focus on graceful degradation
- Card edit tests should create a card via the UI first, then navigate to edit
- Closes #134
