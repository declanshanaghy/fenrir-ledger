# Wireframes: Fenrir Ledger

Wireframes are standalone HTML5 documents. They use only structural layout — no colors, no custom fonts, no shadows, no decorative borders. Theme styling is defined in `theme-system.md` and applied separately by the engineer. If the theme changes, the wireframes remain valid.

**Convention:**
- All wireframe files live in `design/wireframes/`
- Link to them from any `.md` file that references a layout (`[Wireframe](wireframes/foo.html)`)
- The HTML files use semantic elements (`<nav>`, `<main>`, `<aside>`, `<section>`, `<form>`, `<fieldset>`) to convey structure
- Permitted CSS: `display: flex/grid`, `border: 1px solid`, `width/height`, `padding/margin`, `font-size`, `font-weight`
- Prohibited CSS: `color`, `background-color`, `font-family` beyond `sans-serif`, `border-radius`, `box-shadow`, `opacity` (except for placeholder items)

---

## Wireframe Index

| View | File | Description |
|------|------|-------------|
| Dashboard — The Ledger of Fates | [wireframes/dashboard.html](wireframes/dashboard.html) | Sidebar shell, card grid, summary bar, footer |
| Add / Edit Card — Forge a Chain | [wireframes/add-card.html](wireframes/add-card.html) | Multi-section form: identity, fee, welcome bonus, notes |
| Valhalla — Hall of the Honored Dead | [wireframes/valhalla.html](wireframes/valhalla.html) | Tombstone cards, filter bar, empty state |
| The Howl Panel | [wireframes/howl-panel.html](wireframes/howl-panel.html) | Alert sidebar: active and empty variants |
| Marketing Site | [wireframes/marketing-site.html](wireframes/marketing-site.html) | 5-section static page: nav, hero, problems, features, steps, footer |
| Easter Egg Modal | [wireframes/easter-egg-modal.html](wireframes/easter-egg-modal.html) | Reusable discovery dialog triggered by any easter egg — see [easter-egg-modal.md](easter-egg-modal.md) |
| About Modal | [wireframes/about-modal.html](wireframes/about-modal.html) | Two-column dialog: wolf logo left, team pack + seven impossible ingredients right |
| Loki Mode (Easter Egg #3) | [wireframes/loki-mode.html](wireframes/loki-mode.html) | Side-by-side normal vs active states, scrambled card grid, random realm badges, toast, timer, footer trigger |
| LCARS Mode (Easter Egg #6) | [wireframes/lcars-mode.html](wireframes/lcars-mode.html) | LCARS overlay on dashboard header: elbow blocks + 4 data lines, z:9653, 5s auto-dismiss |

---

## Dashboard — The Ledger of Fates

[→ dashboard.html](wireframes/dashboard.html)

Key layout decisions:
- Persistent left sidebar: `272px` fixed, collapses to icon-only rail
- Logo: `ᛟ FENRIR LEDGER` + `Credit Card Tracker` subtitle
- Active nav item highlighted (gold in implementation)
- `[ADD CARD ▶]` lives in content header only — not in the summary bar
- Summary bar: `{N} cards · {N} need attention` — card count bold, attention count accent
- Card grid: 3-col desktop (>1024px) · 2-col tablet (640–1024px) · 1-col mobile
- Mobile: sidebar hidden, toggled as overlay drawer via hamburger

**The Howl panel** *(Sprint 3)*: fixed right sidebar (desktop), bottom drawer (mobile). See `howl-panel.html`.

---

## Card Panel Component

[→ dashboard.html](wireframes/dashboard.html) (cards rendered in the grid)

Each card is a `CardChain` component. Structure:
- Top: Status ring (SVG circle, `strokeDashoffset`-driven progress) + realm badge
- Issuer name (Cinzel 600) + card name (Cinzel 400, muted)
- Hairline rule
- Deadline line: rune + kenning + date (JetBrains Mono)
- Secondary deadline copy (Source Serif 4, muted)
- Hairline rule
- Stats grid: Credit limit / Annual fee / Welcome mead (label + JetBrains Mono value)
- Actions: `[View Record]` + `[···]` overflow menu
- Hover: card lifts 2px + gold glow aura

**Status Ring detail:**
- SVG circle ring, `strokeDashoffset`-driven progress bar
- Rune glyph in center, color-matched to realm
- Pulses when ≤ 30 days remaining

---

## Add / Edit Card — Forge a Chain

[→ add-card.html](wireframes/add-card.html)

Two-column form layout. Four fieldset panels:

| Panel | Column | Fields |
|-------|--------|--------|
| Chain Identity | Full width (row 1) | Issuer (select), Card name, Open date, Credit limit |
| Fee-Serpent | Left (row 2) | Annual fee (cents), Fee date, Promo period (months) |
| Welcome Mead | Right (row 2) | Bonus type (radio), Bonus amount + unit, Spend requirement (cents), Skuld's deadline, Toll paid (checkbox) |
| Skald's Notes | Full width (row 3) | Free text, 3 rows |

Form actions (bottom right): `[Hold]` · `[Bind the Chain ▶]`

Edit mode: title reads "REFORGE THIS CHAIN". Pre-populates all fields.

---

## Valhalla — Hall of the Honored Dead

[→ valhalla.html](wireframes/valhalla.html)

Narrower layout, sepia-tinted background variant (relative to main dashboard). Filter bar: issuer + sort. Tombstone cards:
- Thicker left border accent (stone-hel color)
- `ᛏ` Tiwaz rune + card title + closed date
- Meta: issuer · opened date · held duration
- Plunder table: rewards extracted / fee avoided / net gain
- Epitaph quote
- Empty state with `ᛏ` rune

Gleipnir special entry (easter egg): appears at top of list when all 6 fragments found.

---

## The Howl Panel

[→ howl-panel.html](wireframes/howl-panel.html)

Two variants — active and empty:

**Active:** `ᚲ` Kenaz rune (pulses), "THE HOWL" header, alert items (fee or promo), each with:
- Indicator dot (color-coded by urgency) + type label + days remaining
- Card name, amount, deadline date
- `[View]` · `[Break the chain]` or `[Mark claimed]` actions

**Empty:** `ᚱ` Raido rune (calm), "The wolf is silent. All chains are loose."

Z-index: 50 (see z-index table below). Mobile: bottom drawer toggle.

---

## Marketing Site — `/static/index.html`

[→ marketing-site.html](wireframes/marketing-site.html)

Single-page, no framework, inline CSS/JS. Five sections:

| # | Section | Notes |
|---|---------|-------|
| NAV | Sticky header | Logo + CTA · transparent → glassmorphism on scroll |
| HERO | 100vh | Wolf medallion (260×260) + headline + CTA + Edda quote |
| CHAINS | 3-col problems | Fee-Serpent · Promo Tide · Unclaimed Plunder |
| FEATURES | 3×2 grid | Six product pillars (Sköll & Hati, Norns, Ledger, Valhalla, Howl, Nine Realms) |
| STEPS | 3-step flow | Forge → Watch → Break Free |
| FOOTER | | Logo · quote · runic cipher · CTA · credits |

Easter egg placements visible in wireframe annotations (Gleipnir Hunt #5 on ©, Loki Mode on "Loki").

---

## Responsive Breakpoints

| Breakpoint | Layout | Card Grid | Howl Panel |
|---|---|---|---|
| Mobile `< 640px` | Single column | 1 col | Collapsible bottom drawer |
| Tablet `640–1024px` | Single column | 2 col | Collapsible side panel |
| Desktop `> 1024px` | Split layout | 2–3 col | Fixed sidebar (when urgent) |
| Wide `> 1280px` | Wide split | 3–4 col | Fixed sidebar |

**Mobile header:** logo + card count + notification bell (raven icon) + hamburger for nav.

**Mobile card:** full-width, status ring 40px (desktop: 56px), key stats stacked, actions full-width at bottom.

---

## Navigation Structure

Sidebar (always visible, collapsible):
- Logo: `ᛟ FENRIR LEDGER` + `Credit Card Tracker` subtitle
- Nav items (grow as routes ship):
  - Cards (active: `/`)
  - Valhalla (Sprint 3: `/valhalla`)
  - The Ravens (Sprint 4: `/settings`)
- `[Collapse]` button pinned to sidebar bottom — collapses to icon-only rail

Content header (per-page):
- Page title left (Cinzel, gold)
- `[ADD CARD]` primary CTA right (cards page only)

Mobile: sidebar hidden by default; hamburger toggle opens overlay drawer.

---

## Z-Index Layers

| Layer | Z-Index | Element |
|---|---|---|
| Base | 0 | Page content |
| Cards | 10 | Hover-lifted cards |
| Howl panel | 50 | Sidebar |
| Header | 100 | Sticky nav |
| Modal overlay | 200 | Dialog backdrop |
| Modal | 210 | Dialog |
| Toast | 300 | Notifications |
| Easter egg | 9653 | Wolf rise, LCARS mode — 9653 = W-O-L-F on a phone keypad |

---

## Easter Egg Modal

[→ wireframes/easter-egg-modal.html](wireframes/easter-egg-modal.html) · [Full design doc → easter-egg-modal.md](easter-egg-modal.md)

Reusable modal dialog shown whenever the user discovers a hidden easter egg. The wireframe establishes the two-column layout and content contract; all visual styling (gold glow, Cinzel Decorative headline, animated entry) is defined in `easter-egg-modal.md` and `theme-system.md`.

**Structure:**

```
┌─ [eyebrow: EASTER EGG DISCOVERED] ────────────────────────── (×) ┐
│  [EASTER EGG TITLE]  ← H1                                        │
├───────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  [ Image area ]      │  Discovery text                     │   │
│ │                      │  ────────────                       │   │
│ │  Artifact image      │  Italic lore caption                │   │
│ └────────────────────────────────────────────────────────────┘   │
├───────────────────────────────────────────────────────────────────┤
│                          [ OK ]                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Key layout decisions:**
- Two-column body surrounded by a single outer border with a gradient vertical divider — no separate borders per column
- Left column: artifact image, centered, aspect-ratio `4/3`, max `200px`
- Right column: discovery text + italic lore caption below a hairline rule
- `[OK]` button centered in footer, sole dismiss action
- `(×)` close button top-right of modal shell, secondary dismiss

**Placeholders (replace per egg):**

| Placeholder | Replace with |
|---|---|
| `[EASTER EGG TITLE]` | Name of the discovered egg (e.g., *"The Gleipnir Fragment"*) |
| Image area | `<img>` or `<svg>` of the artifact |
| Discovery text lines | Lore copy, reward details, fragment count |
| Italic caption | Norse kenning, Edda quote, or progress hint |

**Animation** (implementation detail, not in wireframe):
- Backdrop: `backdrop-in` 280ms ease
- Modal shell: `modal-rise` translateY + scale, 320ms `cubic-bezier(0.16, 1, 0.3, 1)` — same easing as `saga-enter` in `interactions.md`

**Accessibility:**
- `role="dialog"` + `aria-modal="true"` on backdrop
- `aria-labelledby` bound to the H1 title
- `×` close button carries `aria-label="Dismiss"`

For the React component, `useEasterEgg` hook, and full token reference see [easter-egg-modal.md](easter-egg-modal.md).

---

## About Modal

[→ wireframes/about-modal.html](wireframes/about-modal.html)

Triggered from a persistent "About" link in the sidebar footer or app header. Provides app identity, team credits, and mythological provenance — all delivered in the wolf's voice.

**Structure:**

```
┌─ About Fenrir Ledger ──────────────────────────────────────── (×) ┐
├──────────────────────────────────────────────────────────────────-─┤
│  Wolf logo     │  The Pack                                         │
│  (icon.png)    │  Freya — She decides what the wolf hunts next.    │
│                │  Luna — She shapes the shadows where the wolf...  │
│  ᛟ FENRIR      │  FiremanDecko — He forged the chain. Then...      │
│    LEDGER      │  Loki — He tests every lock. He is, after...      │
│                │  ─────────────────────────────────────────        │
│  tagline       │  Bound by Seven Impossible Things                 │
│                │  • The sound of a cat's footstep                  │
│                │  • The beard of a woman                           │
│                │  • The roots of a mountain                        │
│                │  • The sinews of a bear                           │
│                │  • The breath of a fish                           │
│                │  • The spittle of a bird                          │
│                │  • The first debt willingly forgiven              │
├──────────────────────────────────────────────────────────────────-─┤
│                                                        [ Close ]   │
└───────────────────────────────────────────────────────────────────┘
```

**Key layout decisions:**
- Left column: `200px` fixed. Wolf logo (`icon.png` from `/static/`) centered at `120×120`, wordmark `ᛟ FENRIR LEDGER`, tagline below
- Right column: flexible. Scrollable (`overflow-y: auto`, `max-height: 420px`) to accommodate future content growth
- Vertical divider: `1px` column between left and right, same pattern as Easter Egg Modal
- Separator bar: `border-top: 1px solid` between team snippets and ingredients list
- `[ Close ]` button bottom-right in footer — sole dismiss action alongside `(×)` top-right

**Team copy voice:** Written as declarations from the wolf, not bios. Short, present tense, active.

**Seven Impossible Things:** References the Norse myth of Gleipnir — the unbreakable chain forged to bind Fenrir, made from things that do not exist. The sixth traditional ingredient (`the spittle of a bird`) also appears as Gleipnir Hunt fragment #6 in Valhalla's empty state (see `easter-eggs.md`). The seventh — *the first debt willingly forgiven* — is an app-original ingredient tying the mythology to the product's purpose.

| # | Ingredient | Origin |
|---|---|---|
| 1 | The sound of a cat's footstep | Norse myth (Gleipnir) |
| 2 | The beard of a woman | Norse myth (Gleipnir) |
| 3 | The roots of a mountain | Norse myth (Gleipnir) |
| 4 | The sinews of a bear | Norse myth (Gleipnir) |
| 5 | The breath of a fish | Norse myth (Gleipnir) |
| 6 | The spittle of a bird | Norse myth (Gleipnir) · also Gleipnir Hunt fragment #6 |
| 7 | The first debt willingly forgiven | App-original |

**Z-index:** 200 (standard modal layer — see z-index table above).

**Accessibility:**
- `role="dialog"` + `aria-modal="true"` on backdrop
- `aria-labelledby` bound to the `<h1>` title
- `(×)` close button carries `aria-label="Close"`

**Mobile behavior:** Full-screen sheet (100vw × 100vh). Left column collapses — wolf logo moves to inline header alongside the title; right column fills full width.
