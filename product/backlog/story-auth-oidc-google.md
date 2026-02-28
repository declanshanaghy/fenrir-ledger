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
2. Have their localStorage data scoped to their authenticated household ID, not a hardcoded string.
3. Sign out, leaving no sensitive financial data visible to the next browser user.
4. Return from the same device, sign in again, and see their portfolio exactly as they left it.

Note: cross-device sync is explicitly deferred until GA. localStorage remains the data layer through the entire MVP and early-access cycle.

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
| Vercel hosting | Done (Sprint 2) | Vercel deployment live; environment variable injection for OIDC secrets needs verification |
| `.env.example` pattern | Done (Sprint 1) | Already in place; needs new OIDC var slots |

localStorage remains the data layer. The household ID derived from the Google `sub` claim is used
as the localStorage namespace key, replacing the hardcoded `"default-household"` string. No
backend data store is introduced in this story.

---

## Acceptance Criteria

- [ ] Unauthenticated users navigating to `/` are redirected to a sign-in page
- [ ] Sign-in page renders correctly on mobile (375 px min width) and desktop
- [ ] "Sign in with Google" button initiates the Google OIDC flow
- [ ] After successful Google auth, user is redirected to the dashboard (`/`)
- [ ] On first sign-in, a `householdId` is derived from the user's Google `sub` claim and stored
      in the session; subsequent sign-ins reuse the same value
- [ ] The localStorage namespace key is the authenticated `householdId` — not `"default-household"`
- [ ] All card reads and writes in `storage.ts` use the session `householdId` as the namespace
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

1. **Auth library choice**: Auth.js v5 (`next-auth@beta`) is the product-preferred choice for
   Next.js App Router. Are there constraints (bundle size, license, Vercel compatibility) that
   favor an alternative (Clerk, Lucia, custom)?

2. **Session strategy**: JWT (stateless) is preferred — it keeps `householdId` available on
   every request without a round-trip. HttpOnly cookie is non-negotiable. Confirm this works
   cleanly when the JWT payload only needs `{ sub, householdId, name, email }`.

3. **localStorage namespace key**: Confirm the scheme for keying localStorage to the
   authenticated user. Product preference: use the Google `sub` claim (a stable, opaque UUID-like
   string) as the `householdId`. Existing keys under `"default-household"` are orphaned — not
   migrated automatically (that is Iteration 5).

4. **localStorage migration**: Existing Sprint-1 local data lives under `"default-household"`.
   Product preference is to defer migration to Iteration 5. Confirm the migration hook does not
   need to be wired now vs. later — `storage.ts` orphaned keys under the old namespace should
   simply remain inert.

5. **Household naming on first sign-in**: Product preference: `"{Google display name}'s
   Household"` derived from the Google `name` claim. Editable in a future sprint.

6. **Vercel environment variables**: `NEXTAUTH_URL` must match the deployment URL. How is this
   handled across preview deployments vs. production? Auth.js v5 supports `AUTH_TRUST_HOST=1`
   for Vercel preview environments — confirm this is the right pattern.

7. **Google OAuth and preview deployments**: Google OAuth redirect URIs must be pre-registered.
   Dynamic Vercel preview URLs cannot be pre-registered. Product preference: option (a) — preview
   deployments cannot run Google OAuth; production OIDC works; preview tests mock or skip auth.
   Confirm or propose an alternative before Sprint 3 starts.

---

## UX Notes

This story requires a sign-in page and a sign-out flow. These surfaces are minimal for Iteration 1
but must respect the Saga Ledger design system (dark Nordic War Room aesthetic, void-black
background, gold accent, Cinzel display font). A Product Design Brief collaboration with Luna is
required before this story enters the "Ready" column.

Suggested sign-in page copy direction (kenning style, per [`copywriting.md`](../copywriting.md)):
- Headline: "Name yourself before the wolf names you."
- Sub-copy: "Sign in to guard your chain-ledger."
- Button label: "Enter with Google"

---

## Handoff Notes for Principal Engineer

- **Non-negotiable**: `Household.id` must become a real UUID derived from the Google `sub` claim.
  The hardcoded `"default-household"` string is retired on this story.
- **Non-negotiable**: Session token must be HttpOnly (not readable by client-side JS).
- **Non-negotiable**: localStorage remains the data layer. No backend database is introduced.
- **Non-negotiable**: localStorage namespace key switches from `"default-household"` to the
  authenticated `householdId`. Data under the old key is orphaned (not migrated — Iteration 5).
- **Acceptable trade-off**: JWT vs. database sessions — Principal Engineer decides; JWT is
  preferred since it keeps `householdId` in-token without a round-trip.
- **Acceptable trade-off**: Exact localStorage key scheme — Principal Engineer proposes a
  namespacing pattern; Freya approves before implementation begins.
- **Deferred by product**: localStorage migration wizard — tracked as Iteration 5 in the backlog.
- **Deferred by product**: Remote storage, multi-device sync, and any database — GA only.

---

## Pre-Sprint 3 Decisions Needed

1. **Auth library confirmed**: Auth.js v5 (`next-auth@beta`) — awaiting Principal Engineer
   feasibility check on App Router compatibility and Vercel preview environment handling.
2. **Luna produces sign-in page wireframe** — gates the auth story entering "Ready".
3. **Google OAuth and preview deployments**: Product preference is option (a) — preview
   deployments cannot run Google OAuth; production OIDC only. Confirm or counter-propose.
