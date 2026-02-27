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
- ⚠️ Norse copy pass not yet complete (generic copy remains in some areas)
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
- `development/src/src/app/globals.css` — Replace all `:root` and `.dark` CSS variables with the Saga Ledger token set (see `design/theme-system.md`)
- `development/src/tailwind.config.ts` — Add `colors`, `fontFamily`, `boxShadow` extensions
- `development/src/src/app/layout.tsx` — Add `next/font/google` imports for Cinzel, Cinzel Decorative, Source Serif 4, JetBrains Mono; apply font variables to `<html>`; add background texture CSS; add HTML source comment signature (easter egg #5)

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
- `development/src/src/app/page.tsx` — Refactor `<header>` section

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
- `development/src/src/components/dashboard/CardStatusBadge.tsx` — New component (or refactor existing badge)
- `development/src/src/lib/card-utils.ts` — Add `getRealmLabel(status, daysRemaining)` utility function

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
- `layout.tsx` — `<title>` and `<meta description>` per `copywriting.md`

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
- New route: `development/src/src/app/valhalla/page.tsx`
- Tombstone card style (darker, sepia, `ᛏ` rune)
- "Slain Fáfnir" copy per card
- Net value calculation (rewards - fees paid)
- Entry animation: cards "descend" into the hall

### Story 5: Easter Eggs Layer B (Sprint 3 Remaining)
- `?` shortcut → About modal (#9) — eggs #4, #5, #7, #2, #3, and fragment #1.5 all shipped in Sprint 2

---

## Sprint 4 Stories (Deep Mythology)

- Konami code wolf howl (#2)
- Loki mode (#3)
- Ragnarök threshold mode (#8)
- Card count milestone toasts (#11)
- Gleipnir Hunt full implementation (#1) — this is a larger story, may split
- Star Trek LCARS mode (#6) — optional/bonus

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
| `src/components/dashboard/HowlPanel.tsx` | S3 | Urgent sidebar |
| `src/components/dashboard/StatusRing.tsx` | S3 | SVG deadline ring |
| `src/components/dashboard/CardStatusBadge.tsx` | S2 | Realm status badge |
| `src/components/layout/Footer.tsx` | S2 | Footer with Loki easter egg trigger |
| `src/app/valhalla/page.tsx` | S3 | Closed cards archive |
| `src/lib/console-signature.ts` | S2 | Console ASCII (client-only) |
| `src/lib/easter-eggs.ts` | S3 | Konami code, Loki mode, event listeners |
| `src/lib/realm-utils.ts` | S2 | `getRealmLabel()` and Norse display helpers |
| `public/cursors/wolf-paw.svg` | S4 | Custom cursor asset |

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

## Open Questions for FiremanDecko

1. **Framer Motion SSR**: Next.js App Router — ensure `framer-motion` components are wrapped in `"use client"` directives. Plan for this in the animation stories.

2. **Font loading strategy**: Use `display: 'swap'` on all `next/font` declarations to prevent FOUT on slow connections.

3. **The `status` field enrichment**: `getRealmLabel()` needs `daysRemaining` which requires computing from `annualFeeDate` and `signUpBonus.deadline`. Confirm `card-utils.ts` already provides this or whether a new `getDaysRemaining(card: Card): number` is needed.

4. **Valhalla vs delete**: Currently cards can be deleted. Propose: soft-delete moves card to `status: "closed"` with `closedAt` date. Hard-delete removed from UI entirely (requires confirmation with the "Cast into the Void" dialog). Discuss with Freya whether this needs a schema migration (ADR-004).

5. **The Howl threshold**: What counts as "urgent enough" for The Howl? Propose: `fee_approaching` (≤ 30 days) OR `promo_expiring` (≤ 45 days). Configurable in settings (Sprint 4).
