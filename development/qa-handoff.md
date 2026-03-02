# QA Handoff: AuthGate UI Abstraction

**Feature:** AuthGate component for auth-conditional rendering
**Branch:** `feat/auth-gate-ui`
**Engineer:** FiremanDecko
**Date:** 2026-03-01

---

## What Was Implemented

A reusable `AuthGate` component that conditionally renders children based on authentication status. The "Import from Google Sheets" buttons (empty state and toolbar) are now hidden for anonymous users and only visible when signed in with Google.

## Files Created / Modified

| File | Change |
|------|--------|
| `development/frontend/src/components/shared/AuthGate.tsx` | **New file.** Reusable component that reads `useAuth().status` and renders children only when the required auth condition is met. Defaults to requiring `"authenticated"`. Supports `require="anonymous"` and an optional `fallback` prop. Returns `null` while auth is loading. |
| `development/frontend/src/components/dashboard/EmptyState.tsx` | Wrapped the "Import from Google Sheets" button with `<AuthGate>`. Added import for `AuthGate`. |
| `development/frontend/src/app/page.tsx` | Wrapped the toolbar "Import" button with `<AuthGate>`. Added import for `AuthGate`. |
| `development/qa-handoff.md` | This file (replaces previous handoff). |

## How to Test

### 1. Anonymous User (not signed in)

1. Open the app in a fresh browser or incognito window (no Google sign-in).
2. **Empty state**: Navigate to `/` with no cards. Verify the "Add Card" button is visible but the "Import from Google Sheets" button is **not visible**.
3. **Toolbar**: Add at least one card, return to `/`. Verify the "Add Card" button is in the toolbar but the "Import" button is **not visible**.

### 2. Authenticated User (signed in with Google)

1. Sign in with Google.
2. **Empty state**: Clear all cards (or use a fresh household). Navigate to `/`. Verify both "Add Card" and "Import from Google Sheets" buttons are visible.
3. **Toolbar**: With at least one card on the dashboard, verify both "Add Card" and "Import" buttons are visible in the toolbar.

### 3. Loading State

1. On slow connections or by throttling, verify no flash of the import button during auth resolution. The button should not appear until auth status resolves to `"authenticated"`.

## Acceptance Criteria Checklist

- [ ] `AuthGate` component created at `components/shared/AuthGate.tsx`
- [ ] Anonymous users do NOT see the "Import from Google Sheets" button on the empty state
- [ ] Anonymous users do NOT see the "Import" button in the dashboard toolbar
- [ ] Authenticated users see both import buttons as before
- [ ] No flash of import button during auth loading state
- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
- [ ] Next.js production build succeeds (`npm run build`)
- [ ] No other source files were modified

## Known Limitations

- None. This is a minimal UI gate with no new business logic.

## Suggested Test Focus

1. **Auth state transitions** -- sign in, sign out, verify button visibility toggles correctly.
2. **Empty state vs toolbar** -- both import button locations are gated independently.
3. **No layout shift** -- the `AuthGate` returns `null` during loading rather than a placeholder, so there should be no visible flash or layout jump.

---

*FiremanDecko -- Principal Engineer*
