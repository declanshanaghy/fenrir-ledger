# Wireframes: Fenrir Ledger

Layout specs, component hierarchy, and responsive breakpoints. All wireframes are text-based for git-friendliness. Reference `theme-system.md` for all colors and type.

---

## Dashboard — "The Ledger of Fates"

> **Sprint 2 update**: The app now uses a persistent shell with a collapsible left sidebar for navigation. The horizontal header-only layout is superseded. The `ADD CARD` button lives in the top-right of the content header only — it was removed from the summary bar.

```
┌──────────────────┬──────────────────────────────────────────────────────────┐
│  SIDEBAR         │  CONTENT HEADER                                          │
│  (272px fixed)   │                                                          │
│                  │  CARDS                                    [ADD CARD ▶]  │
│  ᛟ FENRIR LEDGER │                                                          │
│  Credit Card     ├──────────────────────────────────────────────────────────┤
│  Tracker         │                                                          │
│                  │  SUMMARY BAR                                             │
│  ──────────────  │  14 cards  ·  3 need attention                          │
│                  │                                                          │
│  [▣] Cards  ←   │  ┌─────────────────┐  ┌─────────────────┐               │
│  (active, gold)  │  │ [●] RING        │  │ [●] RING        │  ...          │
│                  │  │                 │  │                 │               │
│                  │  │  Chase          │  │  Amex Gold      │               │
│  (future routes  │  │  Sapphire Pref  │  │                 │               │
│   added here as  │  │                 │  │  Promo Expiring │               │
│   sprints ship)  │  │  Fee Due Soon   │  │  Mar 3          │               │
│                  │  │  Feb 14         │  │                 │               │
│                  │  └─────────────────┘  └─────────────────┘               │
│  ──────────────  │                                                          │
│  [⊞] Collapse   │  (card grid: 2-col tablet, 3-col desktop, 1-col mobile)  │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

**Sidebar specs:**
- Width: `272px` expanded · collapses to icon-only rail on "Collapse"
- Logo: `ᛟ FENRIR LEDGER` (Cinzel Decorative, gold) + `Credit Card Tracker` (Source Serif italic, muted)
- Active nav item: gold background highlight, gold text
- Collapse button pinned to sidebar bottom
- Mobile: hidden by default; toggled as an overlay drawer

**Content area:**
- Page title left in Cinzel, gold (`CARDS`, `ADD CARD`, etc.)
- `ADD CARD` top-right — sole Add Card entry point (not duplicated in summary bar)
- Summary bar: `{N} cards · {N} need attention` — card count bold white, attention count amber

**The Howl panel** *(Sprint 3 — not yet built)*:
- Slides in from right when urgent cards exist
- Fixed right sidebar (desktop), bottom drawer (mobile)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FOOTER                                                                      │
│ Forged by FiremanDecko · Guarded by Freya · Tested by Loki [7x to unlock] │
│ ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ                                        © Fenrir Ledger       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Card Panel Component

Each card in the grid is a `CardChain` component:

```
┌────────────────────────────────────────────┐
│  ┌──┐                          [REALM BADGE]│  ← border: rune-border
│  │ ◉│  issuer monogram         MUSPELHEIM  │  ← ring color: blood orange
│  └──┘                                      │
│                                            │
│  CHASE SAPPHIRE PREFERRED                  │  ← font: Cinzel 600
│  Chase                                     │  ← font: Cinzel 400, muted
│                                            │
│  ──────────────────────────────────────    │  ← hairline rule, gold 15%
│                                            │
│  ᚲ Fee-serpent strikes  Feb 14, 2026       │  ← JetBrains Mono
│     Sköll is 12 days behind the sun        │  ← Source Serif 4, muted
│                                            │
│  ──────────────────────────────────────    │
│                                            │
│  Credit limit    $15,000                   │  ← label: Source Serif 4 sm
│  Annual fee      $95                       │    value: JetBrains Mono
│  Welcome mead    75,000 pts / $4k spend    │
│                                            │
│  [View Record]              [···]          │  ← secondary action menu
└────────────────────────────────────────────┘
     ↑ hover: card lifts 2px + gold glow aura
```

### Status Ring Detail

```
    ╭────╮
   /  ᚲ  \    ← rune in center, color-matched to realm
  │  chase │  ← issuer initial
   \      /
    ╰────╯

  SVG circle ring — strokeDashoffset-driven progress
  Pulses when ≤ 30 days remaining
