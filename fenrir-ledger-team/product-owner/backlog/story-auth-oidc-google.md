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
