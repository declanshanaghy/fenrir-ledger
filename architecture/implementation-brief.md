# Implementation Brief: FiremanDecko Integration Plan

**From**: Luna (UX Designer) + Freya (Product Owner)
**To**: FiremanDecko (Principal Engineer)
**Re**: Integrating the Saga Ledger design system into the existing Next.js codebase

---

## Current State Assessment

Sprint 1 delivered a working foundation. Sprint 2 design integration is complete:

- ✅ Next.js App Router + TypeScript + Tailwind + shadcn/ui
- ✅ `Card` type, `CardStatus` type, `localStorage` persistence
- ✅ Basic dashboard with card list and status indicators
- ✅ Card CRUD (add, edit, delete)
- ✅ Persistent app shell with collapsible sidebar navigation (Sprint 2)
- ✅ Saga Ledger theme applied: void-black bg, gold accents, Cinzel/Source Serif fonts (Sprint 2)
- ✅ Deployed to Vercel: https://fenrir-ledger.vercel.app
- ✅ Static marketing site built at `/static/index.html` (GitHub Pages)
- ✅ Next.js upgraded to 15.1.12 (CVE-2025-66478 fix)
- ✅ Easter Egg #4 (Console ASCII art) — `ConsoleSignature.tsx` (Sprint 2)
- ✅ Easter Egg #5 (HTML source signature) — JSDoc block in `layout.tsx` (Sprint 2)
- ✅ Easter Egg #7 (Runic meta tag) — `metadata.other["fenrir:runes"]` in `layout.tsx` (Sprint 2)
- ✅ Easter Egg #2 (Konami Code Howl) — `KonamiHowl.tsx` (Sprint 2)
- ✅ Easter Egg #3 (Loki Mode) — Footer "Loki" 7-click shuffle (Sprint 2)
- ✅ Easter Egg #1 Fragment 5 (Breath of a Fish) — Footer © hover → `GleipnirFishBreath` modal (Sprint 2)
- ✅ Footer component — `Footer.tsx`, three-column layout with both easter eggs wired (Sprint 2)
- ⚠️ Norse copy pass not yet complete (generic copy remains in some areas — Stories 3–4 partially delivered)
- ⚠️ `getRealmLabel()` / `realm-utils.ts` not yet implemented (deferred to Sprint 3)
- ⚠️ No animation layer (Sprint 3)
- ⚠️ The Howl panel not yet built (Sprint 3)
- ⚠️ Valhalla route not yet built (Sprint 3)

**The existing data model and business logic are untouched by this design system.** The `Card` type, `CardStatus`, `storage.ts`, `card-utils.ts` — none of these change. This is a pure presentation-layer upgrade.

---

## Integration Strategy: Three-Wave Approach

### Wave 1 — Foundation (Sprint 2, Stories 1–2)
*Swap the visual substrate without breaking anything.*

### Wave 2 — Mythology Layer (Sprint 2, Stories 3–4)
*Apply Norse vocabulary, copy, and component enhancements.*

### Wave 3 — Animation + Easter Eggs (Sprint 3)
*Add motion, Howl panel, Valhalla archive, and hidden references.*

---

## Sprint 2 Stories (Design Integration)

### Story 1: Theme System Foundation
**"Replace shadcn defaults with the Saga Ledger theme"**

