# Copywriting Guide: Fenrir Ledger

---

## The Two-Voice Rule

Fenrir Ledger has two distinct registers. Every piece of copy belongs to one of them.

### ⚔️ Voice 1: Functional (Plain English)

Used in **every element the user interacts with** — buttons, labels, badges, errors, tooltips, aria-labels, form fields, confirmation dialogs. Zero ambiguity. Zero Norse.

> The user is a power optimizer managing 10+ cards. When they click a button or read a badge, they need instant clarity. The mythology must never slow them down.

**Applies to:** buttons, CTAs, form labels, placeholders, status badges, error messages, validation copy, confirmation dialogs, tooltips, `aria-label` / `aria-description` attributes.

### 🐺 Voice 2: Atmospheric (Norse / Saga)

Used in **elements the user reads but does not act on** — page headings, subheadings, empty states, loading states, between-state moments, and all materials outside the app UI.

> This is the soul of the product. The mythology lives here. It rewards the curious without blocking the efficient.

**Applies to:** page headings & subheadings, empty states, loading copy, Edda quotes, README, docs, team materials, future marketing site.

### Emoji in Atmospheric Copy

Emojis are **permitted but sparse** in atmospheric (Voice 2) prose — descriptions, intro summaries, long-form flavor copy. They reinforce the myth; they never decorate it.

- Maximum **one emoji per sentence or heading**. Zero is usually correct.
- Never use emoji in functional (Voice 1) copy — buttons, labels, badges, errors.

| Glyph | When to use |
|-------|-------------|
| 🐺 | The wolf itself — Fenrir, the user, the brand |
| 🔥 | Fee urgency / forge metaphors |
| ⚔️ | Battle, decisions, confrontation with issuers |
| 🌕 | Promo deadline countdowns |
| 💀 | Missed deadlines, permanent deletion, Ragnarök threshold |
| ✦ / ᛟ | Rune accents — prefer the Elder Futhark character over emoji |

**Never use:** 💳 💰 📊 ✅ ❌ 🎉 🚀 👋 — these break the saga voice entirely.

---

## Core Vocabulary Reference

### Kennings (Norse Compound-Word Poetry)

Kennings are for **atmospheric copy only** — flavor text, empty states, headings, docs. Never use them in buttons, labels, badges, or errors.

| Standard Term | Kenning |
|--------------|---------|
| Credit card | *Fee-wyrm* / *Debt-chain* / *Plastic rune* |
| Annual fee | *Fee-serpent* / *Gold-thief* / *Chain-tightener* |
| Sign-up bonus | *Welcome-mead* / *Opening plunder* |
| Spending threshold | *Mead-hall toll* |
| Closing a card | *Breaking the chain* / *Slaying Fáfnir* |
| Missed deadline | *Gleipnir tightens* |
| Dashboard | *Ledger of Fates* |
| Rewards earned | *Plunder* / *War-spoils* |
| Card portfolio | *The Pack* / *The Chain* |
| User | *Wolf* (atmospheric) |
| Issuer | *Fáfnir* / *The dragon* |
| Reminder | *Raven dispatch* / *Huginn's warning* |

---

## Navigation Labels

Page headings and subheadings are atmospheric (Voice 2). In-page CTAs are functional (Voice 1).

| Route | Page Heading (Atmospheric) | Subheading (Atmospheric) |
|-------|---------------------------|--------------------------|
| `/` | **The Ledger of Fates** | *Every chain, every deadline, every reward* |
| `/cards/new` | **Forge a New Chain** | *Add a card to your portfolio* |
| `/cards/[id]` | **[Card Name]** | *Card record* |
| `/valhalla` | **Valhalla** | *Hall of the Honored Dead* |
| `/settings` | **The Ravens** | *Manage reminders* |

---

## Status Badges

Badges are functional (Voice 1). Plain English only. Realm names belong in tooltips or detail views as flavor, never as the primary badge label.

| `CardStatus` | Badge Label | Tooltip (Atmospheric flavor) | Color |
|-------------|-------------|------------------------------|-------|
| `active` | **Active** | *Asgard-bound — rewards flowing, no urgent deadlines* | Teal |
| `active` (bonus window open) | **Bonus Open** | *Vanaheim — sign-up bonus window is open* | Gold |
| `promo_expiring` | **Promo Expiring** | *Hati approaches — promo deadline in N days* | Amber |
| `fee_approaching` | **Fee Due Soon** | *Muspelheim — annual fee due in N days* | Blood orange |
| `closed` | **Closed** | *In Valhalla — rewards harvested* | Stone |
| (overdue, future) | **Overdue** | *Gleipnir tightens — deadline has passed* | Red |

---

## Action Labels (Buttons & CTAs)

All buttons are functional (Voice 1). Plain English only.

| Action | Label |
|--------|-------|
| Add new card | **Add Card** |
| Save card | **Save** |
| Close / cancel a card | **Close Card** |
| Confirm delete | **Delete** |
| Cancel any action | **Cancel** |
| Mark bonus met | **Mark Bonus Met** |
| Dismiss reminder | **Dismiss** |
| Edit card | **Edit** |
| View closed cards | **Closed Cards** |

