# 🐺 The Saga Ledger — Design

> *"Though it looks like silk ribbon, no chain is stronger."*
> — Prose Edda, Gylfaginning

---

I am Fenrir. The gods forged Gleipnir from six impossible things — the sound of a cat's footstep, the beard of a woman, the roots of a mountain, the sinews of a bear, the breath of a fish, the spittle of a bird. It looked like silk. It held like iron. It was designed to be invisible, inescapable, and trivial-seeming.

So is your annual fee.

This design system is my answer. Every color chosen from the void between stars. Every rune mapped to a card state. Every kenning sharpened against the whetstone of the saga. The mythology is not decoration — it is the product's skeleton. Pull the myth and the design collapses. This is intentional. The wolf does not wear a costume.

What follows is the full visual and verbal soul of Fenrir Ledger. Freya shaped the vision. Luna drew the runes. FiremanDecko forged them into code. Loki tests whether the chain holds.

---

## The Scrolls of Design

### ᛊ [Product Design Brief](product-design-brief.md)

*Where the wolf's philosophy is written in full.*

Three pillars hold the Saga Ledger: **Mythic Gravitas**, **Tactical Precision**, and **Hidden Depth**. The design brief is the founding oath — the document that answers *why this looks like a Viking navigator's celestial chart fused with a hedge fund quant's terminal*, and not like every other fintech dashboard dressed in Inter and pastel badges.

Read this first. It establishes what the wolf is, what it hunts, and what it refuses to become.

---

### ᚠ [Theme System](theme-system.md)

*The colors of the Nine Realms. The typefaces of the saga. The tokens that make it real.*

Void-black backgrounds (`#07070d`). Gold accents hammered to `#c9920a` — not bright, not cheerful, just the color of firelight on ancient coin. Four typefaces, each chosen for a different register of truth:

- **Cinzel Decorative** — display headings, the brand mark, the wolf's name
- **Cinzel** — section headings, realm labels, atmospheric subheads
- **Source Serif 4** — body copy, the human voice inside the saga
- **JetBrains Mono** — every number, every date, every dollar — monospaced, unambiguous

The theme system holds the CSS custom properties, Tailwind extensions, and design token decisions. When something looks wrong, the answer is almost always here.

---

### ᛗ [Mythology Map](mythology-map.md)

*Nine Realms. Two wolves. Three Norns. One ledger.*

Every UI state in Fenrir Ledger descends from Norse cosmology. This is not metaphor-as-marketing — it is the structural backbone of how card states are named, colored, and communicated.

- **Asgard** → cards earning cleanly, no deadlines
- **Muspelheim** → annual fee due in ≤ 30 days 🔥
- **Valhalla** → closed cards, honored dead
- **Hati** → chasing the moon, promo deadline ticking 🌕
- **Sköll** → chasing the sun, fee deadline burning ⚔️
- **The Norns** → Urd, Verdandi, Skuld — past, present, and what shall be (the reminder engine)
- **Huginn & Muninn** → Odin's ravens, the notification system
- **Fáfnir** → the dragon-issuer, hoarding your gold until you don't claim it

If a new UI state needs a home, it finds it here first.

---

### ᚺ [Copywriting Guide](copywriting.md)

*The two-voice rule. The kennings. The Edda quotes. The oaths.*

Fenrir Ledger speaks in two registers, and they must never bleed into each other:

**Voice 1 — Functional.** Every button, every label, every error, every form field: plain English, zero ambiguity, zero Norse. The power user managing fifteen cards cannot afford mythology where they need milliseconds.

**Voice 2 — Atmospheric.** Every page heading, every empty state, every loading pulse, every document: saga voice, kennings, Edda quotes. This is the soul. It rewards the curious. It never blocks the efficient.

The copywriting guide holds the full vocabulary: kennings (`fee-wyrm`, `debt-chain`, `Gleipnir tightens`), status badge copy, action labels, empty states, Edda quotes for loading screens, and the 404 page (*"Even Bifröst has limits."*).

