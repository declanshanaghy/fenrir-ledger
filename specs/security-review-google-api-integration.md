# Plan: Security Review — Google API Integration

## Task Description
Conduct a comprehensive security review of Fenrir Ledger's Google API integration surfaces: OAuth 2.0 with PKCE, Google Sheets URL import, Google Drive Picker, token handling, and environment variable scoping. The review combines static code analysis (Heimdall agent) with runtime browser traffic inspection (Playwright) to verify that secrets, tokens, and user data are handled securely across the full stack.

## Objective
Produce a structured security report with severity-tagged findings, data flow diagrams, a compliance checklist, and actionable remediation steps. Any CRITICAL or HIGH findings will be addressed by FiremanDecko before the review is considered complete.

## Problem Statement
Fenrir Ledger integrates with Google APIs across multiple surfaces (OAuth, Sheets import, Drive Picker). These integrations handle authentication tokens, API keys, and user data. A focused security review is needed to verify that:

1. Credentials are properly scoped and not over-permissioned
2. Tokens are stored, transmitted, and refreshed securely
3. No 3rd party API keys are exposed to the client side, neither in the bundle nor returned via unauthenticated API calls
4. User data from Google (spreadsheet content, profile info) is handled safely
5. The OAuth flow follows current best practices (PKCE, state parameter, etc.)
6. No secrets leak in browser network traffic or console output

## Solution Approach
Two-pronged review:

1. **Static analysis** (Heimdall): Read-only code audit of all API routes, auth flows, environment variables, import pipelines, and error handling. Produces a structured report with OWASP Top 10 findings.

2. **Runtime traffic inspection** (Playwright via `playwright-bowser`): Start the dev server, exercise the OAuth flow and import wizard, and capture all network requests and console messages. Verify no secrets appear in client-side traffic, JS bundles, or error responses.

Both prongs feed into a single consolidated security report.

## Relevant Files
Use these files to complete the task:

### API Routes (auth guard verification)
- `development/frontend/src/app/api/auth/token/route.ts` — OAuth token exchange proxy (only route exempt from requireAuth)
- `development/frontend/src/app/api/sheets/import/route.ts` — Sheets import endpoint (requireAuth protected)
- `development/frontend/src/app/api/config/picker/route.ts` — Picker API key delivery (requireAuth protected)

### Auth Flow
- `development/frontend/src/lib/auth/require-auth.ts` — Server-side auth guard
- `development/frontend/src/lib/auth/verify-id-token.ts` — Google id_token JWT verification (jose + JWKS)
- `development/frontend/src/lib/auth/refresh-session.ts` — Silent token refresh logic
- `development/frontend/src/lib/auth/session.ts` — Session read/write to localStorage
- `development/frontend/src/contexts/AuthContext.tsx` — Client-side auth state provider
- `development/frontend/src/app/sign-in/page.tsx` — PKCE flow initiation
- `development/frontend/src/app/auth/callback/page.tsx` — OAuth callback handler

### Import Pipeline (data flow + SSRF surface)
- `development/frontend/src/lib/sheets/import-pipeline.ts` — URL import orchestrator
- `development/frontend/src/lib/sheets/csv-import-pipeline.ts` — CSV import orchestrator
- `development/frontend/src/lib/sheets/fetch-csv.ts` — Server-side URL fetch (SSRF surface)
- `development/frontend/src/lib/sheets/parse-url.ts` — Google Sheets URL parser (allowlist check)
- `development/frontend/src/lib/sheets/extract-cards.ts` — LLM extraction entry point
- `development/frontend/src/lib/sheets/prompt.ts` — LLM prompt with sensitive data rules
- `development/frontend/src/lib/llm/extract.ts` — LLM provider factory (reads API keys)

### Client Hooks (token handling)
- `development/frontend/src/hooks/useSheetImport.ts` — Import hook (sends auth headers)
- `development/frontend/src/hooks/usePickerConfig.ts` — Fetches picker API key from server
- `development/frontend/src/hooks/useDriveToken.ts` — Drive token management (localStorage)
- `development/frontend/src/lib/google/gis.ts` — GIS script loader + token client

### Configuration
- `development/frontend/.env.example` — Environment variable template (reference for expected vars)
- `development/frontend/.env.local` — Actual env values (gitignored, check exists)
- `development/frontend/next.config.ts` — Next.js config (rewrites, no env leaks)
- `development/frontend/src/middleware.ts` — Middleware (currently pass-through)
- `development/frontend/.gitignore` — Verify .env files are excluded

### Security Rules
- `CLAUDE.md` — Secret masking rules, API route auth rules, no-public-secrets rules
- `designs/product/backlog/security-review-google-sheets-api.md` — Review checklist and scope

