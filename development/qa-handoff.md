# QA Investigation Report -- Import Sheets Workflow

**Date:** 2026-03-02
**Author:** Loki (QA Tester)
**Investigation scope:** End-to-end import sheets workflow — why it is not working locally

---

## QA Verdict: FAIL — Multiple Issues Found

The import workflow has several blocking and non-blocking issues. The two most critical
are: (1) a stale `.env.local` left over from the backend migration, and (2) 23 orphaned
backend processes running from a deleted directory. A third issue — the dev server
serving broken static assets — was caused by running `npm run build` while the dev
server was active during this investigation.

---

## Root Cause Summary

### ISSUE-001 [HIGH] Stale backend processes occupying port 9753
**File:** System process table
**Description:** 23 `tsx watch` Node processes are running, all started from
`development/backend/` which was permanently deleted in PR #60. The surviving processes
are running from `~/.Trash/backend` — the directory was moved to Trash without killing
the watchers first. Port 9753 is still bound.
**Impact:** Port 9753 is occupied. If any future code tries to start a new backend on
that port it will fail with EADDRINUSE. The current frontend code does NOT contact
port 9753 (verified: no `BACKEND_URL` references in `development/frontend/src/`), so
these zombie processes are not causing active API failures, but they are wasting
resources and are a latent hazard.
**Evidence:**
```
$ lsof -iTCP:9753 -sTCP:LISTEN
node  81442 declanshanaghy  TCP *:rasadv (LISTEN)

$ lsof -p 81442 | grep cwd
node  81442  cwd  DIR  /Users/declanshanaghy/.Trash/backend
```
**Fix:** Kill all orphaned backend processes.
```bash
pkill -f "tsx watch src/index.ts"
pkill -f "development/backend/node_modules/.bin/tsx"
```

---

### ISSUE-002 [HIGH] `.env.local` not updated after backend removal (PR #60)
**File:** `development/frontend/.env.local`
**Description:** After PR #60 removed the dedicated backend server and went fully
serverless, the `.env.example` was updated to remove `BACKEND_URL` and
`NEXT_PUBLIC_BACKEND_WS_URL`. However `.env.local` was never updated — it still
contains both stale variables and is also missing `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`
which was added to `.env.example` in the same migration.

Current `.env.local` state:

| Variable | Status | Impact |
|----------|--------|--------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Present, populated | OK |
| `GOOGLE_CLIENT_SECRET` | Present, populated | OK |
| `ANTHROPIC_API_KEY` | Present, populated, valid | OK |
| `BACKEND_URL` | STALE — should not exist | Harmless (not read by code), confusing |
| `NEXT_PUBLIC_BACKEND_WS_URL` | STALE — should not exist | Harmless (not read by code), confusing |
| `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` | MISSING | Causes Picker path to show "Configuration required" |

**Evidence:**
```bash
$ grep -r "BACKEND_URL" development/frontend/src/
(no output — variable is not consumed by any code)

$ grep "PICKER" development/frontend/.env.local
(no output — variable is absent)

# MethodSelection.tsx line 99:
const pickerDisabled = !isAuthenticated || !PICKER_API_KEY;
# line 110-111:
if (!PICKER_API_KEY) {
    pickerCard.disabledLabel = "Configuration required";
```

**Fix:** Update `.env.local` to match the current `.env.example`. Remove stale
variables and add the missing Picker key. See recommended fix below.

---

### ISSUE-003 [MEDIUM] Dev server static assets broken (404)
**File:** Running dev server process (PID 73340)
**Description:** The Next.js dev server is serving HTML that references dev-mode CSS
paths (`/_next/static/css/app/layout.css?v=...`) but those paths return 404. This was
caused during this investigation by running `npm run build` while the dev server was
active. The prod build overwrote the `.next/` directory, invalidating the dev server's
in-memory webpack state. The UI renders structural HTML but with no CSS applied.
**Evidence:**
```
Browser console:
[ERROR] Failed to load resource: the server responded with a status of 404
  http://localhost:9653/_next/static/css/app/layout.css?v=1772470761115

$ curl -o /dev/null -w "%{http_code}" http://localhost:9653/_next/static/css/app/layout.css
404

# Actual file on disk (from prod build):
.next/static/css/be86496c0afce32a.css  (hashed filename, not the dev path)
```
**Impact:** UI is functionally unusable until dev server is restarted.
**Fix:** Restart the dev server.
```bash
.claude/scripts/services.sh restart
```

