# Test Plan: Anonymous-First Auth + Cloud Sync Upsell

**Story:** Anonymous-First Auth (Sprint 3.2 continuation)
**Engineer:** FiremanDecko
**Date:** 2026-02-27
**QA:** Loki

---

## What Was Implemented

1. **Removed the auth gate** — anonymous users land directly on the dashboard. No redirect to `/sign-in`.
2. **Anonymous householdId** — `localStorage("fenrir:household")` UUID, generated on first load, persists across sessions.
3. **AuthContext `"anonymous"` status** — new status value; `householdId` exposed directly from context.
4. **TopBar anonymous state** — ᛟ rune avatar (no gold ring); clicking opens upsell prompt panel (`role="dialog"`).
5. **Upsell prompt panel** — "Sign in to Google" → navigates to `/sign-in`. "Not now" → closes panel only.
6. **Cloud sync upsell banner** — dashboard only; dismissible with ×; collapses with 300ms animation; persists dismiss via `localStorage("fenrir:upsell_dismissed")`.
7. **Sign-in page reframed** — opt-in upgrade surface; "Continue without signing in" full-width button; two variants (no-data / has-data).
8. **Sign out returns to `/`** — not to `/sign-in`.

## Files Created / Modified

| File | Change |
|------|--------|
| `src/lib/auth/household.ts` | NEW — anonymous householdId logic |
| `src/components/layout/UpsellBanner.tsx` | NEW — dismissible upsell banner |
| `src/contexts/AuthContext.tsx` | Modified — `"anonymous"` status, `householdId` in context, no redirects |
| `src/hooks/useAuth.ts` | Modified — `householdId` in return; updated status type |
| `src/components/layout/TopBar.tsx` | Modified — anonymous ᛟ avatar + upsell panel; signed-in dropdown |
| `src/components/layout/AppShell.tsx` | Modified — UpsellBanner injected on `/` route |
| `src/app/page.tsx` | Modified — uses `householdId` from hook |
| `src/app/valhalla/page.tsx` | Modified — uses `householdId` from hook |
| `src/app/cards/new/page.tsx` | Modified — uses `householdId` from hook |
| `src/app/cards/[id]/edit/page.tsx` | Modified — uses `householdId` from hook |
| `src/app/sign-in/page.tsx` | Modified — opt-in upgrade surface with "Continue" CTA |
| `architecture/adrs/ADR-006-anonymous-first-auth.md` | NEW — decision record |

## How to Deploy

```bash
# From repo root
cd /path/to/fenrir-ledger/development/src
npm run build      # Verify clean compile — 0 errors required
npm run dev        # Run dev server on port 9653
```

Or use the dev server script:

```bash
.claude/scripts/dev-server.sh restart
```

Then open: http://localhost:9653

---

## Test Cases

### Suite 1: Anonymous User — First Load

**TC-ANON-001: App opens to dashboard without sign-in**
- Steps: Open http://localhost:9653 in a fresh browser (clear all localStorage).
- Expected: Dashboard page renders immediately. No redirect to `/sign-in`. The Ledger of Fates heading visible.
- Pass criteria: URL remains `/` throughout.

**TC-ANON-002: TopBar shows ᛟ rune avatar in anonymous state**
- Steps: Observe the TopBar on first load.
- Expected: ᛟ rune avatar visible (no Google photo). No email text. No dropdown caret ▾. Avatar has neutral border (not gold ring).
- Pass criteria: Avatar renders, no email/caret visible.

**TC-ANON-003: ᛟ avatar click opens upsell prompt panel**
- Steps: Click the ᛟ avatar button.
- Expected: A panel appears below the avatar with:
  - Atmospheric text: "The wolf runs unnamed. Your chains are stored here alone."
  - Plain text: "Sign in to back up your cards..."
  - "Sign in to Google" button
  - "Not now" button
- Pass criteria: Panel visible, both CTAs present.

**TC-ANON-004: "Not now" closes the panel**
- Steps: Open the upsell prompt, then click "Not now".
- Expected: Panel closes. User remains on dashboard.
- Pass criteria: Panel not visible after click.

**TC-ANON-005: Escape key closes the upsell panel**
- Steps: Open the upsell prompt, then press Escape.
- Expected: Panel closes. Focus returns to the ᛟ avatar button.
- Pass criteria: Panel not visible. No console errors.

**TC-ANON-006: "Sign in to Google" navigates to /sign-in**
- Steps: Open the upsell prompt, then click "Sign in to Google".
- Expected: User navigates to `/sign-in`.
- Pass criteria: URL is `/sign-in`.

**TC-ANON-007: Click outside closes the upsell panel**
- Steps: Open the upsell prompt, then click elsewhere on the page.
- Expected: Panel closes.
- Pass criteria: Panel not visible after outside click.

---

### Suite 2: Anonymous householdId Persistence

**TC-HOUSEHOLD-001: householdId generated on first load**
- Steps: Clear localStorage, load the app, open browser DevTools → Application → Local Storage.
- Expected: `fenrir:household` key exists with a UUID value.
- Pass criteria: Key present, value is a valid UUID string.