```

---

## Add/Edit Card — "Forge a Chain"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Ledger                                                           │
│                                                                             │
│  FORGE A NEW CHAIN                         [Cinzel Decorative, 2rem]        │
│  Add this card to your portfolio                                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐  ┌──────────────────────────────────────┐
│  CHAIN IDENTITY                  │  │  FEE-SERPENT                         │
│                                  │  │                                      │
│  Issuer *                        │  │  Annual fee (cents)                  │
│  [Chase              ▾]          │  │  [9500          ]                    │
│                                  │  │                                      │
│  Card name *                     │  │  Fee-serpent strikes (date)          │
│  [Sapphire Preferred]            │  │  [2026-02-14    ]                    │
│                                  │  │                                      │
│  Chain forged (open date) *      │  │  Promo period                        │
│  [2025-02-14         ]           │  │  [12 months     ]                    │
│                                  │  │                                      │
│  Chain weight (credit limit)     │  └──────────────────────────────────────┘
│  [15000              ]           │
│                                  │  ┌──────────────────────────────────────┐
└──────────────────────────────────┘  │  WELCOME MEAD (Sign-up Bonus)        │
                                      │                                      │
                                      │  Bonus type                          │
                                      │  ○ Points  ○ Miles  ○ Cashback       │
                                      │                                      │
                                      │  Bonus amount                        │
                                      │  [75000         ]  pts               │
                                      │                                      │
                                      │  Mead-hall toll (spend req.)         │
                                      │  [400000        ]  cents ($4,000)    │
                                      │                                      │
                                      │  Skuld's deadline                    │
                                      │  [2025-05-14    ]                    │
                                      │                                      │
                                      │  ☐ Toll paid (threshold met)         │
                                      └──────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SKALD'S NOTES                                                              │
│  [Free text area — 3 rows                                                 ] │
└─────────────────────────────────────────────────────────────────────────────┘

                               [Hold]        [Bind the Chain ▶]
```

---

## Valhalla — "Hall of the Honored Dead"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VALHALLA                                  [Cinzel Decorative, 3rem]        │
│  Hall of the Honored Dead                                                   │
│                                                                             │
│  "Here lie the chain-breakers. Their rewards were harvested."               │
└─────────────────────────────────────────────────────────────────────────────┘

  [Filter by issuer ▾]  [Sort by: Closed date ▾]

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ᛏ  CHASE FREEDOM UNLIMITED                          Closed Oct 2024       │
│     Chase  ·  Opened Jan 2024  ·  Held 9 months                            │
│     ──────────────────────────────────────────────────────────────          │
│     Plunder extracted:  45,000 pts  ($450 est. value)                       │
│     Fee avoided:        $95                                                 │
│     Net gain:           $545                                                │
│                                                                             │
│     "You have slain Fáfnir."                                                │
└─────────────────────────────────────────────────────────────────────────────┘

