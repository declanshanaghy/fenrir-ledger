# QA Handoff: Task #7 -- Wire Feature Gates to Specific Features

**Task**: #7 -- Wire Feature Gates to Specific Features
**Branch**: `feat/patreon-wire-gates` (targets `feat/patreon-gate`)
**Author**: FiremanDecko (Principal Engineer)
**Date**: 2026-03-03
**Depends on**: Task #6 (PR #96, branch `feat/patreon-gate`)

---

## What Was Implemented

Wired the PatreonGate, UpsellBanner, and PatreonSettings components (from PR #96) to specific locations throughout the app. No new premium features were built -- only gates around where they would appear.

### Changes Summary

| File | Change |
|------|--------|
| `src/app/page.tsx` | Added Patreon UpsellBanner above the card grid on the dashboard |
| `src/app/settings/layout.tsx` | New server component for /settings route metadata |
| `src/app/settings/page.tsx` | New settings page with PatreonSettings + 3 gated feature placeholders |
| `src/components/layout/SideNav.tsx` | Added "Settings" nav link with Lucide gear icon |

### Features Gated (4 of 6)

| Feature Slug | Location | Gate Type |
|-------------|----------|-----------|
| `cloud-sync` | Settings page placeholder section | PatreonGate |
| `multi-household` | Settings page placeholder section | PatreonGate |
| `data-export` | Settings page placeholder section (with disabled Export button) | PatreonGate |
| N/A (general) | Dashboard above card grid | UpsellBanner (dismissible, 7-day re-show) |

### Features Not Gated (by design)

| Feature Slug | Reason |
|-------------|--------|
| `advanced-analytics` | No existing analytics UI; task spec says skip |
| `extended-history` | No extended history UI beyond Valhalla; task spec says skip |
| `cosmetic-perks` | No theme switcher UI; task spec says skip |

---

## Files Created

| File | Description |
|------|-------------|
| `development/frontend/src/app/settings/layout.tsx` | Server component setting `<title>Settings</title>` metadata |
| `development/frontend/src/app/settings/page.tsx` | Settings page: PatreonSettings (auth-gated) + 3 PatreonGate-wrapped feature placeholders |

## Files Modified

| File | Change |
|------|--------|
| `development/frontend/src/app/page.tsx` | Import PatreonUpsellBanner, render it above card grid |
| `development/frontend/src/components/layout/SideNav.tsx` | Import Lucide `Settings` icon, add Settings nav item to NAV_ITEMS array |

---

## How to Test

### Prerequisites
- The app runs on the standard Next.js dev server (`npm run dev`)
- EntitlementProvider and AuthProvider are already wired in root layout

### Test Scenarios

#### 1. UpsellBanner on Dashboard (/)

| Scenario | Expected |
|----------|----------|
| Thrall user (authenticated, no Patreon) | Patreon upsell banner appears above card grid with gold border, Algiz rune, "Learn more" CTA |
| Karl user (authenticated, active Patreon) | Banner does NOT appear |
| Anonymous user (not signed in) | Patreon banner does NOT appear (sign-in banner may appear in TopBar instead) |
| Dismiss banner (click X) | Banner disappears, stays hidden for 7 days |
| Clear `fenrir:upsell-dismissed` from localStorage | Banner reappears on next page load |
| Click "Learn more" | SealedRuneModal opens for the promoted feature (cloud-sync by default) |

#### 2. Settings Page (/settings)

| Scenario | Expected |
|----------|----------|
| Navigate to /settings | Page renders with "Settings" heading, atmospheric subtext |
| Anonymous user | PatreonSettings section is hidden (wrapped in AuthGate). Gated placeholders still show. |
| Authenticated Thrall user | PatreonSettings shows "Link Patreon" state. Cloud Sync, Multi-Household, Data Export sections show SealedRuneModal |
| Authenticated Karl user | PatreonSettings shows linked state. Cloud Sync, Multi-Household, Data Export sections show placeholder content with "Coming soon" |
| Dismiss a SealedRuneModal | Locked placeholder appears with "Learn more" link to re-open |
| Data Export section | Has a disabled "Export Data" button (visual affordance for future feature) |

#### 3. Settings Nav Link in Sidebar

| Scenario | Expected |
|----------|----------|
| Sidebar expanded | Three items: Cards, Valhalla, Settings. Settings has Lucide gear icon. |
| Sidebar collapsed | Gear icon only, tooltip "Settings" on hover |
| Navigate to /settings | Settings link highlighted with gold left border |
| Click Settings link | Navigates to /settings page |

#### 4. TypeScript / Build

- `npx tsc --noEmit` -- PASS (zero errors)
- `npm run build` -- PASS (compiled successfully)

---

## Acceptance Criteria Checklist

1. [x] UpsellBanner appears on dashboard for Thrall users, hidden for Karl
2. [x] PatreonSettings is accessible via a settings page/route (/settings)
3. [x] Settings nav link exists in sidebar (Lucide gear icon)
4. [x] At least 3 of 6 features have PatreonGate wiring (cloud-sync, multi-household, data-export)
5. [x] All gates use the correct feature slug from PremiumFeature type
6. [x] TypeScript strict, no errors
7. [x] Build passes

---

## Known Limitations

1. Premium feature placeholders are informational only -- no actual functionality behind them yet.
2. Three features (advanced-analytics, extended-history, cosmetic-perks) have no gate because there is no UI to gate against.
3. The Data Export section has a disabled button as a visual affordance only.
4. UpsellBanner promotes cloud-sync by default; no rotation logic.
