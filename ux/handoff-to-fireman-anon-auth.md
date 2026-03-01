# Handoff to FiremanDecko: Anonymous-First Auth + Cloud Sync Upsell

**From**: Luna (UX Designer)
**To**: FiremanDecko (Principal Engineer)
**Date**: 2026-02-27
**Priority**: P2-High — touches every page, auth middleware, TopBar, and localStorage model

---

## What Changed in the UX

The product has moved from authentication-required to **anonymous-first**. This is not a minor tweak — it changes the entry point, the default header state, and the relationship between the sign-in page and the rest of the app.

### The Old Model (discard)

User opens app → redirected to `/sign-in` → must authenticate with Google → lands on dashboard.

The sign-in page was a gate. The auth middleware enforced it. The TopBar assumed an authenticated session.

### The New Model (implement this)

User opens app → lands directly on dashboard → is anonymous by default → may optionally sign in via a dismissible upsell surface.

The sign-in page still exists at `/sign-in` but it is a destination the user navigates to voluntarily. There is no redirect on unauthenticated access.

---

## What Needs to Be Removed or Changed

### 1. Auth Middleware — Remove the Gate

The current middleware (`development/frontend/src/middleware.ts`) redirects unauthenticated users to `/sign-in` (or the NextAuth sign-in route). This must be removed or rewritten.

**New behavior:**
- No route is protected for anonymous users. All app routes (`/`, `/valhalla`, `/cards/new`, `/cards/[id]/edit`) are accessible without a session.
- Only the `/sign-in` page requires any special handling: if a user is already signed in and navigates to `/sign-in`, redirect them to `/` (they have nothing to do there).
- No other redirects based on auth state.

### 2. PKCE Auth Flow — Deferred, Not Deleted

The PKCE auth flow that was just built (ADR-005) is not thrown away — it is deferred to GA. For this sprint:

- The Google OAuth flow still needs to work (the sign-in page exists and has a "Sign in to Google" CTA).
- The flow must complete and establish a session when the user opts in.
- The flow is no longer triggered automatically. It is only triggered when the user explicitly clicks "Sign in to Google" on `/sign-in`.
- The `signOut` callback URL must be `/` (dashboard), NOT `/api/auth/signin` or `/sign-in`. The user returns to the dashboard in anonymous state after signing out.

### 3. TopBar Component — Replace the Session-Required Assumption

The `TopBar` component currently assumes an active session. It reads `session.user.picture`, `session.user.email`, `session.user.name`. In the anonymous state, none of these exist.

**New behavior:**
- `TopBar` must handle two states: **anonymous** and **signed-in**.
- **Anonymous state:** render only the ᛟ rune avatar button (no email, no caret). Clicking opens the upsell prompt panel (`role="dialog"`, not a dropdown menu). See `ux/wireframes/topbar.html` Scenarios 1–3.
- **Signed-in state:** render Google photo (or rune fallback) + email (desktop) + caret ▾. Clicking opens the profile dropdown. See `ux/wireframes/topbar.html` Scenarios 4–6.
- **Avatar border distinction:** anonymous = `border-border` (neutral, no gold ring). Signed-in = `border-gold/40` (gold ring, wolf named). This is a visual signal of auth state.

### 4. Sign-In Page — Reframe from Gate to Upgrade

The existing `/sign-in` page (or Auth.js default sign-in page) must be replaced with the new opt-in sign-in page.

**New requirements:**
- Route: `/sign-in`. Not `/api/auth/signin` as the user-facing URL.
- Contains: atmospheric heading + feature list + "Sign in to Google" CTA + "Continue without signing in" secondary CTA.
- "Continue without signing in" navigates to `/`. It does NOT set the upsell dismiss flag.
- If user is already signed in and lands on `/sign-in`: redirect to `/`.
- Two variants based on localStorage card count (see Wireframe Scenario 1 vs. 2 in `sign-in.html`).
- Full spec: `ux/wireframes/sign-in.html`.

---

## The Anonymous householdId Model

This is the core data model change that makes anonymous-first work.

### How it works

Every user — anonymous or signed-in — has a `householdId` (UUID). The difference:

- **Anonymous user:** `householdId` is generated client-side (`crypto.randomUUID()`) and stored in `localStorage` under the key `fenrir:household`.
- **Signed-in user:** `householdId` is derived from the Google `sub` claim (or another server-side stable identifier) and stored server-side.

The data stored in localStorage is identical in both cases — the household UUID scopes all cards, and all existing `storage.ts` functions continue to work unchanged. The UUID just comes from a different source.

### localStorage key

```
localStorage.setItem('fenrir:household', '<uuid>');
```

On first app load, if this key does not exist: generate a UUID and set it. This must happen before any card read/write operations.

```typescript
// Pseudocode — implement in storage.ts or a new lib/household.ts
function getOrCreateHouseholdId(): string {
  const existing = localStorage.getItem('fenrir:household');
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem('fenrir:household', id);
  return id;
}
```

