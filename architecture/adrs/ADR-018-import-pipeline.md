# ADR-018: Import Pipeline

**Status:** Accepted
**Date:** 2026-03-15
**Authors:** FiremanDecko (Principal Engineer)

---

## Context

Users need to import their existing credit card data into Fenrir Ledger. Card data lives in
a variety of formats: public Google Sheets, CSV exports from spreadsheet tools, and Excel
files (`.xls`/`.xlsx`). Manually entering every card is a high-friction onboarding barrier.

The import feature must:

1. Support multiple source formats without requiring users to standardise their data first
2. Handle messy, freeform spreadsheet layouts (non-standard column names, extra rows, etc.)
3. Be gated behind Karl-or-trial tier (import is a premium feature per ADR-017)
4. Run entirely server-side to keep the Anthropic API key out of the browser bundle
5. Apply SSRF protection when fetching external URLs

---

## Decision

Implement a **three-path import pipeline** behind a single API route
(`POST /api/sheets/import`), with LLM-powered card extraction for all paths.

### Path A — URL (Google Sheets / CSV URL)

1. Client POSTs `{ url: "https://docs.google.com/spreadsheets/..." }`
2. Server validates the URL against an SSRF allowlist (`validateImportUrl`)
3. Server fetches the public Google Sheets export URL (`/export?format=csv`) or raw CSV URL
4. Raw CSV is passed to `extractCardsFromCsv()`

### Path B — CSV text upload

1. Client POSTs `{ csv: "<raw CSV text>" }`
2. Raw CSV is passed directly to `extractCardsFromCsv()`

### Path C — Binary file upload (XLS / XLSX)

1. Client POSTs `{ file: "<base64>", filename: "cards.xlsx", format: "xlsx" }`
2. Server decodes base64, parses the binary spreadsheet via a server-side XLSX parser
3. First sheet is serialised to CSV, then passed to `extractCardsFromCsv()`

Accepted formats: `xls`, `xlsx`. Other formats (`.ods`, `.csv` with wrong field) are rejected
with `INVALID_CSV` before reaching the LLM.

### LLM card extraction (`extractCardsFromCsv`)

All three paths converge at `extractCardsFromCsv()` in
`development/ledger/src/lib/sheets/extract-cards.ts`:

1. **Sanitise** — strip prompt-injection patterns from CSV text (`sanitizeCsvForPrompt`)
2. **Prompt** — build a structured extraction prompt (`buildExtractionPrompt`)
3. **LLM call** — call the configured LLM provider (Anthropic Claude via `FENRIR_ANTHROPIC_API_KEY`);
   provider is resolved at runtime by `getLlmProvider()`
4. **Parse** — strip markdown code fences if present; JSON-parse the response
5. **Validate** — validate against `CardsArraySchema` (Zod); reject malformed responses
6. **UUID assignment** — assign stable UUIDs to each extracted card before returning

The LLM handles non-standard column names, extra header rows, and freeform layouts that
rule-based parsing cannot handle reliably.

### Auth and rate limiting

```typescript
// Tier gate: Karl subscribers and active trial users only
const authz = await requireAuthz(request, { tier: "karl-or-trial" });

// 5 imports per user per hour (GHSA-4r6h, GHSA-5pgg)
const { success } = rateLimit(`sheets:import:${authz.user.sub}`, { limit: 5, windowMs: 3_600_000 });
```

### SSRF prevention (URL path only)

`validateImportUrl()` rejects:
- Non-HTTP(S) schemes
- Private IP ranges (RFC 1918, loopback, link-local)
- Non-allowlisted hostnames for Google Sheets (`docs.google.com`, `sheets.googleapis.com`)

### Route configuration

```typescript
// development/ledger/src/app/api/sheets/import/route.ts
export const maxDuration = 60; // LLM calls may take 10–30 s
```

---

## Alternatives Considered

### 1. Rule-based column mapping (no LLM)

