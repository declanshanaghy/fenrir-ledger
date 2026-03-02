# Plan: Patreon Subscription Integration

## Task Description

Integrate Patreon as the subscription platform for Fenrir Ledger's premium features. This is a full-stack feature that spans product definition, UX design, backend API integration, frontend feature gating, and webhook handling. The backlog item (`designs/product/backlog/patreon-subscription-integration.md`) is in Discovery status — this plan begins with Freya interviewing Odin (the human operator) to define the product requirements, then proceeds through design and implementation.

## Objective

When complete, Fenrir Ledger has a tiered subscription model powered by Patreon. Free users retain full access to all current features (anonymous-first model preserved). Patreon supporters unlock premium features. The app checks Patreon membership status via API and displays appropriate feature gates with Norse-themed upsell prompts.

## Problem Statement

Fenrir Ledger currently has no monetization path. All features are free and there's no mechanism to offer premium capabilities to paying supporters. Patreon is the preferred platform because it aligns with the project's indie/creator ethos and avoids the complexity of Stripe/payment processing. The challenge is integrating Patreon's OAuth + API into the existing Google OIDC anonymous-first auth architecture without breaking the current user experience.

## Solution Approach

### Architecture: Patreon as Entitlement Layer (Not Identity)

Patreon does NOT replace Google OIDC for authentication. Instead, Patreon acts as an **entitlement layer**:

1. **Identity**: Google OIDC (existing, unchanged) — who you are
2. **Entitlement**: Patreon membership — what you can access
3. **Anonymous**: Still works — no Patreon, no Google, all current features

### Linking Flow

```
User signs in with Google (existing flow)
  → User clicks "Link Patreon" in settings
  → OAuth redirect to Patreon (authorization_code grant)
  → Callback returns Patreon user ID + access token
  → Server checks Patreon API: is this user a member of our campaign?
  → Store { patreonUserId, tier, linkedAt } in the user's session/profile
  → Feature gates unlock based on tier
```

### Entitlement Checking

Two mechanisms for keeping entitlements fresh:
1. **On-demand API check**: When a gated feature is accessed, call Patreon API to verify active membership
2. **Webhooks**: Patreon sends `members:pledge:create/update/delete` events — update entitlements in real-time

Since Fenrir Ledger uses localStorage (no database), the pragmatic approach for v1 is:
- Store Patreon entitlement in localStorage alongside the Fenrir session
- Re-verify via API on each app load (lightweight GET to our server proxy)
- Webhooks are P2 (requires a persistent data store)

### Feature Gating Pattern

```tsx
<PatreonGate tier="supporter" fallback={<UpsellBanner />}>
  <PremiumFeature />
</PatreonGate>
```

Similar to the existing `<AuthGate>` component pattern.

## Relevant Files

### Existing Files to Modify