This is the only change to the data layer for anonymous users. Everything else in `storage.ts` remains the same.

### On sign-in

When the user signs in, the server establishes a new `householdId` scoped to their Google account. The anonymous `householdId` in localStorage is preserved (not overwritten) so it can be referenced during the migration prompt.

### On sign-out

When the user signs out, the server session is cleared. The anonymous `householdId` in localStorage is restored as the active household. Data is never lost on sign-out.

---

## New UI States to Implement

### State 1: Anonymous TopBar

See `ux/wireframes/topbar.html`, Scenarios 1–3.

Component changes needed:
- Detect anonymous state: `session === null` (or `isAnonymous` prop from context).
- Render ᛟ rune avatar button with `aria-label="Sign in to sync your data"` and `aria-haspopup="true"`.
- On click: open the upsell prompt panel (see State 2).
- No email text. No dropdown caret. No profile dropdown.
- Avatar border: `border-border` (neutral — NOT `border-gold/40`).

### State 2: Upsell Prompt Panel (from avatar click)

See `ux/wireframes/topbar.html`, Scenario 2.

A small panel positioned below the avatar (`absolute, right: 16px, top: calc(100% + 4px)`). NOT a dropdown menu — it is `role="dialog"`.

Contents:
- Atmospheric line (Voice 2): *"The wolf runs unnamed. Your chains are stored here alone."*
- Functional description (Voice 1): plain English sync value prop.
- "Sign in to Google" button → navigates to `/sign-in`.
- "Not now" button → closes the panel. Does NOT set dismiss flag. Does NOT affect the banner.

Close behavior: "Not now" click, Escape key, click outside. Focus returns to avatar button.

### State 3: Upsell Banner (dashboard only)

See `ux/wireframes/upsell-banner.html`.

Rendered in the app shell as `grid-row: 2; grid-column: 1 / 3` — between TopBar and the sidebar/content split.

Render condition: `isAnonymous && localStorage.getItem('fenrir:upsell_dismissed') !== 'true'`.

Contents:
- Atmospheric line (Voice 2): *"Your chains are stored here alone."*
- Description (Voice 1): sync value prop.
- "Sign in to sync" button → navigates to `/sign-in`. Does NOT set dismiss flag.
- × dismiss button → sets `localStorage: fenrir:upsell_dismissed = 'true'` → triggers collapse animation (300ms height + opacity to 0, `ease`) → removes element from DOM.

Mobile: atmospheric line hidden; choices stack; × is `position: absolute; top: right`.

### State 4: Sign-In Page (opt-in surface)

See `ux/wireframes/sign-in.html`.

Full page at `/sign-in`. Conditionally renders two variants based on `localStorage` card count:
- **Variant A (no data):** generic messaging about sync benefits.
- **Variant B (has data):** subheading dynamically references card count. Prepares user for the migration prompt.

Non-negotiable elements:
- "Continue without signing in" must be a full-width button, same visual weight as "Sign in to Google". Never a small text link.
- TopBar is present and functional on this page.

### State 5: Migration Prompt Modal

See `ux/wireframes/migration-prompt.html`.

Fires after OAuth completes, only if `localStorage['fenrir:household']` contains at least 1 card.

`role="dialog"`, `aria-modal="true"`. No × close. Escape does not close. Focus trap.

Two choices:
- **"Import N cards"** (primary, gets initial focus): merges anonymous household into cloud account. After merge: clear the anonymous household from localStorage (or mark it as migrated). Navigate to dashboard (signed-in state). Avatar transition fires.
- **"Start fresh"** (secondary): cloud account starts empty. Anonymous data stays in localStorage untouched — NOT deleted. After choice: navigate to dashboard (signed-in state). Avatar transition fires.

The "start fresh" path must include reassurance copy: *"Your N local cards will still be here if you sign out. Nothing is deleted."*

### State 6: Avatar Transition (anonymous → signed-in)

See `ux/wireframes/topbar.html`, Scenario 7.

When the signed-in dashboard renders after OAuth (and optionally after the migration prompt):
- ᛟ rune cross-fades to Google photo (or rune fallback if no picture URL).
- Avatar border transitions from `border-border` to `border-gold/40`.
- Email text fades in beside the avatar on desktop.
- Caret ▾ appears.
- Duration: ~400ms. Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (saga-enter curve).

This transition is the "naming of the wolf" — the most emotionally significant state change in the product. It must not be a snap.

---

## Open Technical Questions for FiremanDecko

These are implementation decisions that belong in your domain — not UX decisions. Make the call and note it in an ADR if it has architectural implications.

### Q1: Session strategy for anonymous users

The current auth setup uses Auth.js with JWT sessions. For anonymous users, there is no session at all. Two options:

- **Option A:** No session object for anonymous users. The frontend detects anonymous state by checking `session === null`. All auth-guarded API routes return 401 for anonymous users (no API calls are needed for localStorage-only mode).
- **Option B:** Auth.js issues a "guest session" JWT with a generated householdId. This maintains session consistency but adds complexity.

