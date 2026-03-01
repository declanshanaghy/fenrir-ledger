# QA Handoff -- Frontend WebSocket Import (Story 4)

**From**: FiremanDecko (Principal Engineer)
**To**: Loki (QA Tester)
**Branch**: `feat/frontend-ws-import`
**Date**: 2026-03-01

---

## What Was Implemented

### Frontend WebSocket Import Progress

The Google Sheets import wizard now supports real-time phase progress via WebSocket when the backend import service (port 9753) is available. If the backend is unavailable, it silently falls back to the existing HTTP `/api/sheets/import` endpoint.

**Key behaviors:**

1. On submit, the hook probes `GET /health` on the backend (2s timeout).
2. If healthy: opens a WebSocket connection, sends `import_start`, and listens for phase/complete/error messages.
3. If unhealthy or WS fails to open: falls back to existing HTTP POST logic.
4. Cancel button sends `import_cancel` over WebSocket before closing the connection.
5. Loading step shows dynamic Norse-flavored phase labels based on backend progress.

---

## Files Created / Modified

| File | Change |
|------|--------|
| `development/src/src/hooks/useSheetImport.ts` | Added WebSocket import path with health-check fallback, `importPhase` state, `ImportPhase` type export, `ServerMessage` interface, `checkBackendHealth()`, `submitViaWebSocket()`, `submitViaHttp()` (extracted from old `submit`), cancel sends `import_cancel` over WS |
| `development/src/src/components/sheets/ImportWizard.tsx` | Added `ImportPhase` type import, `PHASE_LABELS` map, destructured `importPhase` from hook, dynamic loading text based on phase |
| `development/src/.env.example` | Added `NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:9753` |
| `development/qa-handoff.md` | This file |

---

## How to Test

### Prerequisites

- `npm install` in `development/src/`
- Copy `.env.example` to `.env.local` and fill in required values

### Test 1: HTTP Fallback (No Backend Running)

1. Make sure no process is listening on port 9753.
2. Start the Next.js dev server: `npm run dev` in `development/src/`.
3. Open the import wizard (Google Sheets import).
4. Paste a valid Google Sheets URL and click Import.
5. **Expected**: The loading step shows "Reading the runes from your spreadsheet..." (the default/fallback text). After a brief health check delay (~2s), the import proceeds via the HTTP API route as before.
6. The import should complete (preview step) or error (error step) normally.

### Test 2: Cancel During HTTP Fallback

1. Same setup as Test 1 (no backend on 9753).
2. Start an import and immediately click Cancel.
3. **Expected**: Import is aborted, wizard returns to entry step. No errors.

### Test 3: WebSocket Happy Path (Backend Running)

1. Start the backend WebSocket service on port 9753 (from PR #41).
2. Start the Next.js dev server.
3. Open the import wizard and submit a valid Google Sheets URL.
4. **Expected**:
   - Loading text changes through phases:
     - "Connecting to the forge..."
     - "Fetching the sacred scrolls..."
     - "The runes are being deciphered..."
     - "Validating the inscriptions..."
   - On completion, the preview step shows extracted cards.

### Test 4: WebSocket Cancel

1. Backend running on 9753.
2. Start an import, then click Cancel while loading.
3. **Expected**: `import_cancel` message sent over WS (visible in backend logs), connection closed, wizard returns to entry step.

### Test 5: WebSocket Error from Backend

1. Backend running, but configure it to return an `import_error` message (e.g., invalid sheet URL).
2. **Expected**: Error step shown with appropriate error code and message.

### Test 6: Backend Goes Down Mid-Import

1. Start the backend, begin an import.
2. Kill the backend process while the import is in progress.
3. **Expected**: After the 20s timeout, the wizard shows an error or returns to entry. No crash.

### Test 7: TypeScript and Build

```bash
cd development/src
npx -p typescript tsc --noEmit   # Should pass
npm run build                     # Should pass
```

---

## Env Var Reference

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_BACKEND_WS_URL` | WebSocket URL for backend import service | `ws://localhost:9753` |

The HTTP health-check URL is derived automatically by replacing the `ws://` protocol with `http://`.

---

## Known Limitations

- `import_progress` messages (rowsExtracted/totalRows) are received but not displayed in the UI. A progress bar could be added in a future sprint.
- The `warning` field from the HTTP response is supported, but the WebSocket `import_complete` message does not carry a `warning` field per the current backend spec.
- WebSocket reconnection is not implemented -- if the connection drops, the user must retry manually.