---

### ISSUE-004 [LOW] MEMORY.md and ADR reference deleted backend
**File:** `/Users/declanshanaghy/.claude/projects/.../memory/MEMORY.md`, `designs/architecture/adr-backend-server.md`
**Description:** The session memory still references `development/backend/` as an active
directory with entry point `development/backend/src/index.ts` and WS handlers. This
directory was deleted in PR #60. The ADR has an addendum marking it as superseded, but
the MEMORY.md has not been updated to reflect the serverless-only architecture.
**Impact:** Future agents reading MEMORY.md will receive incorrect information about
the backend and may try to start or reference a directory that does not exist.
**Fix:** Update MEMORY.md to remove backend references. The ADR addendum is correct.

---

## What IS Working

The following components of the import pipeline are confirmed working:

1. **Frontend build:** `npm run build` exits clean. No TypeScript errors, no linting failures.
2. **Anthropic API key:** Valid. Model `claude-haiku-4-5-20251001` responds correctly.
3. **LLM model name:** `claude-haiku-4-5-20251001` is present in the Anthropic models API response.
4. **API route auth guard:** `POST /api/sheets/import` returns `401` for missing token and `invalid_token` for a malformed Bearer token. Auth is enforced correctly.
5. **Import route code:** No backend proxy references. Route calls `importFromSheet()` or `importFromCsv()` directly. Clean serverless implementation.
6. **useSheetImport hook:** HTTP-only. No WebSocket code. No references to `BACKEND_URL` or port 9753.
7. **Error handling:** Both URL and CSV paths handle all 7 `SheetImportErrorCode` values and surface them in the UI correctly.
8. **Picker graceful degradation:** When `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` is absent, the Picker option is shown as disabled with the label "Configuration required" — not a silent failure.
9. **Auth token refresh:** `ensureFreshToken()` is called before every import request (DEF-003 fix is present).
10. **`.env.local` is gitignored:** Confirmed via `git check-ignore`. Secrets are not tracked.

---

## Import Flow Trace (Current Architecture)

```
User enters Google Sheets URL
    ↓
useSheetImport.submit()
    ↓
ensureFreshToken() → reads id_token from localStorage session
    ↓
POST /api/sheets/import { url } + Authorization: Bearer <id_token>
    ↓
requireAuth() → jwtVerify() against Google JWKS
    ↓ (if auth passes)
importFromSheet(url)
    ↓
extractSheetId(url) → sheetId
buildCsvExportUrl(sheetId) → https://docs.google.com/spreadsheets/d/{id}/export?format=csv
fetchCsv(csvUrl) → HTTP GET (sheet must be public)
    ↓
extractCardsFromCsv(csv)
    ↓
getLlmProvider() → AnthropicProvider (reads ANTHROPIC_API_KEY)
provider.extractText(prompt) → claude-haiku-4-5-20251001 (max_tokens: 4096)
    ↓
JSON.parse + Zod validation (ImportResponseSchema or CardsArraySchema)
    ↓
Return { cards, sensitiveDataWarning? } or { error: { code, message } }
    ↓
useSheetImport.handleResponse() → setStep("preview") or setStep("error")
```

---

## Failure Modes for Each Import Path

