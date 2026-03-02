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
| `development/frontend/src/hooks/useSheetImport.ts` | Removed all WebSocket logic (submitViaWebSocket, checkBackendHealth, closeWebSocket, ServerMessage, ImportPhase type, WS refs/constants). Now a simple HTTP-only hook. |
| `development/frontend/src/components/sheets/ImportWizard.tsx` | Removed ImportPhase import, PHASE_LABELS map, importPhase destructuring. Loading step now shows static "Reading the runes..." text. |
| `development/frontend/src/app/api/sheets/import/route.ts` | Removed IMPORT_MODE/BACKEND_URL env vars and backend proxy branch. Route now only calls importFromSheet() directly. |
| `development/frontend/.env.example` | Removed BACKEND_URL, NEXT_PUBLIC_BACKEND_WS_URL, and IMPORT_MODE variables. |
| `development/frontend/src/lib/sheets/import-pipeline.ts` | Updated comment (removed IMPORT_MODE reference). |
| `.claude/scripts/services.sh` | Removed all backend start/stop/restart logic. Now frontend-only wrapper. |
| `.claude/commands/dev-server.md` | Removed backend references, updated to frontend-only documentation. |
| `designs/architecture/adr-backend-server.md` | Added "Superseded" addendum at top explaining the backend removal. |
| `designs/architecture/route-ownership.md` | Rewritten: all routes now under "Next.js (Vercel)". Removed Backend (Fly.io) routes and env vars. |
| `designs/architecture/README.md` | Updated index: backend ADR marked "Superseded", implementation plan and QA report marked "Archived". Removed backend from project structure and dev scripts tables. |
| `designs/architecture/backend-implementation-plan.md` | Added archived notice at top. |
| `designs/architecture/backend-ws-qa-report.md` | Added archived notice at top. |
| `README.md` | Updated project description and quick-start to remove backend references. |

---

## How to Verify

### 1. Build and Type Check

```bash
cd development/frontend
npm run build          # Must pass (verified: all 11 routes compiled)
./node_modules/.bin/tsc --noEmit   # Must pass (verified: zero errors)
```

### 2. Import Still Works via HTTP

1. Start the frontend dev server: `.claude/scripts/frontend-server.sh start`
2. Sign in with Google OAuth
3. Open the Import Wizard (Import from Google Sheets button)
4. Paste a valid public Google Sheets URL
5. Confirm the import completes via HTTP (no WebSocket connection attempted)
6. Verify imported cards appear in the dashboard

### 3. No Backend Required

1. Confirm no process is listening on port 9753
2. Confirm `development/backend/` directory does not exist
3. Confirm `.claude/scripts/backend-server.sh` does not exist
4. Run `.claude/scripts/services.sh status` -- should only show frontend status

### 4. Environment Variables

1. Confirm `.env.example` has no `BACKEND_URL`, `NEXT_PUBLIC_BACKEND_WS_URL`, or `IMPORT_MODE`
2. If `.env.local` exists, the removed vars are harmless (unused) but can be cleaned up

---

## Breaking Changes

| Change | Impact |
|--------|--------|
| WebSocket import removed | Import no longer streams phase-by-phase progress. Loading state shows a single "Reading the runes..." message instead. |
| `IMPORT_MODE=backend` no longer supported | The API route always runs the pipeline inline. Setting this env var has no effect. |
| `backend-server.sh` deleted | Any scripts or automation referencing this file will break. Use `frontend-server.sh` or `services.sh` instead. |
| `ImportPhase` type removed from `useSheetImport` | Any code importing `ImportPhase` from `@/hooks/useSheetImport` will fail to compile. |
| `importPhase` removed from `UseSheetImportReturn` | Any component reading `importPhase` from the hook will fail to compile. |

---

## What Was NOT Changed

- Import pipeline (`import-pipeline.ts`) -- untouched
- Auth system (OAuth, requireAuth, session) -- untouched
- Card types, storage, card-utils -- untouched
- All other components -- untouched
- Frontend-server.sh -- untouched (works standalone)
