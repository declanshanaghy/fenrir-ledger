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
The app rewards exploration. Easter eggs reference the Gleipnir myth, the Norns, Hati and Sköll. The console logs a wolf. A hidden keycode triggers a howl. Nerd culture references are woven in for FiremanDecko and other builders who look close. See [`easter-eggs.md`](../ux/easter-eggs.md).

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

## User Identity — Header Profile

Fenrir Ledger has two user states: **anonymous** and **signed-in**. Both states are
fully supported. The header must surface the correct identity affordance for each.

### Anonymous State (default for all users)

An anonymous user has no account. Their `householdId` is a locally-generated UUID
stored in localStorage under `fenrir:household`. The app works identically for anonymous
and signed-in users — the only difference is data persistence scope.

In the anonymous state the header shows:

- The rune ᛟ (Othalan — heritage, ownership) in an SVG placeholder circle
- No name, no email, no "Sign out" button
- An optional, non-blocking "Sync to cloud" affordance (see Cloud Sync Upsell below)

The rune avatar is not a broken state. It is the wolf unnamed — present, powerful,
unchained.

**Atmospheric copy for anonymous state:**
- Avatar tooltip: *"The wolf runs unnamed."*
- No dropdown in anonymous state; the avatar is non-interactive until sign-in ships.

### Signed-In State

A signed-in user authenticates via Google OIDC. Cloud sync via Firestore is live.
The gap between anonymous and signed-in must feel like an upgrade, not a correction.

| Element | Source | Fallback |
|---------|--------|----------|
| Avatar | `picture` claim from OIDC id_token | Norse rune ᛟ (Othalan) in SVG circle |
| Name | `name` claim from OIDC id_token | Email prefix (everything before `@`) |
| Email | `email` claim — shown in dropdown only | — |

Interaction pattern for signed-in state:

- Avatar and name are always visible in the header (on mobile ≥ 375 px the name may
  truncate with ellipsis but the avatar is always shown).
- Clicking the avatar or name opens a compact profile dropdown containing:
  - Full name (non-editable in Iteration 1)
  - Email address
  - "Sign out" action
- The dropdown is dismissed by clicking outside it or pressing Escape.

Avatar rendering rules for signed-in state:

1. **Google profile picture available**: `<img>` with `picture` URL. `rounded-full`.
   Size: 32 × 32 px desktop, 28 × 28 px mobile.
   Border: `1px solid rgba(201,146,10,0.4)` (faint gold ring — Gleipnir echo).
2. **No picture claim / image load error**: rune ᛟ SVG circle, same size.
   Background: `#07070d` (void-black). Rune: `#c9920a` (gold), Cinzel font.

**Atmospheric copy for signed-in state:**
- Dropdown header line: *"The wolf is named."*
- Sign-out label (functional, no kennings): "Sign out"

### Cloud Sync Upsell

Login is surfaced as a non-blocking upsell only — it must never gate any feature. The
upsell copy pattern (for future implementation):

- Banner or settings option: *"Keep your ledger safe across all your devices."*
- CTA: "Sign in to sync" (functional Voice 1 label)
- Dismissible; once dismissed, not shown again until user navigates to settings.

### Responsive Requirements

- **Desktop (≥ 768 px)**: avatar + truncated name (max ~20 characters) for signed-in;
  rune avatar alone for anonymous.
- **Mobile (375–767 px)**: avatar only in header bar; name shown inside dropdown
  (signed-in state).
- Touch target for the avatar/name trigger: minimum 44 × 44 px (per team norms).

### Mythology Frame

In the anonymous state, the wolf runs unnamed — free, unchained, untracked. The rune ᛟ
is not a placeholder awaiting a real identity; it is identity in its purest form.
The gold avatar ring (signed-in state) echoes Gleipnir: the binding that marks you.
Signing in is not required to belong to the hall.

### Acceptance Criteria

- [ ] Anonymous user sees the rune ᛟ avatar in the header at all breakpoints ≥ 375 px
- [ ] Rune ᛟ avatar renders with gold `#c9920a` on void-black `#07070d`, circular crop
- [ ] No name, email, or "Sign out" is visible in the anonymous state
- [ ] No sign-in gate, redirect, or modal blocks an anonymous user from using any feature
- [ ] The locally-generated `householdId` UUID is stored under `fenrir:household` in
      localStorage on first anonymous visit
- [ ] All card data is scoped to the anonymous `householdId` exactly as it would be for
      a signed-in user
- [ ] Layout holds at 375 px mobile width with no horizontal overflow in both states
- [ ] Touch target for the avatar is ≥ 44 × 44 px on all breakpoints

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
| Authentication model | Anonymous-first; login is optional cloud-sync upsell | Zero friction on first use; no login gate; householdId is a locally-generated UUID; Google OIDC + Firestore sync is live |
| Anonymous identity display | Rune ᛟ avatar in header; non-interactive | The wolf runs unnamed — present and powerful, not broken or incomplete |
| Signed-in identity display | Avatar + name in header; rune ᛟ fallback | Trust signal: the wolf knows who roams the hall; upgrade state, not required state |

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