Parse CSV by detecting known column headers (`Card Name`, `Annual Fee`, `Signup Bonus`, etc.)
and mapping them to the Card schema.

**Pros**: Fast, deterministic, zero API cost.

**Cons**: Users' spreadsheets use wildly different column names (`card`, `cc name`, `bonus`,
`SUB`, etc.). A rule-based matcher would require an ever-growing synonym list and still fails
on unusual layouts. The LLM handles arbitrary layouts reliably with a single prompt.

### 2. Client-side LLM call (browser → Anthropic API directly)

Call the Anthropic API directly from the browser with a public API key.

**Pros**: Simpler — no server round-trip.

**Cons**: `FENRIR_ANTHROPIC_API_KEY` would be exposed in the client bundle (visible in DevTools
network tab). Unacceptable — this key has billing implications and no request-level auth.

### 3. Separate endpoints per import mode (URL / CSV / file)

Three distinct API routes: `/api/sheets/import/url`, `/api/sheets/import/csv`,
`/api/sheets/import/file`.

**Pros**: Cleaner route separation.

**Cons**: Duplicates auth, rate limiting, and error handling across three handlers. A single
route with mode dispatch at the top keeps the shared logic (auth, rate limit, SSRF check,
LLM extraction) in one place.

### 4. Synchronous response (no timeout extension)

Return the LLM result synchronously within the default Next.js route timeout (10 s on Vercel).

**Pros**: No configuration needed.

**Cons**: LLM calls for large spreadsheets can take 15–30 s. On GKE the pod timeout is
effectively unlimited, but `maxDuration = 60` is set explicitly as a safety bound and for
forward compatibility if routes are ever extracted.

---

## Consequences

### Positive

- **Handles arbitrary layouts** — LLM extraction works on freeform spreadsheets without user
  pre-processing
- **Single route** — auth, rate limiting, SSRF, and extraction logic are centralised
- **API key stays server-side** — `FENRIR_ANTHROPIC_API_KEY` never reaches the browser
- **SSRF protection** — URL imports validate against an allowlist before any network call

### Negative

- **LLM cost** — each import call invokes the Anthropic API; large spreadsheets consume more
  tokens; rate limit (5/hour/user) bounds worst-case spend
- **Non-deterministic output** — LLM extraction may occasionally misparse edge cases; the
  Zod schema validation catches structural errors but not semantic mismatches
- **60 s timeout** — large imports block the connection for up to a minute; the UI shows a
  progress indicator during this window
- **Binary file size** — XLS/XLSX files are base64-encoded in the POST body; large files
  may hit Next.js body size limits (currently 4 MB default, configurable)

### Constraints introduced

- `FENRIR_ANTHROPIC_API_KEY` is a server-only env var — never use `NEXT_PUBLIC_` prefix
- All import paths MUST go through `requireAuthz(request, { tier: "karl-or-trial" })`
- URL imports MUST call `validateImportUrl()` before any fetch (SSRF prevention)
- Rate limit key is `sheets:import:{user.sub}` — 5 requests per hour per user

---

## Related

- [ADR-015-authz-layer.md](ADR-015-authz-layer.md) — `requireAuthz()` tier gating
- [ADR-017-trial-tier-system.md](ADR-017-trial-tier-system.md) — import is a Karl-or-trial feature
- `development/ledger/src/app/api/sheets/import/route.ts` — route handler
- `development/ledger/src/lib/sheets/extract-cards.ts` — LLM extraction shared logic
- `development/ledger/src/lib/sheets/import-pipeline.ts` — Path A (URL) pipeline
- `development/ledger/src/lib/sheets/csv-import-pipeline.ts` — Path B (CSV) pipeline
- `development/ledger/src/lib/sheets/file-import-pipeline.ts` — Path C (file) pipeline
- `development/ledger/src/lib/sheets/url-validation.ts` — SSRF allowlist
- `development/ledger/src/lib/sheets/prompt.ts` — extraction prompt builder
- `development/ledger/src/lib/llm/extract.ts` — LLM provider abstraction
