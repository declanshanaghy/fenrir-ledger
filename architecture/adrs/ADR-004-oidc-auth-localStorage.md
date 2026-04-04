# ADR-004: OIDC Authentication with Auth.js v5 + Per-Household localStorage Namespacing

## Status: Superseded by ADR-005

> **Note:** ADR-004 was never used in production. The Auth.js v5 approach was replaced before
> shipping by ADR-005 (Authorization Code + PKCE with server token proxy). This document is
> retained for historical context only. See [ADR-005](ADR-005-auth-pkce-public-client.md) for
> the current auth architecture.

## Context

Sprint 3, Story 3.1 introduces authentication to Fenrir Ledger. Previously the app ran in
single-user mode with a hardcoded `DEFAULT_HOUSEHOLD_ID = "default-household"`. The product
decision is to gate the app behind Google OAuth so that each user's card data is isolated
to their account. No remote database is introduced — localStorage remains the persistence
layer. The `householdId` concept (introduced in ADR-002 from day one) now maps directly to
the authenticated user's Google identity.

Three sub-decisions required:

1. Which auth library to use
2. How to manage the session (token strategy + cookie)
3. How to namespace localStorage so different Google accounts cannot see each other's data

---

## Decision 1: Auth Library

### Options Considered

#### 1. Auth.js v5 (`next-auth@beta`) — chosen

Auth.js is the de facto standard auth library for Next.js App Router. Version 5 (currently
in beta) was built specifically for the App Router and Edge Runtime. It provides:
- First-class Google OAuth provider with minimal config
- JWT session strategy with HttpOnly cookie (no server-side session store required)
- `auth()` server-side helper and `useSession()` client-side hook
- Built-in CSRF protection and token rotation
- Middleware integration for route protection

**Pros**:
- Zero additional backend required — no database, no session store
- Next.js App Router native: works in Server Components, middleware, and client components
- Well-maintained, battle-tested, large ecosystem
- JWT strategy is stateless — no additional infrastructure

**Cons**:
- v5 is still in beta (`next-auth@beta`); minor API surface may change before stable release
- OAuth setup requires registering a Google Cloud project and managing client credentials

#### 2. Lucia v3

Lightweight session management library for Node.js + any database.

**Pros**: Extremely lean, full control over session storage.

**Cons**: Requires a database adapter for session storage — contradicts our decision to keep
localStorage as the only persistence layer (no server-side DB). Adding a DB just for sessions
would be a significant architectural escalation for Sprint 3.

#### 3. Custom OAuth flow (no library)

Build the Google OAuth PKCE flow manually.

**Pros**: Zero dependencies, full control.

**Cons**: Non-trivial to implement securely (state parameter, PKCE, token validation, CSRF).
The attack surface of rolling custom auth exceeds the risk of using a beta library with broad
community adoption.

### Decision

Use **Auth.js v5 (`next-auth@beta`)** with the Google provider.

---

## Decision 2: Session Strategy

### Options Considered

#### 1. JWT sessions (stateless) — chosen

Auth.js stores the session as a signed, encrypted JWT in an HttpOnly cookie. No server-side
session store is required. The JWT contains standard OIDC claims plus our custom `householdId`.

**Pros**:
- Stateless — no database, no Redis, no session table
- Vercel Edge-compatible
- HttpOnly cookie prevents XScript access to the token
- Works identically on Vercel production and local dev

**Cons**:
- JWTs cannot be individually revoked without a denylist (acceptable for a personal tool;
  revoking access via Google OAuth app settings is sufficient)
- Token size grows with custom claims (minor concern; we add only `householdId`)

#### 2. Database sessions

Requires a database adapter and session table to store and look up sessions.

**Pros**: Instant revocation, audit trail.

**Cons**: Requires a database — contradicts ADR-003's no-remote-storage constraint for Sprint 3.
Remote storage is explicitly out of scope.

### Decision

Use **JWT sessions** (stateless). Session is stored in an HttpOnly cookie named `__Secure-authjs.session-token`
(or `authjs.session-token` on non-HTTPS origins, i.e., local dev).

---

## Decision 3: `householdId` Derivation

### Options Considered

#### 1. Use Google `sub` claim directly as `householdId` — chosen

The `sub` claim in a Google ID token is a stable, globally unique identifier for the Google
account. It does not change when the user changes their email address or name.

