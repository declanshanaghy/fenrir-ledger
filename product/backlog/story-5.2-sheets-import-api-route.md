# Story 5.2: Google Sheets Import — Anthropic Conversion API Route

- **As a**: Credit card churner and rewards optimizer
- **I want**: The app to be able to read my Google Sheets credit card data and convert it to the app's format using AI
- **So that**: I can get started quickly without manually re-entering every card I already track in a spreadsheet
- **Priority**: P1-Critical
- **Sprint Target**: 5
- **Status**: Ready

---

## Context / Problem

A meaningful segment of our target users are already tracking their credit cards in Google Sheets. These users have invested time in their own tracking system and will not abandon that investment to manually re-enter 5–20+ cards into a new app. The friction of manual entry is the single largest barrier to adoption for this cohort.

The Anthropic API can solve this: given the raw contents of a Google Sheets document (in any user-defined format), the API can identify credit card data and map it to Fenrir Ledger's `Card` schema. The user provides a URL; the app fetches, converts, and previews.

This story covers the **server-side API route** that performs the actual conversion. It is the technical foundation that Stories 5.3 and 5.4 (the wizard UI and import confirmation) depend on. It is written as a separate story because FiremanDecko can build and test this route independently while Luna designs the wizard UI.

---

## Desired Outcome

After this ships, a Next.js API route exists at `/api/sheets/import` that:

1. Accepts a Google Sheets URL.
2. Fetches the sheet's public CSV export.
3. Sends the raw CSV content to the Anthropic API with a structured prompt.
4. Receives a JSON array of `Card`-shaped objects from Anthropic.
5. Validates the output against the `Card` schema.
6. Returns the validated cards (and any validation errors) to the client.

This route does not save any cards. It only converts. Persistence is the responsibility of Story 5.4.

---

## Google Sheets URL Fetching

The app will only support **publicly shared** Google Sheets. The import workflow will make this requirement explicit to the user. Private sheets (requiring OAuth with the Google Sheets API) are out of scope for Sprint 5.

A publicly shared Google Sheet can be fetched as CSV via a deterministic URL transform:

```
Input:  https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid={GID}
Output: https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}
```

The route must:
1. Extract `SHEET_ID` and optionally `GID` from the user-supplied URL.
2. Construct the CSV export URL.
3. `fetch()` the CSV export from the Google Sheets CDN (server-side — no CORS issues).
4. If the fetch returns a non-200 response or a redirect to a login page, return a structured error: `{ error: "SHEET_NOT_PUBLIC", message: "..." }`.

---

## Anthropic API Conversion

The API route calls the Anthropic API (server-side only — API key never exposed to client) with:

- **Model**: `claude-haiku-4-5-20251001` (fast and cost-effective for structured extraction)
- **Prompt strategy**: A system prompt that explains the `Card` schema in detail and instructs the model to extract all credit card records from the provided CSV, returning a JSON array.

### System Prompt (product-specified):

```
You are a data extraction assistant for a credit card tracking application.
Your task: read the provided CSV content and extract all credit card records.

Return ONLY a valid JSON array. No prose, no markdown, no code blocks.
Each element must conform to this schema:

{
  "issuerId": string,       // lowercase snake_case issuer name, e.g. "chase", "amex", "citi", "capital_one", "barclays", "wells_fargo", "bank_of_america", "us_bank", "discover"
  "cardName": string,       // human-readable card name, e.g. "Sapphire Preferred"
  "openDate": string,       // ISO 8601 date, e.g. "2023-06-15T00:00:00.000Z". If unknown, use today's date.
  "creditLimit": number,    // integer cents. If unknown, use 0.
  "annualFee": number,      // integer cents. If unknown, use 0.
  "annualFeeDate": string,  // ISO 8601 date of next annual fee due. Empty string if no annual fee.
  "promoPeriodMonths": number, // integer months of intro APR or bonus period. 0 if none.
  "signUpBonus": {          // null if no sign-up bonus
    "type": "points" | "miles" | "cashback",
    "amount": number,       // points/miles count or cashback in cents
    "spendRequirement": number, // integer cents
    "deadline": string,     // ISO 8601 deadline. If unknown, use one year from today.
    "met": false
  } | null,
  "notes": string           // any notes from the spreadsheet not captured above. Empty string if none.
}

Rules:
- Dollar amounts → integer cents (multiply by 100). E.g. $500 → 50000.
- If a value is ambiguous or missing, use the default specified above.
- Do not invent data. If a field cannot be reasonably inferred, use the default.
- If the CSV contains no credit card data, return an empty array [].
- If the sheet contains multiple tabs merged into CSV, process all rows.
```

