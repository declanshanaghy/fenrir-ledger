# QA Handoff -- Settings Page Soft Gate

**Branch:** `fix/settings-soft-gate`
**Date:** 2026-03-05
**Engineer:** FiremanDecko
**PR:** https://github.com/declanshanaghy/fenrir-ledger/pull/137

## What was implemented

Changed the Settings page from a hard gate (hiding premium features for non-subscribers) to a soft gate (showing all features with a subscribe banner above them).

### Changes summary

1. **SubscriptionGate** now accepts `mode?: "hard" | "soft"` prop (default `"hard"` for backward compatibility)
2. In **soft mode**, children are always rendered; a non-blocking subscribe banner appears above them when the user lacks entitlement
3. The **SoftGateBanner** component shows a gold-bordered banner with "Unlock this feature" heading and Stripe subscribe CTA
4. **Settings page** updated: all 3 `<SubscriptionGate>` instances now use `mode="soft"`

## Fixes applied (retry #1)

### [HIGH] Playwright tests updated for soft-gate behavior
- **File:** `quality/test-suites/patreon/settings-page.spec.ts`
- TC-SP-14 through TC-SP-30: Rewrote all 17 tests to reflect soft-gate behavior
- Tests now verify: feature sections always visible, subscribe banners present, no modals auto-opening
- TC-SP-34/TC-SP-35: Updated edge cases to check banners (not modals) after entitlement cache clear

### [MEDIUM] Subscribe button touch target fixed
- **File:** `src/components/entitlement/SubscriptionGate.tsx` line 137
- Added `inline-flex items-center` to the Subscribe button's class list
- Now matches the "Learn more" button pattern and renders at 44px+ height

### [LOW] Soft mode no longer shows skeleton during loading
- **File:** `src/components/entitlement/SubscriptionGate.tsx` line 213
- In soft mode, `isLoading` now renders `{children}` directly instead of `<GateSkeleton />`
- The banner will appear once loading resolves if the user lacks entitlement

## Files modified

| File | Description |
|------|-------------|
| `src/components/entitlement/SubscriptionGate.tsx` | Fixed Subscribe button touch target (inline-flex items-center); soft mode renders children during loading |
| `quality/test-suites/patreon/settings-page.spec.ts` | Rewrote TC-SP-14 through TC-SP-30 and TC-SP-34/TC-SP-35 for soft-gate behavior |

## How to test

### Port and URL
- Dev server: http://localhost:49901
- Worktree: `/Users/declanshanaghy/src/github.com/declanshanaghy/fenrir-ledger-trees/fix/settings-soft-gate`

### Test scenarios

1. **Non-subscriber (Thrall) visits /settings**
   - All 3 feature sections (Cloud Sync, Multi-Household, Data Export) must be visible
   - Each section should have an "Unlock this feature" banner above it with gold border
   - No SealedRuneModal auto-opens
   - Banner shows "Subscribe" button
   - Subscribe button should have min 44px touch target

2. **Subscriber (Karl) visits /settings**
   - All 3 feature sections visible
   - No banners appear above any section

3. **Mobile (375px viewport)**
   - Banner stacks vertically (column layout below `sm` breakpoint)
   - Subscribe button maintains 44px min height
   - Feature sections remain readable

4. **Hard mode regression (other pages)**
   - Any SubscriptionGate without `mode="soft"` must behave as before (hard gate)
   - No regression on existing gated components

6. **Loading state in soft mode**
   - Children render immediately while entitlement status resolves (no skeleton flicker)

### Build verification

- `npx tsc --noEmit` -- PASS
- `npx next lint` -- PASS
- `npm run build` -- PASS

## Known limitations

- Soft gate banner is not dismissible (intentional for settings context where each banner is tied to a specific feature section)
- SealedRuneModal still wired in soft mode for "Learn more" flow

## Suggested test focus areas

1. Run Playwright test suite: `quality/test-suites/patreon/settings-page.spec.ts` -- all 35 tests should pass
2. Mobile responsiveness at 375px
3. Hard mode regression on other gated pages
4. Accessibility: banner aria labels, touch targets (44px min)