**Pros**:
- No additional mapping table or generation step
- Stable — survives email changes, name changes
- Already present in the OIDC token; no extra API call needed

**Cons**:
- The `sub` value is opaque (e.g., `"115304845638166398388"`). It is not human-readable in
  localStorage DevTools. Acceptable — this is an internal implementation detail.

#### 2. Generate a UUID on first login and store server-side

**Pros**: Shorter, more legible identifier.

**Cons**: Requires a database or external store to persist the mapping from `sub` → UUID.
Out of scope.

### Decision

`householdId = token.sub` (Google account ID). Set in the Auth.js JWT callback and surfaced
via the session object as `session.user.householdId`.

---

## Decision 4: localStorage Key Namespacing

### Options Considered

#### Option A: Keep flat keys, filter by householdId in memory

Keep the existing `fenrir_ledger:cards` flat array. All cards for all users in the same browser
share this one key. `getCards(householdId)` already filters by `householdId` in memory.

**Pros**: No migration, no key change.

**Cons**: All users sharing a browser (e.g., a family computer) would write into the same
array. While the filter prevents cross-contamination in reads, the array grows unboundedly.
More importantly, it is semantically incorrect — keys should express the ownership boundary.

#### Option B: Per-household keys — chosen

Namespace all keys by `householdId`:
```
fenrir_ledger:{householdId}:cards       → JSON array of Card objects for this user
fenrir_ledger:{householdId}:household   → the Household object for this user
fenrir_ledger:schema_version            → global version key (not per-household)
```

**Pros**:
- Clean isolation — each user's data is completely self-contained under their key namespace
- Straightforward to inspect in DevTools
- No possibility of cross-contamination between accounts on shared browsers
- Consistent with the intent of `householdId` as an ownership boundary

**Cons**:
- Old flat-key data (`fenrir_ledger:cards`) is orphaned. There are no real users yet, so
  there is nothing to migrate. The old keys are simply abandoned.
- Every storage function must accept `householdId` and use it in the key construction.
  The existing functions already accepted `householdId` as a parameter — this is a small
  refactor, not a redesign.

### Decision

Use **Option B: per-household keys**.

The schema version key remains global (`fenrir_ledger:schema_version`) because it tracks
the schema format version, not per-user data.

`DEFAULT_HOUSEHOLD_ID` is removed from `constants.ts`. It is no longer meaningful — the
`householdId` is always derived from the authenticated session.

---

## Decision 5: Vercel Preview Deployments

Google OAuth restricts redirect URIs to explicitly authorized domains. Vercel preview
deployments generate unique URLs per commit (e.g., `fenrir-ledger-abc123.vercel.app`).
These cannot be pre-registered.

### Accepted Approach

Google OAuth is fully functional only on the production domain (`fenrir-ledger.vercel.app`).
Preview deployments serve the UI but redirect to the Google OAuth error page when sign-in
is attempted. This is acceptable — preview deployments are for layout/UI review, not
authenticated testing.

`AUTH_TRUST_HOST=true` is set in the environment so Auth.js does not reject the dynamic
Vercel preview host as an untrusted origin.

---

## Consequences

**Positive**:
- The app is gated behind Google auth from Sprint 3 onward — each user's card data is
  private to their Google account
- JWT strategy requires zero additional infrastructure
- `householdId = sub` is stable and derived automatically — no user management UI needed
- Per-household localStorage keys cleanly enforce data isolation in the browser

**Negative**:
- Google OAuth requires a Google Cloud project with a configured OAuth consent screen.
  Credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) must be provided via `.env.local`.
- Auth.js v5 is in beta. If a breaking change occurs before stable release, a minor migration
  will be required.
- Old flat-key localStorage data (`fenrir_ledger:cards`, `fenrir_ledger:households`) is
  orphaned in browsers that previously ran Sprint 1–2. Users who ran the app unauthenticated
  will not see their old cards after auth lands. This is accepted — there are no real users
  and no production data to preserve.
- Google OAuth only works on `fenrir-ledger.vercel.app` (production). Preview deployments
  cannot authenticate.

**Constraints introduced**:
- All pages require an authenticated session. Unauthenticated requests are redirected to the
  Google OAuth consent screen.
- `householdId` must be threaded through all storage function call sites from the session.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_SECRET` must be present in the
  environment. The app will not start without them.
- `AUTH_URL` must be set to the correct origin in both local dev and production environments.
