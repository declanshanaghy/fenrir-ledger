# Plan: Stripe Direct Integration (Phase 1 MVP)

## Task Description
Integrate Stripe Direct as the subscription/billing platform for Fenrir Ledger, replacing the feature-flagged Patreon integration. This covers the Phase 1 MVP: Stripe Checkout Sessions, webhook handling, Customer Portal, KV entitlement storage, and all UI updates. The existing `PatreonGate` is renamed to `SubscriptionGate` for platform-agnostic gating. Pricing: single "Karl" tier at $3.99/month.

## Objective
When this plan is complete, users can subscribe to the Karl tier ($3.99/month) via Stripe Checkout, manage their subscription via Stripe Customer Portal, and have their entitlement stored in Vercel KV. The `SUBSCRIPTION_PLATFORM=stripe` flag activates all Stripe routes and UI. The entitlement layer (`useEntitlement`, `SubscriptionGate`) works identically regardless of provider. Heimdall validates webhook security.

## Problem Statement
Fenrir Ledger has a fully operational Patreon integration that is feature-flagged off. Stripe Direct was chosen for better revenue retention ($9.34 vs $8.41 per $10 sub), full billing control, and no platform dependency. The entitlement architecture (ADR-009) was designed for provider portability, but no Stripe provider exists yet. A Stripe account also needs to be created and configured.

