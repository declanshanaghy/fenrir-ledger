# Mythology Map: Norse Myth → UI Features

Every major feature and state in Fenrir Ledger is grounded in Norse cosmology. This document is the canonical reference for which myth maps to which UI element.

---

## The Nine Realms → Card States

The nine realms of Norse cosmology map to the lifecycle states of a credit card. This extends the existing `CardStatus` type with mythic vocabulary for display purposes.

| Realm | Norse Meaning | Card State | Trigger Condition | Display |
|-------|--------------|------------|-------------------|---------|
| **Asgard** | Home of gods, abundance | `active` — earning | No urgent deadlines, bonus window open | Teal `#0a8c6e`, rune ᛊ (Sowilo) |
| **Vanaheim** | Fertility, wealth magic | `active` — threshold window | Sign-up spend window open, on track | Gold `#f0b429`, rune ᚠ (Fehu) |
| **Midgard** | Human world, ordinary | `active` — standard | No bonus, no promo, fee-free period | Stone `#8a8578`, rune ᛗ (Mannaz) |
| **Alfheim** | Light elves, grace | Downgraded — fee-free | Card downgraded to no-annual-fee version | Frost blue, rune ᛞ (Dagaz) |
| **Jötunheimr** | Giants, chaos, unpredictability | `promo_expiring` — far | Promo expiring in 61–90 days | Amber `#f59e0b`, rune ᚺ (Hagalaz) |
| **Niflheim** | Ice and mist, slow death | `promo_expiring` — soon | Promo expiring in 31–60 days | Deep amber, pulsing |
| **Muspelheim** | Fire, destruction, heat | `fee_approaching` | Annual fee due in ≤ 30 days | Blood orange `#c94a0a`, rune ᚲ (Kenaz) |
| **Svartalfheim** | Dark dwarves, incomplete craft | Setup incomplete | Card added without required dates | Muted gold, dashed border |
| **Helheim** / **Valhalla** | Realm of the dead / Hall of heroes | `closed` | Card closed or cancelled | Stone `#8a8578`, rune ᛏ (Tiwaz) |

> **Implementation note**: The existing `CardStatus` type (`"active" | "fee_approaching" | "promo_expiring" | "closed"`) maps directly. The realm vocabulary is UI-layer only — types are unchanged.

---

## The Norns → Reminder Engine

The three Norns sit at the base of Yggdrasil and weave the fate of all beings. They represent the three temporal views of the reminder/timeline system.

| Norn | Name Meaning | UI Role |
|------|-------------|---------|
| **Urd** | "What Was" | Card history: past fees paid, old rewards earned, closed card archive |
| **Verdandi** | "What Is" | Current portfolio: active cards, open bonuses, current spend progress |
| **Skuld** | "What Shall Be" | Upcoming deadlines: The Howl panel, timeline view, reminder engine |

> Copy: *"The Norns have spoken."* — loading/processing message for recommendation engine (future sprint).

---

## Huginn & Muninn → Notification System

Odin's ravens, **Huginn** (Thought) and **Muninn** (Memory), carry news from all the nine realms to Odin daily. In Fenrir Ledger, every reminder is a raven dispatch.

| Element | Mythology | UI Expression |
|---------|-----------|---------------|
| Notification icon | Two raven silhouettes | SVG ravens in nav/header, not a bell |
| Empty notifications | *"Even Odin grows uneasy when his ravens are silent."* | Empty state text in Howl panel |
| Reminder settings | "Send the Ravens" | Settings section label |
| Overdue alert | Raven with urgent styling | Red-outlined raven icon, pulsing |

---

## Hati & Sköll → Deadline Countdown

Two wolves chase the sun (Sköll) and moon (Hati) across the sky. When they catch them, Ragnarök begins.

| Wolf | Chase | UI Role |
|------|-------|---------|
| **Sköll** | Chases the sun | Annual fee countdown — red urgency |
| **Hati** | Chases the moon | Promo deadline countdown — amber warning |

> Days-remaining microcopy: *"Sköll is N days behind the sun"* (fee) / *"Hati is N days behind the moon"* (promo).
> Shown in card detail view and The Howl panel.

---

## Gleipnir → The Binding Metaphor

Gleipnir is the magical ribbon that bound Fenrir — made of six impossible things. It looks like silk but no chain is stronger. The annual fee is your Gleipnir: invisible, seemingly trivial, inescapable if ignored.

