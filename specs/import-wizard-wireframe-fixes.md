# Plan: Import Wizard Wireframe Fixes

## Task Description
Fix 3 wireframe mismatches in the Import Wizard components: add "Details" expandable link to the compact safety banner, add CSV format help section below the drop zone, and standardize button text to "Begin Import" across all import paths.

## Objective
After this plan is complete, the Import Wizard implementation will match the wireframe specs in `designs/ux-design/wireframes/import/`. All 3 issues (#131, #132, #133) will be resolved.

## Relevant Files
Use these files to complete the task:

- `development/frontend/src/components/sheets/SafetyBanner.tsx` — compact variant needs "Details" expandable link (lines 99-110)
- `development/frontend/src/components/sheets/CsvUpload.tsx` — needs format help section + button text fix
- `development/frontend/src/components/sheets/ShareUrlEntry.tsx` — button text fix ("Import" -> "Begin Import")
- `designs/ux-design/wireframes/import/safety-banner.html` — wireframe reference for compact banner
- `designs/ux-design/wireframes/import/csv-upload.html` — wireframe reference for format help + button text
- `designs/ux-design/interactions/import-workflow-v2.md` — interaction spec reference

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

### 1. Add Details Expandable Link to Compact Safety Banner
- **Task ID**: safety-banner-details
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (with task 2 and 3)
- In `SafetyBanner.tsx`, add a "Details" button/link to the compact variant that toggles inline expansion
- When expanded, show the include/exclude column content from the full variant
- Use local React state (`expanded` boolean) — no localStorage persistence
- The "Details" link must meet 44px min-height touch target
- Add `aria-label="View full safety details"` to the link
- Reference wireframe: `designs/ux-design/wireframes/import/safety-banner.html` lines 237-241

### 2. Add Format Help Section to CSV Upload
- **Task ID**: csv-format-help
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (with task 1 and 3)
- In `CsvUpload.tsx`, add a "How to export CSV" section below the drop zone
- Include instructions for Google Sheets, Excel, and Numbers
- Always visible (not collapsible)
- Reference wireframe: `designs/ux-design/wireframes/import/csv-upload.html` lines 404-415

### 3. Standardize Button Text to "Begin Import"
- **Task ID**: button-text-fix
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (with task 1 and 2)
- In `CsvUpload.tsx` line 329: change "Import CSV" to "Begin Import"
- In `ShareUrlEntry.tsx` line 77: change "Import" to "Begin Import"

### 4. Write Playwright Tests
- **Task ID**: write-playwright-tests
- **Depends On**: safety-banner-details, csv-format-help, button-text-fix
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Write Playwright tests covering acceptance criteria for each PR
- Tests in `quality/test-suites/import-wireframe-fixes/`
- Assertions derived from acceptance criteria, not current code behavior
- Run tests, verify all pass, commit to each PR's branch

### 5. Final Validation
- **Task ID**: validate-all
- **Depends On**: write-playwright-tests
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Verify Playwright test coverage exists for all new functionality

## Stories

### Story 1: Import Wizard Wireframe Fixes
- **Slug**: import-wireframe-fixes
- **Branch**: fix/import-wireframe-fixes
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Tasks**: safety-banner-details, csv-format-help, button-text-fix
- **Acceptance Criteria**:
  - Compact safety banner has a "Details" link that expands to show include/exclude lists
  - CSV upload step has a "How to export CSV" section below the drop zone
  - All import path buttons read "Begin Import"
  - `npx tsc --noEmit` passes
  - `npx next lint` passes
  - `npx next build` succeeds

### Story 2: QA Validation
- **Slug**: import-wireframe-qa
- **Branch**: test/import-wireframe-qa
- **Depends On**: Story 1
- **Assigned To**: loki
- **Tasks**: write-playwright-tests, validate-all
- **Acceptance Criteria**:
  - Playwright tests verify "Details" link appears and expands in compact banner
  - Playwright tests verify format help section visible on CSV upload step
  - Playwright tests verify "Begin Import" button text on URL and CSV paths
  - All existing tests pass

## Acceptance Criteria
- Compact safety banner includes "Details" expandable link per wireframe spec
- CSV upload includes format help section per wireframe spec
- All import action buttons read "Begin Import"
- No regressions in existing import functionality
- TypeScript compiles, lint passes, build succeeds

## Validation Commands
Execute these commands to validate the task is complete:

- `cd development/frontend && npx tsc --noEmit` - Type-check the codebase
- `cd development/frontend && npx next lint` - Lint the codebase
- `cd development/frontend && npx next build` - Verify the build succeeds

## Notes
- All 3 fixes touch different components so they can be implemented in a single PR
- The "Details" expansion is purely client-side state — no server or localStorage involvement
- Closes #131, #132, #133