- `development/frontend/src/lib/types.ts` — Add `PatreonEntitlement` type, extend `FenrirSession` with optional Patreon fields
- `development/frontend/src/contexts/AuthContext.tsx` — Add Patreon entitlement state, expose `patreonTier` and `linkPatreon`/`unlinkPatreon` methods
- `development/frontend/src/components/shared/AuthGate.tsx` — Reference for the `PatreonGate` pattern
- `development/frontend/src/app/layout.tsx` — No change (AuthProvider already wraps everything)
- `development/frontend/.env.example` — Add `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `PATREON_CAMPAIGN_ID`
- `development/frontend/src/middleware.ts` — No change expected

### New Files to Create

- `designs/product/backlog/patreon-subscription-brief.md` — Full product brief from Freya/Odin interview
- `designs/ux-design/interactions/patreon-subscription.md` — Interaction spec from Luna
- `designs/architecture/adr-patreon-integration.md` — ADR for Patreon as entitlement layer
- `development/frontend/src/app/api/patreon/callback/route.ts` — OAuth callback handler (server-side)
- `development/frontend/src/app/api/patreon/membership/route.ts` — Membership status check proxy
- `development/frontend/src/lib/patreon/types.ts` — Patreon API types
- `development/frontend/src/lib/patreon/api.ts` — Patreon API client (server-side)
- `development/frontend/src/lib/patreon/entitlement.ts` — Client-side entitlement storage + checking
- `development/frontend/src/hooks/usePatreon.ts` — Hook for Patreon state (tier, linking, unlinking)
- `development/frontend/src/components/shared/PatreonGate.tsx` — Feature gate component
- `development/frontend/src/components/shared/PatreonUpsell.tsx` — Norse-themed upsell banner
- `development/frontend/src/app/settings/page.tsx` — Settings page with Patreon linking (or add to existing UI)

## Implementation Phases

### Phase 1: Product Discovery + Design
Freya interviews Odin to define tiers, features, pricing. Luna designs the subscription UX — upsell banners, settings page, linking flow. FiremanDecko writes the ADR.

### Phase 2: Core Integration
Patreon OAuth linking, API proxy routes, entitlement storage, membership verification. The `PatreonGate` component and `usePatreon` hook.

### Phase 3: Feature Gating + Polish
Wire gates to specific features, upsell banners, mobile responsiveness, edge cases (expired membership, unlinked account). Full QA.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
  - This is critical. Your job is to act as a high level director of the team, not a builder.
  - Your role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate this by using the Task* Tools to manage coordination between the team members.
  - Communication is paramount. You'll use the Task* Tools to communicate with the team members and ensure they're on track to complete the plan.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Product Owner
  - Name: freya
  - Role: Product definition, tier structure, acceptance criteria, interview with Odin
  - Agent Type: freya-product-owner
  - Resume: true
- UX Designer
  - Name: luna
  - Role: Wireframes, upsell banners, settings page, linking flow UX
  - Agent Type: luna-ux-designer
  - Resume: true
- Builder
  - Name: fireman-decko
  - Role: Architecture, Patreon API integration, feature gating implementation
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

### 1. Product Discovery Interview — Freya/Odin
- **Task ID**: product-discovery
- **Depends On**: none
- **Assigned To**: freya
- **Agent Type**: freya-product-owner
- **Parallel**: false
- Conduct a product discovery interview with Odin (the human operator) to define:
  - Which features are free vs. paid (all current features MUST remain free per anonymous-first model ADR-006)
  - Patreon tier structure: names, pricing, benefits (Norse-themed tier names)
  - Feature gating approach: hard lock vs. soft upsell banners
  - Premium feature candidates (e.g., cloud sync, multi-household, advanced analytics, export, priority support)
  - Migration path for existing users (no existing users lose access to anything)
- Output: Full product design brief at `designs/product/backlog/patreon-subscription-brief.md`
- **Acceptance Criteria**:
  - Brief defines at least 2 tiers (free + 1 paid) with clear feature boundaries
  - Norse-themed tier names chosen
  - No current free feature is gated behind a paywall
  - Brief answers all 6 open questions from the backlog item

### 2. UX Design — Subscription Interactions
- **Task ID**: ux-design
- **Depends On**: product-discovery
- **Assigned To**: luna
- **Agent Type**: luna-ux-designer
- **Parallel**: false
- Design the subscription UX based on Freya's product brief:
  - "Link Patreon" button placement (settings page or profile menu)
  - Patreon OAuth flow experience (redirect + callback states)
  - Upsell banners for gated features (Norse-themed, non-aggressive)
  - Tier badge display (in top bar or user menu)
  - Unlink flow and confirmation
  - Mobile responsive at 375px
  - Accessibility requirements
- Output: Interaction spec at `designs/ux-design/interactions/patreon-subscription.md` with wireframes
- **Acceptance Criteria**:
  - Wireframes for: settings page with Patreon link, upsell banner, tier badge
  - Interaction spec covers all states: unlinked, linking, linked, expired, error
  - Mobile responsive spec
  - Accessibility requirements documented

### 3. Architecture Decision Record
- **Task ID**: adr-patreon
- **Depends On**: product-discovery
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (can run alongside ux-design)
- Write ADR for Patreon integration at `designs/architecture/adr-patreon-integration.md`:
  - Decision: Patreon as entitlement layer, not identity provider
  - Context: Existing Google OIDC (ADR-005), anonymous-first model (ADR-006)
  - Consequences: Two linking steps (Google sign-in + Patreon link), localStorage entitlement cache
  - Alternatives considered: Stripe, Ko-fi, direct payment
  - API route auth: Patreon callback exempt from requireAuth (like /api/auth/token), membership check requires auth
- **Acceptance Criteria**:
  - ADR follows project convention
  - Clearly documents why Patreon is entitlement-only (not identity)
  - Documents the two-token architecture: Google for identity, Patreon for entitlements

### 4. Patreon OAuth + API Proxy Routes
- **Task ID**: patreon-api-routes
- **Depends On**: adr-patreon, ux-design
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Implement server-side Patreon integration:
  - Create `development/frontend/src/lib/patreon/types.ts` — Patreon API v2 types (campaign, member, tier)
  - Create `development/frontend/src/lib/patreon/api.ts` — Server-side Patreon API client:
    - `exchangeCode(code)` — OAuth authorization_code → access_token + refresh_token
    - `getMembership(accessToken, campaignId)` — Check if user is an active member, get tier
    - `refreshToken(refreshToken)` — Refresh expired Patreon access token
  - Create `development/frontend/src/app/api/patreon/callback/route.ts`:
    - Receives OAuth callback from Patreon with `code` param
    - Exchanges code for tokens via Patreon API
    - Fetches membership status
    - Returns entitlement info to the client (tier, active status)
    - NOT behind requireAuth (user is mid-OAuth flow)
  - Create `development/frontend/src/app/api/patreon/membership/route.ts`:
    - Protected by requireAuth (ADR-008)
    - Accepts Patreon access token from client
    - Checks current membership status via Patreon API
    - Returns current tier and active status
  - Add env vars to `.env.example`: `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `PATREON_CAMPAIGN_ID`