- Cards are "chains" in copy and visual metaphor
- Successfully closing a card before the fee = "breaking Gleipnir"
- The six ingredients are hidden throughout the UI as easter eggs (see [`easter-eggs.md`](../ux-design/easter-eggs.md))
- The Gleipnir Hunt: a discoverable collectible game for power users

---

## Fáfnir → The Issuer / Antagonist

Fáfnir was a dwarf who transformed into a dragon through greed, sitting on a hoard of gold and guarding it jealously. He was slain by Sigurd (Siegfried). Credit card issuers = Fáfnir.

| Moment | Copy |
|--------|------|
| Card closed before annual fee | *"You have slain Fáfnir."* |
| Sign-up bonus earned | *"The dragon's gold is yours."* |
| Fee paid unexpectedly | *"Fáfnir struck while Fenrir slept."* |

---

## Odin → The Allfather / Adversary

The Allfather ordered Fenrir bound because he feared the wolf's power. In Fenrir Ledger, the credit card companies = the Aesir gods who set the rules and forge the chains.

- The system they built is Gleipnir: invisible, designed to catch you
- Fenrir (the user) breaks free — every avoided fee is defiance
- The console signature: *"Odin bound Fenrir. Fenrir built Ledger."*

---

## The Valkyries → Action Recommendations

Valkyries were choosers of the slain — they surveyed the battlefield and decided fates. The recommendation engine (future sprint) acts as a Valkyrie for each card decision.

| Recommendation | Valkyrie Verdict |
|---------------|-----------------|
| Keep the card (ROI positive) | *"The Valkyrie spares this chain — its value is proven."* |
| Close the card | *"The Valkyrie points: close before the fee claims you."* |
| Downgrade to no-fee | *"The Valkyrie advises: strip the chain of its cost."* |
| Transfer credits now | *"The Valkyrie commands: harvest before the season turns."* |

---

## The Wolf Pack → The Team

From `README.md` — the development team is The Pack:

| Role | Team Member | Norse Connection |
|------|------------|-----------------|
| Product Owner | **Freya** | Goddess of love, war, and magic — she also practices seiðr (prophetic magic) = product vision |
| UX Designer | **Luna** | The moon Fenrir's kin chases (Hati pursues the moon) |
| Principal Engineer | **FiremanDecko** | The forge master — echoes of Völundr (master craftsman) |
| QA Tester | **Loki** | Shapeshifter, trickster, chaos agent — perfect for QA |

> **Loki easter egg**: Loki was the father of Fenrir. He is also the QA tester. Of course he is. See [`easter-eggs.md`](../ux-design/easter-eggs.md) for the Loki Mode implementation.

---

## Valhalla Archive → Closed Card Hall

Valhalla is the great hall in Asgard where fallen warriors feast eternally. In Fenrir Ledger, closed cards are not deleted — they are honored.

| Element | Design |
|---------|--------|
| Route | `/valhalla` |
| Title | "Valhalla — Hall of the Honored Dead" |
| Subhead | *"Here lie the chain-breakers. Their rewards were harvested."* |
| Visual style | Darker, sepia-tinted, felt like an ancient memorial |
| Card display | Tombstone-style cards showing: open date, close date, total rewards extracted, fees avoided |
| Entry animation | Cards "descend" into the hall with a fade |
| Rune | ᛏ (Tiwaz — victory, justice) on each card |

---

## Yggdrasil → The Portfolio Network (Future)

Yggdrasil is the world tree connecting all nine realms. In a future sprint, the timeline/relationship view could visualize cards as branches of Yggdrasil — showing how issuers, bonus categories, and reward programs interconnect.

---

## Ragnarök → The End State

Ragnarök is the Norse apocalypse — when Fenrir breaks free and swallows Odin. In Fenrir Ledger, Ragnarök is triggered when the user has multiple overdue cards simultaneously.

- **Visual**: Background gradient shifts to deep red, gold accents turn blood orange
- **Copy**: *"Ragnarök approaches. Multiple chains tighten."*
- **Easter egg mode**: Konami code during Ragnarök state → wolf howl animation at maximum intensity
- See [`easter-eggs.md`](../ux-design/easter-eggs.md) for the Ragnarök threshold easter egg
