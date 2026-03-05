# QA Handoff -- Story 2: Theme Toggle UI + Color Audit + Design Docs

**Branch:** `feat/theme-toggle-ui`
**Date:** 2026-03-04
**Engineer:** FiremanDecko

## What Was Implemented

Three tasks for Story 2:

### Task 1: ThemeToggle Component + TopBar Integration
- Created `ThemeToggle.tsx` -- three-way segmented toggle (Light/Dark/System) using Sun, Moon, Monitor icons from lucide-react
- SSR-safe: renders placeholder until mounted to avoid hydration mismatch
- Integrated into TopBar in both states:
  - **Anonymous**: Theme row in the upsell prompt panel (above "Sign in to Google")
  - **Signed-in**: Theme row in the profile dropdown (above "Sign out")
- Accessible: `role="radiogroup"`, `aria-label="Theme"`, `aria-checked` per option
- Touch-friendly: min 44x36px tap targets

### Task 2: Color Audit -- Hardcoded Hex Removal
- Converted ALL inline `style={{ color: "#hex" }}` and Tailwind `[#hex]` patterns to CSS variables
- Added new CSS variable groups in globals.css: `--egg-*`, `--lcars-*`, `--howl-*`, `--loki-toast-*`, `--realm-*`
- 24 component files modified (see list below)

### Task 3: Design System Documentation
- Created `designs/ux-design/theme-system.md` with full palette specs, WCAG contrast ratios, and mandatory design rules

## Files Created

| File | Description |
|------|-------------|
| `src/components/layout/ThemeToggle.tsx` | Three-way theme toggle (Sun/Moon/Monitor) |
| `designs/ux-design/theme-system.md` | Dual-theme design system documentation |

## Files Modified

| File | Change |
|------|--------|
| `src/app/globals.css` | Added `--egg-*`, `--lcars-*`, `--howl-*`, `--loki-toast-*`, `--realm-*` vars in both `:root` and `.dark` |
| `src/components/layout/TopBar.tsx` | Added ThemeToggle import and integration in both auth states |
| `src/components/easter-eggs/EasterEggModal.tsx` | All hex to `--egg-*` CSS variables |
| `src/components/easter-eggs/LcarsOverlay.tsx` | All hex to `--lcars-*` CSS variables |
| `src/components/layout/KonamiHowl.tsx` | All hex to `--howl-*` CSS variables |
| `src/components/layout/Footer.tsx` | Loki Toast hex to `--loki-toast-*` variables |
| `src/components/layout/HowlPanel.tsx` | Realm status hex to `--realm-*` variables |
| `src/components/layout/SyncIndicator.tsx` | Hex to CSS variables |
| `src/components/layout/ForgeMasterEgg.tsx` | Hex to `--egg-*` variables |
| `src/components/dashboard/StatusRing.tsx` | Realm color constants to CSS variables |
| `src/components/cards/GleipnirCatFootfall.tsx` | All hex to CSS variables |
| `src/components/cards/GleipnirWomansBeard.tsx` | All hex to CSS variables |
| `src/components/cards/GleipnirMountainRoots.tsx` | All hex to CSS variables |
| `src/components/cards/GleipnirBearSinews.tsx` | All hex to CSS variables |
| `src/components/cards/GleipnirFishBreath.tsx` | All hex to CSS variables |
| `src/components/cards/GleipnirBirdSpittle.tsx` | All hex to CSS variables |
| `src/components/shared/WolfHungerMeter.tsx` | Hex to CSS variables |
| `src/app/page.tsx` | Urgent badge color to CSS variable |
| `src/app/valhalla/page.tsx` | All hex to CSS variables |
| `src/components/entitlement/PatreonSettings.tsx` | `#07070d` to `text-primary-foreground` |
| `src/components/entitlement/SealedRuneModal.tsx` | `#07070d` to semantic tokens |
| `src/components/entitlement/UpsellBanner.tsx` | `#07070d` to `bg-background` |
| `src/components/entitlement/UnlinkConfirmDialog.tsx` | `#07070d` to `bg-background` |

## How to Deploy / Test

```bash
cd development/frontend
npm install
npm run dev
```

## Test Scenarios

### ThemeToggle

| Test | Steps | Expected |
|------|-------|----------|
| TC-TH-001 | Sign in, click avatar, open dropdown | "Theme" row with toggle visible above "Sign out" |
| TC-TH-002 | Anonymous state, click avatar | "Theme" row visible in upsell panel above CTAs |
| TC-TH-003 | Click Moon (Dark) | `.dark` class added to `<html>`, dark background |
| TC-TH-004 | Click Sun (Light) | `.dark` class removed, parchment background |
| TC-TH-005 | Click Monitor (System), toggle OS dark/light | Theme follows OS |
| TC-TH-006 | Clear localStorage `fenrir-theme`, reload | Default is System |
| TC-TH-007 | Select Dark, reload page | Theme persists as Dark |
| TC-TH-008 | Set to Light | Parchment background renders (not white) |
| TC-TH-009 | Set to Dark | Void-black background renders |
| TC-TH-011 | Hard reload | No flash of wrong theme |

### Color Audit

| Test | Steps | Expected |
|------|-------|----------|
| Easter eggs | Trigger `?` key (ForgeMasterEgg) in both themes | Modal renders correctly |
| LCARS | Ctrl+Shift+L in both themes | Overlay renders with correct colors |
| Konami | Enter Konami code in both themes | Wolf and band render correctly |
| HowlPanel | View with urgent cards in both themes | Colors render correctly |
| StatusRing | View cards with various statuses | Ring colors visible and correct |
| Valhalla | Visit /valhalla in both themes | Tombstone cards render correctly |
| Loki Mode | Click "Loki" 7x in footer in both themes | Toast renders correctly |

### Build Validation

```bash
cd development/frontend
npx tsc --noEmit   # PASS (verified)
npx next build     # PASS (verified)
```

## Known Limitations

- Google brand colors on the sign-in page (#4285F4, etc.) are intentionally left as hardcoded hex per brand guidelines
- Easter egg modals use their own dark overlay aesthetic in both themes (by design)
- The `--realm-*` status colors are identical in both themes for consistency
- Tailwind config still has hardcoded hex in direct color tokens (void, forge, chain, gold, realm) -- these are design-time constants used by Tailwind's color system, not runtime theme variables

## Suggested Test Focus Areas

1. **Dark mode visual regression** -- everything should look identical to pre-change
2. **Light mode readability** -- all text readable on parchment background
3. **Easter egg modals in light mode** -- these have their own dark overlay
4. **Status colors on light background** -- realm-* colors need adequate contrast
5. **ThemeToggle active state** -- gold highlight on the selected option