### Request structure:

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "Extract credit card records from this CSV:\n\n{CSV_CONTENT}"
    }
  ],
  "system": "{SYSTEM_PROMPT_ABOVE}"
}
```

### Response handling:

- Parse Anthropic's `content[0].text` as JSON.
- If parsing fails, return `{ error: "PARSE_ERROR", rawResponse: string }`.
- If the array is empty, return `{ cards: [], warning: "NO_CARDS_FOUND" }`.
- Assign each card a fresh UUID (`crypto.randomUUID()`) for `id`.
- Set `createdAt` and `updatedAt` to the current timestamp.
- Set `status` to `"active"` (will be recomputed by `computeCardStatus()` on save).
- Do NOT set `householdId` — that is supplied by the client at import time (Story 5.4).

---

## API Route Specification

**Route**: `POST /api/sheets/import`

**Request body**:
```json
{
  "url": "https://docs.google.com/spreadsheets/d/..."
}
```

**Success response** (`200`):
```json
{
  "cards": [Card, Card, ...],
  "sheetTitle": "My Credit Cards",
  "rowCount": 12,
  "cardCount": 8
}
```

**Error responses**:

| HTTP status | Error code | Meaning |
|-------------|------------|---------|
| `400` | `INVALID_URL` | URL is not a recognizable Google Sheets URL |
| `422` | `SHEET_NOT_PUBLIC` | Sheet fetch returned a non-CSV response (login page or 403) |
| `422` | `NO_CARDS_FOUND` | Anthropic returned an empty array — sheet has no credit card data |
| `422` | `PARSE_ERROR` | Anthropic response could not be parsed as JSON |
| `500` | `ANTHROPIC_ERROR` | Anthropic API returned a non-200 status |
| `500` | `FETCH_ERROR` | Network error fetching the Google Sheet |

---

## Environment Variables

This story requires a new server-side environment variable:

```
ANTHROPIC_API_KEY=sk-ant-...
```

- Must be added to `.env.example` (with placeholder value, not a real key).
- Must be documented in the project README or architecture docs.
- Must NOT be prefixed with `NEXT_PUBLIC_` — this key must never be exposed to the client bundle.
- Vercel preview deployments must have this variable set to run the import feature; if unset, the route returns `500 ANTHROPIC_NOT_CONFIGURED`.

---

## Acceptance Criteria

- [ ] `POST /api/sheets/import` exists and is reachable in the Next.js app
- [ ] A valid public Google Sheets URL results in a `200` response containing a `cards` array
- [ ] Each card in the response has a unique UUID `id`, `createdAt`, `updatedAt`, and `status: "active"`
- [ ] Dollar amounts in the source sheet are correctly converted to integer cents in the response
- [ ] Dates in the source sheet are correctly normalized to ISO 8601 UTC timestamps
- [ ] A Google Sheets URL pointing to a private/non-public sheet returns `422 SHEET_NOT_PUBLIC`
- [ ] An invalid (non-Sheets) URL returns `400 INVALID_URL`
- [ ] A sheet with no recognizable credit card data returns `422 NO_CARDS_FOUND`
- [ ] `ANTHROPIC_API_KEY` is documented in `.env.example` and never appears in client-side bundles
- [ ] The route returns `500 ANTHROPIC_NOT_CONFIGURED` if `ANTHROPIC_API_KEY` is not set
- [ ] The Anthropic API key does not appear in any response body, error message, or server log at `info` level or below
- [ ] The route handles sheets with non-standard column names (e.g. "Bank" instead of "Issuer") and still extracts recognizable card data
- [ ] A sheet containing 20 cards is processed in under 15 seconds end-to-end (URL fetch + Anthropic call)
- [ ] `npm run build` passes with zero errors
- [ ] TypeScript strict mode: zero new type errors introduced

---

## Technical Notes for FiremanDecko

**Next.js route location**: `development/frontend/src/app/api/sheets/import/route.ts` — a standard App Router route handler using `export async function POST(request: Request)`.

**CSV fetch**: Use the native `fetch()` API (available in Node 18+ and Next.js App Router edge/Node runtime). Set a `User-Agent` header to avoid being blocked by Google's CDN.

**Sheet ID extraction regex**: Google Sheets URLs follow this pattern:
```
/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
```
GID (tab ID) is optional in the URL hash: `#gid=0`. Default to GID `0` if absent.

**CSV size limit**: Truncate CSV content at 100,000 characters before sending to Anthropic. Large sheets are unlikely to be fully parseable by the model anyway, and this prevents token overflows. Return a `warning: "CSV_TRUNCATED"` in the response if truncation occurs.

**Anthropic SDK**: Use the official `@anthropic-ai/sdk` npm package. This is a server-side call — do not use the SDK in any client component. Do not add the SDK to the client bundle.

**Response validation**: After parsing Anthropic's JSON output, validate each card object minimally — confirm `issuerId` is a non-empty string, `cardName` is non-empty, `annualFee` is a non-negative integer. Drop any record that fails validation rather than returning garbage to the client. Return `droppedCount` in the response so the user knows how many records were unusable.

**Error isolation**: Wrap the entire route handler in try/catch. Never let an unhandled exception return a 500 with a stack trace — map all exceptions to the structured error response format above.

**No authentication required on this route in Sprint 5**: The route does not check for a signed-in session. Any client (signed-in or anonymous) can call it. This is acceptable because the route reads a public URL and calls the Anthropic API — there is no user data at risk. Rate limiting can be added post-GA if abuse is observed.

---

## Open Questions for FiremanDecko

1. ~~**Anthropic model selection**~~ — **Resolved**: Use `claude-haiku-4-5-20251001`. This is the confirmed model ID for Sprint 5.

2. **CSV encoding**: Google Sheets CSV exports may use UTF-8 with BOM. Confirm whether the fetch response needs BOM stripping before passing to Anthropic.

3. **Rate limiting**: Anthropic has per-minute token limits. If a user submits a very large sheet, the request may be rate-limited. Should the route return a retryable `429` response, or silently truncate the input first? Product preference: truncate first (at 100k characters), then surface a warning.

4. ~~**Vercel timeout**~~ — **Resolved**: Extend the function timeout using `export const maxDuration = 60` at the top of the route file (Vercel Pro, serverless runtime). Do not use streaming or edge runtime for this route.

---

## Dependencies

- **Depends on**: Nothing (this story is the foundation; no upstream dependency)
- **Blocks**: Story 5.3 (wizard UI), Story 5.4 (import confirmation)

---

## Mythology Frame

The Norns read the threads of fate across every loom — in any format, in any language. Anthropic is the Norn. The spreadsheet is the loom. The ledger is where the threads find their final record.