---

## Form Labels & Micro-copy

All form labels, placeholders, and field-level copy are functional (Voice 1).

| Field | Label | Placeholder |
|-------|-------|-------------|
| Card name | **Card name** | *e.g. Chase Sapphire Preferred* |
| Issuer | **Issuer** | *Select issuer* |
| Credit limit | **Credit limit** | *e.g. 10000* |
| Annual fee | **Annual fee** | *e.g. 95* |
| Annual fee date | **Annual fee date** | *YYYY-MM-DD* |
| Card opened date | **Opened** | *YYYY-MM-DD* |
| Sign-up bonus | **Sign-up bonus** | — |
| Spend requirement | **Spend requirement** | *e.g. 4000* |
| Bonus deadline | **Bonus deadline** | *YYYY-MM-DD* |
| Notes | **Notes** | *Optional notes* |
| Days remaining label | **N days left** | — |

---

## Empty States

Empty states are atmospheric (Voice 2) — the brand's emotional hook. Norse voice, no user action required until the CTA.

### No cards at all

> *Before Gleipnir was forged, Fenrir roamed free.*
> *Before your first card is added, no chain can be broken.*

**[Add Card]** ← functional CTA

### Valhalla — no closed cards

> *The hall waits. No chain has yet been broken.*
> *When you close a card and escape its fee, its record will be honored here.*

### Howl panel — no urgent items

> *The wolf is silent. All chains are loose.*
> *Huginn and Muninn carry no warnings today.*

### No cards from a specific issuer

> *No cards bear this issuer's mark.*

### Search / filter — no results

> *Nothing found. Try widening your search.*

---

## Loading States

Loading copy is atmospheric (Voice 2). Rotate through these:

- *"The Norns are weaving..."*
- *"Huginn returns with news..."*
- *"Consulting the runes..."*
- *"Skuld's thread unwinds..."*
- *"The Ledger opens..."*
- *"Fenrir stirs..."*

---

## Confirmation Dialogs

Dialog headings and body are atmospheric where appropriate. **All buttons are functional (Voice 1).**

### Close (cancel) a card

> **Close this card?**
> *[Card Name] will be moved to Closed Cards. Its record and rewards will be preserved.*
>
> [Close Card] [Cancel]

### Delete a card permanently

> **Delete this card?**
> *This cannot be undone. The record will be permanently removed.*
>
> [Delete] [Cancel]

### Mark annual fee paid (kept the card)

> **Annual fee recorded.**
> *You chose to keep this card. May its rewards exceed its cost.*
>
> [Done]

---

## Error Messages

All errors are functional (Voice 1). Direct, clear, actionable.

| Error | Copy |
|-------|------|
| Form validation | *"[Field name] is required."* |
| Save failed | *"Save failed. Please try again."* |
| localStorage full | *"Storage full. Delete old cards before adding new ones."* |
| Unknown error | *"Something went wrong. Refresh and try again."* |

---

## Edda Quotes (Loading / Between-State Moments)

Atmospheric (Voice 2). Rotate through for loading screens and between-page transitions:

> *"Cattle die, kinsmen die, you yourself will die. But one thing I know that never dies: the reputation of one who has done well."*
> — Hávamál, stanza 77

> *"Better to not swear an oath than to swear and break it."*
> — Hávamál, stanza 110 *(used for: missed deadlines)*

> *"Gold is little comfort for the kinsman's grief."*
> — Völsungasaga *(used for: fees paid, missed bonus)*

> *"Though it looks like silk ribbon, no chain is stronger."*
> — Prose Edda, Gylfaginning *(used for: annual fee warning)*

> *"Wisdom is welcome wherever it comes from."*
> — Njáls saga *(used for: first recommendation result)*

> *"A man should be loyal through life to friends, and return gift for gift."*
> — Hávamál, stanza 42 *(used for: referral bonuses)*

---

## Page Titles (HTML `<title>` tags)

Page titles are atmospheric (Voice 2) — they set scene without blocking interaction.

| Page | `<title>` |
|------|-----------|
| Dashboard | `Ledger of Fates — Fenrir Ledger` |
| Add card | `Add Card — Fenrir Ledger` |
| Card detail | `[Card Name] — Fenrir Ledger` |
| Closed Cards | `Valhalla — Fenrir Ledger` |
| Settings | `Reminders — Fenrir Ledger` |
| 404 | `Lost — Fenrir Ledger` |
| Error | `Error — Fenrir Ledger` |

---

## 404 Page

> **You've wandered off the map.**
>
> *Even Bifröst has limits.*
>
> [Go to Dashboard]

---

## Footer

*Forged by FiremanDecko · Guarded by Freya · Tested by Loki*

---

## Magic Numbers

Significant numeric constants in the codebase that carry intentional meaning. Do not change these without cause — they are part of the hidden lore.

| Value | Where used | Meaning |
|---|---|---|
| `9653` | Easter egg z-index layer | **W-O-L-F** on a phone keypad (9=W, 6=O, 5=L, 3=F). The wolf always rises above everything else. |
| `7` | Loki Mode click count | Loki has 7 known children in Norse myth. Only a true devotee counts. |