| Import Path | Likely Failure | User-Visible Error |
|-------------|---------------|-------------------|
| URL (Share a Scroll) | Not signed in | "Your session has expired. Please sign in again." |
| URL (Share a Scroll) | Sheet not public | "SHEET_NOT_PUBLIC" error message shown |
| URL (Share a Scroll) | Invalid URL | "Enter a valid Google Sheets URL" (client-side) |
| URL (Share a Scroll) | ANTHROPIC_API_KEY not set | "ANTHROPIC_ERROR" shown in error step |
| CSV (Deliver a Rune-Stone) | Not signed in | 401, then "FETCH_ERROR" in UI |
| CSV (Deliver a Rune-Stone) | CSV too short | "INVALID_CSV" error |
| Picker (Browse the Archives) | No PICKER API key | "Configuration required" (disabled button) |
| Picker (Browse the Archives) | Not signed in | Disabled button: "Sign in to browse your Google Drive" |

---

## Recommended Fixes

### Fix 1: Kill orphaned backend processes (do this now)
```bash
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "development/backend/node_modules" 2>/dev/null || true
echo "Port 9753 should now be free"
```

### Fix 2: Update `.env.local` to match current `.env.example`
The `.env.local` must be manually updated (it is gitignored). Remove the stale
variables and add the Picker key:

```bash
# Remove stale variables from .env.local:
# BACKEND_URL=http://localhost:9753         ← DELETE THIS LINE
# NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:9753  ← DELETE THIS LINE

# Add missing variable (obtain from Google Cloud Console):
# NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=<your-picker-api-key>
```

Note: `ANTHROPIC_API_KEY` is already set and valid. `GOOGLE_CLIENT_SECRET` is already
set. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is already set.

### Fix 3: Restart the dev server
```bash
.claude/scripts/services.sh restart
```

### Fix 4: Update MEMORY.md (next session)
Remove all references to `development/backend/`, backend WebSocket, port 9753 for
backend, `backend-server.sh`, and `NEXT_PUBLIC_BACKEND_WS_URL` from the session memory.

---

## Steps to Reproduce the Failures

### Reproduce ISSUE-001 (orphaned processes)
```bash
lsof -iTCP:9753 -sTCP:LISTEN
# Expect: node process listed
lsof -p <pid> | grep cwd
# Expect: cwd points to ~/.Trash/backend
```

### Reproduce ISSUE-002 (stale .env.local)
```bash
diff \
  <(grep -E "^[A-Z]" development/frontend/.env.example | sed 's/=.*//' | sort) \
  <(grep -E "^[A-Z]" development/frontend/.env.local | sed 's/=.*//' | sort)
# Expect: BACKEND_URL and NEXT_PUBLIC_BACKEND_WS_URL in .env.local only
#         NEXT_PUBLIC_GOOGLE_PICKER_API_KEY in .env.example only
```

### Reproduce ISSUE-003 (broken CSS)
```bash
curl -o /dev/null -w "%{http_code}" \
  "http://localhost:9653/_next/static/css/app/layout.css"
# Expect: 404
```

---

## Priority

| Issue | Priority | Blocking Import? |
|-------|----------|-----------------|
| ISSUE-001: Orphaned backend processes | HIGH | No (current code doesn't use port 9753) |
| ISSUE-002: Stale .env.local | HIGH | No for URL/CSV paths; Yes for Picker path (missing key) |
| ISSUE-003: Dev server CSS broken | MEDIUM | Yes — UI unusable without CSS |
| ISSUE-004: Stale MEMORY.md | LOW | No |

---

## Previous QA Handoff (Terminal Skin Story 4: Install Script)

The following section is preserved from the previous handoff for reference.

**Branch:** `feat/terminal-skin-install`
**Date:** 2026-03-02
**Author:** FiremanDecko (Principal Engineer)

### What Was Implemented

Story 4 of the Norse terminal skin: an idempotent install script and a comprehensive
setup guide README.

| File | Description |
|------|-------------|
| `terminal/install.sh` | Idempotent bash installer — symlinks, settings merge, shell wrapper, color instructions |
| `terminal/README.md` | Setup guide covering all 4 skin components, rune semantics, color palette, troubleshooting |

### How to Test (Terminal Skin)

See the original QA handoff at commit `4cc3d67` for the full terminal skin test plan.
