# QA Verdict: PR #41 — Backend WebSocket Import Pipeline (Stories 1-3)

**Date:** 2026-03-01
**Branch:** `feat/backend-ws-pipeline`
**Reviewer:** Loki (QA Tester)
**PR:** #41 feat: backend server with WebSocket import pipeline

> **⚠️ Deployment status update (2026-03-01):** The dedicated Node/Hono backend validated in this report was subsequently removed in PR #60 ("remove Fly.io backend, go fully serverless on Vercel"). The WebSocket import pipeline and `fly.toml` described below no longer exist in the codebase. This document is retained as a historical record of the Sprint 5 backend scaffold QA.

---

## QA Verdict: PASS

All acceptance criteria met. Zero blocking defects. Two low-severity observations logged below.

---

## Code Review

### Story 1 — Backend Scaffold

| File | Present | Review |
|------|---------|--------|
| `package.json` | YES | Correct dependencies: hono, @hono/node-server, ws, @anthropic-ai/sdk, zod. devDependencies: tsx, typescript, @types/node, @types/ws. `"type": "module"` correct for ESM. |
| `tsconfig.json` | YES | ES2022 target, NodeNext module resolution, strict mode, sourceMap + declarationMap. All correct. |
| `.env.example` | YES | Documents ANTHROPIC_API_KEY, FENRIR_BACKEND_PORT, NODE_ENV. No real secrets. Safe to commit. |
| `.gitignore` | YES | Excludes `.env`, `node_modules/`, `dist/`, `logs/`. Root `.gitignore` provides additional coverage for `*.env` and `.env.*` variants. |
| `fly.toml` | YES | App name, IAD region, port 8080, HTTPS enforced, auto-stop/start machines, 256MB RAM. No secrets. |
| `src/config.ts` | YES | Port from `FENRIR_BACKEND_PORT ?? "9753"`, lazy `assertConfig()` for API key. Health-only mode works without API key. |
| `src/routes/health.ts` | YES | GET /health returns `{status, service, ts}`. Correct shape per spec. |
| `src/index.ts` | YES | Hono app with logger + CORS middleware. Routes mounted at `/`. Server starts, attaches WebSocket. |

### Story 2 — WebSocket Server + Types

| File | Present | Review |
|------|---------|--------|
| `src/types/messages.ts` | YES | `ClientMessage` union: `import_start` + `import_cancel`. `ServerMessage` union: `import_phase`, `import_progress`, `import_complete`, `import_error`. `ImportPhase` covers all 4 phases. `ImportErrorCode` covers all 6 error cases. `ImportedCard` interface complete with all required fields. |
| `src/ws/server.ts` | YES | `attachWebSocketServer()` attaches to existing http.Server. Connection lifecycle (connect, message, close, error) all handled. Invalid JSON sends structured error response. |

**Type contract completeness check:** `ClientMessage` and `ServerMessage` are discriminated unions with string literal `type` fields. TypeScript exhaustiveness check in `handleImportMessage` via `default:` branch with `(msg as { type: string }).type` — correct.

### Story 3 — Import Pipeline

| File | Present | Review |
|------|---------|--------|
| `src/lib/sheets/parse-url.ts` | YES | `extractSheetId()` handles edit URLs, hash fragments, bare sheet URLs. `buildCsvExportUrl()` correct format. |
| `src/lib/sheets/prompt.ts` | YES | `KNOWN_ISSUERS` array inlined (10 issuers + "other"). `buildExtractionPrompt()` instructs model to return plain JSON, not markdown. `CSV_TRUNCATION_LIMIT = 100_000`. |
| `src/lib/sheets/fetch-csv.ts` | YES | Handles 403/404 (SHEET_NOT_PUBLIC), non-OK status (FETCH_ERROR), empty body (NO_CARDS_FOUND), truncation with warning. |
| `src/lib/anthropic/extract.ts` | YES | Claude Haiku model, 4096 max_tokens, single retry on transient failure. Returns raw text to caller for parsing. |
| `src/ws/handlers/import.ts` | YES | Full pipeline: assertConfig → extractSheetId → fetchCsv → extractCardsFromCsv → Zod validate → assign IDs → send events. Cancellation flag checked between each async step. `WeakMap` for per-connection cancel state (no memory leak). |
| `src/routes/import.ts` | YES | HTTP POST /import mirrors WebSocket pipeline. Returns `{cards}` or `{error:{code,message}}`. Includes `warning` field when CSV was truncated. |

---

## Build Validation

- **npm install:** PASS — 19 packages, 0 vulnerabilities, 0 errors
- **npm run typecheck:** PASS — `tsc --noEmit` exits 0, zero type errors

---

## Health Endpoint

**GET /health:** PASS

```
curl http://localhost:9753/health
{"status":"ok","service":"fenrir-ledger-backend","ts":"2026-03-01T22:36:13.958Z"}
HTTP 200
```

Response shape matches spec: `status`, `service`, `ts` (ISO 8601). Verified twice (idempotent).

---

## HTTP Import Error-Path Tests