**TC-HOUSEHOLD-002: householdId persists across page refresh**
- Steps: Note the `fenrir:household` value. Refresh the page (F5).
- Expected: `fenrir:household` value is unchanged after refresh.
- Pass criteria: Same UUID before and after refresh.

**TC-HOUSEHOLD-003: Cards are scoped to the anonymous householdId**
- Steps: Add a card as an anonymous user. Open DevTools → Local Storage.
- Expected: Card data is stored under key `fenrir_ledger:{householdId}:cards` where `householdId` matches `fenrir:household`.
- Pass criteria: Card data key matches the anonymous householdId.

**TC-HOUSEHOLD-004: householdId persists across browser sessions (close + reopen)**
- Steps: Note the `fenrir:household` value. Close and reopen the browser tab.
- Expected: Same `fenrir:household` value is still present.
- Pass criteria: UUID unchanged after close/reopen.

---

### Suite 3: Upsell Banner

**TC-BANNER-001: Upsell banner appears on dashboard for anonymous users**
- Steps: Clear localStorage (or ensure `fenrir:upsell_dismissed` is absent). Load `/`.
- Expected: A banner appears below the TopBar with: "Your chains are stored here alone." (atmospheric), "Sign in to back up..." (description), "Sign in to sync" button, × dismiss button.
- Pass criteria: Banner visible on `/`.

**TC-BANNER-002: Upsell banner does NOT appear on /valhalla**
- Steps: Navigate to `/valhalla`.
- Expected: No upsell banner visible.
- Pass criteria: Banner absent.

**TC-BANNER-003: Upsell banner does NOT appear on /cards/new**
- Steps: Navigate to `/cards/new`.
- Expected: No upsell banner visible.
- Pass criteria: Banner absent.

**TC-BANNER-004: Dismiss sets localStorage flag**
- Steps: Click the × dismiss button on the banner.
- Expected: `localStorage("fenrir:upsell_dismissed")` === `"true"`.
- Pass criteria: Flag set immediately.

**TC-BANNER-005: Banner animates out on dismiss**
- Steps: Click × and observe the transition.
- Expected: Banner collapses smoothly (height + opacity to 0) over ~300ms. Content below moves up.
- Pass criteria: No snap. Smooth collapse.

**TC-BANNER-006: Banner does NOT reappear after dismiss on refresh**
- Steps: Dismiss the banner. Refresh the page.
- Expected: Banner does not reappear.
- Pass criteria: Banner absent after refresh.

**TC-BANNER-007: "Sign in to sync" navigates to /sign-in (does not dismiss)**
- Steps: Click "Sign in to sync" in the banner.
- Expected: User navigates to `/sign-in`. `fenrir:upsell_dismissed` is NOT set.
- Pass criteria: Navigated to sign-in. Dismiss flag absent in localStorage.

**TC-BANNER-008: Banner reappears after navigating away + back (not dismissed)**
- Steps: Click "Sign in to sync" in the banner (navigate to `/sign-in`). Click "Continue without signing in" (navigate to `/`).
- Expected: Upsell banner is still visible on dashboard (dismiss flag not set).
- Pass criteria: Banner visible after returning without signing in.

**TC-BANNER-009: Banner does NOT appear for signed-in users**
- Steps: Complete Google sign-in. Navigate to `/`.
- Expected: No upsell banner visible.
- Pass criteria: Banner absent for authenticated users.

---

### Suite 4: Sign-In Page

**TC-SIGNIN-001: /sign-in is accessible without authentication**
- Steps: Navigate to `/sign-in` without signing in.
- Expected: Sign-in page renders. No redirect.
- Pass criteria: Page renders at `/sign-in`.

**TC-SIGNIN-002: Sign-in page shows "Continue without signing in" as full-width button**
- Steps: Load `/sign-in`.
- Expected: "Continue without signing in" is a full-width button, same visual size as "Sign in to Google". Not a small text link.
- Pass criteria: Both CTAs are full-width buttons with comparable visual weight.

