# QA Handoff: Task #6 -- PatreonGate + Upsell Components

**Task**: #6 -- PatreonGate + Upsell Components
**Branch**: `feat/patreon-gate`
**Author**: FiremanDecko (Principal Engineer)
**Date**: 2026-03-03
**Depends on**: Task #5 (PR #95, branch `feat/patreon-client`)

---

## What Was Implemented

UI gate and upsell components for the Patreon subscription integration. These components consume the `useEntitlement` hook from Task #5 and implement the hard gate, upsell banner, and settings section wireframes from the design branch.

### Components

1. **PatreonGate** -- Wrapper that hard-gates premium features (renders children for Karl, Sealed Rune Modal for Thrall, skeleton while loading)
2. **SealedRuneModal** -- Norse-themed hard gate modal with Algiz rune, feature info, Pledge/Renew CTA
3. **UpsellBanner** -- Dismissible banner promoting Karl tier (7-day re-show, localStorage-backed)
4. **PatreonSettings** -- Settings section with unlinked/linked Karl/linked Thrall/expired states
5. **UnlinkConfirmDialog** -- Confirmation dialog for Patreon unlink action
6. **Feature Descriptions** -- Registry of Norse-themed copy per premium feature (Voice 1 + Voice 2)

---

## Files Created

| File | Description |
|------|-------------|
| `development/frontend/src/components/entitlement/PatreonGate.tsx` | Wrapper: renders children for Karl, SealedRuneModal for Thrall, skeleton while loading |
| `development/frontend/src/components/entitlement/SealedRuneModal.tsx` | Hard gate modal: Algiz rune, "THIS RUNE IS SEALED", feature info, CTA, dismiss |
| `development/frontend/src/components/entitlement/UpsellBanner.tsx` | Dismissible banner: 7-day re-show, "Learn more" opens SealedRuneModal |
| `development/frontend/src/components/entitlement/PatreonSettings.tsx` | Settings section: 4 states (unlinked, Karl active, Thrall linked, expired) |
| `development/frontend/src/components/entitlement/UnlinkConfirmDialog.tsx` | Confirmation dialog with cancel/confirm, Voice 1 copy |
| `development/frontend/src/components/entitlement/index.ts` | Barrel exports for all entitlement components |
| `development/frontend/src/lib/entitlement/feature-descriptions.ts` | Feature descriptions: description, atmospheric, expiredAtmospheric per feature |

## Files Modified

| File | Change |
|------|--------|
| `development/frontend/src/lib/entitlement/index.ts` | Added re-export for feature-descriptions module |
| `development/frontend/src/app/globals.css` | Added `sealed-rune-pulse` animation + `prefers-reduced-motion` override |

---

## Component Usage

```tsx
// PatreonGate wraps any premium feature content
import { PatreonGate } from "@/components/entitlement";

<PatreonGate feature="cloud-sync">
  <CloudSyncPanel />
</PatreonGate>

// UpsellBanner on the dashboard
import { UpsellBanner } from "@/components/entitlement";

<UpsellBanner feature="cloud-sync" />

// PatreonSettings in a settings page (wrap in AuthGate)
import { PatreonSettings } from "@/components/entitlement";
import { AuthGate } from "@/components/shared/AuthGate";

<AuthGate>
  <PatreonSettings />
</AuthGate>
```

---

## Suggested Test Focus Areas

### 1. PatreonGate: Feature Gating

| Scenario | Expected Behavior |
|----------|-------------------|
| Karl user, feature unlocked | Children render normally |
| Thrall user, feature locked | SealedRuneModal appears |
| Expired user (linked, not active) | SealedRuneModal with "Renew" variant |
| isLoading = true | Skeleton shimmer with `aria-busy="true"` |
| Modal dismissed | Locked placeholder with "Learn more" re-opens modal |

### 2. SealedRuneModal: Hard Gate

