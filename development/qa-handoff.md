# QA Handoff — Story 5: Route Ownership + Env Config

**Date:** 2026-03-01
**Engineer:** FiremanDecko
**Branch:** `feat/route-ownership-config`

---

## What Was Built

This story converts the Next.js `/api/sheets/import` route from a full Anthropic import implementation into a thin HTTP proxy that delegates to the backend server. It also documents the route ownership split and adds the `BACKEND_URL` environment variable.

### Files Created

| File | Description |
|------|-------------|
| `designs/architecture/route-ownership.md` | Documents which routes live in Next.js vs. backend, env var mapping, and design principles |

### Files Modified

| File | Change |
|------|--------|
| `development/src/src/app/api/sheets/import/route.ts` | Replaced full Anthropic/Zod import implementation with thin HTTP proxy to backend `/import` endpoint |
| `development/src/.env.example` | Added `BACKEND_URL=http://localhost:9753` with documentation comments |
| `development/qa-handoff.md` | This file (overwritten per sprint convention) |

---

## How to Deploy

1. Pull the `feat/route-ownership-config` branch
2. `cd development/src && npm install`
3. Ensure `.env.local` has `BACKEND_URL=http://localhost:9753` (or the deployed backend URL)
4. `npm run build` -- verify successful build
5. `npm run dev` -- start the Next.js dev server

---

## Testing Instructions

### Acceptance Criteria Checklist

- [ ] **No Anthropic SDK in route**: Open `development/src/src/app/api/sheets/import/route.ts` and verify there are no imports of `@anthropic-ai/sdk`, `zod`, `extractSheetId`, `buildCsvExportUrl`, `buildExtractionPrompt`, or `CSV_TRUNCATION_LIMIT`
- [ ] **Thin proxy only**: The route should be under 45 lines. It accepts a URL in the body, forwards it to `BACKEND_URL/import`, and returns the response
- [ ] **503 on backend unreachable**: With no backend running, POST to `/api/sheets/import` with `{"url": "https://docs.google.com/spreadsheets/d/test"}` and verify it returns HTTP 503 with `{"error": {"code": "FETCH_ERROR", "message": "The import service is currently unavailable. Please try again later."}}`
- [ ] **504 on timeout**: If the backend takes over 55 seconds, the route returns 504 (hard to test manually; verify the `AbortSignal.timeout(55_000)` code is present)
- [ ] **BACKEND_URL in .env.example**: Verify `development/src/.env.example` contains `BACKEND_URL=http://localhost:9753` with documentation
- [ ] **Route ownership doc**: Verify `designs/architecture/route-ownership.md` contains the route table, env var table, and 4 design principles
- [ ] **TypeScript compiles**: `cd development/src && npx tsc --noEmit` exits 0
- [ ] **Build succeeds**: `cd development/src && npm run build` exits 0

### Test Commands

```bash
# TypeScript check
cd development/src && npx tsc --noEmit

# Production build
cd development/src && npm run build

# Test 503 error (no backend running)
cd development/src && npm run dev &
curl -X POST http://localhost:9653/api/sheets/import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.google.com/spreadsheets/d/test"}'
# Expected: 503 with FETCH_ERROR

# Test invalid body
curl -X POST http://localhost:9653/api/sheets/import \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 with INVALID_URL

# Test invalid JSON
curl -X POST http://localhost:9653/api/sheets/import \
  -H "Content-Type: text/plain" \
  -d 'not json'
# Expected: 400 with INVALID_URL
```

---

## Known Limitations

- The `NEXT_PUBLIC_BACKEND_WS_URL` env var is documented in `route-ownership.md` but not yet added to `.env.example` -- it will be added when the WebSocket client code is implemented.
- The `@anthropic-ai/sdk` and `zod` packages remain in `package.json` as they may be used by other parts of the application or the future backend. They are no longer imported by the import route.
