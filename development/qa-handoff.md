# QA Handoff: Backend Server with WebSocket Import Pipeline

**Date:** 2026-03-01
**Author:** FiremanDecko (Principal Engineer)
**Branch:** `feat/backend-ws-pipeline`
**Stories:** Backend Stories 1-3 (Scaffold + WebSocket + Import Pipeline)

---

## What Was Built

### Story 1 — Backend Scaffold (`development/backend/`)
A new standalone Node.js + TypeScript backend server using Hono as the HTTP framework. Runs independently from the Next.js frontend on port 9753.

- `package.json` — Project manifest with Hono, ws, @anthropic-ai/sdk, zod dependencies
- `tsconfig.json` — ES2022 target, NodeNext module resolution, strict mode
- `.env.example` — Template for ANTHROPIC_API_KEY, FENRIR_BACKEND_PORT, NODE_ENV
- `.gitignore` — Excludes .env, node_modules/, dist/, logs/
- `fly.toml` — Fly.io deployment configuration
- `src/config.ts` — Environment variable resolution; assertConfig() for lazy API key validation
- `src/routes/health.ts` — GET /health liveness probe
- `src/index.ts` — Hono app entry point with logger, CORS, health route, import route, WebSocket

### Story 2 — WebSocket Server + Types
WebSocket server attached to the same HTTP server for duplex communication during imports.

- `src/types/messages.ts` — ClientMessage, ServerMessage, ImportErrorCode, ImportedCard types
- `src/ws/server.ts` — WebSocketServer creation and connection lifecycle management
- `src/ws/handlers/import.ts` — WebSocket import handler with cancellation support

### Story 3 — Backend Import Pipeline
Full port of the Google Sheets import pipeline from Next.js to the backend.

- `src/lib/sheets/parse-url.ts` — extractSheetId and buildCsvExportUrl (ported from frontend)
- `src/lib/sheets/prompt.ts` — buildExtractionPrompt with inlined KNOWN_ISSUERS array
- `src/lib/sheets/fetch-csv.ts` — CSV fetch with error handling (403/404, empty body, truncation)
- `src/lib/anthropic/extract.ts` — Anthropic Claude Haiku call with single retry
- `src/routes/import.ts` — HTTP POST /import endpoint for non-WebSocket clients

---

## How to Test

### Prerequisites
- Node.js 20+
- An `ANTHROPIC_API_KEY` in `development/backend/.env` (copy from `.env.example`)

### Start the Server

```bash
# Option A: Use the backend-server.sh script
.claude/scripts/backend-server.sh start

# Option B: Direct npm run
cd development/backend
npm install
npm run dev
```

### Test 1: Health Endpoint

```bash
curl http://localhost:9753/health
```

**Expected response:**
```json
{"status":"ok","service":"fenrir-ledger-backend","ts":"2026-03-01T...Z"}
```

### Test 2: HTTP Import (requires ANTHROPIC_API_KEY)

```bash
curl -X POST http://localhost:9753/import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://docs.google.com/spreadsheets/d/YOUR_PUBLIC_SHEET_ID/edit"}'
```

**Expected:** JSON response with `{ cards: [...] }` or `{ error: { code, message } }`.

### Test 3: HTTP Import Error Cases

```bash
# Invalid URL
curl -X POST http://localhost:9753/import \
  -H "Content-Type: application/json" \
  -d '{"url":"not-a-url"}'
# Expected: {"error":{"code":"INVALID_URL",...}}

# Missing URL
curl -X POST http://localhost:9753/import \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: {"error":{"code":"INVALID_URL",...}}

# Invalid JSON
curl -X POST http://localhost:9753/import \
  -H "Content-Type: application/json" \
  -d 'not json'
# Expected: {"error":{"code":"INVALID_URL","message":"Invalid JSON body."}}
```

### Test 4: WebSocket Import

Use `wscat` or any WebSocket client:

```bash
npx wscat -c ws://localhost:9753
```

