# Story: Optional Login — Google OIDC + Cloud Sync Upsell (Iteration 1)

- **As a**: credit card churner and rewards optimizer
- **I want**: to optionally sign in with my Google account to unlock cloud sync
- **So that**: I can access my card portfolio across multiple devices without losing my locally-tracked data
- **Priority**: P3-Medium
- **Status**: Done (Iteration 1 shipped; Iteration 2 deferred to GA)
- **Created**: 2026-02-27
- **Last revised**: 2026-03-01 — Iteration 1 shipped (commit 60d8f64, QA 24/24); Iteration 2 deferred to GA
- **Sprint target**: Iteration 1 shipped Sprint 5; Iteration 2 deferred to GA

---

## Context: Why This Changed

This story was originally written as a P1-Critical sign-in gate — unauthenticated users
were blocked from the dashboard entirely. That model has been superseded.

**New direction**: Users can open Fenrir Ledger and begin tracking cards immediately
with no login required. localStorage is the primary data store for all users.
A locally-generated UUID (`householdId`) stored under `fenrir:household` serves as the
anonymous user's stable household identity. Login is an optional upgrade that unlocks
cloud sync and multi-device access when remote storage ships at GA.

The `Household.id` field already exists and is already scoped correctly. The anonymous
householdId model requires no structural change to the data layer.

---

## Problem Statement

An anonymous user's data lives in one browser's localStorage. If they switch devices,
clear their browser, or want to share their portfolio with a partner, they have no
path to do that without manually exporting their data.

Login solves this — but only when remote storage exists to back it up. Before that,
login provides no tangible user benefit beyond scoping to a Google sub claim instead of
a locally-generated UUID. The friction of OAuth on first load is not worth a namespacing
difference the user cannot see.

This story becomes relevant at GA when cloud sync ships.

---

## Target User

Credit card churners and rewards optimizers who:

- Already use the app anonymously and want to graduate to multi-device access
- Manage 5–20+ active cards and cannot afford to lose their data if they switch devices
- May share a household with a partner who also churns
- Are willing to create an account in exchange for a concrete benefit (cloud sync)

This is not the first-time user. The first-time user needs no login. This story serves
the returning power user who has already validated the product's value.

---

## Desired Outcome

After this ships (at GA), a user can:

1. See a non-blocking "Sync to cloud" upsell in the app — banner or settings prompt.
2. Tap "Sign in to sync" and authenticate with one click via Google.
3. Have their existing anonymous localStorage data offered for migration to their
   cloud-backed account.
4. Return from any device, sign in, and see their portfolio exactly as they left it.

---

## Scope — Iteration 1 (This Story)

### In Scope

- Non-blocking upsell surface: a dismissible banner or settings option inviting the user
  to "Sign in to sync your data to the cloud"
- Google OIDC sign-in via Authorization Code + PKCE (public client — no client secret)
- On first sign-in: offer to migrate existing anonymous localStorage data to the new
  cloud-backed household
- `householdId` for signed-in users derived from Google `sub` claim (as originally
  specified)
- Tokens stored in localStorage under `fenrir:auth`
- `id_token` claims (`sub`, `name`, `email`, `picture`) used to populate the signed-in
  header profile (avatar, name, dropdown)
- Sign-out flow: clear `fenrir:auth` from localStorage; return user to anonymous state
  (do not delete card data; revert to local anonymous `householdId`)
- Mobile-responsive sign-in surface (minimum 375 px)
- `.env.example` updated with `NEXT_PUBLIC_GOOGLE_CLIENT_ID` placeholder

### Out of Scope (Iteration 1)

- Remote storage — this story requires GA planning to be triggered first
- Microsoft, GitHub, Facebook, Apple, or any other OIDC provider
- Multi-household support
- Household member invitation or sharing
- Account deletion / data export
- Email/password login

---

## Future Iterations

| Iteration | Scope |
|-----------|-------|
| Iteration 2 | Microsoft (Entra / Azure AD) OIDC provider |
| Iteration 3 | Generic OIDC provider support |
| Iteration 4 | Household sharing — invite a partner by email |
| Iteration 5 | localStorage migration wizard (for legacy anonymous data) |

---

## Anonymous householdId Model (Pre-Login)

The anonymous `householdId` is a UUID generated on first visit and stored in
localStorage under the key `fenrir:household`. It is used as the namespace key for all
card data: `fenrir_ledger:{householdId}:cards`.

This is identical to the signed-in model — the only difference is that the UUID comes
from `crypto.randomUUID()` rather than a Google `sub` claim. The data layer is already
correct; no code changes are required to support anonymous use.

When a user signs in for the first time, they are offered a migration: "We found N cards
from your anonymous session — add them to your cloud account?" This is an explicit user
choice, not an automatic merge.

---

## Acceptance Criteria

