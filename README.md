# 🐺 Fenrir Ledger

**Break free from fee traps. Harvest every reward. Let no chain hold.**

> *In Norse mythology, Fenrir is the great wolf who shatters the chains the gods forged to bind him. Fenrir Ledger breaks the invisible chains of forgotten annual fees, expired promotions, and wasted sign-up bonuses that silently devour your wallet.*

---

Fenrir Ledger is a credit card churn tracker for rewards optimizers. It watches over your card portfolio — every opening date, every promo deadline, every annual fee renewal — and howls before the trap snaps shut. Add your cards, set your thresholds, and Fenrir does the rest: reminding you to spend, transfer, downgrade, or close before you lose a single dollar to a fee you didn't choose to pay.

**Status**: Sprint 1 complete. Running locally.

---

## The Pack (Team)

| Role | Agent | Model | Skill |
|------|-------|-------|-------|
| Product Owner | Freya | Sonnet | [SKILL](fenrir-ledger-team/product-owner/SKILL.md) |
| UX Designer | Luna | Sonnet | [SKILL](fenrir-ledger-team/ux-designer/SKILL.md) |
| Principal Engineer | FiremanDecko | Sonnet | [SKILL](fenrir-ledger-team/principal-engineer/SKILL.md) |
| QA Tester | Loki | Haiku | [SKILL](fenrir-ledger-team/qa-tester/SKILL.md) |

## Workflow

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

Kanban method · Max 5 stories/sprint · Deployment story mandatory every sprint

---

## Key Docs

### 🗺️ Project Foundation
- [Product Brief](product-brief.md) — What we're building, why, for whom, and the prioritized backlog
- [Patient Zero](patient-zero.md) — Team composition, pipeline summary, and quick-reference setup

### 🎨 Design (Freya + Luna output)
- `design/product-design-brief.md` — Problem statement, user flows, visual direction, acceptance criteria *(not yet created)*
- `design/wireframes.md` — UI wireframes and layout specs *(not yet created)*
- `design/interactions.md` — Interaction patterns and state transitions *(not yet created)*

### 🏗️ Architecture + Development (FiremanDecko output)
- [architecture/system-design.md](architecture/system-design.md) — Component architecture, data model, tech stack decisions
- `architecture/api-contracts.md` — API surface, data shapes, endpoint specs *(future sprint)*
- [architecture/sprint-plan.md](architecture/sprint-plan.md) — Current sprint stories with technical notes
- [architecture/adrs/](architecture/adrs/) — Architecture Decision Records (ADR-001, ADR-002, ADR-003)
- [development/src/](development/src/) — Next.js source code
- [development/implementation-plan.md](development/implementation-plan.md) — What was built and how
- [development/qa-handoff.md](development/qa-handoff.md) — Handoff notes for QA: what to deploy, what to test
- [development/scripts/](development/scripts/) — Build and deploy scripts

### 🎭 Quality (Loki output)
- `quality/test-plan.md` — Test strategy and coverage plan *(not yet created)*
- `quality/test-cases.md` — Detailed test cases against acceptance criteria *(not yet created)*
- `quality/quality-report.md` — Ship / No Ship recommendation *(not yet created)*
- `quality/scripts/` — Idempotent deploy and test scripts *(not yet created)*

### 🔧 Team Operations
- [Pipeline](fenrir-ledger-team/pipeline/SKILL.md) — Full Kanban workflow orchestration
- [Git Convention](fenrir-ledger-team/git-commit/SKILL.md) — Commit message format and pre-commit checklist
- [Mermaid Style Guide](fenrir-ledger-team/ux-designer/ux-assets/mermaid-style-guide.md) — Diagram conventions for all team members

### 📋 Templates
- [Create Product Brief](prompts/create-product-brief.md) — Prompt template for generating product briefs (ZeroForge convention)

---

## FiremanDecko — Principal Engineer (Sprint 1)

### Quick Start

```bash
# 1. Clone and set up
git clone https://github.com/declanshanaghy/fenrir-ledger.git
cd fenrir-ledger
./development/scripts/setup-local.sh

# 2. Start the dev server
cd development/src && npm run dev

# 3. Open http://localhost:3000
```

### Sprint 1 Artifacts

**Architecture**
- [Sprint Plan](architecture/sprint-plan.md) — 5 stories with acceptance criteria and technical notes
- [System Design](architecture/system-design.md) — Component architecture, data model, data flow diagrams
- [ADR-001: Tech Stack](architecture/adrs/ADR-001-tech-stack.md) — Next.js + TypeScript + Tailwind + shadcn/ui decision
- [ADR-002: Data Model](architecture/adrs/ADR-002-data-model.md) — Household-scoped schema from day one
- [ADR-003: Local Storage](architecture/adrs/ADR-003-local-storage.md) — localStorage for Sprint 1 + migration path

**Implementation**
- [Implementation Plan](development/implementation-plan.md) — Ordered task breakdown
- [QA Handoff](development/qa-handoff.md) — Files created, test focus areas, known limitations
- [Setup Script](development/scripts/setup-local.sh) — Idempotent local dev setup
- [Source Code](development/src/) — Next.js project root (all Next.js files live here)

---

## Lineage

Fenrir Ledger was forged from [ZeroForge](https://github.com/declanshanaghy/zeroforge) — a reusable AI agent team starter kit — with structural improvements carried forward from [Vulcan Brownout](https://github.com/declanshanaghy/vulcan-brownout), including explicit input/output file mappings per agent, a flat output directory structure (no sprint subdirectories), and the `patient-zero.md` quick-reference pattern.

---

## Conventions

* **Diagrams**: All Mermaid, following the [mermaid-style-guide.md](fenrir-ledger-team/ux-designer/ux-assets/mermaid-style-guide.md)
* **Commits**: Strict format per [git-commit/SKILL.md](fenrir-ledger-team/git-commit/SKILL.md)
* **Secrets**: `.env` file, never committed, `.env.example` as template
* **Sprints**: Max 5 stories, idempotent deployment scripts every sprint
* **Output structure**: Each role writes to its top-level folder (`design/`, `architecture/`, `development/`, `quality/`). Git tracks history — files are overwritten each sprint, no sprint subdirectories.
