# QA Handoff: Remove Fly.io Backend -- Serverless-Only

**Branch:** `chore/remove-fly-io`
**Date:** 2026-03-01
**Author:** FiremanDecko (Principal Engineer)

---

## What Was Done

Removed the dedicated Node/TS backend server (`development/backend/`) and all
WebSocket import infrastructure. The Google Sheets import pipeline now runs
exclusively as a Vercel serverless function via the Next.js API route
`/api/sheets/import`.

---

## Files Deleted

| Path | Description |
|------|-------------|
| `development/backend/` (entire directory) | Hono v4 backend server, Dockerfile, fly.toml, WebSocket handlers, import routes, LLM providers, schemas, config |
| `.claude/scripts/backend-server.sh` | Backend server lifecycle management script |

## Files Modified

| Path | Change |
|------|--------|
| `development/frontend/src/hooks/useSheetImport.ts` | Removed all WebSocket logic. Now a simple HTTP-only hook. |
| `development/frontend/src/components/sheets/ImportWizard.tsx` | Removed ImportPhase import, PHASE_LABELS map. Loading step now shows static text. |
| `development/frontend/src/app/api/sheets/import/route.ts` | Removed IMPORT_MODE/BACKEND_URL. Route now only calls importFromSheet() directly. |
| `development/frontend/.env.example` | Removed BACKEND_URL, NEXT_PUBLIC_BACKEND_WS_URL, and IMPORT_MODE variables. |
| `development/frontend/src/lib/sheets/import-pipeline.ts` | Updated comment. |
| `.claude/scripts/services.sh` | Removed all backend logic. Now frontend-only wrapper. |
| `.claude/commands/dev-server.md` | Removed backend references. |
| `designs/architecture/adr-backend-server.md` | Added "Superseded" addendum. |
| `designs/architecture/route-ownership.md` | Rewritten: all routes now under "Next.js (Vercel)". |
| `designs/architecture/README.md` | Updated index. |
| `designs/architecture/backend-implementation-plan.md` | Added archived notice. |
| `designs/architecture/backend-ws-qa-report.md` | Added archived notice. |
| `README.md` | Updated project description and quick-start. |

---

## Breaking Changes

| Change | Impact |
|--------|--------|
| WebSocket import removed | Import no longer streams phase-by-phase progress. |
| `IMPORT_MODE=backend` no longer supported | The API route always runs the pipeline inline. |
| `backend-server.sh` deleted | Use `frontend-server.sh` or `services.sh` instead. |
| `ImportPhase` type removed | Any code importing it will fail to compile. |
| `importPhase` removed from hook return | Any component reading it will fail to compile. |

---

## What Was NOT Changed

- Import pipeline (`import-pipeline.ts`) -- untouched
- Auth system -- untouched
- Card types, storage, card-utils -- untouched
- Frontend-server.sh -- untouched