- Branch: `feat/patreon-api`
- **Acceptance Criteria**:
  - OAuth callback exchanges code for tokens
  - Membership check returns tier + active status
  - Error handling for: invalid code, expired token, non-member, network error
  - PATREON_CLIENT_SECRET never exposed to the browser
  - Build passes, TypeScript passes

### 5. Client-Side Entitlement + usePatreon Hook
- **Task ID**: patreon-client
- **Depends On**: patreon-api-routes
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Implement client-side Patreon state management:
  - Create `development/frontend/src/lib/patreon/entitlement.ts`:
    - localStorage key: `"fenrir:patreon"` — stores `{ tier, active, patreonUserId, linkedAt, checkedAt }`
    - `getEntitlement()`, `setEntitlement()`, `clearEntitlement()`
    - `isEntitlementStale()` — true if `checkedAt` is older than 1 hour
  - Create `development/frontend/src/hooks/usePatreon.ts`:
    - `tier: PatreonTier | null` — current tier (null = not linked)
    - `isActive: boolean` — is the membership active
    - `isLinked: boolean` — is Patreon linked
    - `isLoading: boolean` — checking membership status
    - `linkPatreon()` — initiates Patreon OAuth redirect
    - `unlinkPatreon()` — clears entitlement from localStorage
    - `refreshEntitlement()` — calls membership API to re-verify
    - On mount: if linked and stale, silently refresh entitlement
  - Extend `FenrirSession` type or create parallel `PatreonEntitlement` type in `types.ts`
  - Clear Patreon entitlement on sign-out (add to AuthContext signOut)
- Branch: `feat/patreon-client`
- **Acceptance Criteria**:
  - Hook correctly manages Patreon state lifecycle
  - Entitlement is verified on app load if stale
  - Linking initiates OAuth redirect to Patreon
  - Unlinking clears localStorage
  - Sign-out clears Patreon entitlement
  - TypeScript strict passes

### 6. PatreonGate + Upsell Components
- **Task ID**: patreon-ui
- **Depends On**: patreon-client
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Build the UI components per Luna's wireframes:
  - Create `development/frontend/src/components/shared/PatreonGate.tsx`:
    - Props: `tier: PatreonTier`, `fallback?: ReactNode`, `children: ReactNode`
    - If user's tier >= required tier → render children
    - If not → render fallback (defaults to `<PatreonUpsell />`)
    - While loading → render nothing (or skeleton)
    - Pattern: mirrors `<AuthGate>` from `components/shared/AuthGate.tsx`
  - Create `development/frontend/src/components/shared/PatreonUpsell.tsx`:
    - Norse-themed upsell banner: "Unlock the deeper runes..."
    - "Support on Patreon" CTA button linking to the campaign page
    - Non-aggressive, informational tone (not a hard block)
    - Amber/gold styling consistent with SafetyBanner
    - Responsive at 375px, 44px touch targets
  - Add Patreon link/unlink to settings or profile area per Luna's wireframes
  - Add tier badge to user menu (if signed in + linked)
- Branch: `feat/patreon-ui`
- **Acceptance Criteria**:
  - PatreonGate correctly gates content based on tier
  - Upsell banner renders with Norse theme
  - Link/unlink Patreon works from the settings UI
  - Tier badge displays when linked
  - Mobile responsive at 375px
  - Accessible: keyboard navigable, proper aria labels
  - Build passes, TypeScript passes

### 7. Wire Feature Gates to Specific Features
- **Task ID**: wire-feature-gates
- **Depends On**: patreon-ui
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Based on Freya's product brief, wrap premium features with `<PatreonGate>`:
  - Identify which components/routes get gated (defined in product brief)
  - Add `<PatreonGate>` wrappers with appropriate tier levels
  - Ensure free features remain completely ungated
  - Test that anonymous users are unaffected
- Branch: `feat/patreon-gates`
- **Acceptance Criteria**:
  - Premium features gated per product brief
  - All current free features remain accessible without Patreon
  - Anonymous users see no Patreon-related UI
  - Signed-in users without Patreon see upsell banners on gated features

