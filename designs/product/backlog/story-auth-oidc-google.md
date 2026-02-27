# Story: OIDC Authentication — Google Login (Iteration 1)

- **As a**: credit card churner and rewards optimizer
- **I want**: to sign in with my Google account
- **So that**: my card portfolio is private, tied to my identity, and accessible from any device I own
- **Priority**: P1-Critical
- **Status**: Backlog
- **Created**: 2026-02-27
- **Sprint target**: Sprint 3 (pending capacity confirmation)

---

## Problem Statement

Today every visitor to Fenrir Ledger shares the same hardcoded `"default-household"` and the same
localStorage bucket on that device. That means:

1. **No privacy** — anyone who opens the app on the same browser can see all cards.
2. **No portability** — data lives in one browser's localStorage; a phone, a second laptop, or an
   incognito window starts fresh.
3. **No household sharing** — a partner or spouse can't see the same portfolio without manually
   syncing data.

The `Household` entity and its `id` field were deliberately scoped from Sprint 1 to support this
future. The foundation is already laid — auth is the next structural unlock.

Google is the right first provider: it is the identity provider most churners already use for
spreadsheet-based tracking (Google Sheets), so the context switch is minimal. Microsoft and generic
OIDC expand reach in subsequent iterations.

---

## Target User

Credit card churners and rewards optimizers who:

- Manage 5–20+ active cards and cannot afford to lose their data
- Switch between devices (desktop, phone, tablet)
- May share a household with a partner who also churns
- Already trust Google as their identity layer for other financial tools (Sheets, Drive, Gmail
  travel alerts)

---

## Desired Outcome

After this ships, a user can:

1. Land on Fenrir Ledger for the first time and sign in with one click via Google.
2. Have their card portfolio stored server-side, scoped to their Google identity.
3. Return from any device, sign in again, and see the exact same portfolio.
4. Sign out, leaving no sensitive financial data exposed in the browser.

---

## Scope — Iteration 1 (This Story)

### In Scope

