# QA Handoff -- Settings Page Soft Gate

**Branch:** `fix/settings-soft-gate`
**Date:** 2026-03-04
**Engineer:** FiremanDecko
**PR:** https://github.com/declanshanaghy/fenrir-ledger/pull/137

## What was implemented

Changed the Settings page from a hard gate (hiding premium features for non-subscribers) to a soft gate (showing all features with a subscribe banner above them).

### Changes summary

1. **SubscriptionGate** now accepts `mode?: "hard" | "soft"` prop (default `"hard"` for backward compatibility)
2. In **soft mode**, children are always rendered; a non-blocking subscribe banner appears above them when the user lacks entitlement
3. The **SoftGateBanner** component shows a gold-bordered banner with "Unlock this feature" heading and Stripe subscribe CTA
4. **Settings page** updated: all 3 `<SubscriptionGate>` instances now use `mode="soft"`

## Files modified

| File | Description |
|------|-------------|
| `src/components/entitlement/SubscriptionGate.tsx` | Added `mode` prop, `SoftGateBanner` component, soft-mode rendering path |
| `src/app/settings/page.tsx` | Changed all 3 SubscriptionGate usages to `mode="soft"`, updated JSDoc |

## How to test

### Port and URL
- Dev server: http://localhost:49901
- Worktree: `/Users/declanshanaghy/src/github.com/declanshanaghy/fenrir-ledger-trees/fix/settings-soft-gate`

### Test scenarios

1. **Non-subscriber (Thrall) visits /settings**
   - All 3 feature sections (Cloud Sync, Multi-Household, Data Export) must be visible
   - Each section should have an "Unlock this feature" banner above it with gold border
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

### Build verification

- `npx tsc --noEmit` -- PASS
- `npx next lint` -- PASS
- `npm run build` -- PASS

## Known limitations

- Soft gate banner is not dismissible (intentional for settings context where each banner is tied to a specific feature section)
- SealedRuneModal still wired in soft mode for "Learn more" flow

## Suggested test focus areas

1. Mobile responsiveness at 375px
2. Hard mode regression on other gated pages
3. Accessibility: banner aria labels, touch targets
