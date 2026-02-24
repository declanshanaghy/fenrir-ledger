# Copywriting Guide: Fenrir Ledger

All UI copy must feel like it belongs to the Saga Ledger world. Terse, allusive, mythic — but never at the cost of clarity. Write for the wolf, not the tourist.

---

## Core Vocabulary Reference

### Kennings (Norse Compound-Word Poetry)

Norse skalds used kennings — poetic compound-word substitutes. Use these in secondary copy, tooltips, and flavor text. Never replace primary navigation labels.

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
| User | *Wolf* (informal) / *Chain-breaker* (formal) |
| Issuer | *Fáfnir* / *The dragon* / *Aesir bankers* |
| Reminder | *Raven dispatch* / *Huginn's warning* |
| Recommendation engine | *The Norns* / *The Valkyrie's verdict* |

---

## Emoji Usage in Wolf's Voice

Emojis are **permitted but sparse** when writing in the voice of the wolf — documentation, README prose, commit messages, and in-app flavor copy. They reinforce the myth; they never decorate it.

**Rules:**
- Maximum **one emoji per sentence or heading**. Zero is usually correct.
- Use only myth-resonant glyphs. Approved set:

| Glyph | When to use |
|-------|-------------|
| 🐺 | The wolf itself — Fenrir, the user, the brand |
| 🔥 | Muspelheim / fee urgency / forge metaphors |
| ⚔️ | Battle, decisions, confrontation with issuers |
| 🌕 | Hati / Sköll moon/sun chase — promo countdowns |
| 💀 | Ragnarök threshold, missed deadlines, permanent deletion |
| ✦ / ᛟ | Rune accents — prefer the Elder Futhark character over emoji |

**Never use:** 💳 💰 📊 ✅ ❌ 🎉 🚀 👋 — these break the saga voice entirely.

**Correct:** *"The fee-serpent 🔥 strikes in 7 days."*
**Incorrect:** *"⚠️ Your annual fee is due soon! 💳"*

---

## Navigation Labels

| Route | Primary Label | Subheading |
|-------|--------------|-----------|
| `/` | **The Ledger of Fates** | *Every chain, every deadline, every reward* |
| `/cards/new` | **Forge a New Chain** | *Add a card to your portfolio* |
| `/cards/[id]` | **[Card Name]** | *Chain record* |
| `/valhalla` | **Valhalla** | *Hall of the Honored Dead* |
| `/settings` | **The Ravens** | *Send reminders before the chains tighten* |

---

## Status Labels

Replace the generic shadcn badge text with realm-based labels. The primary label is short; the tooltip is the full realm name.

| `CardStatus` | Badge Label | Tooltip / Long Form | Color |
|-------------|-------------|---------------------|-------|
| `active` | **Asgard-bound** | *Active — rewards flowing, no urgent deadlines* | Teal |
| `active` (bonus window) | **Vanaheim** | *Sign-up bonus window is open* | Gold |
| `promo_expiring` (>60d) | **Hati approaches** | *Promo expiring in N days — Hati runs* | Amber |
| `fee_approaching` (≤30d) | **Muspelheim** | *Annual fee due in N days — fire approaches* | Blood orange |
| `closed` | **In Valhalla** | *Card closed — rewards harvested* | Stone |
| (overdue, future) | **Gleipnir tightens** | *Deadline missed — the chain holds* | Red |

---

## Empty States

Empty states are the brand's clearest voice. Never write "No cards yet. Add one!"

### No cards at all

> *Before Gleipnir was forged, Fenrir roamed free.*
> *Before your first card is added, no chain can be broken.*
>
> *Add your first card, wolf.*

### Valhalla with no closed cards

> *The hall waits. No chain has yet been broken.*
>
> *When you close a card and escape its fee, its record will be honored here.*

### The Howl panel — no urgent items

> *The wolf is silent. All chains are loose.*
>
> *Huginn and Muninn carry no warnings today.*

### No cards from a specific issuer

> *No chains bear this dragon's mark.*

### Search / filter — no results

> *The runes reveal nothing. Widen your search.*

---

## Loading States

Rotate through these during data loading moments:

