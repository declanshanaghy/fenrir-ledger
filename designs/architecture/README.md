# Architecture — Fenrir Ledger

Technical architecture documents owned by FiremanDecko (Principal Engineer).

## Index

| File | Type | Status | Description |
|------|------|--------|-------------|
| [adr-backend-server.md](adr-backend-server.md) | ADR | Superseded | Originally introduced a dedicated Node/TS backend server. Backend removed in favor of serverless-only (see addendum at top of file). |
| [adr-clerk-auth.md](adr-clerk-auth.md) | ADR | Proposed | Clerk as auth platform with GitHub as initial identity provider. Deferred until GA planning. |
| [backend-implementation-plan.md](backend-implementation-plan.md) | Implementation Plan | Archived | Phased implementation plan for the (now-removed) backend server. Kept for historical reference. |
| [clerk-implementation-plan.md](clerk-implementation-plan.md) | Implementation Plan | Proposed (deferred) | 5-phase Clerk auth integration plan. Deferred until GA planning is triggered. |
| [route-ownership.md](route-ownership.md) | Reference | Current | Route placement table: all routes now live in Next.js (Vercel). |
| [backend-ws-qa-report.md](backend-ws-qa-report.md) | QA Report | Archived | Loki's QA validation of the (now-removed) backend ADR and implementation plan. Kept for historical reference. |
| [clerk-auth-qa-report.md](clerk-auth-qa-report.md) | QA Report | Complete | Loki's QA validation of the Clerk ADR and implementation plan. Verdict: Approved with notes. |

## Directory Layout

```
designs/architecture/
├── README.md                        # This index
├── adr-backend-server.md            # ADR: backend server decision (superseded)
├── adr-clerk-auth.md                # ADR: Clerk auth decision
├── backend-implementation-plan.md   # Backend server implementation plan (archived)
├── backend-ws-qa-report.md          # QA report: backend/WS investigation (archived)
├── clerk-auth-qa-report.md          # QA report: Clerk auth architecture
├── clerk-implementation-plan.md     # Clerk auth implementation plan
└── route-ownership.md               # Route placement reference
```

## Key Relationships

- The backend ADR (`adr-backend-server.md`) has been superseded; the backend was removed in favor of serverless-only.
- The Clerk ADR (`adr-clerk-auth.md`) is the decision; `clerk-implementation-plan.md` is the execution plan.
- `route-ownership.md` documents all routes, now exclusively in Next.js (Vercel).
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
