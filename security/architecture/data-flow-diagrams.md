# Security Data Flow Diagrams — Fenrir Ledger

**Owner**: Heimdall
**Last reviewed**: 2026-03-02

Trust boundary notation:
- `[TB]` — Trust boundary crossing (browser ↔ server)
- `[SSRF]` — Server-side request forgery surface
- `[INJ]` — Injection point (prompt injection / data injection)
- `[XSS]` — XSS-accessible storage

---

## 1. OAuth 2.0 PKCE Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant SP as /sign-in (Client)
    participant SS as sessionStorage
    participant G as Google OAuth
    participant CB as /auth/callback (Client)
    participant TP as /api/auth/token [TB]
    participant LS as localStorage [XSS]

    U->>SP: Click "Sign in to Google"
    SP->>SP: generateCodeVerifier() [96B random]
    SP->>SP: generateCodeChallenge() [SHA-256 S256]
    SP->>SP: generateState() [16B random]
    SP->>SS: Write fenrir:pkce {verifier, state, callbackUrl:"/"}
    SP->>G: Redirect to accounts.google.com<br/>?code_challenge=S256<br/>&state=<random><br/>&scope=openid email profile

    G->>G: User consents
    G->>CB: Redirect /auth/callback?code=<code>&state=<state>

    CB->>SS: Read fenrir:pkce
    CB->>CB: CSRF check: state === stateParam
    CB->>SS: Remove fenrir:pkce [cleanup]

    CB->>TP: POST /api/auth/token [TB]<br/>{code, code_verifier, redirect_uri}
    TP->>TP: Rate limit (10/min per IP)
    TP->>TP: Validate redirect_uri origin allowlist
    TP->>G: POST /token {+client_secret (server-only)}
    G->>TP: {access_token, id_token, expires_in, refresh_token?}
    TP->>CB: Forward response

    CB->>CB: decodeIdToken(id_token) [client-side, no sig verify]
    CB->>LS: setSession() → fenrir:auth [XSS]
    CB->>CB: mergeAnonymousCards() [no schema validation — SEV-013]
    CB->>U: Redirect to callbackUrl (isSafeCallbackUrl validated)
```

### ASCII representation (for non-Mermaid environments)

```
User Browser
  │
  ├─ /sign-in/page.tsx
  │    generateCodeVerifier()   [96B, Web Crypto]
  │    generateCodeChallenge()  [S256]
  │    generateState()          [16B hex]
  │    sessionStorage["fenrir:pkce"] = {verifier, state, callbackUrl:"/"}
  │    window.location → accounts.google.com/o/oauth2/v2/auth
  │
  ├─ accounts.google.com  [Google consent screen]
  │    User grants → redirects to /auth/callback?code=...&state=...
  │
  ├─ /auth/callback/page.tsx
  │    Read sessionStorage["fenrir:pkce"]
  │    CSRF check: state matches  ← CRITICAL check
  │    sessionStorage.removeItem("fenrir:pkce")
  │    POST /api/auth/token {code, code_verifier, redirect_uri}
  │         ──────────────── [TRUST BOUNDARY] ──────────────
  │         rate limit by IP
  │         validate redirect_uri origin
  │         add GOOGLE_CLIENT_SECRET  (server-only)
  │         POST https://oauth2.googleapis.com/token
  │         forward response
  │         ──────────────────────────────────────────────
  │    decodeIdToken(id_token)  [client decode, no sig verify — safe here]
  │    setSession() → localStorage["fenrir:auth"]  [XSS-accessible]
  │    mergeAnonymousCards()
  │    redirect to callbackUrl (origin-validated)
```

---

## 2. URL Import Pipeline (Path A)

```
POST /api/sheets/import
  Authorization: Bearer <id_token>
  Body: { "url": "<user-supplied-google-sheets-url>" }

Server (/api/sheets/import/route.ts)
  │
  ├─ requireAuth(request)  ← [TB] id_token verified against Google JWKS
  │    verifyIdToken() → jose.jwtVerify()
  │    if !auth.ok → 401
  │
  ├─ Parse request.json() → url (user-controlled input)
  │
  ├─ extractSheetId(url)  [parse-url.ts]
  │    new URL(url)
  │    hostname.endsWith("google.com")  ← SSRF mitigation: restricts to google.com
  │    pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  │    if no match → return INVALID_URL error
  │
  ├─ buildCsvExportUrl(sheetId)
  │    "https://docs.google.com/spreadsheets/d/{sheetId}/export?format=csv"
  │    ← hardcoded google.com domain, sheetId is alphanumeric only
  │    ← [SSRF surface: minimal — domain-locked, path-restricted]
  │
  ├─ fetchCsv(csvUrl)  [fetch-csv.ts]
  │    fetch(csvUrl, { redirect: "follow" })
  │    ← [SSRF: redirect:follow means Google could redirect to internal URLs]
  │    403/404 → SHEET_NOT_PUBLIC error
  │    200 → csv text
  │    Truncate at CSV_TRUNCATION_LIMIT (100,000 chars)
  │
  ├─ extractCardsFromCsv(csv)  [extract-cards.ts]
  │    buildExtractionPrompt(csv)  [prompt.ts]
  │    ← [INJ: csv is user-controlled and interpolated into LLM prompt]
  │    LLM call (Anthropic/OpenAI)
  │    JSON.parse(response)
  │    Zod schema validation (CardsArraySchema / ImportResponseSchema)
  │    assign crypto.randomUUID() to each card
  │
  └─ return { cards } → browser
