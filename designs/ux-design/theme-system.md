# Theme System: Fenrir Ledger

The visual language of the Saga Ledger. All tokens should be implemented as CSS custom properties, then mapped into `tailwind.config.ts` as semantic aliases.

---

## Color Palette

### Base Surfaces

| Name | Hex | HSL | Use |
|------|-----|-----|-----|
| `void` | `#07070d` | `240 40% 4%` | Page background — near-black with cold blue undertone |
| `forge` | `#0f1018` | `236 26% 8%` | Elevated surface (cards, panels) |
| `chain` | `#13151f` | `234 22% 10%` | Card content area |
| `rune-border` | `#1e2235` | `232 28% 16%` | Structural borders, hairline rules |
| `iron-border` | `#2a2d45` | `232 24% 22%` | Emphasized borders, active outlines |

### Gold Accents (Asgard — wealth, power, active)

| Name | Hex | Use |
|------|-----|-----|
| `gold-dim` | `#8a6a00` | Muted backgrounds, disabled states |
| `gold` | `#c9920a` | Primary brand accent — firelight, not gaudy |
| `gold-bright` | `#f0b429` | Hover states, active indicators, callouts |
| `gold-glow` | `rgba(201, 146, 10, 0.15)` | Subtle background glow on card hover |

### Status Colors (Norse Realms — see `../product/mythology-map.md`)

| Name | Hex | Realm | CardStatus mapping |
|------|-----|-------|--------------------|
| `teal-asgard` | `#0a8c6e` | Asgard | `active` — earning, no urgency |
| `amber-hati` | `#f59e0b` | Hati approaching | `promo_expiring` — warning |
| `fire-muspel` | `#c94a0a` | Muspelheim | `fee_approaching` — danger |
| `red-ragnarok` | `#ef4444` | Ragnarök | Overdue / missed deadline |
| `stone-hel` | `#8a8578` | Helheim / Valhalla | `closed` — honored dead |

### Text

| Name | Hex | Use |
|------|-----|-----|
| `text-saga` | `#e8e4d4` | Primary text — warm off-white, aged parchment |
| `text-rune` | `#8a8578` | Secondary, captions, Norse stone inscription |
| `text-void` | `#3d3d52` | Tertiary, background labels, placeholder |

---

## Typography

### Font Stack

| Role | Font | Weight | Where |
|------|------|--------|-------|
| **Display** | Cinzel Decorative | 700–900 | H1, page titles, Valhalla headers |
| **Headings** | Cinzel | 400–700 | H2–H4, card names, section labels |
| **Body / prose** | Source Serif 4 | 300–600 | Copy, descriptions, Edda quotes |
| **Data / numbers** | JetBrains Mono | 400–600 | Dollar amounts, dates, card numbers, status badges |
| **Rune accent** | Noto Sans Runic | 400 | Decorative Elder Futhark characters only |

### Loading via next/font (Google Fonts)

```typescript
// development/frontend/src/app/layout.tsx
import { Cinzel, Cinzel_Decorative, Source_Serif_4, JetBrains_Mono } from 'next/font/google'

const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', weight: ['400','600','700','900'] })
const cinzelDecorative = Cinzel_Decorative({ subsets: ['latin'], variable: '--font-cinzel-decorative', weight: ['400','700','900'] })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif', weight: ['300','400','600'] })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400','500','600'] })
```

### Type Scale

| Token | Size | Font | Use |
|-------|------|------|-----|
| `display` | 3rem / 48px | Cinzel Decorative 700 | Page hero, Valhalla title |
| `h1` | 2rem / 32px | Cinzel Decorative 400 | Dashboard section title |
| `h2` | 1.5rem / 24px | Cinzel 700 | Card issuer name |
| `h3` | 1.125rem / 18px | Cinzel 600 | Card card name |
| `body` | 1rem / 16px | Source Serif 4 400 | Descriptions, notes |
| `caption` | 0.875rem / 14px | Source Serif 4 300 | Dates, labels |
| `data` | 0.875rem / 14px | JetBrains Mono 500 | Amounts, deadlines |
| `data-lg` | 1.25rem / 20px | JetBrains Mono 600 | Key stats (credit limit, bonus) |
| `micro` | 0.75rem / 12px | JetBrains Mono 400 | Status badges, metadata |

---

## CSS Custom Properties

Add to `globals.css` (replaces current shadcn defaults):