- Google OIDC sign-in / sign-out via NextAuth.js (or equivalent Next.js-compatible auth library)
- Server-side session management (JWT or database session — see Open Questions)
- Household creation on first sign-in (replace `"default-household"` with a real UUID scoped to
  the authenticated user's Google `sub` claim)
- All card data reads and writes scoped to the authenticated household — unauthenticated users see
  a sign-in gate, not the dashboard
- Protected routes: `/`, `/cards/new`, `/cards/[id]/edit` require authentication
- Sign-out flow clears the session and redirects to a landing/sign-in page
- Mobile-responsive sign-in page (minimum 375 px)
- `.env.example` updated with required OIDC environment variable placeholders
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`)

### Out of Scope (Iteration 1)

- Microsoft, GitHub, Facebook, Apple, or any other OIDC provider
- Multi-household support (one user = one household for now)
- Household member invitation or sharing
- Migration UI for users with existing localStorage data (see Open Questions)
- Account deletion / data export
- Email/password login
- Magic link / passwordless login

---

## Future Iterations

| Iteration | Scope |
|-----------|-------|
| Iteration 2 | Microsoft (Entra / Azure AD) OIDC provider — same NextAuth adapter pattern |
| Iteration 3 | Generic OIDC provider support (GitHub, Apple, etc.) — "Sign in with any OIDC" |
| Iteration 4 | Household sharing — invite a partner by email; shared card portfolio |
| Iteration 5 | localStorage migration wizard — offer to import Sprint-1-era local data on first sign-in |

---

## Priority Justification

This is P1-Critical for three compounding reasons:

1. **Data privacy is a baseline expectation** — financial data (credit limits, annual fee dates,
   sign-up bonus amounts) is sensitive. Leaving it accessible to any browser visitor is a
   ship-blocker for any real user adoption.
2. **Multi-device is table stakes** — churners live on their phones. A desktop-only, single-device
   tool loses half its value.
3. **Household model is already there** — the `Household` entity exists, `householdId` is on every
   `Card`, and `"default-household"` is explicitly marked in the code comments as a Sprint-1
   placeholder. Shipping OIDC is the planned promotion of that scaffold into a real feature.

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `Household` entity with `id` field | Done (Sprint 1) | `development/src/src/lib/types.ts` |
| `householdId` on every `Card` | Done (Sprint 1) | All card storage already scoped |
| Backend data store (not localStorage) | Blocker | localStorage cannot be shared across devices; a server-side store (Postgres, Planetscale, Supabase, etc.) is required before auth is useful |
| Vercel hosting | Partial | Vercel deployment exists; environment variable injection for OIDC secrets needs confirmation |
| `.env.example` pattern | Done (Sprint 1) | Already in place; needs new OIDC var slots |

The **critical blocker** is the backend data store. Authenticating a user is pointless if their
cards are still stored in that device's localStorage. Auth and server-side persistence must ship
together in the same sprint (or the persistence story must land first in the preceding sprint).

---

## Acceptance Criteria

- [ ] Unauthenticated users navigating to `/` are redirected to a sign-in page
- [ ] Sign-in page renders correctly on mobile (375 px min width) and desktop
- [ ] "Sign in with Google" button initiates the Google OIDC flow
- [ ] After successful Google auth, user is redirected to the dashboard (`/`)
- [ ] A `Household` record is created in the server-side store on first sign-in, keyed to the
      user's Google `sub` claim (subsequent sign-ins reuse the existing household)
- [ ] All card reads and writes are scoped to the authenticated user's `householdId`
- [ ] A user signed in as User A cannot access or modify User B's cards
- [ ] "Sign out" clears the session and redirects to the sign-in page
- [ ] After sign-out, navigating to `/` redirects back to the sign-in page (no stale session)
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are
      documented in `.env.example` with placeholder values and comments
- [ ] No OIDC credentials or secrets appear in any committed file
- [ ] `npm run build` passes with zero errors post-implementation
- [ ] TypeScript strict mode: zero new type errors introduced
- [ ] Session token is not exposed in client-side JavaScript (HttpOnly cookie or equivalent)

---

## Open Questions for Principal Engineer

1. **Auth library choice**: NextAuth.js v5 (Auth.js) is the natural fit for Next.js App Router.
   Are there constraints (bundle size, license, Vercel compatibility) that favor an alternative
   (Clerk, Lucia, custom)?

2. **Session strategy**: JWT (stateless, no DB needed for sessions) vs. database sessions (more
   revocable, requires a sessions table). What does the chosen backend data store make cheapest?

3. **Backend data store**: What persistent store do we use? Options: Supabase (Postgres + auth
   built-in), Planetscale (MySQL serverless), Vercel Postgres (KV or Neon). This decision gates
   the auth story — they ship together.

4. **localStorage migration**: Existing Sprint-1 users have data in localStorage
   (`fenrir_ledger:cards:*`). Should iteration 1 include a migration prompt ("We found local data —
   import it to your account?") or explicitly defer it? Product preference is to defer but the
   Principal Engineer should assess whether the migration hook is easier to wire now vs. later.

5. **Household naming**: On first sign-in, what should the household `name` field be set to?
   Options: Google display name + "'s Household", email prefix, or left blank for user to fill in.
   Product preference: `"{Google display name}'s Household"` as a sensible default.

6. **Multi-tenant data isolation**: At the database query level, is row-level security (e.g.,
   Supabase RLS policies) sufficient, or should every query be double-checked at the API layer?
   Product requirement: User A must never see User B's data — the enforcement mechanism is a
   technical decision.

7. **Vercel environment variables**: `NEXTAUTH_URL` must match the deployment URL. How is this
   handled across preview deployments vs. production? (Preview deployments get dynamic URLs.)

---

## UX Notes

This story requires a sign-in page and a sign-out flow. These surfaces are minimal for Iteration 1
but must respect the Saga Ledger design system (dark Nordic War Room aesthetic, void-black
background, gold accent, Cinzel display font). A Product Design Brief collaboration with Luna is
required before this story enters the "Ready" column.

Suggested sign-in page copy direction (kenning style, per `design/copywriting.md`):
- Headline: "Name yourself before the wolf names you."
- Sub-copy: "Sign in to guard your chain-ledger."
- Button label: "Enter with Google"

---

## Handoff Notes for Principal Engineer

- **Non-negotiable**: Auth and server-side persistence ship together. There is no user value in
  auth without cross-device data.
- **Non-negotiable**: `Household.id` must become a real UUID tied to the Google `sub` claim.
  The hardcoded `"default-household"` string must be retired on this story.
- **Non-negotiable**: Session token must be HttpOnly (not readable by client-side JS).
- **Acceptable trade-off**: JWT vs. database sessions — Principal Engineer decides based on the
  chosen data store.
- **Acceptable trade-off**: Specific database/backend service — Principal Engineer proposes, Freya
  approves before implementation begins.
- **Deferred by product**: localStorage migration wizard — log a follow-up story in the backlog.

---

## Engineering Response

**From**: FiremanDecko (Principal Engineer)
**Date**: 2026-02-27
**Status**: Recommendations provided — awaiting Freya approval before Sprint 3 planning begins

Full ADR and technical spec have been written:
- **ADR**: `architecture/adrs/ADR-004-oidc-auth-and-persistence.md`
- **Spec**: `development/spec-auth-oidc-google.md`

---

### Answers to Open Questions (1–7)

**1. Auth library choice**

Recommendation: **Auth.js v5 (`next-auth@beta`)**.

It is the right tool for Next.js App Router. It handles the Google OIDC flow, JWT sessions, HttpOnly
cookie management, CSRF protection, and Vercel preview URL strategy in a single library with no
lock-in. Clerk is eliminated because its opinionated component system conflicts with the Saga Ledger
design system and its cost model is wrong for this stage. Lucia requires more boilerplate for a
problem Auth.js already solves. Custom OIDC is not justified.

Auth.js v5 is still RC but is production-stable and is the official App Router-first release.

**2. Session strategy**

Recommendation: **JWT sessions (stateless)**.

We need `householdId` on every API call to scope database queries. A JWT payload containing
`{ sub, householdId, name, email }` gives us that without a DB round-trip per request. Database
sessions add a `sessions` table and a lookup on every request for a benefit we don't need today
(individual session revocation). That feature is deferred; the architecture allows adding a JWT
blocklist later without a full rewrite.

Sessions are HttpOnly cookies by default in Auth.js — the non-negotiable is met.

**3. Backend data store**

Recommendation: **Supabase (PostgreSQL)**.

True Postgres is the right model for relational household→cards data. Supabase's free tier covers
development and early production. The Vercel integration auto-populates environment variables.
Row Level Security gives us a defence-in-depth isolation layer (see Q6). The Auth.js Supabase
adapter and `@supabase/supabase-js` client are both mature.

PlanetScale is eliminated (ended free tier — minimum $39/month). Vercel Postgres (Neon) is
viable but thinner ecosystem and no RLS. Firebase Firestore fights our relational schema.

This decision gates the sprint — **Freya must approve this choice before Sprint 3 planning**.

**4. localStorage migration**

Recommendation: **Defer entirely to Iteration 5**.

There are no public users with Sprint-1 localStorage data to migrate. Wiring a migration hook
now adds non-trivial scope and requires a Luna-designed UI surface. The `storage.ts` abstraction
and localStorage keys remain intact — they are the read path for the Iteration 5 import wizard.
`storage.ts` becomes dead code in Sprint 3 (not called, not deleted).

A separate backlog story is logged for the migration wizard (Iteration 5 per your story table).

**5. Household naming on first sign-in**

Recommendation: **Agree with Freya's proposal** — `"{Google display name}'s Household"`.

The Google `name` claim is used. This is editable in future sprints (household rename flow).

**6. Multi-tenant isolation**

Recommendation: **API layer as primary enforcement + Supabase RLS as defence in depth**.

Every API route handler extracts `householdId` from the JWT and injects it into every query as
an explicit `WHERE household_id = ?` clause. This is testable and code-reviewable.

RLS policies (`app.household_id` Postgres configuration parameter) are added as a fallback that
catches any query that accidentally omits the WHERE clause. The service role key (which bypasses
RLS) is never used in application code — only in migration scripts.

**Caveat**: Supabase's PgBouncer connection pooler may complicate the `set_config` approach for
RLS in transaction mode. If it proves fragile during Sprint 3, the fallback is API-layer-only
isolation (drop RLS policies, keep all WHERE clauses). This is flagged as an open question in the
spec.

**7. Vercel preview deployment URLs**

Recommendation: Use **`AUTH_TRUST_HOST=1`** for Vercel preview environments.

- Production: `NEXTAUTH_URL=https://fenrir-ledger.vercel.app` (explicit, no trust host)
- Preview: `AUTH_TRUST_HOST=1`, `NEXTAUTH_URL` not set (Auth.js reads `X-Forwarded-Host`)
- Development: `NEXTAUTH_URL=http://localhost:9653`

This is the documented Auth.js v5 / Vercel pattern. It does not weaken CSRF protection.

**Important caveat**: Google OAuth requires redirect URIs to be pre-registered. Dynamic preview
URLs cannot be pre-registered individually. This means Google sign-in will not work on preview
deployments unless we use a fixed custom domain for previews. Options are discussed in the spec
(see Open Question #3). **This needs a Freya decision before Sprint 3 starts.**

---

### New Open Questions (surfaced by engineering)

**OQ-1: Sign-in page UX spec**
A Luna wireframe is required for the sign-in page before that story is "Ready". Copy direction
is in this story; the visual spec (logo placement, button styling, background treatment) is pending.
The sign-in page can be scoped as its own story in Sprint 3.

**OQ-2: Supabase project setup**
Should there be separate Supabase projects for dev, preview, and production, or a single project
with environment-scoped tables? Recommendation: separate dev and production projects. Preview
deployments share dev. **Needs Freya/DevOps confirmation.**

**OQ-3: Google OAuth and preview deployments**
Google OAuth redirect URIs must be pre-registered. Dynamic Vercel preview URLs cannot be
pre-registered. Decision options:
  (a) Preview deployments cannot run Google OAuth — only production OIDC works. Preview tests
      mock or skip auth. (Simplest. Recommended.)
  (b) Add a fixed custom domain for preview (`preview.fenrir-ledger.com`). (More infrastructure.)
  (c) Use a separate Google OAuth app for development that has `localhost` registered, plus a
      production app for `fenrir-ledger.vercel.app`. (Already standard practice — probably already
      implied by having separate `GOOGLE_CLIENT_ID` values per environment.)
**Decision needed before Sprint 3 planning.**

---

### Blockers Before Sprint 3 Can Start

1. **Freya approves data store decision (Supabase)** — gates everything.
2. **Freya approves auth library (Auth.js v5)** — gates Sprint 3 story writing.
3. **Luna produces sign-in page wireframe** — gates that story entering "Ready".
4. **Decision on Google OAuth and preview deployments** (OQ-3 above).
5. **Supabase project created** — someone must click "New Project" and copy the credentials into
   Vercel before the sprint can be validated in a test environment.

---

### Sprint 3 Story Scope Estimate

This feature set requires more than one sprint story. Suggested breakdown (max 5 stories total):

| Story | Scope | Complexity |
|-------|-------|-----------|
| 3.1 | Supabase schema + migration SQL + deployment script | M |
| 3.2 | Auth.js v5 config + Google OIDC + session JWT | M |
| 3.3 | Middleware + protected routes + sign-in page | M |
| 3.4 | API routes for cards (GET list, POST, GET by id, PUT, DELETE) + household API | L |
| 3.5 | Dashboard migration: swap localStorage reads for API calls | M |

These map neatly to 5 stories — exactly the sprint max. The deployment script story (3.1) must
land before any auth story is testable in QA's environment.