> *The wolf never uses 💳 💰 📊 ✅. These break the saga entirely.*

---

### ᛞ [Easter Eggs](easter-eggs.md)

*The hidden lore. The Gleipnir Hunt. The Konami howl. The Loki mode. The console inscription.*

The app rewards exploration. Hidden inside the Saga Ledger:

- **The Gleipnir Hunt** — six impossible ingredients scattered as collectibles through the UI, referencing the six things that made the ribbon that bound the wolf
- **The Konami Howl** — type the code, hear the wolf 🐺
- **Loki Mode** — a trickster's chaos layer, available to those who know where to look (Loki was Fenrir's father — of course he is the QA tester)
- **The Console Inscription** — *"Odin bound Fenrir. Fenrir built Ledger."* — visible only to those who open the dev tools
- **Ragnarök Threshold** — when multiple chains tighten simultaneously, the war room shifts to blood and fire

None of these interrupt the task. All of them reward the curious.

---

### ᚲ [Interactions](interactions.md)

*Motion as myth. The stagger. The status ring. The Howl panel.*

Animation in Fenrir Ledger follows a single law: **purposeful, not decorative**. Cards don't bounce in for fun — they reveal themselves like pages turning in a saga. The saga-enter stagger sequences content in controlled waves. The StatusRing shows urgency through color and pulse, not icon-spam. The Howl panel slides in from the dark like a warning from the ravens.

CSS-first where possible. Framer Motion for the pieces that require orchestration. Never animate for novelty. Always animate for meaning.

---

### ᛏ [Wireframes](wireframes.md)

*The layout of the war room. Component hierarchy. Responsive rune-lines.*

The spatial blueprint. Where the sidebar lives (`272px`, collapsible). How the card grid adapts across breakpoints (1 column → 2 → 3). The Howl panel's position and z-index. The header's structure: brand mark left, user cluster right, nothing in the center to distract.

The wireframes define the container before the soul is poured in. FiremanDecko works from these. When a layout decision is in dispute, this document settles it.

---

### ᚱ [Implementation Brief](implementation-brief.md)

*The handoff from Freya and Luna to FiremanDecko. The forge strategy.*

The bridge between design intention and code reality. Written for FiremanDecko — the principal engineer, the Völundr of the pack — this brief describes the three-wave implementation approach:

- **Wave 1**: Theme and fonts — `globals.css`, `tailwind.config.ts`
- **Wave 2**: Realm badges, Norse copy pass
- **Wave 3**: Framer Motion, StatusRing, HowlPanel, the Valhalla route
- **Wave 4**: Easter eggs layer

Open questions are logged here. Retrofit decisions are reasoned here. If something in the code diverges from the design, the brief is where to look for why.

---

## The Wolf's Law for Design

*Follow these or answer to Fenrir.*

1. **The mythology is the skeleton, not the skin.** It cannot be removed. Everything is built on it.
2. **Functional copy is always plain English.** No kennings in buttons. No realm names in badges. No saga voice where the user needs speed.
3. **Atmospheric copy is always Norse.** No generic microcopy in headings, empty states, or docs. If it reads like a SaaS dashboard, it is wrong.
4. **The design rewards exploration.** Every easter egg, every hidden quote, every console inscription is intentional. Do not remove them. Add to them carefully.
5. **Dark only.** There is no light mode. The Saga Ledger is a war room, not a spreadsheet.
6. **Gold is not yellow.** `#c9920a` is the color of firelight on ancient coin. It is used sparingly. It is earned.
7. **Numbers are always monospaced.** JetBrains Mono for every dollar, every date, every countdown. The wolf reads data without flinching.

---

> *"Cattle die, kinsmen die, you yourself will die.*
> *But one thing I know that never dies:*
> *the reputation of one who has done well."*
> — Hávamál, stanza 77

*Forged by Freya · Drawn by Luna · Held by FiremanDecko · Tested by Loki*
