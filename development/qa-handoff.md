# QA Handoff -- Story 2: Stripe UI Components + PatreonGate Rename

**Branch:** `feat/stripe-ui`
**Date:** 2026-03-04
**Engineer:** FiremanDecko

## What was implemented

### Story references
- Story 2 of the Stripe Direct Integration sprint
- Depends on Story 1 (feat/stripe-foundation branch -- API routes + KV store)

### Changes summary
1. **PatreonGate renamed to SubscriptionGate** across entire codebase
2. **StripeSettings component** built with 3 states (Thrall/Karl/Canceled)
3. **AnonymousCheckoutModal** for anonymous user email collection before Stripe Checkout
4. **EntitlementContext updated** with `subscribeStripe()`, `openPortal()`, `unlinkStripe()` actions
5. **SealedRuneModal updated** with Stripe CTA (subscribe button replaces Patreon link when isStripe())
6. **UpsellBanner updated** to work in Stripe mode (Upgrade to Karl CTA)
7. **Settings page updated** to conditionally render StripeSettings or PatreonSettings
8. **SEV-002 fixed**: Removed `request.headers.get("origin")` from checkout and portal routes, replaced with `process.env.APP_BASE_URL`
9. **SEV-003 fixed**: Added `js.stripe.com`, `api.stripe.com`, `hooks.stripe.com` to CSP in next.config.ts
10. **EntitlementPlatform type** updated to include `"stripe"`

## Files created/modified

### New files
| File | Description |
|------|-------------|
| `src/components/entitlement/SubscriptionGate.tsx` | Renamed from PatreonGate, works for both platforms |
| `src/components/entitlement/StripeSettings.tsx` | Stripe subscription settings (3 states) |
| `src/components/entitlement/AnonymousCheckoutModal.tsx` | Email collection modal for anonymous Stripe checkout |
| `src/lib/stripe/types.ts` | Stripe type definitions (from Story 1) |
| `src/lib/stripe/api.ts` | Stripe SDK client (from Story 1) |
| `src/lib/stripe/webhook.ts` | Webhook handler (from Story 1) |
| `src/app/api/stripe/checkout/route.ts` | Checkout session API (from Story 1, SEV-002 fixed) |
| `src/app/api/stripe/portal/route.ts` | Customer Portal API (from Story 1, SEV-002 fixed) |
| `src/app/api/stripe/membership/route.ts` | Membership status API (from Story 1) |
| `src/app/api/stripe/unlink/route.ts` | Unlink/cancel API (from Story 1) |
| `src/app/api/stripe/webhook/route.ts` | Webhook endpoint (from Story 1) |

### Modified files
| File | Description |
|------|-------------|
| `src/components/entitlement/index.ts` | Barrel exports updated (SubscriptionGate, StripeSettings, AnonymousCheckoutModal) |
| `src/components/entitlement/SealedRuneModal.tsx` | Stripe CTA added alongside Patreon CTA |
| `src/components/entitlement/UpsellBanner.tsx` | Stripe mode support (Upgrade to Karl CTA) |
| `src/app/settings/page.tsx` | SubscriptionGate + conditional StripeSettings/PatreonSettings |
| `src/contexts/EntitlementContext.tsx` | subscribeStripe, openPortal, unlinkStripe, Stripe membership fetch |
| `src/lib/entitlement/types.ts` | EntitlementPlatform now includes "stripe" |
| `src/lib/kv/entitlement-store.ts` | Stripe entitlement CRUD operations added |
| `next.config.ts` | CSP updated with Stripe domains (SEV-003 fix) |
| `.env.example` | Stripe env vars added |

### Deleted files
| File | Description |
|------|-------------|
| `src/components/entitlement/PatreonGate.tsx` | Renamed to SubscriptionGate.tsx |

## How to deploy

1. Ensure `SUBSCRIPTION_PLATFORM=stripe` is set in `.env.local`
2. Ensure Stripe env vars are set: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
3. Ensure `APP_BASE_URL` is set (SEV-002 fix)
4. `cd development/frontend && npm install && npx next build`
5. `npx next dev -p 9656`