Recommendation from UX: Option A is simpler and matches the product direction — anonymous users never touch the server. If you go with A, ensure the `useSession()` hook returns `null` cleanly and the TopBar handles `null` without throwing.

### Q2: Migration API endpoint

The "Import N cards" path in the migration prompt requires a server endpoint to accept the anonymous household's card data and associate it with the signed-in account.

UX does not specify the API contract — that is your domain. Questions to resolve:
- Does the client POST the full card data to the server on import? Or does the server pull it from a sync queue?
- What is the endpoint path? `/api/household/migrate`?
- What is the error handling if the migration fails mid-flight?

From a UX standpoint: if migration fails, the user should be shown an error and given the option to retry or continue without importing. The anonymous data must never be deleted on a failed migration.

### Q3: householdId generation — client vs. server

The spec says: generate client-side with `crypto.randomUUID()` on first load. This is safe for localStorage-only mode. But:

- If the app ever server-renders pages that depend on the householdId, client-side generation creates a hydration mismatch.
- If the householdId needs to be available in middleware or API routes for anonymous users, it would need to be in a cookie (not just localStorage).

For the current sprint (localStorage only, no server persistence for anonymous users): client-side generation is fine. Flag this for the GA sprint when server persistence is added.

### Q4: Upsell banner in the app shell — grid vs. component

The banner wireframe specifies `grid-row: 2; grid-column: 1 / 3` in the app shell. The current `layout.tsx` may not have a grid row 2.

You have two options:
- Add a dedicated grid row in the app shell for the banner (clean, but changes the layout grid).
- Render the banner inside the TopBar as an absolutely positioned element below it (simpler, but may cause z-index and layout issues).

UX preference: the dedicated grid row — it keeps the banner in the normal document flow, which makes the collapse animation simpler. But the implementation decision is yours.

### Q5: `fenrir:upsell_dismissed` flag scope

The dismiss flag is stored in localStorage and is persistent across sessions. Two questions:

- **On sign-out:** if the user dismisses the banner while signed in (future state — banner not shown to signed-in users, so this is moot), does the flag persist? Answer: yes, localStorage persists across sign-out.
- **On sign-in after dismissal:** if an anonymous user dismissed the banner and then signs in, and later signs out again (returning to anonymous state) — should the banner reappear? Current spec: no, the dismiss flag persists. The settings page (`/settings`) is the fallback entry point for users who want to sign in after dismissal.

If you want to implement "re-show after sign-out" behavior (e.g., the user signs out after GA and might not know about cloud sync), that is a product decision — take it to Freya.

### Q6: `/sign-in` page — Auth.js integration

The current NextAuth sign-in page is at `/api/auth/signin` (or wherever Auth.js routes it). The new `/sign-in` page is a custom page at a clean URL.

Auth.js v5 supports `pages.signIn` configuration to point to a custom sign-in page. Ensure the Auth.js config points to `/sign-in` so that any automatic redirects (e.g., if a future protected route is added) go to the right place.

Also: the `/sign-in` page triggers the OAuth flow via Auth.js's `signIn('google')` function. The page is custom — the OAuth handshake still goes through Auth.js. The PKCE flow built in Sprint 3.1 (ADR-005) remains intact for this.

---

## Wireframe Reference

| Wireframe | File | What it specifies |
|-----------|------|-------------------|
| TopBar — all states | `ux/wireframes/topbar.html` | Anonymous avatar, upsell prompt panel, signed-in dropdown, avatar transition |
| Upsell Banner | `ux/wireframes/upsell-banner.html` | Banner placement, dismiss lifecycle, mobile variant |
| Sign In Page | `ux/wireframes/sign-in.html` | /sign-in page layout, two variants, "Continue without signing in" CTA |
| Migration Prompt | `ux/wireframes/migration-prompt.html` | Post-OAuth modal, Import vs. Start fresh choices |

All wireframes are HTML5 with structural layout only — no theme colors, no custom fonts. They are self-annotated with implementation notes in HTML comments and `.note-block` elements.

---

## Non-Negotiables (UX enforces these)

1. The app opens to the dashboard for all users — no redirect on unauthenticated load.
2. The ᛟ rune avatar is the canonical anonymous identity. No generic user icon, question mark, or silhouette.
3. "Continue without signing in" is a full-width outlined button on the sign-in page — same visual weight as the primary CTA. Never a small text link.
4. The upsell banner is dismissible with one tap. Setting the dismiss flag must happen before the animation starts (in case of fast navigation or crash).
5. "Start fresh" in the migration prompt must not delete anonymous localStorage data. The user's data stays safe regardless of which path they choose.
6. The avatar transition from ᛟ rune to Google photo must cross-fade — not snap. 400ms, saga-enter easing.
7. Sign out returns the user to `/` (dashboard in anonymous state), not to `/sign-in`.

---

*Luna — UX Designer · Fenrir Ledger*
*"Though it looks like silk ribbon, no chain is stronger."*
