# Architecture -- FiremanDecko's Forge

Technical architecture documents. These translate product vision into technical structure and implementation sequence. Read the pipeline first to understand how work flows through the team; read the system design to understand what has been built.

## Core Documents

- [README.md](README.md) -- This index.
- [pipeline.md](pipeline.md) -- Kanban workflow, agent chains, automated orchestration (Depot remote builders, `/fire-next-up`, `/plan-w-team`).
- [system-design.md](system-design.md) -- Component architecture, data flow diagrams, file structure, and dependency table reflecting the current delivered state (through Stripe Direct integration).
- [implementation-brief.md](implementation-brief.md) -- Historical integration plan for the Saga Ledger design system: three-wave approach, sprint story breakdowns, and QA handoff notes.

## ADRs (architecture/adrs/)

These are the Sprint 1-3 ADRs:

- [adrs/ADR-001-tech-stack.md](adrs/ADR-001-tech-stack.md) -- Next.js + TypeScript + Tailwind CSS + shadcn/ui stack choice. **Accepted.**
- [adrs/ADR-002-data-model.md](adrs/ADR-002-data-model.md) -- Household-scoped data model. **Accepted.**
- [adrs/ADR-003-local-storage.md](adrs/ADR-003-local-storage.md) -- localStorage persistence with documented migration path. **Accepted.**
- [adrs/ADR-004-oidc-auth-localStorage.md](adrs/ADR-004-oidc-auth-localStorage.md) -- OIDC auth with per-household localStorage namespacing. **Accepted, superseded by ADR-005.**
- [adrs/ADR-005-auth-pkce-public-client.md](adrs/ADR-005-auth-pkce-public-client.md) -- Authorization Code + PKCE flow with server token proxy. **Accepted.**
- [adrs/ADR-006-anonymous-first-auth.md](adrs/ADR-006-anonymous-first-auth.md) -- Anonymous-first auth model with optional Google sign-in. **Accepted, current.**
- [adrs/ADR-007-remote-builder-platforms.md](adrs/ADR-007-remote-builder-platforms.md) -- Remote builder platform evaluation: Depot selected for agent chain execution. **Accepted, current.**

## ADRs (Post-Sprint 5)

- [adrs/ADR-008-api-auth.md](adrs/ADR-008-api-auth.md) -- ADR-008: Server-side API route auth via Google id_token JWKS verification. **Accepted, current.**
- [adrs/ADR-009-clerk-auth.md](adrs/ADR-009-clerk-auth.md) -- ADR-009: Clerk as auth platform. **Proposed, deferred to GA.**
- [adrs/ADR-010-stripe-direct.md](adrs/ADR-010-stripe-direct.md) -- ADR-010: Stripe Direct integration (Checkout, Customer Portal, webhook-driven entitlements). **Accepted, current.**
- [adrs/ADR-011-feature-flags.md](adrs/ADR-011-feature-flags.md) -- Feature flag system for subscription platform toggle. **Superseded** (Patreon removed, Stripe is sole platform).

## Other Architecture Documents

- [clerk-implementation-plan.md](clerk-implementation-plan.md) -- 5-phase Clerk auth integration plan. Deferred until GA planning.
- [clerk-auth-qa-report.md](clerk-auth-qa-report.md) -- Loki's QA validation of the Clerk ADR and implementation plan.
- [n8n-reddit-automation.md](n8n-reddit-automation.md) -- n8n Reddit automation workflows technical research.
- [umami-api-integration.md](umami-api-integration.md) -- Umami analytics API research, n8n workflow design, PostgreSQL schema for the marketing metrics loop (issue #1180).
- [route-ownership.md](route-ownership.md) -- Route placement table: all routes in Next.js (Vercel).
