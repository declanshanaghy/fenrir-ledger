# ADR-006 — Anonymous-First Auth: No Gate, Local householdId, Cloud Sync Upsell

**Status:** Accepted
**Date:** 2026-02-27
**Authors:** FiremanDecko (Principal Engineer)
**Supersedes:** ADR-005 (client-side route protection — redirects to /sign-in removed)

---

## Context

ADR-005 established a PKCE + localStorage session model where:
- `AuthContext` redirected unauthenticated users to `/sign-in` on mount.
- All app routes (`/`, `/valhalla`, `/cards/*`) were effectively protected.
- The `householdId` for storage operations came exclusively from `session.user.sub`.

Product direction changed (Freya, 2026-02-27): the app must be **anonymous-first**.
Users should open the app and use it immediately without any sign-in step. Sign-in
becomes an optional upgrade — a cloud sync upsell — not a gate.

Key drivers:
1. The entire data model is already localStorage-based. Anonymous users need only a
   UUID for their `householdId` — the data layer doesn't care where the UUID comes from.
2. Forcing sign-in before first use creates friction that kills conversion.
3. The PKCE OAuth flow (ADR-005) remains intact for users who choose to sign in.

---

## Decision

### 1. Remove the auth gate

`AuthContext` no longer redirects to `/sign-in` on unauthenticated load. The new
`status` type is `"loading" | "authenticated" | "anonymous"`. All app routes are
accessible to anonymous users. There is no route protection for anonymous access.

The only special routing: if a user who is already signed in navigates to `/sign-in`,
the page redirects them to `/` immediately.

### 2. Anonymous householdId from localStorage

A new module `src/lib/auth/household.ts` provides `getOrCreateAnonHouseholdId()`:

```typescript
const ANONYMOUS_HOUSEHOLD_KEY = "fenrir:household";

function getOrCreateAnonHouseholdId(): string {
  const existing = localStorage.getItem(ANONYMOUS_HOUSEHOLD_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(ANONYMOUS_HOUSEHOLD_KEY, id);
  return id;
}
```

`householdId` resolution order in `AuthContext`:
1. If `fenrir:auth` session is valid → `session.user.sub` (Google account ID)
2. Else → `getOrCreateAnonHouseholdId()` (UUID from `fenrir:household`)

All existing `storage.ts` functions accept `householdId` as a parameter and are
unchanged. The source of the UUID is the only difference.

### 3. householdId exposed by AuthContext and useAuth

`AuthContext` now exposes `householdId: string` directly. All pages use this value
instead of `session?.user?.sub`. This eliminates the `if (!householdId) return` guard
that previously blocked rendering for unauthenticated users.

### 4. TopBar anonymous state

When `status !== "authenticated"`:
- Show ᛟ rune avatar with `border-border` (no gold ring — wolf unnamed).
- No email text. No dropdown caret.
- Clicking avatar opens a `role="dialog"` upsell prompt panel (not a user menu).
- Panel: atmospheric copy + "Sign in to Google" (navigates to `/sign-in`) + "Not now" (closes panel).
- "Not now" does not set any persistent dismiss flag.

When `status === "authenticated"`:
- Show Google photo (or ᛟ rune fallback) with `border-gold/40` (wolf named).
- Email on desktop. Caret ▾.
- Clicking opens profile dropdown with name, email, atmospheric line, Sign Out.
- Sign Out calls `clearSession()`, restores anonymous state, navigates to `/`.

### 5. Cloud sync upsell banner (dashboard only)

`UpsellBanner` component renders in `AppShell` between TopBar and the main content,
but only on the `/` (dashboard) route.

Render condition: `status !== "authenticated" AND status !== "loading" AND
localStorage("fenrir:upsell_dismissed") !== "true"`

Dismiss behavior:
1. Set `localStorage("fenrir:upsell_dismissed", "true")` immediately.
2. Animate height + opacity to 0 over 300ms ease.
3. Remove from DOM. Never shown again on this device.

"Sign in to sync" navigates to `/sign-in`. Does not set the dismiss flag.

### 6. Sign-in page reframed as opt-in upgrade

`/sign-in` is redesigned as a voluntary destination with:
- Voice 2 atmospheric heading: "Name the wolf." (or "Your chains are already here." if cards exist)
- Feature list (Voice 1 plain English)
- "Sign in to Google" primary CTA (full-width)
- "Continue without signing in" secondary CTA — full-width outlined button, same visual weight as primary. **Non-negotiable per Luna.**
- Two variants: no-data (generic) vs. has-data (references card count, prepares for migration prompt).

### 7. Post-sign-in migration prompt (deferred)

The modal that appears post-OAuth when anonymous data exists is **deferred to a
future sprint**. When implemented, it will:
- Show after `/auth/callback` completes, if `getAnonHouseholdId()` returns a non-null ID.
- Present: "Import N cards" (primary) / "Start fresh" (secondary).
- "Start fresh" must NOT delete anonymous localStorage data.
- After choice: navigate to dashboard in signed-in state.

This is noted here so the auth callback flow (currently navigates straight to `/`) can
be updated when migration is implemented.

---

## Files Changed

### Created
| File | Purpose |
|------|---------|
| `src/lib/auth/household.ts` | Anonymous householdId generation and retrieval |
| `src/components/layout/UpsellBanner.tsx` | Dismissible cloud sync upsell banner |

### Modified
| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Added `"anonymous"` status; removed redirect; added `householdId` to context value |
| `src/hooks/useAuth.ts` | Exposes `householdId` directly; updated status type |
| `src/components/layout/TopBar.tsx` | Anonymous state (ᛟ upsell panel) + signed-in state (gold ring + dropdown) |
| `src/components/layout/AppShell.tsx` | Injects `UpsellBanner` on dashboard route |
| `src/app/page.tsx` | Uses `householdId` from hook; no session dependency |
| `src/app/valhalla/page.tsx` | Same |
| `src/app/cards/new/page.tsx` | Same |
| `src/app/cards/[id]/edit/page.tsx` | Same |
| `src/app/sign-in/page.tsx` | Reframed as opt-in upgrade surface; "Continue without signing in" CTA |

---

## Consequences

### Positive
- **Zero friction first use** — users land on the dashboard immediately, see their
  (empty) ledger, and can add cards without any sign-in step.
- **Data model unchanged** — all `storage.ts` functions work identically; only the
  source of `householdId` changes for anonymous users.
- **PKCE flow intact** — ADR-005 auth infrastructure is preserved for users who opt in.
- **No breaking changes** — existing signed-in users continue to work unchanged.

### Negative / Trade-offs
- **No server-side protection** — the app has no server-side auth. This is acceptable
  for the current localStorage-only model but must be revisited when server persistence
  is added (GA sprint).
- **Migration prompt deferred** — users who sign in after accumulating anonymous data
  will not be offered a migration until the next sprint. Their data is safe in
  localStorage; they just won't see it in their cloud account yet.
- **Dismiss flag is permanent** — once dismissed, the upsell banner never reappears
  on this device unless the user clears localStorage. The settings page will be the
  re-entry point (future sprint).

---

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Keep auth gate, add anonymous bypass via URL param | Still feels like a gate; complicates routing |
| Issue a "guest session" JWT for anonymous users | Adds complexity (Auth.js server involvement) for no benefit; anonymous state doesn't need a server session |
| Show migration prompt immediately at sign-in | Correct long-term but deferred: the prompt requires a server endpoint (`/api/household/migrate`) that doesn't exist yet |