**Files to modify**:
- `development/ledger/src/app/globals.css` — Replace all `:root` and `.dark` CSS variables with the Saga Ledger token set (see `../ux/theme-system.md`)
- `development/ledger/tailwind.config.ts` — Add `colors`, `fontFamily`, `boxShadow` extensions
- `development/ledger/src/app/layout.tsx` — Add `next/font/google` imports for Cinzel, Cinzel Decorative, Source Serif 4, JetBrains Mono; apply font variables to `<html>`; add background texture CSS; add HTML source comment signature (easter egg #5)

**Acceptance criteria**:
- Background is `#07070d` (void-black) — not white
- Text is `#e8e4d4` (aged parchment)
- Gold accent `#c9920a` is wired to `--primary`
- Cinzel Decorative renders on the page title
- JetBrains Mono renders on any numeric field
- No visual regressions in card CRUD (shadcn components still function)

---

### Story 2: Header + Navigation
**"Replace generic header with Saga Ledger nav"**

**Files to modify**:
- `development/ledger/src/app/page.tsx` — Refactor `<header>` section

**New header structure**:
```tsx
<header className="sticky top-0 z-100 border-b border-rune-border">
  <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

    {/* Logo */}
    <div className="flex flex-col">
      <span className="font-display text-gold tracking-widest uppercase text-sm">
        ᛟ Fenrir Ledger
      </span>
      <span className="font-body text-rune text-xs italic">
        Ledger of Fates
      </span>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-3">
      <HowlBadge count={urgentCount} />  {/* new component */}
      <Button className="font-heading">Forge a Chain</Button>
    </div>
  </div>
</header>
```

**Remove**: the `🐺` emoji (replaced by `ᛟ` rune + typography)

---

### Story 3: CardStatus → Norse Realm Display
**"Apply realm vocabulary to card status badges"**

**Files to modify / create**:
- `development/ledger/src/components/dashboard/StatusBadge.tsx` — Shipped as `StatusBadge.tsx`; realm label wiring via `getRealmLabel()` still pending
- `development/ledger/src/lib/card-utils.ts` — Add `getRealmLabel(status, daysRemaining)` utility function (pending)

**Do not change**: `CardStatus` type in `types.ts`. The Norse vocabulary is display-only.

```typescript
// card-utils.ts addition
export function getRealmLabel(status: CardStatus, daysRemaining?: number): {
  label: string
  sublabel: string
  rune: string
  colorClass: string
} {
  if (status === 'closed') return {
    label: 'In Valhalla',
    sublabel: 'Chain broken — rewards harvested',
    rune: 'ᛏ',
    colorClass: 'text-realm-hel'
  }
  if (status === 'fee_approaching') return {
    label: 'Muspelheim',
    sublabel: `Sköll is ${daysRemaining} days behind the sun`,
    rune: 'ᚲ',
    colorClass: 'text-realm-muspel'
  }
  if (status === 'promo_expiring') return {
    label: 'Hati approaches',
    sublabel: `Hati is ${daysRemaining} days behind the moon`,
    rune: 'ᚺ',
    colorClass: 'text-realm-hati'
  }
  return {
    label: 'Asgard-bound',
    sublabel: 'Rewards flowing — no urgent deadlines',
    rune: 'ᛊ',
    colorClass: 'text-realm-asgard'
  }
}
```

---

### Story 4: Empty State + Copy Pass
**"Apply Saga Ledger copy to all empty states, loading states, and key labels"**

**Files to touch**:
- `page.tsx` — Loading state copy: *"The Norns are weaving..."*
- `Dashboard.tsx` (or equivalent) — Empty state: Gleipnir text (see `copywriting.md`)
- Form labels in add/edit card — Apply kenning micro-copy
- Button text — "Bind the Chain", "Forge a Chain", etc.
- `layout.tsx` — `<title>` and `<meta description>` per `../product/copywriting.md`

**No structural changes** — copy-only pass. This can be done by search-and-replace + careful review.

---

### Story 5 (Deployment): Sprint 2 Deploy Script
*Standard idempotent deployment story per team conventions.*

---

## Sprint 3 Stories (Animation + Howl Panel)

### Story 1: Framer Motion + Card Animations
- Install `framer-motion` (check if already in `package.json`)
- Wrap card grid in `AnimatePresence`
- `saga-enter` stagger on page load
- Card appear/exit animations (see `interactions.md`)
- Skeleton shimmer loading state

### Story 2: Status Ring Component
- `StatusRing.tsx` — SVG progress ring around card issuer initials
- `strokeDashoffset`-driven by `daysRemaining / totalDays`
- Pulse animation when `daysRemaining <= 30`
- Color transitions per realm (see `interactions.md`)

### Story 3: The Howl Panel
- `HowlPanel.tsx` — Sidebar component showing urgent cards
- Slides in via Framer Motion when `urgentCards.length > 0`
- Raven shake animation on new urgent card
- Empty state: *"The wolf is silent. All chains are loose."*
- Responsive: drawer on mobile, sidebar on desktop

### Story 4: Valhalla Archive (`/valhalla`)
- New route: `development/ledger/src/app/valhalla/page.tsx`
- Tombstone card style (darker, sepia, `ᛏ` rune)
- "Slain Fáfnir" copy per card
- Net value calculation (rewards - fees paid)
- Entry animation: cards "descend" into the hall

### Story 5: Easter Eggs Layer B (Sprint 3 Remaining)
- `?` shortcut → About modal (#9) — eggs #4, #5, #7, #2, #3, and fragment #1.5 all shipped in Sprint 2

---

## Sprint 4 Stories (Deep Mythology)

- Ragnarök threshold mode (#8)
- Card count milestone toasts (#11)
- Gleipnir Hunt full implementation (#1) — this is a larger story, may split
- Star Trek LCARS mode (#6) — optional/bonus

> **Note**: Easter Eggs #2 (Konami Code Howl) and #3 (Loki Mode) shipped in Sprint 2 and are not repeated here. See `../ux/easter-eggs.md` implementation priority table for the full status of all eggs.

---

## Standing UI Conventions

### Button Alignment (global rule, applies to all sprints)

Every form and dialog in the application follows one layout rule. This rule must be respected in any component that renders action buttons — including `CardForm.tsx`, any confirmation dialogs, and future panels.

**Rule summary**:
- **Primary / positive action** (Save, Add, Continue, OK) — far right.
- **Cancel** — immediately left of the primary action.
- **Destructive action** (Close Card, Delete) — isolated on the far left, only when co-present with a primary action.
- **Mobile** — stack vertically, primary button on top.

**Desktop layout**:

```
[ Destructive ]                    [ Cancel ] [ Primary ]
```

**Mobile layout** (stacked):

```
[ Primary     ]
[ Cancel      ]
[ Destructive ]
```

Implementation notes:
- Use `justify-between` on the row container when a destructive action is present; `justify-end` otherwise.
- Collapse to `flex-col md:flex-row` with reversed stacking order on mobile.
- Touch targets min 44 x 44 px per team norms.
- See `ux/wireframes.md` for the full visual specification.

---

## Files That Do Not Change (Hands Off)

| File | Why |
|------|-----|
| `src/lib/types.ts` | Data model is correct as-is |
| `src/lib/storage.ts` | Persistence logic unchanged (add Gleipnir ingredient comment) |
| `src/lib/constants.ts` | No changes needed |
| `src/lib/card-utils.ts` | Add `getRealmLabel()` only; don't touch existing functions |

---

## New Files / Routes Created

| File | Sprint | Purpose |
|------|--------|---------|
| `src/components/layout/HowlPanel.tsx` | S3 | Urgent cards sidebar |
| `src/components/dashboard/StatusRing.tsx` | S3 | SVG deadline ring |
| `src/components/dashboard/StatusBadge.tsx` | S2 | Realm status badge |
| `src/components/dashboard/AnimatedCardGrid.tsx` | S3 | Framer Motion card grid |
| `src/components/dashboard/CardSkeletonGrid.tsx` | S3 | Gold shimmer loading |
| `src/components/layout/Footer.tsx` | S2 | Footer with Loki easter egg trigger |
| `src/components/layout/UpsellBanner.tsx` | S3 | Cloud sync upsell for anonymous users |
| `src/components/layout/SyncIndicator.tsx` | S4 | Sync status dot (Gleipnir fragment 1) |
| `src/components/shared/WolfHungerMeter.tsx` | S4 | Aggregate bonus summary |
| `src/components/shared/AuthGate.tsx` | S5 | Hides children for anonymous users |
| `src/components/easter-eggs/EasterEggModal.tsx` | S4 | Shared Gleipnir modal shell |
| `src/components/easter-eggs/LcarsOverlay.tsx` | S4 | LCARS overlay easter egg |
| `src/app/valhalla/page.tsx` | S3 | Closed cards archive |
| `src/app/sign-in/page.tsx` | S3 | Opt-in sign-in page |
| `src/app/auth/callback/page.tsx` | S3 | OAuth callback |
| `src/app/api/auth/token/route.ts` | S3 | Server token proxy |
| `src/app/api/sheets/import/route.ts` | S5 | Google Sheets import API |
| `src/components/layout/ConsoleSignature.tsx` | S2 | Console ASCII (client-only) |
| `src/lib/realm-utils.ts` | S3 | `getRealmLabel()` Norse display helpers |
| `src/lib/milestone-utils.ts` | S4 | Card count milestone toast thresholds |
| `src/lib/gleipnir-utils.ts` | S4 | Gleipnir fragment tracking |
| `src/lib/merge-anonymous.ts` | S5 | Anonymous → authenticated data merge |
| `src/lib/auth/pkce.ts` | S3 | PKCE utilities |
| `src/lib/auth/session.ts` | S3 | localStorage session management |
| `src/lib/auth/household.ts` | S3 | Anonymous householdId generation |
| `src/lib/auth/require-auth.ts` | S5 | API route auth guard |
| `src/contexts/AuthContext.tsx` | S3 | Auth state context |
| `src/contexts/RagnarokContext.tsx` | S4 | Ragnarok threshold context |
| `src/hooks/useAuth.ts` | S3 | Auth hook |
| `src/hooks/useSheetImport.ts` | S5 | Sheet import state management |
| `src/components/sheets/ImportWizard.tsx` | S5 | Three-path import wizard |

---

## Dependency Additions

| Package | Why | Sprint |
|---------|-----|--------|
| `framer-motion` | Card animations, Howl panel slide | S3 |

All fonts via `next/font/google` — no external CSS imports, no extra dependencies.

---

## QA Handoff Notes for Loki

For each sprint, Loki should specifically test:

**Sprint 2**:
- All text is readable against dark backgrounds (WCAG AA minimum)
- Fonts load correctly and don't flash (FOUT)
- shadcn form components (Select, Input, Dialog) function correctly with new theme
- Status badges render with correct realm name and color per `CardStatus`
- Mobile: header doesn't overflow

**Sprint 3**:
- Animations don't cause layout shift or scroll jank
- `AnimatePresence` card exit doesn't leave DOM ghosts
- The Howl panel doesn't overlap form inputs on tablet
- Valhalla route is reachable and back-navigation works
- Console art only prints once per session (not on every re-render)

**Sprint 4**:
- Konami code doesn't trigger on form input fields
- Loki mode restores correct order after 5 seconds
- Ragnarök mode threshold count is accurate (≥ 3 urgent cards)
- Easter eggs don't interfere with accessibility (keyboard navigation intact)

---

## Resolved Questions (Historical)

1. **Framer Motion SSR**: Resolved — all Framer Motion components use `"use client"` directive. `AnimatedCardGrid.tsx` and `CardSkeletonGrid.tsx` are client components.

2. **Font loading strategy**: Resolved — `display: 'swap'` applied to all `next/font/google` declarations in `layout.tsx`.

3. **The `status` field enrichment**: Resolved — `getRealmLabel()` implemented in `realm-utils.ts`, wired into `StatusBadge.tsx`. `daysRemaining` computed from card dates.

4. **Valhalla vs delete**: Resolved — Valhalla route built at `/valhalla` for closed cards. Cards with `status: "closed"` appear in Valhalla.

5. **The Howl threshold**: Resolved — HowlPanel shows cards with `fee_approaching` or `promo_expiring` status. Ragnarok mode (>= 5 urgent) triggers dramatic overlay via `RagnarokContext`.
