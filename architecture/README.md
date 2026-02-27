# Architecture — Designs Index

FiremanDecko's forge. These documents translate product vision into technical structure and implementation sequence. Read the pipeline first to understand how work flows through the team; read the brief to understand what has been built and what is planned.

- [README.md](README.md) — This index: all architecture documents and their purpose.
- [pipeline.md](pipeline.md) — Kanban workflow and model assignments for the full four-agent team pipeline.
- [implementation-brief.md](implementation-brief.md) — Integration plan for the Saga Ledger design system, covering the three-wave approach, sprint story breakdowns, and QA handoff notes.
- [system-design.md](system-design.md) — Component architecture, data flow diagrams, file structure, and dependency table reflecting the Sprint 2 delivered state.
- [sprint-plan.md](sprint-plan.md) — Rolling sprint plan: Sprint 1 and Sprint 2 completed stories, Sprint 3 and Sprint 4 upcoming stories with acceptance criteria and complexity estimates.
- [adrs/ADR-001-tech-stack.md](adrs/ADR-001-tech-stack.md) — Decision record for the Next.js + TypeScript + Tailwind CSS + shadcn/ui stack choice.
- [adrs/ADR-002-data-model.md](adrs/ADR-002-data-model.md) — Decision record establishing the household-scoped data model from Sprint 1 to avoid future breaking migrations.
- [adrs/ADR-003-local-storage.md](adrs/ADR-003-local-storage.md) — Decision record for localStorage persistence in Sprint 1 and the documented migration path to a server-side backend.
- [adrs/ADR-004-oidc-auth-and-persistence.md](adrs/ADR-004-oidc-auth-and-persistence.md) — Decision record covering Auth.js v5, JWT sessions, Supabase PostgreSQL, and multi-tenant isolation strategy (Status: Proposed — targets Sprint 3).
