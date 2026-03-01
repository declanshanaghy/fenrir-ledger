# Architecture — Fenrir Ledger

Technical architecture documents owned by FiremanDecko (Principal Engineer).

## Index

| File | Type | Status | Description |
|------|------|--------|-------------|
| [adr-backend-server.md](adr-backend-server.md) | ADR | Accepted | Introduce a dedicated Node/TS backend server (Hono + ws) alongside the Next.js frontend. Covers 5 options evaluated, Fly.io hosting recommendation, and phased rollout. |
| [adr-clerk-auth.md](adr-clerk-auth.md) | ADR | Proposed | Clerk as auth platform with GitHub as initial identity provider. Deferred until GA planning. |
| [backend-implementation-plan.md](backend-implementation-plan.md) | Implementation Plan | Accepted (Phase 1+2 shipped) | Phased implementation plan for the backend server: scaffold, WebSocket import streaming, route split, and GA sync. |
| [clerk-implementation-plan.md](clerk-implementation-plan.md) | Implementation Plan | Proposed (deferred) | 5-phase Clerk auth integration plan. Deferred until GA planning is triggered. |
| [route-ownership.md](route-ownership.md) | Reference | Current | Route placement table: which routes live in Next.js vs. the backend, and why. |
| [backend-ws-qa-report.md](backend-ws-qa-report.md) | QA Report | Complete | Loki's QA validation of the backend ADR and implementation plan. Verdict: Approved. |
| [clerk-auth-qa-report.md](clerk-auth-qa-report.md) | QA Report | Complete | Loki's QA validation of the Clerk ADR and implementation plan. Verdict: Approved with notes. |

## Directory Layout

```
designs/architecture/
├── README.md                        # This index
├── adr-backend-server.md            # ADR: backend server decision
├── adr-clerk-auth.md                # ADR: Clerk auth decision
├── backend-implementation-plan.md   # Backend server implementation plan
├── backend-ws-qa-report.md          # QA report: backend/WS investigation
├── clerk-auth-qa-report.md          # QA report: Clerk auth architecture
├── clerk-implementation-plan.md     # Clerk auth implementation plan
└── route-ownership.md               # Route placement reference
```

## Key Relationships

- The backend ADR (`adr-backend-server.md`) is the decision; `backend-implementation-plan.md` is the execution plan.
- The Clerk ADR (`adr-clerk-auth.md`) is the decision; `clerk-implementation-plan.md` is the execution plan.
- `route-ownership.md` documents the outcome of Phase 3 (route split stabilization) from the backend plan.
- QA reports validate each ADR + plan pair before implementation begins.

## Project Structure Reference

```
development/
├── frontend/        # Next.js app (Vercel) -- renamed from src/ in PR #44
└── backend/         # Node/TS server (Fly.io) -- Hono v4 + ws v8
```

## Dev Scripts Reference

All scripts live in `.claude/scripts/`:

| Script | Purpose |
|--------|---------|
| `services.sh` | Start/stop both frontend + backend together |
| `frontend-server.sh` | Individual frontend control (renamed from `dev-server.sh` in PR #45) |
| `backend-server.sh` | Individual backend control |
