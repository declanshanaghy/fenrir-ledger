# Wireframes: Fenrir Ledger

Layout specs, component hierarchy, and responsive breakpoints. All wireframes are text-based for git-friendliness. Reference `theme-system.md` for all colors and type.

---

## Dashboard — "The Ledger of Fates"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER (sticky, blurs on scroll)                                            │
│                                                                             │
│  ᛟ  FENRIR LEDGER          [The Howl 🔴 3]  [Forge a Chain ▶]             │
│      Ledger of Fates                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────┐  ┌────────────────────────────┐
│  SUMMARY BAR                               │  │  THE HOWL                  │
│                                            │  │  ══════════════════════    │
│  ᚠ 14 chains  ·  $4,200 plunder  ·        │  │  ᚲ  Sköll is 12 days       │
│  3 chains in Muspelheim                    │  │     behind the sun         │
└────────────────────────────────────────────┘  │                            │
                                                │  Chase Sapphire Preferred  │
┌─────────────────────────────────────────────┐ │  Fee due Feb 14            │
│  CARD GRID (2-col desktop, 1-col mobile)    │ │  ──────────────────────    │
│                                             │ │  ᚺ  Hati is 23 days        │
│  ┌─────────────────┐  ┌─────────────────┐  │ │     behind the moon        │
│  │ [●] RING        │  │ [●] RING        │  │ │                            │
│  │                 │  │                 │  │ │  Amex Gold                 │
│  │  Chase          │  │  Amex           │  │ │  Promo expires Mar 3       │
│  │  Sapphire Pref  │  │  Gold           │  │ │  ──────────────────────    │
│  │                 │  │                 │  │ │  ᚺ  Hati is 31 days        │
│  │  ᚲ MUSPELHEIM   │  │  ᚺ Hati runs   │  │ │     behind the moon        │
│  │  Fee: Feb 14    │  │  Promo: Mar 3   │  │ │                            │
│  │                 │  │                 │  │ │  Citi Double Cash          │
│  │  $550 limit     │  │  75k pts        │  │ │  Promo expires Mar 14      │
│  │  $95 fee        │  │  $250 credit    │  │ └────────────────────────────┘
│  └─────────────────┘  └─────────────────┘  │
│                                             │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │ [●] RING        │  │ [+] ADD CHAIN   │  │
│  │                 │  │                 │  │
│  │  Citi           │  │  Forge a new    │  │
│  │  Double Cash    │  │  chain          │  │
│  │                 │  │                 │  │
│  │  ᛊ ASGARD-BOUND │  │  [+ Forge]      │  │
│  │  Earning 2%     │  │                 │  │
│  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────┘

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

```
Header (always visible):
  ← Logo: "ᛟ FENRIR LEDGER"
  → The Howl badge (urgent count)
  → [Forge a Chain] CTA
  → [⋮] Menu → Valhalla / The Ravens / About

Mobile: hamburger drawer with same items
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