### Agent Definition
- `.claude/agents/heimdall.md` — Heimdall security agent prompt and workflow

## Implementation Phases

### Phase 1: Foundation
- Start the frontend dev server so the runtime inspection has a live target
- Verify all env vars are configured (or note which are missing — affects test coverage)

### Phase 2: Core Implementation
- **Static analysis**: Heimdall reads every file in scope, traces data flows, checks OWASP Top 10 patterns, verifies requireAuth on all API routes, audits env var scoping
- **Runtime inspection**: Playwright navigates the app as an unauthenticated user and as an authenticated user, capturing all network requests and console messages. Checks for leaked secrets, exposed API keys, verbose error responses.

### Phase 3: Integration & Polish
- Consolidate static + runtime findings into a single report
- If CRITICAL/HIGH findings exist, FiremanDecko fixes them
- Loki re-validates after fixes
- Final report saved to `development/security-review-report.md`

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
  - Role: Fix any CRITICAL/HIGH findings identified by the review
  - Agent Type: fireman-decko-principal-engineer
  - Resume: true
- Validator
  - Name: loki
  - Role: Re-validate fixes, final QA pass
  - Agent Type: loki-qa-tester
  - Resume: true

**Note**: Freya and Luna are not needed — this is a security audit, not a product/UX task. Heimdall (static analysis) and Playwright-Bowser (runtime inspection) are the primary review tools, with FiremanDecko only engaged if remediations are needed.

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Start Dev Server
- **Task ID**: start-dev-server
- **Depends On**: none
- **Assigned To**: orchestrator (self)
- **Agent Type**: N/A (run `.claude/scripts/frontend-server.sh start` directly)
- **Parallel**: false
- Run `.claude/scripts/frontend-server.sh status` to check if already running
- If not running, run `.claude/scripts/frontend-server.sh start`
- Verify the server is accessible at `http://localhost:9653`

