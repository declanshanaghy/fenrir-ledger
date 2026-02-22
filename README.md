# 🐺 Fenrir Ledger

**Break free from fee traps. Harvest every reward. Let no chain hold.**

> *In Norse mythology, Fenrir is the great wolf who shatters the chains the gods forged to bind him. Fenrir Ledger breaks the invisible chains of forgotten annual fees, expired promotions, and wasted sign-up bonuses that silently devour your wallet.*

---

Fenrir Ledger is a credit card churn tracker for rewards optimizers. It watches over your card portfolio — every opening date, every promo deadline, every annual fee renewal — and howls before the trap snaps shut. Add your cards, set your thresholds, and Fenrir does the rest: reminding you to spend, transfer, downgrade, or close before you lose a single dollar to a fee you didn't choose to pay.

**Status**: Project initialized. Sprint 1 not started.

> ⚠️ **Git push is disabled in this environment.** Agents must commit locally only. The repo owner (Dek) handles all pushes to GitHub manually.

---

## The Pack (Team)

| Role | Agent | Model | Skill |
|------|-------|-------|-------|
| Product Owner | Freya | Opus | [SKILL](fenrir-ledger-team/product-owner/SKILL.md) |
| UX Designer | Luna | Sonnet | [SKILL](fenrir-ledger-team/ux-designer/SKILL.md) |
| Architect | FiremanDecko | Opus | [SKILL](fenrir-ledger-team/architect/SKILL.md) |
| Lead Developer | ArsonWells | Sonnet | [SKILL](fenrir-ledger-team/lead-dev/SKILL.md) |
| QA Tester | Loki | Sonnet | [SKILL](fenrir-ledger-team/qa-tester/SKILL.md) |

## Workflow

PO + UX Designer → Design Brief → Architect → System Design + API Contracts → Lead Dev → Implementation → QA Tester → Acceptance. Kanban method. Max 5 stories/sprint. Deployment story mandatory every sprint.

---

## Key Docs

### 🗺️ Project Foundation
- [Product Brief](product-brief.md) — What we're building, why, for whom, and the prioritized backlog
- [Patient Zero](patient-zero.md) — Team composition, pipeline summary, and quick-reference setup

### 🎨 Design (Freya + Luna output)
- `design/product-design-brief.md` — Problem statement, user flows, visual direction, acceptance criteria *(not yet created)*
- `design/wireframes.md` — UI wireframes and layout specs *(not yet created)*
- `design/interactions.md` — Interaction patterns and state transitions *(not yet created)*

### 🏗️ Architecture (FiremanDecko output)
- `architecture/system-design.md` — Component architecture, data model, tech stack decisions *(not yet created)*
- `architecture/api-contracts.md` — API surface, data shapes, endpoint specs *(not yet created)*
- `architecture/sprint-plan.md` — Current sprint stories with technical notes *(not yet created)*
- `architecture/delegation-brief.md` — Handoff spec for the Lead Developer *(not yet created)*
- `architecture/adrs/` — Architecture Decision Records (accumulate across sprints) *(not yet created)*

### ⚡ Development (ArsonWells output)
- `development/src/` — Source code *(not yet created)*
- `development/implementation-plan.md` — What was built and how *(not yet created)*
- `development/qa-handoff.md` — Handoff notes for QA: what to deploy, what to test *(not yet created)*
- `development/scripts/` — Build and deploy scripts *(not yet created)*

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

## Lineage

Fenrir Ledger was forged from [ZeroForge](https://github.com/declanshanaghy/zeroforge) — a reusable AI agent team starter kit — with structural improvements carried forward from [Vulcan Brownout](https://github.com/declanshanaghy/vulcan-brownout), including explicit input/output file mappings per agent, a flat output directory structure (no sprint subdirectories), and the `patient-zero.md` quick-reference pattern.

---

## Conventions

* **Diagrams**: All Mermaid, following the [mermaid-style-guide.md](fenrir-ledger-team/ux-designer/ux-assets/mermaid-style-guide.md)
* **Commits**: Strict format per [git-commit/SKILL.md](fenrir-ledger-team/git-commit/SKILL.md)
* **Secrets**: `.env` file, never committed, `.env.example` as template
* **Sprints**: Max 5 stories, idempotent deployment scripts every sprint
* **Output structure**: Each role writes to its top-level folder (`design/`, `architecture/`, `development/`, `quality/`). Git tracks history — files are overwritten each sprint, no sprint subdirectories.