[darker, slightly sepia-tinted, narrower layout than main dashboard]
[cards use tombstone styling — border-left accent, ᛏ rune, stone color scheme]
```

---

## The Howl Panel (Sidebar)

Appears on right side of dashboard when urgent cards exist:

```
┌──────────────────────────────┐
│  ᚲ THE HOWL                  │  ← pulsing Kenaz rune when active
│  Huginn carries warnings     │
│                              │
│  ─────────────────────────   │
│                              │
│  🔴 FEE  ·  12 days          │
│  Chase Sapphire Preferred    │
│  $95 fee  ·  Feb 14          │
│  [View]  [Break the chain]   │
│                              │
│  ─────────────────────────   │
│                              │
│  🟡 PROMO  ·  23 days        │
│  Amex Gold                   │
│  $250 credit  ·  Mar 3       │
│  [View]  [Mark claimed]      │
│                              │
└──────────────────────────────┘
```

Empty state:
```
┌──────────────────────────────┐
│  ᚱ THE HOWL                  │  ← calm rune (Raido — journey)
│                              │
│  The wolf is silent.         │
│  All chains are loose.       │
│                              │
│  Huginn and Muninn carry     │
│  no warnings today.          │
└──────────────────────────────┘
```

---

## Marketing Site — `/static/index.html`

> **Sprint 2 addition**: A static single-page marketing site lives at `/static/` and is served via GitHub Pages. Six sections, no framework, no build step. All CSS inline. Single scroll-listener `<script>`. Built by FiremanDecko from Luna's spec.

**Live at**: GitHub Pages (root of `/static/` branch or directory, TBD on Pages config)
**App link**: https://fenrir-ledger.vercel.app

**Section map:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ NAV (sticky, glassmorphism on scroll)                                       │
│ [ᛟ wolf icon]  FENRIR LEDGER                         [Enter the Ledger ▶] │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ HERO (100vh)                                                                │
│                                                                             │
│  [wolf medallion]    FENRIR LEDGER  ← Cinzel Decorative 900, carved-stone  │
│  260px × 260px       The wolf was not bound. You are.                      │
│                      Every annual fee is Gleipnir...                        │
│                                                   [Break the Chain ▶]      │
│                      "Though it looks like silk ribbon..." — Prose Edda    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ THE CHAINS THEY FORGED FOR YOU  (3-col problem cards)                      │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ ᚲ               │  │ ᚺ               │  │ ᚠ               │            │
│  │ The Fee-Serpent │  │ The Promo Tide  │  │ The Unclaimed   │            │
│  │ (fire-muspel)   │  │ (amber-hati)    │  │ Plunder (stone) │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│  "Fáfnir set these traps. Fenrir was bred to spring them."                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ WHAT THE WOLF WATCHES  (6-feature grid, 3×2)                               │
│                                                                             │
│  ᚲ Sköll & Hati     ᚺ The Norns' Weave   ᛟ The Ledger of Fates           │
│  ᛏ Valhalla         ᛉ The Howl            ᛗ The Nine Realms               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ THREE RUNES TO FREEDOM  (steps, forge-bg surface)                          │
│                                                                             │
│  [ᛏ]──────────[ᚺ]──────────[ᛊ]                                            │
│   01            02            03                                            │
│ Forge Your   Watch the     Break Free                                      │
│  Chains      Norns Weave                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FOOTER                                                                      │
│ ᛟ FENRIR LEDGER                                                             │
│ "Though it looks like silk ribbon..." — Prose Edda                         │
│ ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ                    [Enter the Ledger ▶]                     │
│ © 2026 Fenrir Ledger · Forged by FiremanDecko · Guarded by Freya ·        │
│ Tested by Loki  ← hover "Loki" for easter egg tooltip                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Assets in `/static/`:**
| File | Purpose |
|------|---------|
| `index.html` | Full site — HTML + CSS + inline JS |
| `icon.png` | Wolf medallion (hero + nav logo) |
| `favicon.ico` | Multi-size ICO: 16/32/48/64px |
| `icon-192.png` | PWA manifest icon |
| `icon-512.png` | PWA manifest icon |
| `.nojekyll` | Disables Jekyll on GitHub Pages |

---

## Responsive Breakpoints

| Breakpoint | Layout | Card Grid | Howl Panel |
|-----------|--------|-----------|------------|
| Mobile `< 640px` | Single column | 1 col | Collapsible bottom drawer |
| Tablet `640–1024px` | Single column | 2 col | Collapsible side panel |
| Desktop `> 1024px` | Split layout | 2–3 col | Fixed sidebar (when urgent) |
| Wide `> 1280px` | Wide split | 3–4 col | Fixed sidebar |

### Mobile Header

Compact on mobile: logo + card count + notification bell (raven icon) + hamburger for nav.

### Mobile Card

Full-width, same structure as desktop card but:
- Status ring: 40px diameter (desktop: 56px)
- Key stats stacked vertically
- Actions: bottom-aligned full-width buttons

---

## Navigation Structure

> **Sprint 2 update**: Navigation moved from a top header to a persistent left sidebar.

```
Sidebar (always visible, collapsible):
  ↑ Logo: "ᛟ FENRIR LEDGER" + "Credit Card Tracker" subtitle
  ↑ Nav items (grow as routes ship):
    · Cards (active: /  )
    · Valhalla (Sprint 3: /valhalla)
    · The Ravens (Sprint 4: /settings)
  ↓ [Collapse] button (icon-only rail when collapsed)

Content header (per-page):
  ← Page title (Cinzel, gold)
  → [ADD CARD] primary CTA (cards page only)

Mobile: sidebar hidden by default; hamburger toggle opens overlay drawer
```

---

## Z-Index Layers

| Layer | Z-Index | Element |
|-------|---------|---------|
| Base | 0 | Page content |
| Cards | 10 | Hover-lifted cards |
| Howl panel | 50 | Sidebar |
| Header | 100 | Sticky nav |
| Modal overlay | 200 | Dialog backdrop |
| Modal | 210 | Dialog |
| Toast | 300 | Notifications |
| Easter egg | 9999 | Wolf rise, LCARS mode |