### 8. QA Validation
- **Task ID**: validate-all
- **Depends On**: wire-feature-gates
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Full QA validation of the Patreon integration:
  - Build validation: `cd development/frontend && npm run build`
  - TypeScript validation: `cd development/frontend && npx tsc --noEmit`
  - Lint validation: `cd development/frontend && npx next lint`
- **Functional validation**:
  - Anonymous user: no Patreon UI visible, all current features work
  - Signed-in user (no Patreon): sees upsell banners on premium features, can link Patreon
  - Signed-in user (with Patreon): sees premium features unlocked, tier badge displayed
  - Link flow: Google sign-in → Link Patreon → OAuth redirect → callback → entitlement stored
  - Unlink flow: Settings → Unlink → confirmation → entitlement cleared
  - Expired membership: upsell banner shown, graceful degradation
  - Sign-out clears both Google session and Patreon entitlement
- **Non-regression**:
  - Existing auth flow (Google OIDC) unchanged
  - Import workflow (Path A, C) unchanged
  - All Sprint 1-5 features unchanged
- **Accessibility**:
  - Upsell banners keyboard navigable
  - PatreonGate fallback has proper aria attributes
  - 44px touch targets on all Patreon-related buttons
- Report: SHIP / FIX REQUIRED with specific issues

## Acceptance Criteria

### Product
- [ ] At least 2 tiers defined (free + 1 paid) with Norse-themed names
- [ ] No current free feature is gated behind a paywall
- [ ] Premium feature list is clearly defined in the product brief
- [ ] Anonymous-first model (ADR-006) is preserved

### Integration
- [ ] Patreon OAuth linking works (redirect → callback → entitlement stored)
- [ ] Membership status is verified via Patreon API
- [ ] Entitlement is cached in localStorage with staleness check
- [ ] PATREON_CLIENT_SECRET stays server-side (never in browser bundle)
- [ ] Patreon callback route is NOT behind requireAuth
- [ ] Membership check route IS behind requireAuth (ADR-008)

### UI/UX
- [ ] PatreonGate component gates features by tier
- [ ] Norse-themed upsell banners display on gated features
- [ ] Link/unlink Patreon available in settings
- [ ] Tier badge displayed for linked users
- [ ] Mobile responsive at 375px
- [ ] Keyboard accessible, WCAG AA compliant

### Non-Regression
- [ ] Anonymous users: all current features work, no Patreon UI
- [ ] Google sign-in/sign-out unchanged
- [ ] Import workflow unchanged
- [ ] TypeScript clean, build clean, lint clean

## Validation Commands

Execute these commands to validate the task is complete:

- `cd development/frontend && npx tsc --noEmit` — Type-check the codebase
- `cd development/frontend && npx next lint` — Lint the codebase
- `cd development/frontend && npm run build` — Verify the build succeeds

## Notes

### Patreon API v2 Reference
- Docs: https://docs.patreon.com/
- OAuth: `https://www.patreon.com/oauth2/authorize` (authorization_code grant)
- Token: `https://www.patreon.com/api/oauth2/token`
- Membership: `GET /api/oauth2/v2/identity?include=memberships&fields[member]=patron_status,currently_entitled_tiers`
- Campaign: `GET /api/oauth2/v2/campaigns/{id}/members`

### Patreon OAuth Scopes
- `identity` — read the user's profile (required)
- `identity[email]` — read the user's email (optional, for matching)
- `campaigns.members` — read campaign membership (required for entitlement check)

### Environment Variables
```
PATREON_CLIENT_ID=your-patreon-client-id
PATREON_CLIENT_SECRET=your-patreon-client-secret
PATREON_CAMPAIGN_ID=your-campaign-id
```

### No New npm Dependencies
Patreon API v2 uses standard REST + OAuth2. No SDK needed — use `fetch()` directly.

### Patreon Setup (Manual Steps)
1. Create a Patreon account and campaign
2. Go to https://www.patreon.com/portal/registration/register-clients
3. Create an OAuth client with redirect URI: `http://localhost:9653/api/patreon/callback` and `https://fenrir-ledger.vercel.app/api/patreon/callback`
4. Copy Client ID, Client Secret, and Campaign ID to `.env.local`
5. Define tiers on Patreon campaign page (must match the tier IDs used in the app)

### Webhook Support (P2 — Future)
Webhooks (`members:pledge:create/update/delete`) require a persistent data store to process events when the user is not active. Since Fenrir Ledger uses localStorage, webhooks are deferred to P2 when a backend database is added. For v1, entitlements are verified on-demand via API.

### Graceful Degradation
If Patreon's API is down:
- Cached entitlement in localStorage is used (trust last-known state)
- If no cache exists, treat as free tier (never block features due to API failure)
- Log the error, show a subtle "Couldn't verify subscription" note
