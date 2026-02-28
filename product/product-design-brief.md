# Product Design Brief: Fenrir Ledger

> *"In Norse mythology, Fenrir is the great wolf who shatters the chains the gods forged to bind him.
> Fenrir Ledger breaks the invisible chains of forgotten annual fees, expired promotions,
> and wasted sign-up bonuses that silently devour your wallet."*

---

## Design Philosophy

Fenrir Ledger is not a fintech app. It is a **saga ledger** — a war room for financial wolves who hunt rewards and break free from fee traps. Every design decision must carry the weight of that metaphor. The mythology is not decoration; it is the product's identity.

### The Three Design Pillars

**1. Mythic Gravitas**
Every element — color, label, animation, empty state — is grounded in the Norse saga. This is not a generic dashboard with a wolf emoji slapped on the header. It is a world. Users who discover the mythology layer should feel they've found something.

**2. Tactical Precision**
The target user is a numbers-obsessed optimizer managing 5–20+ credit cards. Data must be scannable, dense-but-organized, and tactically clear. The mythology provides atmosphere; the function provides a war room. These must coexist without friction.

**3. Hidden Depth**
The app rewards exploration. Easter eggs reference the Gleipnir myth, the Norns, Hati and Sköll. The console logs a wolf. A hidden keycode triggers a howl. Nerd culture references are woven in for FiremanDecko and other builders who look close. See [`easter-eggs.md`](easter-eggs.md).

---

## The Unforgettable Moment

When a user lands on the dashboard for the first time with zero cards, they do not see a generic empty state. They see:

> *"Before Gleipnir was forged, Fenrir roamed free.
> Before your first card is added, no chain can be broken.*
>
> *Add your first card, wolf."*

This is the moment that separates Fenrir Ledger from every other fintech tool.

---

## Aesthetic Direction: "The Saga Ledger"

**Dark Nordic War Room** — not fintech blue, not minimal white space, not purple gradients. Something that feels like a Viking navigator's celestial chart fused with a hedge fund quant's terminal.

- **Ancient precision** — runes and knotwork alongside monospace numbers
- **Cold intelligence** — deep void-black backgrounds, barely warm gold accents
- **Wolf energy** — sharp edges, asymmetric layouts, hierarchy that dominates

### Do Not Do

- No Inter, Roboto, or system fonts
- No white backgrounds with light gray cards
- No purple/blue gradient hero sections
- No rounded-pill status badges in pastel
- No generic "loading..." spinners
- No emoji as primary design elements (the 🐺 in the current header must go)
- No emoji in functional copy (buttons, labels, badges, errors) — ever
- No kennings or realm names in buttons, form labels, or error messages
- No Norse vocabulary where plain English is faster to parse

---

## Information Architecture

```
/ (Dashboard — "The Ledger of Fates")
├── The Pack (card portfolio grid)
├── The Howl (urgent sidebar — active deadlines only)
└── Summary stats (total plunder, net value, active chains)

/cards/new (Add Card — "Forge a New Chain")
/cards/[id] (Card Detail — "The Chain's Record")
/valhalla (Closed Cards Archive — "Hall of the Honored Dead")
/settings (Reminders — "Send the Ravens")
```

---

## Signed-In User Identity — Header Profile

The site header must surface the authenticated user's identity at all times. The current
header shows only a `?` button and a "Log out" button — no user identity is displayed.
Once OIDC authentication ships, that gap is a trust and orientation failure: the wolf
must know who roams the hall.

### What the Header Must Show

| Element | Source | Fallback |
|---------|--------|----------|
| Avatar | `picture` claim from OIDC id_token | Norse rune ᛟ (Othalan — heritage, ownership) in SVG circle |
| Name | `name` claim from OIDC id_token | Email prefix (everything before `@`) |
| Email | `email` claim — shown in dropdown only | — |

### Interaction Pattern

- Avatar and name are always visible in the header (no overflow to a collapsed menu on
  desktop; on mobile ≥ 375 px the name may truncate with ellipsis but the avatar is
  always shown).
- Clicking the avatar or name opens a compact profile dropdown containing:
  - Full name (non-editable in Iteration 1)
  - Email address
  - "Sign out" action (replaces the standalone "Log out" button — do not show both)
- The dropdown is dismissed by clicking outside it or pressing Escape.
- The `?` help button may remain alongside the profile — it is not replaced by this
  feature.

### Avatar Rendering Rules

1. **Google profile picture available**: render an `<img>` with the `picture` URL from
   the OIDC id_token. Apply `rounded-full` (circular crop). Size: 32 × 32 px on desktop,
   28 × 28 px on mobile. Border: `1px solid rgba(201,146,10,0.4)` (faint gold ring —
   Gleipnir echo: the chain that marks you).
