# Architecture — Fenrir Ledger

Technical architecture documents owned by FiremanDecko (Principal Engineer).

## Index

| File | Type | Status | Description |
|------|------|--------|-------------|
| [README.md](README.md) | Index | Current | This file: directory index for all architecture documents. |
| [adr-api-auth.md](adr-api-auth.md) | ADR | Accepted | ADR-008: Server-side API route authentication via Google id_token JWKS verification using the `jose` library. Updated 2026-03-07: protected routes table expanded to include all current routes (picker, all Stripe routes). |
| [adr-backend-server.md](adr-backend-server.md) | ADR | Superseded | Originally introduced a dedicated Node/TS backend server. Backend removed in favor of serverless-only. |
| [adr-clerk-auth.md](adr-clerk-auth.md) | ADR | Proposed | ADR-007: Clerk as auth platform with GitHub as initial identity provider. Deferred until GA planning. |
| [adr-openapi-spec.md](adr-openapi-spec.md) | ADR | Superseded | OpenAPI specification for the (now-removed) backend API. Backend removed; spec is no longer applicable. |
| [backend-implementation-plan.md](backend-implementation-plan.md) | Implementation Plan | Archived | Phased implementation plan for the (now-removed) backend server. Kept for historical reference. |
| [clerk-implementation-plan.md](clerk-implementation-plan.md) | Implementation Plan | Proposed (deferred) | 5-phase Clerk auth integration plan. Deferred until GA planning is triggered. |
| [route-ownership.md](route-ownership.md) | Reference | Current | Route placement table: all routes in Next.js (Vercel). Updated 2026-03-07: added `/api/config/picker`, all 5 Stripe routes, and full env var table. |
| [backend-ws-qa-report.md](backend-ws-qa-report.md) | QA Report | Archived | Loki's QA validation of the (now-removed) backend ADR and implementation plan. Kept for historical reference. |
| [clerk-auth-qa-report.md](clerk-auth-qa-report.md) | QA Report | Complete | Loki's QA validation of the Clerk ADR and implementation plan. Verdict: Approved with notes. |
| [adr-feature-flags.md](adr-feature-flags.md) | ADR | Superseded | Feature flag system for subscription platform toggle. Superseded — Patreon removed, Stripe is sole platform, `feature-flags.ts` deleted. |
| [adr-010-stripe-direct.md](adr-010-stripe-direct.md) | ADR | Accepted | ADR-010: Stripe Direct integration — Checkout, Customer Portal, webhook-driven entitlements, Vercel KV storage. Updated 2026-03-07: addendum notes Patreon removal and feature flag deletion. |

## Directory Layout

```
designs/architecture/
├── README.md                        # This index
├── adr-api-auth.md                  # ADR-008: API route auth via Google id_token (accepted)
├── adr-backend-server.md            # ADR: backend server decision (superseded)
├── adr-clerk-auth.md                # ADR-007: Clerk auth decision (proposed, deferred)
├── adr-openapi-spec.md              # ADR: OpenAPI spec for backend (superseded)
├── backend-implementation-plan.md   # Backend server implementation plan (archived)
├── backend-ws-qa-report.md          # QA report: backend/WS investigation (archived)
├── clerk-auth-qa-report.md          # QA report: Clerk auth architecture
├── clerk-implementation-plan.md     # Clerk auth implementation plan
├── route-ownership.md               # Route placement reference
├── adr-feature-flags.md             # Feature flag system (superseded)
└── adr-010-stripe-direct.md         # ADR-010: Stripe Direct integration (accepted)
```

## Key Relationships

- The backend ADR (`adr-backend-server.md`) and its OpenAPI ADR (`adr-openapi-spec.md`) are both superseded; the backend was removed in favor of serverless-only.
- `adr-api-auth.md` (ADR-008) defines the current API route auth pattern — Google id_token verification via `jose` JWKS. This is the active auth mechanism for all routes except `/api/auth/token` (exempt by design) and `/api/stripe/webhook` (secured by Stripe HMAC).
- `adr-010-stripe-direct.md` is the active subscription ADR. Patreon has been fully removed; Stripe is the sole platform. `adr-feature-flags.md` is superseded.
- The Clerk ADR (`adr-clerk-auth.md`) is the decision; `clerk-implementation-plan.md` is the execution plan. Both are deferred until GA planning is declared.
- `route-ownership.md` is the canonical route registry — documents all 9 routes (UI + API) with auth status and env vars.
- QA reports validate each ADR + plan pair before implementation begins.

## Project Structure Reference

```
development/
└── frontend/        # Next.js app (Vercel)
```

## Dev Scripts Reference

All scripts live in `.claude/scripts/`:

| Script | Purpose |
|--------|---------|
| `services.sh` | Start/stop the frontend server |
| `frontend-server.sh` | Individual frontend control |