All tested live against the running server:

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| `url: "not-a-url"` | `INVALID_URL` | `INVALID_URL` | PASS |
| `url` field missing (`{}`) | `INVALID_URL` | `INVALID_URL` | PASS |
| Body is invalid JSON | `INVALID_URL` / "Invalid JSON body." | `INVALID_URL` / "Invalid JSON body." | PASS |
| Non-Google domain URL | `INVALID_URL` | `INVALID_URL` | PASS |
| `url: ""` (empty string) | `INVALID_URL` | `INVALID_URL` | PASS |
| `url: 12345` (number) | `INVALID_URL` | `INVALID_URL` | PASS |
| `url: null` | `INVALID_URL` | `INVALID_URL` | PASS |
| `url: [...]` (array) | `INVALID_URL` | `INVALID_URL` | PASS |
| Valid Google URL, private sheet | `SHEET_NOT_PUBLIC` | `SHEET_NOT_PUBLIC` | PASS |
| Unknown route (GET /) | 404 | 404 | PASS |

**assertConfig() ordering:** Verified in code — `assertConfig()` is called at step 2 of the HTTP route (lines 51-55), before `extractSheetId` (step 3) and `fetchCsv` (step 4). When `ANTHROPIC_API_KEY` is absent, server returns HTTP 500 `ANTHROPIC_ERROR` before touching the network. Correct.

---

## Security Review

- **.env in .gitignore:** PASS — `development/backend/.gitignore` line 1 explicitly excludes `.env`. Root `.gitignore` additionally covers `*.env` and `.env.*`.
- **No hardcoded secrets:** PASS — grep across all `src/**/*.ts` found zero API keys, tokens, or passwords. Config reads exclusively from `process.env`.
- **CORS configuration:** PASS with caveat — `origin: "*"` is appropriate for development. Documented as a known limitation in qa-handoff.md (no auth middleware, open import routes). Both are correct stances for Phase 1 / pre-GA.
- **.env.example safety:** PASS — contains only placeholder strings (`your-anthropic-api-key-here`), no real credentials.
- **Fly.toml secrets:** PASS — `fly.toml` only sets `NODE_ENV` and `FENRIR_BACKEND_PORT`. API key is not in the config file.

---

## GH Actions

- **Status:** NO CHECKS — The branch `feat/backend-ws-pipeline` has no CI checks configured. `gh pr checks 41` reports "no checks reported."

This is an observation, not a blocker for Phase 1 (backend scaffold). A CI workflow for the backend (typecheck, lint) should be added before Phase 2 work lands.

---

## Observations (Non-Blocking)

### OBS-001: Backend .gitignore does not cover `*.env` variants [LOW]

- **File:** `development/backend/.gitignore`
- **Detail:** Only `.env` is listed. Patterns like `test.env`, `.env.local`, `.env.production` are NOT matched by the backend-local `.gitignore`. They ARE covered by the root `.gitignore` (`*.env`, `.env.*`).
- **Risk:** Minimal. Root `.gitignore` provides the backstop. But defence-in-depth suggests the backend `.gitignore` should be self-contained.
- **Recommendation:** Add `*.env` and `.env.*` lines (with `!.env.example` exception) to `development/backend/.gitignore`.

### OBS-002: 404 responses are plain text, not JSON [LOW]

- **File:** `src/index.ts` (Hono default)
- **Detail:** Requests to undefined routes (e.g., `GET /`) return Hono's default `404 Not Found` as plain text, not a JSON error object. The frontend will need to handle non-JSON 404 responses if it ever hits an undefined route.
- **Risk:** Minimal in Phase 1 — only two routes exist and both are documented. No frontend integration yet.
- **Recommendation:** Add a Hono `app.notFound()` handler returning `{ error: { code: "NOT_FOUND", message: "..." } }` for consistency.

### OBS-003: No CI workflow for backend [LOW]

- **Detail:** No GitHub Actions workflow runs `npm run typecheck` or lint on the `development/backend/` path. TypeScript errors could merge undetected in future PRs.
- **Recommendation:** Add a `.github/workflows/backend-ci.yml` that runs `cd development/backend && npm ci && npm run typecheck` on PRs touching `development/backend/**`.

---

## Tests Passed (Acceptance Criteria)

- `npm run typecheck` passes with zero errors
- `GET /health` returns `{"status":"ok","service":"fenrir-ledger-backend","ts":"..."}` at HTTP 200
- HTTP POST /import returns structured `{error:{code,message}}` for all invalid-URL cases
- HTTP POST /import returns `SHEET_NOT_PUBLIC` for private Google Sheets URLs
- `assertConfig()` is called before any network I/O in both the HTTP route and WS handler
- No secrets hardcoded anywhere in `src/`
- `.env` is excluded from git (backend `.gitignore` + root `.gitignore`)
- `ClientMessage` and `ServerMessage` discriminated unions are complete per spec
- `ImportErrorCode` covers all 6 error cases: `INVALID_URL`, `SHEET_NOT_PUBLIC`, `FETCH_ERROR`, `ANTHROPIC_ERROR`, `PARSE_ERROR`, `NO_CARDS_FOUND`
- `ImportedCard` interface includes all required fields with correct types
- WebSocket cancellation flag is checked between each async pipeline step
- `WeakMap` used for per-connection state (no memory leak on disconnect)
- CSV truncation warning propagated in HTTP response `warning` field
- `fly.toml` uses port 8080 with `force_https = true`

---

## Recommendation: SHIP

Zero blocking defects. All acceptance criteria pass. Three low-severity observations filed for future cleanup. The backend scaffold is ready to merge.
