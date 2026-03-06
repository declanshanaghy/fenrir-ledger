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

## ADRs (designs/architecture/)

Post-Sprint 5 ADRs and implementation plans live in the shared designs directory:

- [../designs/architecture/adr-api-auth.md](../designs/architecture/adr-api-auth.md) -- ADR-008: Server-side API route auth via Google id_token JWKS verification. **Accepted, current.**
- [../designs/architecture/adr-010-stripe-direct.md](../designs/architecture/adr-010-stripe-direct.md) -- ADR-010: Stripe Direct integration (Checkout, Customer Portal, webhook-driven entitlements). **Accepted, current.**
- [../designs/architecture/adr-clerk-auth.md](../designs/architecture/adr-clerk-auth.md) -- ADR-007: Clerk as auth platform. **Proposed, deferred to GA.**
- [../designs/architecture/adr-feature-flags.md](../designs/architecture/adr-feature-flags.md) -- Feature flag system for subscription platform toggle. **Superseded** (Patreon removed, Stripe is sole platform).
- [../designs/architecture/adr-backend-server.md](../designs/architecture/adr-backend-server.md) -- Backend server decision. **Superseded** (backend removed, fully serverless).
- [../designs/architecture/adr-openapi-spec.md](../designs/architecture/adr-openapi-spec.md) -- OpenAPI spec for backend API. **Superseded** (backend removed).

## See Also

- [../designs/architecture/README.md](../designs/architecture/README.md) -- Full index of `designs/architecture/` including implementation plans and QA reports.