Then send:
```json
{"type":"import_start","payload":{"url":"https://docs.google.com/spreadsheets/d/YOUR_PUBLIC_SHEET_ID/edit"}}
```

**Expected messages (in order):**
1. `{"type":"import_phase","phase":"fetching_sheet"}`
2. `{"type":"import_phase","phase":"extracting"}`
3. `{"type":"import_phase","phase":"validating"}`
4. `{"type":"import_phase","phase":"done"}`
5. `{"type":"import_complete","cards":[...]}`

### Test 5: WebSocket Cancellation

Send `import_start`, then immediately send:
```json
{"type":"import_cancel"}
```

**Expected:** The pipeline stops at the next checkpoint. No `import_complete` event is sent.

### Test 6: TypeScript Type Check

```bash
cd development/backend && npm run typecheck
```

**Expected:** Exit code 0, no errors.

### Test 7: Backend Server Script

```bash
.claude/scripts/backend-server.sh start
.claude/scripts/backend-server.sh status   # Should say "Running"
.claude/scripts/backend-server.sh start    # Should say "Already running" (idempotent)
.claude/scripts/backend-server.sh stop
.claude/scripts/backend-server.sh status   # Should say "Not running"
```

---

## Files Changed

### New Files (16)

| File | Description |
|------|-------------|
| `development/backend/package.json` | Backend project manifest |
| `development/backend/tsconfig.json` | TypeScript configuration |
| `development/backend/.env.example` | Environment variable template |
| `development/backend/.gitignore` | Git ignore rules for backend |
| `development/backend/fly.toml` | Fly.io deployment config |
| `development/backend/src/index.ts` | Server entry point (Hono + WS) |
| `development/backend/src/config.ts` | Environment config + assertConfig() |
| `development/backend/src/routes/health.ts` | GET /health liveness probe |
| `development/backend/src/routes/import.ts` | POST /import HTTP endpoint |
| `development/backend/src/types/messages.ts` | WebSocket message type definitions |
| `development/backend/src/ws/server.ts` | WebSocket server setup |
| `development/backend/src/ws/handlers/import.ts` | WebSocket import handler |
| `development/backend/src/lib/sheets/parse-url.ts` | Sheet URL parsing utilities |
| `development/backend/src/lib/sheets/prompt.ts` | Anthropic prompt builder |
| `development/backend/src/lib/sheets/fetch-csv.ts` | CSV fetch with error handling |
| `development/backend/src/lib/anthropic/extract.ts` | Anthropic API call wrapper |

### Modified Files (1)

| File | Change |
|------|--------|
| `development/qa-handoff.md` | Updated with this handoff document |

---

## Known Limitations

1. **No frontend integration yet.** The frontend still uses the existing Next.js `/api/sheets/import` route. WebSocket client integration is Phase 2 frontend work.
2. **No production deployment.** The `fly.toml` is ready but `fly deploy` has not been run. This is a future sprint story.
3. **ANTHROPIC_API_KEY required for import.** The server starts without it (health-only mode), but import routes return 500 without the key.
4. **No rate limiting.** WebSocket connections are not rate-limited. A future story should add connection limits.
5. **No authentication.** The backend has no auth middleware. Import routes are open. This matches the frontend's anonymous-first model but should be revisited at GA.
6. **CORS is set to `*` (allow all origins).** Appropriate for development; should be tightened for production.

---

## Suggested Test Focus Areas

1. **Health endpoint** — Verify it returns correct JSON structure.
2. **WebSocket lifecycle** — Connect, send import_start, verify phase events arrive in order, verify import_complete contains valid card objects.
3. **Error handling** — Invalid URLs, non-public sheets, missing API key, malformed JSON messages.
4. **Cancellation** — Verify import_cancel interrupts the pipeline cleanly.
5. **Type safety** — `npm run typecheck` passes with zero errors.
6. **Idempotent start** — `backend-server.sh start` is safe to run multiple times.