```

**Trust boundary crossings**: 1 (browser → API route)
**SSRF surface**: `fetchCsv()` with `redirect:"follow"` — mitigated by domain lock
**Injection point**: CSV content interpolated into LLM prompt — prompt injection risk

---

## 3. CSV Upload Pipeline (Path C)

```
POST /api/sheets/import
  Authorization: Bearer <id_token>
  Body: { "csv": "<raw-csv-text>" }

Server (/api/sheets/import/route.ts)
  │
  ├─ requireAuth(request)  ← [TB] same as Path A
  │
  ├─ Parse request.json() → csv (user-controlled — up to request body size limit)
  │
  ├─ importFromCsv(csv)  [csv-import-pipeline.ts]
  │    typeof csv === "string"  ← type check only
  │    csv.trim().length >= MIN_CSV_LENGTH (10 chars)
  │    Truncate at CSV_TRUNCATION_LIMIT
  │    ← NO hostname restriction (csv is inline text, no network fetch)
  │
  ├─ extractCardsFromCsv(csv)  ← same LLM pipeline as Path A
  │    buildExtractionPrompt(csv)
  │    ← [INJ: same prompt injection risk as Path A]
  │    LLM call → Zod validation → UUID assignment
  │
  └─ return { cards } → browser
```

**Note**: Path C has no SSRF surface (no external fetch). The injection surface is
identical to Path A — user-controlled CSV text is sent to the LLM.

---

## 4. Google Picker Flow (Path B)

```
Browser
  │
  ├─ useDriveToken.requestDriveAccess()  [useDriveToken.ts]
  │    loadGisScript()  → dynamic script: accounts.google.com/gsi/client
  │    google.accounts.oauth2.initTokenClient({scope: "drive.file spreadsheets.readonly"})
  │    client.requestAccessToken()  → GIS popup
  │    On grant: storeToken() → localStorage["fenrir:drive-token"]  [XSS]
  │
  ├─ GET /api/config/picker  [TB]
  │    Authorization: Bearer <id_token>
  │    requireAuth() → verified
  │    return { pickerApiKey: GOOGLE_PICKER_API_KEY }  [key sent to browser plaintext]
  │
  ├─ openPicker(driveToken, pickerApiKey)  [picker.ts]
  │    loadGapiScript()  → dynamic script: apis.google.com/js/api.js
  │    gapi.load("picker")
  │    new google.picker.PickerBuilder()
  │         .setOAuthToken(driveToken)
  │         .setDeveloperKey(pickerApiKey)
  │    → Google Picker UI (iframe: docs.google.com)
  │    User selects spreadsheet → { id, name }
  │
  ├─ fetchSheetAsCSV(sheetId, driveToken)  [sheets-api.ts]
  │    GET https://sheets.googleapis.com/v4/spreadsheets/{sheetId}/values/A:ZZ
  │    Authorization: Bearer <driveToken>
  │    ← sheetId comes from Picker response (Google-controlled, trusted)
  │    ← [SSRF surface: none — hardcoded googleapis.com domain]
  │    valuesToCsv(data.values)  → csv text
  │
  ├─ POST /api/sheets/import { csv }  [TB]
  │    Authorization: Bearer <id_token>
  │    ← same extraction pipeline as Path C
  │
  └─ return { cards } → browser
```

**Trust boundary crossings**: 2 (picker config + import)
**SSRF surface**: None — all URLs are hardcoded to googleapis.com
**XSS surface**: Drive token stored in localStorage

---

## 5. Summary of Attack Surfaces per Flow

| Flow | SSRF | Prompt Injection | XSS-accessible Storage | Auth Check |
|------|------|-----------------|------------------------|------------|
| Path A (URL) | Low (domain-locked + redirect:follow) | Yes (CSV→prompt) | fenrir:auth | requireAuth |
| Path B (Picker) | None | Yes (CSV→prompt) | fenrir:auth + fenrir:drive-token | requireAuth |
| Path C (CSV upload) | None | Yes (CSV→prompt) | fenrir:auth | requireAuth |
| OAuth callback | None | None | fenrir:auth | N/A (public) |
| Token proxy | None (fixed URL) | None | None | N/A (public, rate-limited) |