### 2. Static Security Analysis (Heimdall)
- **Task ID**: heimdall-static-review
- **Depends On**: none
- **Assigned To**: heimdall
- **Agent Type**: general-purpose (Heimdall agent definition is read-only, use general-purpose with Heimdall's prompt)
- **Parallel**: true (can run alongside Task 3)
- Invoke with the full Heimdall workflow from `.claude/agents/heimdall.md`
- Scope: full codebase sweep of all Google API integration surfaces
- Specific checks:
  - Verify `requireAuth()` is called in all API routes (except `/api/auth/token`)
  - Audit all `process.env` references — no server secrets with `NEXT_PUBLIC_` prefix
  - Verify `.env*` files are gitignored
  - Verify `next.config.ts` doesn't leak env vars to client
  - Trace data flows: user input → API route → pipeline → LLM → response
  - Check SSRF surface in `fetch-csv.ts` — verify URL is constrained to `google.com`
  - Check `parse-url.ts` hostname validation
  - Verify token storage: session in localStorage, refresh_token handling
  - Verify error responses don't leak stack traces, file paths, or internal details
  - Check OAuth scopes are minimal (`drive.file`, `spreadsheets.readonly`)
  - Check the LLM prompt includes sensitive data filtering rules
  - Verify `GOOGLE_CLIENT_SECRET` never appears in client-reachable code
  - Check for hardcoded secrets or tokens in source files
- Save report to `development/heimdall-static-review.md`

### 3. Runtime Browser Traffic Inspection (Playwright)
- **Task ID**: browser-traffic-inspection
- **Depends On**: start-dev-server
- **Assigned To**: playwright-bowser
- **Agent Type**: playwright-bowser-agent
- **Parallel**: true (can run alongside Task 2)
- Navigate to `http://localhost:9653` as an unauthenticated user
- Capture all network requests during page load — verify:
  - No 3rd party API keys exposed to client side, neither in the bundle nor returned via API calls
  - No `GOOGLE_CLIENT_SECRET` in any response body or JS chunk
  - No `FENRIR_ANTHROPIC_API_KEY` or `FENRIR_OPENAI_API_KEY` in any response
- Check console messages for leaked secrets or sensitive errors
- Navigate to `/cards/new` — verify no auth tokens in unauthenticated requests
- Attempt to call `GET /api/config/picker` without auth — verify 401 response
- Attempt to call `POST /api/sheets/import` without auth — verify 401 response
- Attempt to call `POST /api/auth/token` with invalid body — verify error response doesn't leak secrets
- Check the JS bundle for string patterns: grep the fetched JS for API key patterns, secret patterns
- Capture screenshots of error states to `tmp/playwright-bowser/`
- Save findings to `tmp/playwright-bowser/browser-traffic-report.md`

### 4. Consolidate Security Report
- **Task ID**: consolidate-report
- **Depends On**: heimdall-static-review, browser-traffic-inspection
- **Assigned To**: orchestrator (self)
- **Agent Type**: N/A (orchestrator merges reports)
- **Parallel**: false
- Read `development/heimdall-static-review.md` and `tmp/playwright-bowser/browser-traffic-report.md`
- Merge findings into a single consolidated report at `development/security-review-report.md`
- Deduplicate findings found by both static and runtime analysis
- Assign final severity ratings
- Create a prioritized remediation list
- If no CRITICAL/HIGH findings: skip to Task 6
- If CRITICAL/HIGH findings exist: proceed to Task 5

### 5. Remediate CRITICAL/HIGH Findings (if any)
- **Task ID**: remediate-findings
- **Depends On**: consolidate-report
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Read the consolidated report at `development/security-review-report.md`
- Fix all CRITICAL findings (mandatory before any deployment)
- Fix all HIGH findings (should fix in current sprint)
- Do NOT fix MEDIUM/LOW/INFO — document them as accepted risk or future work
- Run `cd development/frontend && npx tsc --noEmit` after fixes
- Run `cd development/frontend && npx next build` to verify no regressions
- Commit fixes on a branch `fix/security-review-remediations`
- Update `development/qa-handoff.md` with what was fixed

### 6. Final Validation
- **Task ID**: validate-all
- **Depends On**: consolidate-report, remediate-findings
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- If remediations were made (Task 5 ran):
  - Verify each fix addresses the finding it claims to fix
  - Re-run the browser traffic inspection checks from Task 3 against the fixed code
  - Run `cd development/frontend && npx tsc --noEmit`
  - Run `cd development/frontend && npx next build`
  - Run Playwright test suite: `cd quality && npx playwright test`
- If no remediations needed:
  - Validate the consolidated report is complete and well-structured
  - Confirm all checklist items are addressed
- Produce a QA verdict: SHIP or FIX REQUIRED
- Save verdict to `development/qa-handoff.md`

## Acceptance Criteria

- [ ] Heimdall static review report produced with all OWASP Top 10 categories checked
- [ ] All 3 API routes verified for `requireAuth()` (or documented exception)
- [ ] All `process.env` references audited for correct `NEXT_PUBLIC_` scoping
- [ ] `.env*` files confirmed gitignored
- [ ] Browser traffic inspection confirms no 3rd party API keys exposed to client side
- [ ] Browser traffic inspection confirms no secrets in JS bundles or console output
- [ ] Unauthenticated API calls to protected routes return 401
- [ ] Error responses verified to not leak internal details
- [ ] SSRF surface in import pipeline verified (URL constrained to google.com domain)
- [ ] Data flow diagrams produced for OAuth flow and import pipeline
- [ ] Consolidated report saved to `development/security-review-report.md`
- [ ] All CRITICAL/HIGH findings remediated (or escalated if unreachable)
- [ ] Build passes after any remediations: `npx next build`
- [ ] Existing Playwright tests pass after any remediations

## Validation Commands
Execute these commands to validate the task is complete:

- `cd development/frontend && npx tsc --noEmit` — Type-check the codebase
- `cd development/frontend && npx next build` — Verify the build succeeds
- `cd quality && npx playwright test` — Run full Playwright test suite (216 tests)
- `cat development/security-review-report.md` — Verify consolidated report exists and is complete
- `cat development/qa-handoff.md` — Verify QA verdict is present

## Notes

- **No new dependencies required** — this is a review task, not an implementation task.
- **Heimdall is read-only** — it cannot edit files. All remediations go through FiremanDecko.
- **The token exchange proxy (`/api/auth/token`) is the only route exempt from `requireAuth()`** — this is by design (ADR-008) because the client is obtaining its token there.
- **Session storage is localStorage** — this is a known architectural decision (ADR-005/006). The review should note the tradeoffs (XSS exposure vs anonymous-first model) but not flag it as a finding unless a concrete exploit path exists.
- **Drive token is also in localStorage** (`fenrir:drive-token`) — same tradeoff applies.
- **The `parse-url.ts` already validates hostname ends with `google.com`** — this constrains the SSRF surface to Google domains. Heimdall should verify this is sufficient.
- **The LLM prompt already includes sensitive data filtering rules** — Heimdall should verify these are adequate (card numbers, SSNs, CVVs).
- **Browser traffic inspection requires the dev server running** — Task 1 must complete before Task 3 starts.
- **If Google OAuth credentials are not configured in `.env.local`**, some runtime checks (authenticated flows) may be limited. Document what couldn't be tested.