- [ ] The app opens directly to the dashboard for all users — no sign-in gate or redirect
- [ ] On first anonymous visit, a `householdId` UUID is generated and stored under
      `fenrir:household` in localStorage
- [ ] All card reads and writes use the anonymous `householdId` as the namespace key
- [ ] The upsell banner/prompt is dismissible; once dismissed, it does not reappear
      until the user navigates to settings
- [ ] The upsell never blocks navigation, form submission, or any core feature
- [ ] "Sign in to sync" initiates the Google OIDC Authorization Code + PKCE flow
- [ ] After successful sign-in, user is returned to the dashboard (not a sign-in page)
- [ ] On first sign-in with existing anonymous data, user is offered migration (explicit
      choice; migration failure does not block sign-in)
- [ ] "Sign out" clears `fenrir:auth` from localStorage and reverts to anonymous state;
      card data is preserved under the anonymous `householdId`
- [ ] Sign-in surface renders correctly on mobile (375 px min width) and desktop
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is documented in `.env.example`
- [ ] No client secret or private key appears in any committed file
- [ ] `npm run build` passes with zero errors post-implementation
- [ ] TypeScript strict mode: zero new type errors introduced

---

## Open Questions for Principal Engineer

1. **Anonymous householdId generation**: Confirm `crypto.randomUUID()` is available in
   all target browser environments (Next.js App Router client components). If not,
   confirm fallback strategy.

2. **localStorage key for anonymous householdId**: Product preference: `fenrir:household`
   (separate from the card data namespace `fenrir_ledger:{householdId}:cards`).

3. **Anonymous-to-signed-in migration**: Confirm the merge strategy — product preference
   is an explicit user prompt with "yes / skip" choice. No automatic silent merge.

4. **Sign-out anonymous state**: After sign-out, confirm the app uses the anonymous
   `householdId` (from `fenrir:household`) rather than a new UUID. The user should
   return to their pre-sign-in local data, not a blank state.

5. **Google OAuth and preview deployments**: Google OAuth redirect URIs must be
   pre-registered. Dynamic Vercel preview URLs cannot be pre-registered. Product
   preference: preview deployments cannot run Google OAuth; production OIDC only;
   preview tests mock or skip auth. Confirm before implementation begins.

6. **Upsell placement**: Where should the cloud-sync upsell appear? Product preference:
   a dismissible top-of-page banner on the dashboard, plus a "Sync to cloud" option in
   settings. Principal Engineer to confirm no layout conflict with existing TopBar.

---

## UX Notes

This story requires a minimal sign-in surface and a cloud-sync upsell pattern. Both
must respect the Saga Ledger design system. Importantly, the sign-in page must feel
like an optional upgrade, not a required gate — the design should communicate choice,
not obligation.

Sign-in page copy direction:
- Headline: *"Carry your ledger across every hall."*
- Sub-copy: "Sign in to back up your cards and access them from any device."
- Button: "Sign in with Google" (functional Voice 1)
- Back link: "Continue without signing in" (functional Voice 1)

Upsell banner copy direction:
- Banner text: *"Your chains are stored here alone."*
- Sub-copy: "Sign in to keep them safe across all your devices."
- CTA: "Sign in to sync" (functional Voice 1)
- Dismiss: "Not now" (functional Voice 1)

A Product Design Brief collaboration with Luna is required before this story enters
the "Ready" column. See `product/handoff-to-luna-anon-auth.md` for current UX handoff.

---

## Handoff Notes for Principal Engineer

- **Non-negotiable**: No sign-in gate. Any unauthenticated user must reach the dashboard
  without redirect or prompt.
- **Non-negotiable**: Anonymous `householdId` is a locally-generated UUID stored in
  `fenrir:household` — not a hardcoded string, not a session token.
- **Non-negotiable**: All card data scoped to `householdId` — same key structure whether
  anonymous or signed-in.
- **Non-negotiable**: Authorization Code + PKCE public client — no client secret anywhere.
- **Non-negotiable**: Login upsell is non-blocking and dismissible. It must never
  interrupt or prevent a core feature action.
- **Non-negotiable**: localStorage remains the card data layer until GA. No backend
  database is introduced in this story.
- **Acceptable trade-off**: PKCE client library choice — Principal Engineer selects.
- **Acceptable trade-off**: Silent token refresh strategy — Principal Engineer proposes.
- **Deferred by product**: Remote storage, multi-device sync, any database — GA only.
- **Deferred by product**: localStorage migration wizard — Iteration 5.

---

## Pre-GA Decisions Needed

1. **GA planning triggered**: This story does not enter "Ready" until GA planning has
   been explicitly initiated by the product owner.
2. **Luna produces sign-in page and upsell wireframes** — gates this story entering
   "Ready". See `product/handoff-to-luna-anon-auth.md`.
3. **Google OAuth and preview deployments**: Product preference is production OIDC only;
   preview deployments mock auth. Confirm or counter-propose at planning.
