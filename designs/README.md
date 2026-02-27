# The Saga Ledger — Design

> *"Though it looks like silk ribbon, no chain is stronger."*
> — Prose Edda, Gylfaginning

---

I am Fenrir. The gods forged Gleipnir from six impossible things — the sound of a cat's footstep, the beard of a woman, the roots of a mountain, the sinews of a bear, the breath of a fish, the spittle of a bird. It looked like silk. It held like iron. It was designed to be invisible, inescapable, and trivial-seeming.

So is your annual fee.

This design system is my answer. Every color chosen from the void between stars. Every rune mapped to a card state. Every kenning sharpened against the whetstone of the saga. The mythology is not decoration — it is the product's skeleton. Pull the myth and the design collapses. This is intentional. The wolf does not wear a costume.

What follows is the full visual and verbal soul of Fenrir Ledger. Freya shaped the vision. Luna drew the runes. FiremanDecko forged them into code. Loki tests whether the chain holds.

---

## Index

- [product-design-brief.md](product-design-brief.md) — Design philosophy, three pillars, aesthetic direction, key decisions.
- [product/README.md](product/README.md) — Freya's domain: mythology map, copywriting guide, and groomed backlog.
- [product/mythology-map.md](product/mythology-map.md) — Norse cosmology mapped to every UI state, character, and feature.
- [product/copywriting.md](product/copywriting.md) — Two-voice rule, kennings, status badge copy, action labels, empty states, Edda quotes.
- [product/backlog/README.md](product/backlog/README.md) — Freya's groomed backlog index: all stories ready for sprint planning.
- [product/backlog/story-auth-oidc-google.md](product/backlog/story-auth-oidc-google.md) — P1-Critical: OIDC Authentication — Google Login (Iteration 1).
- [ux-design/README.md](ux-design/README.md) — Luna's domain: visual system, interactions, wireframes, and easter eggs.
- [ux-design/theme-system.md](ux-design/theme-system.md) — Color palette, typography, CSS custom properties, Tailwind config extensions.
- [ux-design/easter-eggs.md](ux-design/easter-eggs.md) — All hidden references: Gleipnir Hunt, Konami Howl, Loki Mode, console ASCII, and more.
- [ux-design/interactions.md](ux-design/interactions.md) — Animation philosophy, saga-enter stagger, status ring, Howl panel, easter egg keyframes.
- [ux-design/wireframes.md](ux-design/wireframes.md) — Layout specs, component hierarchy, responsive breakpoints, z-index table, wireframe index.
- [ux-design/easter-egg-modal.md](ux-design/easter-egg-modal.md) — Shared modal template for all easter egg discovery moments.
- [ux-design/ux-assets/mermaid-style-guide.md](ux-design/ux-assets/mermaid-style-guide.md) — Mermaid diagram conventions for all pack members.
- [architecture/README.md](architecture/README.md) — FiremanDecko's domain: implementation brief, pipeline, system design, sprint plan, and ADRs.
- [architecture/implementation-brief.md](architecture/implementation-brief.md) — FiremanDecko integration plan: wave strategy, sprint stories, open questions.
- [architecture/pipeline.md](architecture/pipeline.md) — Kanban orchestration: model assignments, stage gates, WIP limits, handoff chain.
- [architecture/system-design.md](architecture/system-design.md) — Component architecture, data flow diagrams, file structure, and dependency table for the current sprint.
- [architecture/sprint-plan.md](architecture/sprint-plan.md) — Sprint stories with acceptance criteria, technical notes, and complexity estimates for the current sprint.
- [architecture/adrs/ADR-001-tech-stack.md](architecture/adrs/ADR-001-tech-stack.md) — ADR: Next.js + TypeScript + Tailwind CSS + shadcn/ui stack selection.
- [architecture/adrs/ADR-002-data-model.md](architecture/adrs/ADR-002-data-model.md) — ADR: household-scoped data model from Sprint 1 to avoid future schema breakage.
- [architecture/adrs/ADR-003-local-storage.md](architecture/adrs/ADR-003-local-storage.md) — ADR: localStorage for Sprint 1 persistence with a documented migration path to a server-side backend.
- [architecture/adrs/ADR-004-oidc-auth-and-persistence.md](architecture/adrs/ADR-004-oidc-auth-and-persistence.md) — ADR: Auth.js v5, JWT sessions, Supabase PostgreSQL, and multi-tenant isolation strategy.

---

## The Scrolls of Design

### ᛊ [Product Design Brief](product-design-brief.md)

*Where the wolf's philosophy is written in full.*

Three pillars hold the Saga Ledger: **Mythic Gravitas**, **Tactical Precision**, and **Hidden Depth**. The design brief is the founding oath — the document that answers *why this looks like a Viking navigator's celestial chart fused with a hedge fund quant's terminal*, and not like every other fintech dashboard dressed in Inter and pastel badges.

Read this first. It establishes what the wolf is, what it hunts, and what it refuses to become.

---

### ᚠ [Theme System](ux-design/theme-system.md)

*The colors of the Nine Realms. The typefaces of the saga. The tokens that make it real.*

Void-black backgrounds (`#07070d`). Gold accents hammered to `#c9920a` — not bright, not cheerful, just the color of firelight on ancient coin. Four typefaces, each chosen for a different register of truth:

- **Cinzel Decorative** — display headings, the brand mark, the wolf's name
- **Cinzel** — section headings, realm labels, atmospheric subheads
- **Source Serif 4** — body copy, the human voice inside the saga
- **JetBrains Mono** — every number, every date, every dollar — monospaced, unambiguous