## Solution Approach
Mirror the Patreon integration's architecture for Stripe:
- **API Routes**: `/api/stripe/checkout`, `/api/stripe/webhook`, `/api/stripe/membership`, `/api/stripe/portal`, `/api/stripe/unlink`
- **KV Store**: Extend `entitlement-store.ts` with Stripe-specific fields (`stripeCustomerId`, `stripeSubscriptionId`). Dual-key pattern mirroring Patreon: `entitlement:{googleSub}` for authenticated users, `entitlement:stripe:{stripeCustomerId}` for anonymous users. Migration from anonymous → authenticated on Google sign-in.
- **Webhooks**: SHA-256 HMAC signature verification (superior to Patreon's HMAC-MD5)
- **UI**: Rename `PatreonGate` → `SubscriptionGate`, update `SealedRuneModal` and `UpsellBanner` CTAs, create `StripeSettings` component
- **EntitlementContext**: Add Stripe provider path alongside existing Patreon path, switched by feature flag

Odin's requirements (from Freya interview):
1. **Phase 1 MVP only** — monthly billing, no annual/trials/coupons
2. **$3.99/month** for Karl tier (not $5 as originally spec'd)
3. **Stripe account needs setup** — prerequisite
4. **Rename PatreonGate → SubscriptionGate** — included
5. **Heimdall security review** — included
6. **Clean start** — no existing Patreon subscribers to migrate
7. **Anonymous users can subscribe** — Google sign-in is NOT required before subscribing (mirrors Patreon anonymous flow)

## Relevant Files
Use these files to complete the task:

### Existing Files to Modify
- `development/frontend/src/contexts/EntitlementContext.tsx` — Add Stripe provider path (checkout redirect, membership check, unlink), switched by `isStripe()`. Keep Patreon path intact.
- `development/frontend/src/lib/feature-flags.ts` — Already has `isStripe()` / `isPatreon()`. No changes needed.
- `development/frontend/src/lib/kv/entitlement-store.ts` — Add Stripe-specific KV operations (`getStripeEntitlement`, `setStripeEntitlement`). Key format: `entitlement:{googleSub}` (same as Patreon). Add `stripeCustomerId`, `stripeSubscriptionId` fields.
- `development/frontend/src/components/entitlement/PatreonGate.tsx` → Rename to `SubscriptionGate.tsx`. Update imports across codebase.
- `development/frontend/src/components/entitlement/SealedRuneModal.tsx` — Add Stripe checkout CTA when `isStripe()`. Keep Patreon CTA for backwards compat.
- `development/frontend/src/components/entitlement/UpsellBanner.tsx` — Enable for Stripe mode (currently returns `null` when `!isPatreon()`). Update CTA to Stripe checkout.
- `development/frontend/src/app/settings/page.tsx` — Conditionally render `StripeSettings` when `isStripe()`, `PatreonSettings` when `isPatreon()`.
- `development/frontend/package.json` — Add `stripe` npm package.
- `development/frontend/src/lib/auth/require-auth.ts` — No changes (Stripe routes use same auth pattern).

### New Files to Create
- `development/frontend/src/lib/stripe/api.ts` — Stripe SDK wrapper (initialize client, create checkout session, create portal session, retrieve subscription)
- `development/frontend/src/lib/stripe/types.ts` — Stripe-specific types (`StripeEntitlement`, `StripeWebhookEvent`)
- `development/frontend/src/lib/stripe/webhook.ts` — Webhook signature verification (SHA-256 HMAC) and event processing
- `development/frontend/src/app/api/stripe/checkout/route.ts` — POST: Create Stripe Checkout Session, return URL
- `development/frontend/src/app/api/stripe/webhook/route.ts` — POST: Handle Stripe webhook events (no auth, signature verification)
- `development/frontend/src/app/api/stripe/membership/route.ts` — GET: Return current subscription status from KV
- `development/frontend/src/app/api/stripe/portal/route.ts` — POST: Create Stripe Customer Portal session, return URL
- `development/frontend/src/app/api/stripe/unlink/route.ts` — POST: Cancel subscription and clear entitlement in KV
- `development/frontend/src/components/entitlement/StripeSettings.tsx` — Settings page component showing Stripe subscription status, portal link, unlink button
- `development/frontend/src/components/entitlement/SubscriptionGate.tsx` — Renamed from PatreonGate, platform-agnostic feature gating

### Design & Architecture Docs
- `designs/architecture/adr-010-stripe-direct.md` — ADR for Stripe Direct integration decision
- `product/platform-recommendation.md` — Update "Done" checklist items as they're completed

## Implementation Phases
### Phase 1: Foundation — Stripe Account + SDK + KV
Set up Stripe account (test mode), install `stripe` npm package, create Stripe SDK wrapper, extend KV store with Stripe fields, create ADR-010.

### Phase 2: Core — API Routes + Webhook Handler
Build all 5 Stripe API routes. Implement webhook signature verification (SHA-256). Handle checkout.session.completed, customer.subscription.updated, customer.subscription.deleted events. Wire up EntitlementContext with Stripe provider path.

### Phase 3: UI + Rename + Polish
Rename PatreonGate → SubscriptionGate. Build StripeSettings component. Update SealedRuneModal and UpsellBanner for Stripe CTAs. Heimdall security review. Update design docs.

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
- Security
  - Name: heimdall
  - Role: Security review, webhook signature verification, key management audit
  - Agent Type: heimdall
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Stripe Account Setup + SDK Installation
- **Task ID**: stripe-setup
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Odin must create a Stripe account at stripe.com and provide test keys in `.env.local`:
  - `STRIPE_SECRET_KEY=sk_test_...`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`
  - `STRIPE_PRICE_ID=price_...` (create a "Karl" product at $3.99/month in Stripe Dashboard)
  - `SUBSCRIPTION_PLATFORM=stripe`
- Install stripe SDK: `cd development/frontend && npm install stripe`
- Create `src/lib/stripe/api.ts` — initialize Stripe client with `STRIPE_SECRET_KEY`
- Create `src/lib/stripe/types.ts` — `StripeEntitlement` type extending base entitlement
- Write ADR-010: `designs/architecture/adr-010-stripe-direct.md`
- Extend `entitlement-store.ts` with Stripe fields:
  - `stripeCustomerId: string`
  - `stripeSubscriptionId: string`
  - `stripeStatus: string` (active, canceled, past_due, etc.)
  - Dual KV key pattern (mirrors Patreon anonymous flow):
    - Authenticated: `entitlement:{googleSub}` (same as Patreon)
    - Anonymous: `entitlement:stripe:{stripeCustomerId}`
    - Reverse index: `stripe-customer:{stripeCustomerId}` → `{googleSub}` or `stripe:{stripeCustomerId}`
  - Add `getAnonymousStripeEntitlement(stripeCustomerId)`, `setAnonymousStripeEntitlement(stripeCustomerId, entitlement)`
  - Add `getGoogleSubByStripeCustomerId(stripeCustomerId)` (reverse index lookup)
  - Add `migrateStripeEntitlement(stripeCustomerId, googleSub)` (anonymous → authenticated migration)

### 2. Stripe API Routes — Checkout + Webhook
- **Task ID**: stripe-routes
- **Depends On**: stripe-setup
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Create `POST /api/stripe/checkout`:
  - Guard with `if (!isStripe()) return 404`
  - **Dual auth path** (mirrors Patreon anonymous flow):
    - **Authenticated**: call `requireAuth(request)` — use `auth.user.sub` + `auth.user.email`. Set metadata: `{ googleSub: auth.user.sub }`
    - **Anonymous**: skip `requireAuth`. Accept `{ email }` in request body. No `googleSub` in metadata.
  - Create Stripe Checkout Session with: `mode: "subscription"`, `price: STRIPE_PRICE_ID`, `customer_email`, `success_url`, `cancel_url`, metadata as above
  - Return `{ url: session.url }`
- Create `POST /api/stripe/webhook`:
  - NO `requireAuth` — Stripe sends webhooks directly
  - Guard with `if (!isStripe()) return 404`
  - Verify signature: `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` — SHA-256 HMAC
  - Handle events:
    - `checkout.session.completed` → create KV entitlement (tier: "karl", active: true)
      - If metadata has `googleSub`: store as `entitlement:{googleSub}` (authenticated)
      - If no `googleSub`: store as `entitlement:stripe:{stripeCustomerId}` (anonymous)
      - Maintain reverse index: `stripe-customer:{stripeCustomerId}` → `{googleSub}` or `stripe:{stripeCustomerId}`
    - `customer.subscription.updated` → update tier/active status (lookup via reverse index)
    - `customer.subscription.deleted` → set active: false (lookup via reverse index)
  - Extract identity from metadata (`googleSub`) or fall back to `stripeCustomerId` for anonymous users
  - Return 200
- Create `GET /api/stripe/membership`:
  - `requireAuth(request)`
  - Guard with `if (!isStripe()) return 404`
  - Read entitlement from KV by `auth.user.sub`
  - Return `{ tier, active, platform: "stripe", stripeCustomerId, stripeSubscriptionId }`
- Create `POST /api/stripe/portal`:
  - `requireAuth(request)`
  - Guard with `if (!isStripe()) return 404`
  - Read `stripeCustomerId` from KV
  - Create Stripe Customer Portal session: `stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url })`
  - Return `{ url: session.url }`
- Create `POST /api/stripe/unlink`:
  - `requireAuth(request)`
  - Guard with `if (!isStripe()) return 404`
  - Cancel subscription via Stripe API
  - Delete KV entitlement
  - Return `{ success: true }`
- Create `src/lib/stripe/webhook.ts` — webhook event processing helpers

### 3. EntitlementContext + UI Components
- **Task ID**: stripe-ui
- **Depends On**: stripe-routes
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Update `EntitlementContext.tsx`:
  - When `isStripe()`: call `/api/stripe/membership` instead of `/api/patreon/membership`
  - Add `subscribeStripe()` action: POST to `/api/stripe/checkout`, redirect to returned URL
  - Add `openPortal()` action: POST to `/api/stripe/portal`, redirect to returned URL
  - Add `unlinkStripe()` action: POST to `/api/stripe/unlink`
  - Keep all Patreon actions guarded by `isPatreon()`
- Rename `PatreonGate.tsx` → `SubscriptionGate.tsx`:
  - Update component name and all imports across codebase
  - When `isStripe()`: show Stripe-specific locked UI (CTA to checkout instead of Patreon campaign)
  - Keep PatreonGate behavior when `isPatreon()`
- Create `StripeSettings.tsx`:
  - Mirror PatreonSettings structure but for Stripe
  - States: Unsubscribed → "Subscribe for $3.99/month" button | Active Karl → "Manage Subscription" (portal link) + "Cancel" | Canceled → "Resubscribe" button
  - Use Norse styling consistent with existing Settings page
- Update `SealedRuneModal.tsx`:
  - When `isStripe()`: CTA button triggers `subscribeStripe()` from context (Stripe Checkout redirect)
  - Copy: "Unlock with a Karl subscription — $3.99/month"
- Update `UpsellBanner.tsx`:
  - Remove the `if (!isPatreon()) return null` guard
  - When `isStripe()`: CTA triggers Stripe checkout flow
- Update `settings/page.tsx`:
  - `isStripe() ? <StripeSettings /> : isPatreon() ? <PatreonSettings /> : null`

### 4. Heimdall Security Review
- **Task ID**: security-review
- **Depends On**: stripe-routes
- **Assigned To**: heimdall
- **Agent Type**: heimdall
- **Parallel**: true (can run alongside stripe-ui)
- Review all Stripe API routes for:
  - Webhook signature verification correctness (SHA-256 HMAC via `stripe.webhooks.constructEvent`)
  - `requireAuth` on all non-webhook routes
  - `isStripe()` guard on every route
  - No secrets in client-side code (STRIPE_SECRET_KEY must NOT have NEXT_PUBLIC_ prefix)
  - STRIPE_WEBHOOK_SECRET handling (never logged, never exposed)
  - KV data integrity (no PII leaks, proper TTL)
  - CSRF protection on checkout/portal session creation
- Write security report to `security/reports/stripe-direct-integration.md`
- Verdict: APPROVE / BLOCK with specific findings

### 5. Write Playwright Tests
- **Task ID**: write-playwright-tests
- **Depends On**: stripe-ui, security-review
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Write Playwright tests covering acceptance criteria
- Tests in `quality/test-suites/stripe-direct/`
- Test cases:
  - TC-SD-001: Stripe checkout route returns 404 when SUBSCRIPTION_PLATFORM=patreon
  - TC-SD-002: Stripe checkout route requires auth (401 without Bearer token)
  - TC-SD-003: Stripe membership route returns entitlement data
  - TC-SD-004: Stripe portal route requires auth
  - TC-SD-005: Stripe unlink route requires auth
  - TC-SD-006: Stripe webhook route does NOT require auth (200 on valid signature)
  - TC-SD-007: SubscriptionGate renders children when user has Karl tier
  - TC-SD-008: SubscriptionGate renders locked UI when user is Thrall
  - TC-SD-009: StripeSettings renders "Subscribe" button for unsubscribed users
  - TC-SD-010: StripeSettings renders "Manage Subscription" for active Karl users
  - TC-SD-011: UpsellBanner renders in Stripe mode for Thrall users
  - TC-SD-012: SealedRuneModal shows Stripe checkout CTA in Stripe mode
  - TC-SD-013: PatreonGate → SubscriptionGate rename — no broken imports
  - TC-SD-014: Feature flag isStripe() returns true when SUBSCRIPTION_PLATFORM=stripe
  - TC-SD-015: Feature flag isPatreon() returns true when SUBSCRIPTION_PLATFORM=patreon (backwards compat)
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
- Verify Heimdall security review is APPROVE
- Check that `next build` succeeds with no TypeScript errors

## Stories

Group the tasks above into max 5 PR-sized stories. Each story becomes one branch + one PR.
The orchestrator (`/orchestrate`) reads this section to know how to execute.

### Story 1: Stripe Foundation + API Routes
- **Slug**: stripe-foundation
- **Branch**: feat/stripe-foundation
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Tasks**: stripe-setup, stripe-routes
- **Acceptance Criteria**:
  - `stripe` npm package installed
  - `src/lib/stripe/api.ts` initializes Stripe client
  - `src/lib/stripe/types.ts` defines Stripe entitlement types
  - `entitlement-store.ts` has Stripe-specific KV operations
  - All 5 Stripe API routes exist and are guarded with `isStripe()` + `requireAuth` (except webhook)
  - Webhook route verifies SHA-256 HMAC signature via `stripe.webhooks.constructEvent`
  - Webhook handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
  - ADR-010 documents the Stripe Direct decision
  - `cd development/frontend && npx tsc --noEmit` passes
  - `cd development/frontend && npx next build` succeeds

### Story 2: UI Components + PatreonGate Rename
- **Slug**: stripe-ui
- **Branch**: feat/stripe-ui
- **Depends On**: Story 1
- **Assigned To**: fireman-decko
- **Tasks**: stripe-ui
- **Acceptance Criteria**:
  - `PatreonGate` renamed to `SubscriptionGate` across entire codebase
  - `StripeSettings` component renders subscription status and management UI
  - `EntitlementContext` has Stripe provider path (checkout, membership, portal, unlink)
  - `SealedRuneModal` shows Stripe checkout CTA when `isStripe()`
  - `UpsellBanner` works in Stripe mode
  - Settings page conditionally renders `StripeSettings` or `PatreonSettings`
  - Existing Patreon tests still pass when `SUBSCRIPTION_PLATFORM=patreon`
  - `cd development/frontend && npx tsc --noEmit` passes
  - `cd development/frontend && npx next build` succeeds

### Story 3: Security Review
- **Slug**: stripe-security
- **Branch**: feat/stripe-security
- **Depends On**: Story 1
- **Assigned To**: heimdall
- **Tasks**: security-review
- **Acceptance Criteria**:
  - Security report at `security/reports/stripe-direct-integration.md`
  - All Stripe routes reviewed for auth, signature verification, secret handling
  - Verdict: APPROVE (or BLOCK with actionable findings)

## Acceptance Criteria
- `SUBSCRIPTION_PLATFORM=stripe` activates all Stripe routes and UI
- Karl tier subscription at $3.99/month via Stripe Checkout
- Stripe webhook handler verifies SHA-256 HMAC signatures
- Webhook processes `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Customer Portal accessible for subscription management (cancel, update payment)
- Anonymous users can subscribe via Stripe Checkout without Google sign-in
- `stripeCustomerId` used as identity key for anonymous subscribers
- `migrateStripeEntitlement()` migrates anonymous → authenticated on Google sign-in
- `useEntitlement()` hook works identically with both Stripe and Patreon providers
- `PatreonGate` renamed to `SubscriptionGate` — all imports updated, no breakage
- `StripeSettings` component shows subscription status, portal link, cancel option
- `SealedRuneModal` and `UpsellBanner` use Stripe checkout CTA when in Stripe mode
- Existing Patreon integration still works when `SUBSCRIPTION_PLATFORM=patreon`
- Heimdall security review passes (APPROVE verdict)
- `npx tsc --noEmit` passes
- `npx next build` succeeds
- Playwright tests verify Stripe route guards, UI components, and feature flag behavior