- *"The Norns are weaving..."*
- *"Huginn returns with news..."*
- *"Consulting the runes..."*
- *"Skuld's thread unwinds..."*
- *"The Ledger opens..."*
- *"Fenrir stirs..."*

---

## Action Labels (Buttons & CTAs)

| Action | Label |
|--------|-------|
| Add new card | **Forge a Chain** |
| Save card | **Bind the Chain** |
| Close / cancel card | **Break the Chain** |
| Confirm delete | **Send to Valhalla** |
| Cancel delete | **Hold** |
| Mark bonus met | **Plunder Claimed** |
| Dismiss reminder | **Raven dismissed** |
| Edit card | **Amend the Record** |
| View closed cards | **Enter Valhalla** |

---

## Confirmation Dialogs

### Close (cancel) a card

> **Break this chain?**
> *[Card Name] will be sent to Valhalla. Its record and rewards will be preserved.*
>
> [Break the Chain] [Hold]

### Delete a card permanently

> **Erase from the Ledger?**
> *This cannot be undone. Unlike Valhalla, there is no return from the void.*
>
> [Cast into the Void] [Hold]

### Mark annual fee paid (kept the card)

> **The fee-serpent has fed.**
> *You chose to keep this chain. May its rewards exceed its cost.*
>
> [Noted] [Recalculate ROI]

---

## Error Messages

| Error | Copy |
|-------|------|
| Form validation | *"The runes are incomplete. [Specific field] is required."* |
| Save failed | *"Gleipnir resisted. The chain was not saved."* |
| localStorage full | *"The Ledger is full. Clear old records before forging new chains."* |
| Unknown error | *"Something in the nine realms went wrong. Refresh and try again."* |

---

## Micro-copy

| Element | Copy |
|---------|------|
| Credit limit label | *Chain weight* |
| Annual fee label | *Fee-serpent value* |
| Annual fee date label | *Fee-serpent strikes* |
| Open date label | *Chain forged* |
| Sign-up bonus label | *Welcome mead* |
| Spend requirement label | *Mead-hall toll* |
| Deadline label | *Skuld's deadline* |
| Notes label | *Skald's notes* |
| Days remaining | *N days remain* |
| Hati countdown | *Hati is N days behind the moon* |
| Sköll countdown | *Sköll is N days behind the sun* |
| Bonus earned | *Plunder claimed* |
| Bonus not yet earned | *Toll unpaid* |
| Footer credit | *Forged by FiremanDecko · Guarded by Freya · Tested by Loki* |

---

## Edda Quotes (Loading / Between-State Moments)

Rotate through these for loading screens, skeleton states, and between-page transitions:

> *"Cattle die, kinsmen die, you yourself will die. But one thing I know that never dies: the reputation of one who has done well."*
> — Hávamál, stanza 77

> *"Better to not swear an oath than to swear and break it."*
> — Hávamál, stanza 110 *(used for: missed deadlines, unkept commitments)*

> *"Gold is little comfort for the kinsman's grief."*
> — Völsungasaga *(used for: fees paid, missed bonus)*

> *"Though it looks like silk ribbon, no chain is stronger."*
> — Prose Edda, Gylfaginning *(used for: Gleipnir / annual fee warning)*

> *"Wisdom is welcome wherever it comes from."*
> — Njáls saga *(used for: first recommendation engine result)*

> *"A man should be loyal through life to friends, and return gift for gift."*
> — Hávamál, stanza 42 *(used for: reciprocal rewards, referral bonuses)*

---

## Page Titles (HTML `<title>` tags)

| Page | `<title>` |
|------|-----------|
| Dashboard | `Ledger of Fates — Fenrir Ledger` |
| Add card | `Forge a Chain — Fenrir Ledger` |
| Card detail | `[Card Name] — Fenrir Ledger` |
| Valhalla | `Valhalla — Fenrir Ledger` |
| Settings | `The Ravens — Fenrir Ledger` |
| 404 | `Lost in the Nine Realms — Fenrir Ledger` |
| Error | `Ragnarök — Fenrir Ledger` |

---

## 404 Page

> **You have wandered past the nine realms.**
>
> *Even Bifröst has limits.*
>
> [Return to the Ledger]