- Algiz rune glyph (Unicode 5765) renders and has gold pulse animation (600ms, one-shot)
- "THIS RUNE IS SEALED" in Cinzel Decorative, uppercase, letter-spacing 0.12em
- Feature name and description pulled from `PREMIUM_FEATURES` and `FEATURE_DESCRIPTIONS`
- Atmospheric quote: Norse italic for Thrall, welcoming italic for expired
- Tier badge: "Karl Supporter" for Thrall, "Expired" (dashed border) for expired users
- CTA text: "Pledge on Patreon" for Thrall, "Renew on Patreon" for expired
- Dismiss text: includes "I will continue as Thrall" for Thrall, just "Not now" for expired
- Escape key dismisses the modal
- `prefers-reduced-motion: reduce` disables the rune pulse
- Mobile (375px): `w-[92vw]`, tier row stacks vertically
- Gold border: `border-2 border-gold/40`
- Void-black background: `bg-[#07070d]`

### 3. UpsellBanner: Dismissible Promotion

- Only visible for authenticated Thrall users
- Hidden for: anonymous users, Karl users, expired users, loading state
- Dismiss (X button): writes `Date.now()` to `fenrir:upsell-dismissed` in localStorage
- After dismissal: banner does not reappear for 7 days
- Clear `fenrir:upsell-dismissed` or set timestamp > 7 days: banner reappears
- "Learn more" link opens SealedRuneModal for the promoted feature
- Anatomy: [Rune icon] [Headline] [Description] [Atmospheric] [Learn more]
- Mobile: column layout; Desktop: row layout

### 4. PatreonSettings: Settings Section

**Unlinked state (not linked, not loading):**
- "Link your Patreon account" description
- Feature list with lock icons (all 6 features)
- "Link Patreon" button with "P" icon
- Button calls `linkPatreon()`

**Linked Karl state (linked, active, tier=karl):**
- "KARL" badge (gold border, compact) in section header
- "Linked to Patreon" text with member-since date from cache
- "Premium features: All unlocked" with checkmark icons
- "Unlink Patreon" button (right-aligned) opens UnlinkConfirmDialog

**Linked Thrall state (linked, not active, tier=thrall):**
- No tier badge
- "Linked to Patreon" + "No active pledge found."
- Feature list with lock icons
- "Pledge on Patreon" CTA + "Unlink Patreon" button

**Expired state (linked, not active, tier=karl previously):**
- "EXPIRED" badge (dashed border, muted)
- Amber left-border warning block
- "Your Karl membership has expired."
- "Renew on Patreon" primary CTA + "Unlink Patreon" secondary
- Reassurance: "Your card data and settings are not affected."

### 5. UnlinkConfirmDialog

- `role="alertdialog"` for screen readers
- All copy is Voice 1 (functional, no Norse)
- Two consequences explained: premium features locked, Patreon continues
- Cancel dismisses, "Unlink Patreon" calls `unlinkPatreon()`
- Shows "Unlinking..." during operation, both buttons disabled
- Toast "Patreon unlinked." on success
- Mobile: buttons stack vertically (column-reverse), full-width

### 6. Accessibility

- All modals: `aria-labelledby`, `aria-describedby`
- UnlinkConfirmDialog: `role="alertdialog"`
- All interactive elements: `aria-label` attributes
- Touch targets: minimum 44x44px on all buttons and links
- Skeleton states: `aria-busy="true"`, `aria-label` describing what is loading
- `prefers-reduced-motion: reduce` disables sealed-rune-pulse animation
- UpsellBanner: `role="complementary"` with descriptive `aria-label`

### 7. Responsive (Mobile 375px+)

- SealedRuneModal: `w-[92vw] max-w-[480px]`, tier row stacks vertically
- PatreonSettings: all buttons become full-width on mobile
- UnlinkConfirmDialog: buttons stack vertically, full-width, min-height 48px
- UpsellBanner: column layout on mobile

---

## Build Status

- `npx tsc --noEmit`: PASS (zero errors)
- `npm run build`: PASS (compiled successfully, no warnings from new code)

---

## Known Limitations

1. **Components are not yet wired into pages** -- They are built and exported but not imported into the dashboard or settings page. Page-level integration is a separate task.
2. **Feature descriptions are static** -- The Norse copy is hardcoded in `feature-descriptions.ts`, not fetched from any backend.
3. **UpsellBanner promotes cloud-sync by default** -- The `feature` prop can override this, but no logic rotates the promoted feature.
4. **PatreonSettings reads linkedAt from localStorage** -- The member-since date is derived from the entitlement cache. If the cache is cleared, the date is not shown.