```css
:root {
  /* Surfaces */
  --background:       240 40% 4%;    /* #07070d — void */
  --surface:          236 26% 8%;    /* #0f1018 — forge */
  --surface-raised:   234 22% 10%;   /* #13151f — chain */
  --border:           232 28% 16%;   /* #1e2235 — rune-border */
  --border-strong:    232 24% 22%;   /* #2a2d45 — iron-border */

  /* Gold */
  --gold:             38 93% 41%;    /* #c9920a */
  --gold-bright:      40 85% 57%;    /* #f0b429 */
  --gold-dim:         38 100% 27%;   /* #8a6a00 */

  /* Status */
  --status-active:    163 83% 29%;   /* #0a8c6e — teal-asgard */
  --status-promo:     38 90% 51%;    /* #f59e0b — amber-hati */
  --status-fee:       22 88% 41%;    /* #c94a0a — fire-muspel */
  --status-danger:    0  79% 59%;    /* #ef4444 — red-ragnarok */
  --status-closed:    35 7%  51%;    /* #8a8578 — stone-hel */

  /* Text */
  --foreground:       40 22% 87%;    /* #e8e4d4 — text-saga */
  --muted-foreground: 35 7%  51%;    /* #8a8578 — text-rune */
  --subtle-foreground: 240 15% 28%;  /* #3d3d52 — text-void */

  /* shadcn compatibility shims */
  --card:             var(--surface);
  --card-foreground:  var(--foreground);
  --primary:          var(--gold);
  --primary-foreground: 240 40% 4%;
  --destructive:      var(--status-fee);
  --destructive-foreground: var(--foreground);
  --input:            var(--border-strong);
  --ring:             var(--gold);
  --radius:           0.25rem;       /* Tighter radius — sharp, angular */

  /* Typography */
  --font-display:     var(--font-cinzel-decorative), serif;
  --font-heading:     var(--font-cinzel), serif;
  --font-body:        var(--font-source-serif), serif;
  --font-mono:        var(--font-jetbrains-mono), monospace;
}
```

---

## Tailwind Config Extensions

```typescript
// tailwind.config.ts additions
theme: {
  extend: {
    colors: {
      void:     '#07070d',
      forge:    '#0f1018',
      chain:    '#13151f',

      gold: {
        dim:    '#8a6a00',
        DEFAULT: '#c9920a',
        bright: '#f0b429',
      },

      realm: {
        asgard:  '#0a8c6e',  // active
        hati:    '#f59e0b',  // promo expiring
        muspel:  '#c94a0a',  // fee approaching
        ragnarok: '#ef4444', // overdue
        hel:     '#8a8578',  // closed
      },

      saga: '#e8e4d4',       // primary text
      rune: '#8a8578',       // secondary text
    },

    fontFamily: {
      display: ['var(--font-cinzel-decorative)', 'serif'],
      heading:  ['var(--font-cinzel)', 'serif'],
      body:     ['var(--font-source-serif)', 'serif'],
      mono:     ['var(--font-jetbrains-mono)', 'monospace'],
    },

    boxShadow: {
      'gold-sm':   '0 0 8px rgba(201, 146, 10, 0.20)',
      'gold-md':   '0 0 20px rgba(201, 146, 10, 0.25)',
      'gold-lg':   '0 0 40px rgba(201, 146, 10, 0.30)',
      'muspel':    '0 0 20px rgba(201, 74, 10, 0.35)',
      'inset-rune': 'inset 0 1px 0 rgba(255,255,255,0.03)',
    },
  }
}
```

---

## Background Texture

The page background uses a layered CSS noise effect to evoke ancient stone and parchment. Do not use `background-color` alone.

```css
body {
  background-color: #07070d;
  background-image:
    radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201, 146, 10, 0.06) 0%, transparent 60%),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  background-attachment: fixed;
}
```

---

## Rune Decorative Characters

These Elder Futhark runes are used as CSS `content` decorations and subtle motifs. They are never used for navigation or interactive elements.

| Rune | Character | Meaning | Use |
|------|-----------|---------|-----|
| Fehu | ᚠ | Wealth, cattle | Beside credit limits, bonus amounts |
| Othala | ᛟ | Inheritance, home | Household section, portfolio total |
| Mannaz | ᛗ | Self, humanity | User/account area |
| Tiwaz | ᛏ | Justice, victory | Successfully closed card |
| Isa | ᛁ | Ice, stasis | Frozen/no-action state |
| Kenaz | ᚲ | Fire, torch | Insights, active alerts |
| Sowilo | ᛊ | Sun, success | Bonus earned, threshold met |
| Algiz | ᛉ | Protection | Reminder set, guarded from fee |
| Hagalaz | ᚺ | Hail, disruption | Missed deadline, warning |
| Dagaz | ᛞ | Dawn, breakthrough | Promo credit used, chain broken |

Rune glyphs appear in:
- Card status ring inner label (tiny, monochrome)
- Section separator decorations
- The Howl panel header
- Valhalla Archive card tombstones

---

## Easter Egg Modal

When a hidden easter egg is triggered, it is revealed through a themed modal dialog that applies all Saga Ledger tokens — gold glow border, Cinzel Decorative headline, two-column artifact layout, and animated entry.

See [`easter-egg-modal.md`](./easter-egg-modal.md) for the full template spec, React integration guide, and accessibility notes.