2. **No picture claim / image load error**: render the rune ᛟ in an SVG placeholder
   circle of identical size. Background fill: `#07070d` (void-black). Rune color:
   `#c9920a` (gold), `font-family: Cinzel`. This is the "identity without a face" state.

### Responsive Requirements

- **Desktop (≥ 768 px)**: avatar + truncated name (max ~20 characters) visible in the
  header bar.
- **Mobile (375–767 px)**: avatar only in the header bar; name hidden from the bar but
  shown inside the profile dropdown.
- Touch target for the avatar/name trigger: minimum 44 × 44 px (per team norms).

### Atmospheric Copy

- Dropdown header line: *"The wolf is named."*
- Sign-out button label (plain English — functional copy, no kennings): "Sign out"

### Mythology Frame

The header profile is not a "user account widget." It is proof that Fenrir knows its
hunter. Odin bound Fenrir because he feared what it was — the header names the wolf so
the chain-breaker cannot be anonymous. The gold avatar ring deliberately echoes
Gleipnir: the binding that marks you.

### Acceptance Criteria

- [ ] Authenticated user's Google avatar (`picture` claim) renders as a circular image
      in the header at all breakpoints ≥ 375 px
- [ ] When `picture` claim is absent or the image fails to load, the rune ᛟ fallback
      renders in an identical-size circle with gold `#c9920a` on void-black `#07070d`
- [ ] User's `name` claim is visible alongside the avatar on desktop (≥ 768 px);
      truncated with ellipsis beyond ~20 characters
- [ ] Clicking the avatar or name opens a dropdown showing: full name, email, and
      "Sign out"
- [ ] Clicking outside the dropdown or pressing Escape closes it without signing out
- [ ] "Sign out" in the dropdown triggers the existing sign-out flow; no standalone
      "Log out" button remains in the header
- [ ] Touch target for the avatar/name trigger is ≥ 44 × 44 px on all breakpoints
- [ ] Layout holds at 375 px mobile width with no horizontal overflow
- [ ] No avatar, name, or email is visible when the user is unauthenticated

---

## Target Audience & Tone

**Who**: Power users — spreadsheet warriors who track 5–20+ cards, know their issuer rules cold, and check their portfolio regularly (including mobile, on the go).

**Tone**: Two registers, one product.

- **Functional copy** (buttons, labels, badges, errors, tooltips, aria-labels): 100% plain English. Zero kennings, zero realm names. The user is a power optimizer — every millisecond of confusion is a failure.
- **Atmospheric copy** (page headings, subheadings, empty states, loading states, docs, marketing): Norse saga voice. Kennings, Edda quotes, realm metaphors. This is the soul of the brand.

The mythology rewards exploration. It never blocks a task.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Color mode | Dark-only (no light mode toggle) | Saga aesthetics require darkness; adds mystique and avoids complexity |
| Status vocabulary | Norse realms (not "active/warning") | See `mythology-map.md` — Muspelheim, Valhalla, etc. |
| Typography | Cinzel Decorative + Source Serif 4 + JetBrains Mono | Ancient gravitas + scholarly body + data precision |
| Animations | CSS-first, subtle but orchestrated | One well-timed page load reveal > scattered micro-interactions |
| Empty states | Edda quotes + myth context | The emotional hook that makes the brand memorable |
| Easter eggs | Discoverable, not obtrusive | Reward exploration; never break task flow |
| Wikipedia enrichment | `.myth-link` class on Norse proper nouns | Faint gold dotted underline + `cursor: help` links curious users to myth context; see `mythology-map.md` |
| Signed-in identity display | Avatar + name in header; rune ᛟ fallback | Trust signal: the wolf knows who roams the hall; eliminates anonymous session ambiguity |

---

## Related Design Files

| File | Contents |
|------|----------|
| [`theme-system.md`](../ux/theme-system.md) | Color palette, typography, CSS tokens, Tailwind config |
| [`mythology-map.md`](mythology-map.md) | Norse myth → UI feature mapping (realms, characters, kennings) |
| [`copywriting.md`](copywriting.md) | All UI copy, empty states, kennings, Edda quotes |
| [`easter-eggs.md`](../ux/easter-eggs.md) | Hidden references: Gleipnir hunt, Konami howl, console art, Loki mode |
| [`interactions.md`](../ux/interactions.md) | Animations, micro-interactions, state transitions |
| [`wireframes.md`](../ux/wireframes.md) | Layout specs, component hierarchy, responsive notes |
| [`implementation-brief.md`](../architecture/implementation-brief.md) | FiremanDecko integration plan: sprint breakdown, retrofit strategy |