**TC-SIGNIN-003: "Continue without signing in" navigates to /**
- Steps: Click "Continue without signing in" on `/sign-in`.
- Expected: User navigates to `/` (dashboard).
- Pass criteria: URL is `/` after click.

**TC-SIGNIN-004: "Continue without signing in" does not set dismiss flag**
- Steps: Navigate to `/sign-in`, click "Continue without signing in".
- Expected: `fenrir:upsell_dismissed` is NOT set.
- Pass criteria: Flag absent.

**TC-SIGNIN-005: Sign-in page Variant A (no local cards)**
- Steps: Clear localStorage. Load `/sign-in`.
- Expected: Heading is "Name the wolf." Subheading is "Your chains are already here. Sign in to carry them everywhere." No card count mention.
- Pass criteria: Variant A copy visible.

**TC-SIGNIN-006: Sign-in page Variant B (has local cards)**
- Steps: Add at least 1 card as anonymous user. Navigate to `/sign-in`.
- Expected: Heading is "Your chains are already here." Subheading mentions the card count (e.g., "your 1 local card").
- Pass criteria: Card count correctly referenced.

**TC-SIGNIN-007: Already-signed-in user is redirected from /sign-in**
- Steps: Sign in via Google. Navigate to `/sign-in`.
- Expected: Immediately redirected to `/`.
- Pass criteria: URL is `/` after navigating to `/sign-in` while signed in.

---

### Suite 5: Sign-In Flow (PKCE — Existing Functionality)

**TC-PKCE-001: "Sign in to Google" initiates PKCE redirect**
- Steps: Click "Sign in to Google" on `/sign-in`. Observe the redirect.
- Expected: Browser redirects to `accounts.google.com/o/oauth2/v2/auth`. URL contains `code_challenge`, `state`, `client_id`.
- Pass criteria: Correct OAuth redirect parameters present.

**TC-PKCE-002: Successful OAuth sets session and navigates to /**
- Steps: Complete the Google sign-in flow.
- Expected: `localStorage("fenrir:auth")` is set with a valid `FenrirSession` object. User is on the dashboard (`/`). TopBar shows Google avatar with gold ring border.
- Pass criteria: Session set, URL is `/`, gold ring avatar visible.

---

### Suite 6: TopBar Signed-In State

**TC-TOPBAR-SIGNIN-001: Signed-in TopBar shows email (desktop)**
- Steps: Sign in. Observe the TopBar on a desktop viewport (≥640px).
- Expected: Email address visible next to avatar. Gold ring border on avatar. Dropdown caret ▾ visible.
- Pass criteria: Email, gold ring, caret all present.

**TC-TOPBAR-SIGNIN-002: Signed-in TopBar — email hidden on mobile**
- Steps: Sign in. Resize viewport to 375px.
- Expected: Email hidden. Avatar and caret still visible.
- Pass criteria: No email at 375px.

**TC-TOPBAR-SIGNIN-003: Signed-in avatar opens profile dropdown**
- Steps: Click the avatar button when signed in.
- Expected: Profile dropdown appears with: full name, email, "The wolf is named." atmospheric line, "Sign out" button.
- Pass criteria: All four elements visible in dropdown.

**TC-TOPBAR-SIGNIN-004: Sign out returns to / in anonymous state**
- Steps: Click avatar → click "Sign out".
- Expected: Session cleared (`fenrir:auth` removed from localStorage). User navigated to `/`. TopBar shows ᛟ rune avatar (no email, no caret, no gold ring).
- Pass criteria: URL is `/`. TopBar is in anonymous state.

**TC-TOPBAR-SIGNIN-005: Sign out does NOT navigate to /sign-in**
- Steps: Click "Sign out".
- Expected: URL is `/`, NOT `/sign-in`.
- Pass criteria: URL after sign-out is `/`.

---

### Suite 7: Mobile Responsiveness (375px)

**TC-MOBILE-001: Dashboard renders at 375px without horizontal scroll**
- Steps: Set viewport to 375px. Load `/`.
- Expected: No horizontal scrollbar. Content fits within viewport.
- Pass criteria: No horizontal overflow.

**TC-MOBILE-002: Upsell banner mobile layout**
- Steps: Set viewport to 375px. Ensure banner is visible.
- Expected: No atmospheric line. Description + CTA stack vertically. × dismiss is absolute top-right.
- Pass criteria: Correct mobile layout.

**TC-MOBILE-003: Upsell prompt panel does not overflow on mobile**
- Steps: Set viewport to 375px. Click ᛟ avatar.
- Expected: Panel width is `calc(100vw - 32px)` or fits within viewport. No horizontal overflow.
- Pass criteria: Panel contained within 375px viewport.

---

## Known Limitations

1. **Migration prompt is deferred** — users who sign in after accumulating anonymous data will NOT see an import offer. Their anonymous data remains safe in localStorage under the `fenrir:household` UUID; it is not migrated. This will be implemented in a future sprint.

2. **Anonymous householdId is device-scoped** — clearing localStorage destroys the anonymous UUID and creates a new one. Any cards added under the old UUID become orphaned. This is by design for the current localStorage-only model.

3. **Upsell banner dismiss is permanent** — the `fenrir:upsell_dismissed` flag persists until localStorage is cleared. There is no in-app way to reset it. The settings page (future sprint) will provide a "Sync to cloud" re-entry point.

4. **Avatar transition animation (named → unnamed) not implemented** — the cross-fade from ᛟ rune to Google photo on sign-in is not yet animated (400ms saga-enter). The avatar updates on the next render cycle. This is a polish item for a future sprint.

---

## Suggested Test Focus

1. **First-load anonymous flow** — verify zero redirects; dashboard is accessible immediately.
2. **Banner dismiss lifecycle** — set flag, animation, absence after refresh.
3. **Sign-in page "Continue" CTA** — confirm it is full-width and prominent, not a small link.
4. **Sign-out destination** — must be `/`, never `/sign-in`.
5. **PKCE flow regression** — confirm existing sign-in path still works end-to-end.

---

*FiremanDecko — Principal Engineer · Fenrir Ledger*
*"Though it looks like silk ribbon, no chain is stronger."*
