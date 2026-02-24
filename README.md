# ᛟ Fenrir Ledger

**Break free from fee traps. Harvest every reward. Let no chain hold.**

> *In Norse mythology, Fenrir is the great wolf who shatters the chains the gods forged to bind him.*
> *Fenrir Ledger breaks the invisible chains of forgotten annual fees, expired promotions,*
> *and wasted sign-up bonuses that silently devour your wallet.*

---

Track every fee-wyrm in your portfolio. Every chain forged, every promo deadline, every fee-serpent's strike date — Fenrir watches and howls before the trap snaps shut. Add your cards, name your thresholds, and the wolf does the rest: reminding you to spend, transfer, downgrade, or close before you lose a single dollar to a fee you didn't choose to pay.

*Sprint 1 complete. Sprint 2 in progress — the Saga Ledger theme is live.*

---

## The Pack

| Role | Wolf | Model | Scroll |
|------|------|-------|--------|
| Product Owner | Freya | Sonnet | [SKILL](fenrir-ledger-team/product-owner/SKILL.md) |
| UX Designer | Luna | Sonnet | [SKILL](fenrir-ledger-team/ux-designer/SKILL.md) |
| Principal Engineer | FiremanDecko | Sonnet | [SKILL](fenrir-ledger-team/principal-engineer/SKILL.md) |
| QA Tester | Loki | Haiku | [SKILL](fenrir-ledger-team/qa-tester/SKILL.md) |

## The Pipeline

```mermaid
graph LR
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef warning fill:#FF9800,stroke:#F57C00,color:#FFF
    classDef neutral fill:#F5F5F5,stroke:#E0E0E0,color:#212121

    %% Roles
    po(Freya<br/>Product Owner)
    ux(Luna<br/>UX Designer)
    eng(FiremanDecko<br/>Principal Engineer)
    qa(Loki<br/>QA Tester)

    %% Artifacts
    brief[Design Brief]
    sysdesign[System Design<br/>+ API Contracts]
    impl[Implementation]
    ship([Accepted ✓])

    %% Pipeline
    po -->|collaborates| ux
    ux -->|produces| brief
    brief -->|handed off| eng
    eng -->|produces| sysdesign
    sysdesign -->|guides| impl
    impl -->|tested by| qa
    qa -->|ship / no-ship| ship

    class po primary
    class ux primary
    class eng primary
    class qa warning
    class brief neutral
    class sysdesign neutral
    class impl neutral
    class ship healthy
```

Kanban · Max 5 chains per sprint · The forge-script runs every sprint

---

## The Scrolls

### ᛟ Foundation

- [Product Brief](product-brief.md) — What the wolf hunts, why, and for whom. The prioritized backlog.
- [Patient Zero](patient-zero.md) — Pack composition, pipeline summary, quick-reference setup.

### ᚱ The Saga Ledger — Design

*Freya + Luna's domain. The visual soul of the wolf.*

- [design/product-design-brief.md](design/product-design-brief.md) — Design philosophy, three pillars, aesthetic direction
- [design/theme-system.md](design/theme-system.md) — Color palette, typography, CSS tokens, Tailwind extensions
- [design/mythology-map.md](design/mythology-map.md) — Nine Realms → card states, Norns, Huginn & Muninn, Hati & Sköll
- [design/copywriting.md](design/copywriting.md) — Kennings, Edda quotes, empty states, action labels, error voice
- [design/easter-eggs.md](design/easter-eggs.md) — Gleipnir Hunt, Konami howl, Loki mode, console ASCII, all hidden lore
- [design/interactions.md](design/interactions.md) — Animations, saga-enter stagger, status ring, Howl panel patterns
- [design/wireframes.md](design/wireframes.md) — Layout specs, component hierarchy, responsive breakpoints
- [design/implementation-brief.md](design/implementation-brief.md) — FiremanDecko integration plan, wave strategy, open questions

### ᚲ The Forge — Architecture + Development

*FiremanDecko's domain. Where the chains are forged.*