## How to test

### Port and URL
- Dev server: `http://localhost:9656`
- Worktree path: `/Users/declanshanaghy/src/github.com/declanshanaghy/fenrir-ledger-trees/feat/stripe-ui`

### Test with SUBSCRIPTION_PLATFORM=stripe

1. **StripeSettings (Thrall state)**
   - Navigate to `/settings`
   - Verify: "Subscription" heading, "Thrall" badge, Karl benefits list, "Subscribe for $3.99/month" button
   - Anonymous user: clicking subscribe opens AnonymousCheckoutModal
   - Authenticated user: clicking subscribe calls POST /api/stripe/checkout

2. **AnonymousCheckoutModal**
   - As anonymous user, click any subscribe CTA
   - Verify: email input with validation, "Continue to checkout" button
   - Submit empty: "Please enter your email address."
   - Submit "not-an-email": "Please enter a valid email address."
   - Submit valid email: button changes to "Redirecting to Stripe..."
   - "Sign in instead" link navigates to /sign-in
   - Cancel/X/Escape dismisses

3. **SealedRuneModal (Stripe CTA)**
   - Navigate to `/settings` as Thrall user
   - Click "Learn more" on a locked feature
   - Verify: "Subscribe for $3.99/month" button, "Not now" dismiss, locked feature name shown
   - Anonymous: subscribe CTA opens email modal
   - Authenticated: subscribe CTA redirects to checkout

4. **UpsellBanner (Stripe mode)**
   - Navigate to dashboard as Thrall user
   - Verify: "Upgrade to Karl" button, atmospheric text, dismiss X button
   - Anonymous: clicking CTA opens email modal
   - Dismiss: sets `fenrir:stripe_upsell_dismissed` in localStorage, banner hidden permanently

5. **SubscriptionGate (renamed from PatreonGate)**
   - Verify premium features are gated in Stripe mode
   - Both anonymous and authenticated Thrall users see the gate
   - Karl users see the feature content

### Test with SUBSCRIPTION_PLATFORM=patreon

6. **Existing Patreon flow still works**
   - PatreonSettings renders on /settings
   - SealedRuneModal shows Patreon CTA
   - UpsellBanner shows "Learn more" (Patreon flow)
   - SubscriptionGate works for authenticated users

### Security verification

7. **SEV-002: No Origin header usage**
   - `grep -rn "origin" src/app/api/stripe/` should NOT show `request.headers.get("origin")`
   - Checkout and portal routes use `process.env.APP_BASE_URL`

8. **SEV-003: Stripe domains in CSP**
   - `next.config.ts` includes js.stripe.com, api.stripe.com, hooks.stripe.com
   - Browser console should not show CSP violations when Stripe.js loads

### Build verification

9. `cd development/frontend && npx tsc --noEmit` -- passes
10. `cd development/frontend && npx next build` -- succeeds
11. `grep -rn 'PatreonGate' development/frontend/src/ --include='*.tsx' --include='*.ts'` -- returns only the rename comment

## Known limitations

- Stripe subscription states (canceled with access until period end) require actual Stripe webhook events to populate `stripeStatus` and `currentPeriodEnd` in the context. These fields are wired but not yet populated from the membership API response (Story 1 membership endpoint returns `tier` and `active` but not status/period details). The UI gracefully handles null values.
- Anonymous Stripe flow is client-side only (no server-side session). The email modal collects email for Stripe Checkout pre-fill.
- The `unlinkStripe` action is wired in the context but not exposed in the StripeSettings UI (per wireframe: cancel routes to Stripe Portal).

## Suggested test focus areas

1. Platform switching: toggling `SUBSCRIPTION_PLATFORM` between `patreon` and `stripe` should cleanly switch all UI
2. Anonymous checkout flow: email validation, loading state, error handling
3. Mobile responsiveness: all new components at 375px width
4. Accessibility: modal focus trapping, aria labels, screen reader flow
5. CSP: load the app with Stripe mode and verify no CSP errors in console