## Validation Commands
Execute these commands to validate the task is complete:

- `cd development/frontend && npx tsc --noEmit` - Type-check the codebase
- `cd development/frontend && npx next lint` - Lint the codebase
- `cd development/frontend && npx next build` - Verify the build succeeds
- `cd development/frontend && npx playwright test quality/test-suites/stripe-direct/` - Run Stripe integration tests
- `cd development/frontend && npx playwright test quality/test-suites/feature-flags/` - Verify existing feature flag tests still pass
- `grep -rn 'PatreonGate' development/frontend/src/ --include='*.tsx' --include='*.ts'` - Verify PatreonGate rename is complete (should return 0 results)

## Notes
- **New dependency**: `stripe` — official Stripe Node.js library. Well-maintained, TypeScript-native.
- **Stripe account prerequisite**: Odin must create a Stripe account and configure: a "Karl" product at $3.99/month, a webhook endpoint pointing to `/api/stripe/webhook`, and provide test keys in `.env.local`. This is a manual step that cannot be automated.
- **Anonymous flow supported**: Anonymous users can subscribe without Google sign-in (mirrors Patreon anonymous flow). Identity is keyed by `stripeCustomerId` until the user signs in with Google, at which point `migrateStripeEntitlement()` moves the entitlement to `entitlement:{googleSub}`. The checkout route accepts either an authenticated request (with Bearer token) or an anonymous request (with just `{ email }` in the body).
- **Webhook endpoint**: In development, use Stripe CLI (`stripe listen --forward-to localhost:9653/api/stripe/webhook`) to forward webhook events. In production, configure the webhook URL in Stripe Dashboard.
- **Price ID**: The `STRIPE_PRICE_ID` env var references a recurring price object created in Stripe Dashboard. This is NOT a code-level configuration — it must be created manually in Stripe.
- **Customer Portal**: Stripe's hosted Customer Portal handles subscription management (cancel, update payment method, view invoices). It must be configured in Stripe Dashboard with branding settings.