- [architecture/system-design.md](architecture/system-design.md) — Component architecture, data model, data flow diagrams
- [architecture/sprint-plan.md](architecture/sprint-plan.md) — Current sprint's stories, acceptance criteria, technical notes
- [architecture/adrs/](architecture/adrs/) — Architecture Decision Records (ADR-001, ADR-002, ADR-003)
- `architecture/api-contracts.md` — API surface, data shapes, endpoint specs *(future sprint)*
- [development/src/](development/src/) — The forge itself. Next.js source code lives here.
- [development/implementation-plan.md](development/implementation-plan.md) — Ordered task breakdown, what was built
- [development/qa-handoff.md](development/qa-handoff.md) — Handoff to Loki: deploy steps, test focus, known limits
- [development/scripts/](development/scripts/) — Idempotent build and deploy scripts

### ᛏ Loki's Domain — Quality

*The trickster tests. His verdicts are final.*

- `quality/test-plan.md` — Test strategy and coverage plan *(not yet forged)*
- `quality/test-cases.md` — Detailed test cases against acceptance criteria *(not yet forged)*
- `quality/quality-report.md` — Ship / No Ship verdict *(not yet forged)*
- `quality/scripts/` — Idempotent deploy and test scripts *(not yet forged)*

### ᚠ Pack Operations

- [Pipeline](fenrir-ledger-team/pipeline/SKILL.md) — Full Kanban workflow orchestration
- [Git Convention](fenrir-ledger-team/git-commit/SKILL.md) — Commit format and pre-commit oaths
- [Mermaid Style Guide](fenrir-ledger-team/ux-designer/ux-assets/mermaid-style-guide.md) — Diagram conventions for all pack members

### ᛁ Templates

- [Create Product Brief](prompts/create-product-brief.md) — Prompt template for generating product briefs (ZeroForge convention)

---

## The Forge — Quick Start

```bash
# Clone the pack's work
git clone https://github.com/declanshanaghy/fenrir-ledger.git
cd fenrir-ledger

# Prepare the forge (idempotent)
./development/scripts/setup-local.sh

# Stoke the fire
cd development/src && npm run dev

# Open http://localhost:3000
```

### Sprint 1 — Forged Artifacts

**The Architecture**
- [Sprint Plan](architecture/sprint-plan.md) — 5 stories, acceptance criteria, technical notes
- [System Design](architecture/system-design.md) — Component architecture, data model, data flow diagrams
- [ADR-001: Tech Stack](architecture/adrs/ADR-001-tech-stack.md) — Why Next.js + TypeScript + Tailwind + shadcn/ui
- [ADR-002: Data Model](architecture/adrs/ADR-002-data-model.md) — Household-scoped schema from day one
- [ADR-003: Local Storage](architecture/adrs/ADR-003-local-storage.md) — localStorage for Sprint 1 + the migration path

**The Implementation**
- [Implementation Plan](development/implementation-plan.md) — Ordered task breakdown
- [QA Handoff](development/qa-handoff.md) — Files created, test focus areas, known limits
- [Setup Script](development/scripts/setup-local.sh) — Idempotent local dev setup
- [Source Code](development/src/) — Next.js project root

---

## Lineage

Fenrir Ledger was forged from [ZeroForge](https://github.com/declanshanaghy/zeroforge) — a reusable AI agent team starter kit — with structural improvements carried forward from [Vulcan Brownout](https://github.com/declanshanaghy/vulcan-brownout): explicit input/output file mappings per agent, a flat output directory structure, and the `patient-zero.md` quick-reference pattern.

*"Though it looks like silk ribbon, no chain is stronger."*
— Prose Edda, Gylfaginning

---

## The Pack's Oaths

- **Diagrams**: All Mermaid, following the [mermaid-style-guide.md](fenrir-ledger-team/ux-designer/ux-assets/mermaid-style-guide.md)
- **Commits**: Strict format per [git-commit/SKILL.md](fenrir-ledger-team/git-commit/SKILL.md)
- **Secrets**: `.env` file, never committed, `.env.example` as the template
- **Sprints**: Max 5 stories. The forge-script runs every sprint. No exceptions.
- **Output**: Each wolf writes to its top-level folder (`design/`, `architecture/`, `development/`, `quality/`). Git tracks the history — files are overwritten each sprint, no subdirectories.