The theme system holds the CSS custom properties, Tailwind extensions, and design token decisions. When something looks wrong, the answer is almost always here.

---

### ᛗ [Mythology Map](product/mythology-map.md)

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

### ᚺ [Copywriting Guide](product/copywriting.md)

*The two-voice rule. The kennings. The Edda quotes. The oaths.*

Fenrir Ledger speaks in two registers, and they must never bleed into each other:

**Voice 1 — Functional.** Every button, every label, every error, every form field: plain English, zero ambiguity, zero Norse. The power user managing fifteen cards cannot afford mythology where they need milliseconds.

**Voice 2 — Atmospheric.** Every page heading, every empty state, every loading pulse, every document: saga voice, kennings, Edda quotes. This is the soul. It rewards the curious. It never blocks the efficient.

The copywriting guide holds the full vocabulary: kennings (`fee-wyrm`, `debt-chain`, `Gleipnir tightens`), status badge copy, action labels, empty states, Edda quotes for loading screens, and the 404 page (*"Even Bifröst has limits."*).

> *The wolf never uses 💳 💰 📊 ✅. These break the saga entirely.*

---

### ᛞ [Easter Eggs](ux-design/easter-eggs.md)

*The hidden lore. The Gleipnir Hunt. The Konami howl. The Loki mode. The console inscription.*

The app rewards exploration. Hidden inside the Saga Ledger:

- **The Gleipnir Hunt** — six impossible ingredients scattered as collectibles through the UI, referencing the six things that made the ribbon that bound the wolf
- **The Konami Howl** — type the code, hear the wolf 🐺
- **Loki Mode** — a trickster's chaos layer, available to those who know where to look (Loki was Fenrir's father — of course he is the QA tester)
- **The Console Inscription** — *"Odin bound Fenrir. Fenrir built Ledger."* — visible only to those who open the dev tools
- **Ragnarök Threshold** — when multiple chains tighten simultaneously, the war room shifts to blood and fire

None of these interrupt the task. All of them reward the curious.

---

### ᚲ [Interactions](ux-design/interactions.md)

*Motion as myth. The stagger. The status ring. The Howl panel.*

Animation in Fenrir Ledger follows a single law: **purposeful, not decorative**. Cards don't bounce in for fun — they reveal themselves like pages turning in a saga. The saga-enter stagger sequences content in controlled waves. The StatusRing shows urgency through color and pulse, not icon-spam. The Howl panel slides in from the dark like a warning from the ravens.

CSS-first where possible. Framer Motion for the pieces that require orchestration. Never animate for novelty. Always animate for meaning.

---

### ᛏ [Wireframes](ux-design/wireframes.md)

*The layout of the war room. Component hierarchy. Responsive rune-lines.*

The spatial blueprint. Where the sidebar lives (`272px`, collapsible). How the card grid adapts across breakpoints (1 column → 2 → 3). The Howl panel's position and z-index. The header's structure: brand mark left, user cluster right, nothing in the center to distract.

Wireframes are standalone HTML5 documents in `designs/ux-design/wireframes/`. They carry no theme styling — no colors, no custom fonts, no decorative rules — so they remain valid regardless of how the theme evolves. The `wireframes.md` index links to each file and records the key layout decisions behind them.

The wireframes define the container before the soul is poured in. FiremanDecko works from these. When a layout decision is in dispute, this document settles it.

---

### ᚱ [Implementation Brief](architecture/implementation-brief.md)

*The handoff from Freya and Luna to FiremanDecko. The forge strategy.*

The bridge between design intention and code reality. Written for FiremanDecko — the principal engineer, the Völundr of the pack — this brief describes the three-wave implementation approach:

- **Wave 1**: Theme and fonts — `globals.css`, `tailwind.config.ts`
- **Wave 2**: Realm badges, Norse copy pass
- **Wave 3**: Framer Motion, StatusRing, HowlPanel, the Valhalla route
- **Wave 4**: Easter eggs layer

Open questions are logged here. Retrofit decisions are reasoned here. If something in the code diverges from the design, the brief is where to look for why.

---

### ᛟ [Easter Egg Modal](ux-design/easter-egg-modal.md)

*The shared modal template for every easter egg discovery moment.*

The full design spec and React integration guide for the reusable `EasterEggModal` component: gold glow border, Cinzel Decorative headline, two-column artifact layout, animated entry via `saga-enter` easing. All design tokens come from `ux-design/theme-system.md`. Every easter egg that surfaces a discovery dialog uses this template.

---

### ᚹ [Pipeline](architecture/pipeline.md)

*The Kanban orchestration contract. How the pack hunts in order.*

The workflow definition for all four agents — model assignments, stage gates, WIP limits, and the `designs/ → development/ → quality/` handoff chain. Read this to understand how work moves through the forge from backlog to ship.

---

### ᛉ [Mermaid Style Guide](ux-design/ux-assets/mermaid-style-guide.md)

*How the pack draws its diagrams. One style, all wolves.*

The canonical reference for Mermaid syntax conventions across all four agents: color palette, node shapes, edge styles, diagram type selection, and examples of good vs. bad diagrams. Every team member must read this before producing any diagram.

---

### ᚢ [Freya's Backlog](product/backlog/README.md)

*The wolf's queue. Groomed, prioritized, ready to hunt.*

Freya's sprint-ready backlog: all stories that have been written, prioritized, and cleared for engineering. The index links to each story file with its priority, status, and sprint target.

Current stories:

- [OIDC Authentication — Google Login (Iteration 1)](product/backlog/story-auth-oidc-google.md) — P1-Critical, Sprint 3 target. Sign in with Google, server-side persistence, household scoping. Engineering response and ADR complete.

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
