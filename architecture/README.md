# Architecture -- FiremanDecko's Forge

Technical architecture documents. These translate product vision into technical structure and implementation sequence. Read the pipeline first to understand how work flows through the team; read the system design to understand what has been built.

## Core Documents

- [README.md](README.md) -- This index.
- [pipeline.md](pipeline.md) -- Kanban workflow, agent chains, automated orchestration (GKE remote execution, `/fire-next-up`, `/plan-w-team`).
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
- [adrs/ADR-007-remote-builder-platforms.md](adrs/ADR-007-remote-builder-platforms.md) -- Remote builder platform evaluation: Depot was initially selected but **superseded by infrastructure ADR-004** (GKE Autopilot Jobs chosen for agent execution). **Accepted, superseded.**

## ADRs (Post-Sprint 5)

- [adrs/ADR-008-api-auth.md](adrs/ADR-008-api-auth.md) -- ADR-008: Server-side API route auth via Google id_token JWKS verification. **Accepted, current.**
- [adrs/ADR-010-stripe-direct.md](adrs/ADR-010-stripe-direct.md) -- ADR-010: Stripe Direct integration (Checkout, Customer Portal, webhook-driven entitlements). **Accepted, current.**
- [adrs/ADR-011-feature-flags.md](adrs/ADR-011-feature-flags.md) -- Feature flag system for subscription platform toggle. **Superseded** (Patreon removed, Stripe is sole platform).
- [adrs/ADR-013-agent-monitor-spa.md](adrs/ADR-013-agent-monitor-spa.md) -- ADR-013: Agent Monitor single-file SPA for real-time GKE agent log streaming. **Accepted, current.**
- [adrs/ADR-014-firestore-cloud-sync.md](adrs/ADR-014-firestore-cloud-sync.md) -- ADR-014: Firestore for Karl-tier cloud sync of card data. **Accepted, current.**
- [adrs/ADR-015-authz-layer.md](adrs/ADR-015-authz-layer.md) -- ADR-015: Centralized `requireAuthz()` authorization layer for household-scoped routes. **Accepted, current.**

## Other Architecture Documents

- [n8n-reddit-automation.md](n8n-reddit-automation.md) -- n8n Reddit automation workflows technical research.
- [umami-api-integration.md](umami-api-integration.md) -- Umami analytics API research, n8n workflow design, PostgreSQL schema for the marketing metrics loop (issue #1180).
- [route-ownership.md](route-ownership.md) -- Route placement table: all routes in Next.js on GKE Autopilot.
