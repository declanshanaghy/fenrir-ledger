# Auth Architecture — Fenrir Ledger

**Owner**: Heimdall
**Last reviewed**: 2026-03-02 (updated for Patreon integration — feat/patreon-api)
**References**: ADR-005, ADR-006, ADR-008, ADR-009

---

## Overview

Fenrir Ledger uses Google OAuth 2.0 with PKCE (Proof Key for Code Exchange) as its
authentication mechanism. The application is anonymous-first: users may use the app
without signing in; signing in is a voluntary upgrade that enables cross-device sync.

There is no server-side session. All session state lives in the browser
(`localStorage`). The server validates identity on every API request by verifying
the Google `id_token` JWT against Google's public JWKS keys.

---

## 1. OAuth 2.0 PKCE Flow

### 1.1 Protocol Choice

The application uses the **Authorization Code + PKCE** flow rather than the Implicit
flow. PKCE prevents authorization code interception attacks by binding the
authorization request to a per-request secret that only the originating browser tab
can produce.

Google's Web Application OAuth client type requires a `client_secret` even when
PKCE is used. This secret cannot reside in the browser. A thin server-side proxy
(`/api/auth/token`) receives the authorization code from the browser and adds the
`client_secret` before forwarding to Google's token endpoint. The browser retains
full ownership of the PKCE verifier and state, so the proxy is an implementation
detail, not a security boundary.

### 1.2 PKCE Primitives (pkce.ts)

| Parameter | Generation | Entropy |
|---|---|---|
| `code_verifier` | `crypto.getRandomValues(96 bytes)` → base64url | 768 bits |
| `code_challenge` | `base64url(SHA-256(verifier))` — S256 method | Derived |
| `state` | `crypto.getRandomValues(16 bytes)` → hex | 128 bits |

All primitives use the Web Crypto API (`crypto.subtle`). No external dependencies.

### 1.3 Sign-In Flow (sign-in/page.tsx)

```
/sign-in/page.tsx
  1. Check isSessionValid() → if valid, redirect to /
  2. User clicks "Sign in to Google"
  3. generateCodeVerifier()   [96-byte random, 768-bit entropy]
  4. generateCodeChallenge()  [SHA-256 S256]
  5. generateState()          [16-byte random hex]
  6. sessionStorage["fenrir:pkce"] = { verifier, state, callbackUrl: "/" }
  7. window.location.href = accounts.google.com/o/oauth2/v2/auth
       ?client_id=NEXT_PUBLIC_GOOGLE_CLIENT_ID
       &response_type=code
       &scope=openid email profile
       &access_type=offline
       &code_challenge=<S256>
       &code_challenge_method=S256
       &state=<random>
       &redirect_uri=<origin>/auth/callback
```

The `callbackUrl` written to `sessionStorage` is hardcoded to `"/"`. Any future
`?next=` parameter feature MUST pass through `isSafeCallbackUrl()` before storage.

### 1.4 Callback Flow (auth/callback/page.tsx)

```
Google redirects to /auth/callback?code=<auth_code>&state=<state>

/auth/callback/page.tsx
  1. Read sessionStorage["fenrir:pkce"] → { verifier, state, callbackUrl }
  2. CSRF check: pkceData.state === stateParam  [throws if mismatch]
  3. sessionStorage.removeItem("fenrir:pkce")   [clean up immediately]
  4. POST /api/auth/token {
       code,
       code_verifier: pkceData.verifier,
       redirect_uri: window.location.origin + "/auth/callback"
     }
  5. Receive { access_token, id_token, expires_in, refresh_token? }
  6. decodeIdToken(id_token)  → { sub, email, name, picture, exp }
     [client-side decode — safe because received directly from Google over HTTPS]
  7. Build FenrirSession; call setSession() → localStorage["fenrir:auth"]
  8. mergeAnonymousCards() (if anonymous cards exist)
  9. isSafeCallbackUrl(pkceData.callbackUrl) → redirect
```

### 1.5 Token Exchange Proxy (/api/auth/token)

The proxy is the only unprotected API route (no `requireAuth`). Its attack surface
is constrained by:

- **Origin allowlist**: `redirect_uri` origin must be in `ALLOWED_ORIGINS` (localhost, production, VERCEL_URL preview)
- **Rate limiting**: 10 requests/minute per IP (in-memory, per-instance)
- **Input validation**: `code`, `code_verifier`, `redirect_uri` all required
- **Secret isolation**: `GOOGLE_CLIENT_SECRET` never leaves the server

```
POST /api/auth/token
  1. Rate limit by IP (10 req/min)
  2. Parse and validate { code, code_verifier, redirect_uri }
  3. isAllowedRedirectUri(redirect_uri) → reject if not in allowlist
  4. Read GOOGLE_CLIENT_SECRET from process.env (server-only)
  5. POST https://oauth2.googleapis.com/token {
       code, code_verifier, redirect_uri,
       client_id: NEXT_PUBLIC_GOOGLE_CLIENT_ID,
       client_secret: GOOGLE_CLIENT_SECRET,
       grant_type: authorization_code
     }
  6. Forward Google's response (status + body) to browser
```

---

## 2. Session Storage Model

### 2.1 Session Structure (FenrirSession)

Stored at `localStorage["fenrir:auth"]`:

```typescript
interface FenrirSession {
  access_token: string;       // Google OAuth2 access token (1-hour TTL)
  id_token: string;           // Google OIDC JWT (used for API auth)
  refresh_token?: string;     // Present only on first consent (access_type=offline)
  expires_at: number;         // Date.now() + expires_in * 1000
  user: {
    sub: string;              // Google account ID → householdId
    email: string;
    name: string;
    picture: string;          // Google CDN avatar URL
  };
}
```

### 2.2 What Is Stored

| localStorage Key | Contents | Sensitivity |
|---|---|---|
| `fenrir:auth` | Full FenrirSession (tokens + user profile) | HIGH — contains live OAuth tokens |
| `fenrir:drive-token` | `{ access_token, expires_at }` | HIGH — Drive-scoped access token |
| `fenrir:pkce` | `{ verifier, state, callbackUrl }` (sessionStorage, not localStorage) | MEDIUM — transient, cleared after use |
| `fenrir_ledger:{sub}:cards` | Card array for this user | MEDIUM — financial metadata |
| `fenrir_ledger:{sub}:household` | Household record | LOW |
| `fenrir_ledger:schema_version` | Integer | LOW |

`fenrir:pkce` is in **sessionStorage** (tab-scoped, cleared on tab close). All others are in **localStorage** (origin-scoped, persists across tabs and sessions).

### 2.3 Expiration Handling

| Token | Expiration | Detection | Action |
|---|---|---|---|
| `id_token` / `access_token` | `expires_at` in session | `isSessionValid()` checks `expires_at > Date.now()` | User redirected to /sign-in |
| `refresh_token` | Long-lived (until user revokes) | Not actively checked | Used to skip re-consent on re-sign-in |
| Drive token | `expires_at` in drive-token record | `getStoredToken()` checks with 2-minute buffer | GIS popup re-triggered |

**There is no automatic token refresh.** When the `id_token` expires (~1 hour), the user must sign in again. This is a known architectural tradeoff (documented in ADR-005): background refresh would require storing the `refresh_token` and proxying refresh calls through the server to keep `client_secret` off the browser.

---

## 3. API Authentication Guard (requireAuth)

Every API route handler (except `/api/auth/token`) calls `requireAuth(request)` as
the first operation.

```typescript
// Pattern enforced by ADR-008 and CLAUDE.md:
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  // auth.user: { sub, email, name, picture }
  // handler logic begins here
}
```

### 3.1 requireAuth() Flow

```
requireAuth(request)
  1. Extract "Authorization: Bearer <id_token>" header
  2. If missing or malformed → 401 { error: "missing_token" }
  3. verifyIdToken(token)
       a. Read NEXT_PUBLIC_GOOGLE_CLIENT_ID from env
       b. jwtVerify(token, jwks) — jose library
          - Fetches/caches Google's JWKS from https://www.googleapis.com/oauth2/v3/certs
          - Verifies signature against RS256 public key
          - Verifies iss ∈ { "https://accounts.google.com", "accounts.google.com" }
          - Verifies aud === GOOGLE_CLIENT_ID
          - Verifies exp > now
       c. Returns { ok: true, user } or { ok: false, error, status }
  4. If verification fails → 401/403 with generic message
  5. Returns { ok: true, user: VerifiedUser }
```

### 3.2 JWKS Caching

The `createRemoteJWKSet(GOOGLE_JWKS_URL)` instance is a module-level singleton.
`jose` caches keys in memory and re-fetches when it encounters an unknown `kid`
(Google rotates keys approximately every 6 hours). This means key rotation is
handled automatically without a cold start.

---

## 4. Incremental Consent — Drive Scopes (GIS)

The initial OAuth sign-in requests only `openid email profile` scopes. When the user
activates Path B (Google Picker), Drive scopes are acquired via Google Identity
Services (GIS) incremental consent without disrupting the existing PKCE session.

### 4.1 Drive Token Flow (gis.ts + useDriveToken.ts)

```
User clicks "Browse the Archives"
  1. useDriveToken.requestDriveAccess()
  2. loadGisScript() — dynamically appends https://accounts.google.com/gsi/client
  3. google.accounts.oauth2.initTokenClient({
       client_id: NEXT_PUBLIC_GOOGLE_CLIENT_ID,
       scope: "drive.file spreadsheets.readonly",
       callback: (response) => { resolve(response.access_token) }
     })
  4. client.requestAccessToken({ prompt: "" })
     [GIS popup opens; user grants or denies]
  5. On grant: storeToken() → localStorage["fenrir:drive-token"]
     On denial: throws GisError("CONSENT_DECLINED")
```

### 4.2 Drive Scopes Requested

| Scope | Purpose |
|---|---|
| `https://www.googleapis.com/auth/drive.file` | Access files created or opened with the app (Picker) |
| `https://www.googleapis.com/auth/spreadsheets.readonly` | Read sheet values via Sheets API v4 |

These are the minimum scopes required for Path B. `drive.file` is narrower than
`drive.readonly` — it only covers files the user explicitly selects in the Picker.

---

## 5. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (untrusted)                                                 │
│                                                                      │
│  localStorage["fenrir:auth"]  ← tokens, user profile                │
│  localStorage["fenrir:drive-token"]  ← Drive access token           │
│  localStorage["fenrir_ledger:{sub}:cards"]  ← card data             │
│  sessionStorage["fenrir:pkce"]  ← transient PKCE state              │
│                                                                      │
│  Components read id_token from session and send as Bearer token      │
│  in Authorization header to API routes.                              │
└─────────────────────────────────┬───────────────────────────────────┘
                                   │ HTTPS
                    ───────────────┼───────────────  ← TRUST BOUNDARY
                                   │
┌─────────────────────────────────▼───────────────────────────────────┐
│  NEXT.JS SERVER (trusted — Vercel serverless)                        │
│                                                                      │
│  /api/auth/token — adds GOOGLE_CLIENT_SECRET to token exchange       │
│  /api/sheets/import — requireAuth() → LLM extraction                 │
│  /api/config/picker — requireAuth() → serves GOOGLE_PICKER_API_KEY  │
│                                                                      │
│  Server secrets (never sent to browser):                             │
│    GOOGLE_CLIENT_SECRET                                              │
│    FENRIR_ANTHROPIC_API_KEY                                          │
│    FENRIR_OPENAI_API_KEY                                             │
│    GOOGLE_PICKER_API_KEY  (served to browser on request, auth-gated) │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Anonymous-First Model

Users who do not sign in receive an anonymous household ID (`getAnonHouseholdId()`),
stored in `localStorage`. Their card data lives under
`fenrir_ledger:<anon-id>:cards`. When they sign in, `mergeAnonymousCards()` offers
to migrate anonymous data into their Google account's namespace.

The anonymous model means the sign-in page is an upsell destination, not a gate.
This is intentional (ADR-006).

---

## 7. Security Properties Summary

| Property | Implementation | Status |
|---|---|---|
| Code interception prevention | PKCE S256 | PASS |
| CSRF prevention | state parameter | PASS |
| client_secret isolation | Server-side proxy | PASS |
| Token signature verification | jose + Google JWKS | PASS |
| Audience binding | `aud === CLIENT_ID` | PASS |
| Expiration enforcement | `exp` checked by jose | PASS |
| Open redirect prevention | `isSafeCallbackUrl()` | PASS (post-SEV-001 fix) |
| Rate limiting on token endpoint | In-memory, per-instance | PARTIAL (not distributed) |
| Token storage | localStorage (XSS-accessible) | RESIDUAL RISK |
| Drive token persistence | localStorage | RESIDUAL RISK (see SEV-006) |
| Automatic token refresh | Not implemented | KNOWN GAP |

---

## 8. Patreon OAuth Linking Flow (ADR-009)

### 8.1 Overview

The Patreon integration adds a second OAuth flow, layered on top of the existing
Google authentication. Users must be signed in with Google before linking Patreon.
The Patreon tokens are stored server-side (Vercel KV, encrypted) rather than in
the browser, because Patreon requires a `client_secret` for token exchange and
the tokens must persist across browser sessions for webhook-driven entitlement updates.

This creates a **two-token model**:

| Token | Storage | Expiry | Purpose |
|---|---|---|---|
| Google `id_token` | localStorage | ~1 hour | Identity verification on every API request |
| Patreon `access_token` | Vercel KV (AES-256-GCM encrypted) | ~31 days | Patreon membership verification |
| Patreon `refresh_token` | Vercel KV (AES-256-GCM encrypted) | Long-lived | Refreshing expired access tokens |

### 8.2 Patreon Linking Flow

```
Browser (authenticated with Google)    Server Routes                    External
                                                                          Services
   |                                       |                               |
   |-- GET /api/patreon/authorize          |                               |
   |   Authorization: Bearer id_token      |                               |
   |                                       |                               |
   |   requireAuth() -> verifyIdToken()    |                               |
   |   generateState(googleSub)            |                               |
   |   AES-256-GCM encrypt(stateJson)      |                               |
   |   Random 12-byte IV per encryption    |                               |
   |                                       |                               |
   |<-- 302 to patreon.com/oauth2/authorize|                               |
   |   ?state=<encrypted>&client_id=...    |                               |
   |                                       |                               |
   |---------------- user grants consent ->|                         Patreon|
   |                                       |                               |
   |<-- 302 /api/patreon/callback          |                               |
   |   ?code=<auth_code>&state=<enc>       |                               |
   |                                       |                               |
   |-- GET /api/patreon/callback           |                               |
   |   (no requireAuth — exempt)           |                               |
   |                                       |                               |
   |   validateState(state)                |                               |
   |   decrypt -> check expiry -> googleSub|                               |
   |                                       |                               |
   |   exchangeCode(code, redirectUri)     |-- POST /oauth2/token -------> |
   |                                       |<-- {access_token, refresh} -- |
   |                                       |                               |
   |   getMembership(access_token)         |-- GET /v2/identity ---------->|
   |                                       |<-- {patron_status, amount} -- |
   |                                       |                               |
   |   encrypt(access_token) -> AES-GCM    |                               |
   |   encrypt(refresh_token) -> AES-GCM   |                               |
   |                                       |                               |
   |   setEntitlement(googleSub, record)   |-- KV.set entitlement:sub ---> |
   |                                       |-- KV.set patreon-user:pid --> |
   |                                       |                               |
   |<-- 302 /settings?patreon=linked&tier= |                               |
```

### 8.3 Entitlement Storage

Entitlements are stored in Vercel KV (Redis) with a 30-day TTL. Two keys are maintained:

| Key Pattern | Value | TTL | Purpose |
|---|---|---|---|
| `entitlement:{googleSub}` | `StoredEntitlement` JSON | 30 days | Primary lookup by Google user |
| `patreon-user:{patreonUserId}` | `{googleSub}` string | 30 days | Reverse index for webhook routing |

All `patreonAccessToken` and `patreonRefreshToken` values stored in KV are encrypted with
AES-256-GCM using a 32-byte key (`ENTITLEMENT_ENCRYPTION_KEY`). Each encryption uses a
fresh 12-byte random IV. The encrypted format is `base64(iv[12] + ciphertext + authTag[16])`.

### 8.4 Membership Check Flow (Stale Cache)

The `/api/patreon/membership` route caches membership status for 1 hour. When the
cache is stale, it automatically refreshes Patreon tokens and re-checks membership.
On Patreon API failure, it returns the last-known state with `{ stale: true }`.

### 8.5 Webhook Flow

Patreon sends webhook events for pledge changes. The webhook route:

1. Reads the raw request body (before JSON parsing) for HMAC validation
2. Validates `X-Patreon-Signature` using HMAC-MD5 (Patreon's mandated algorithm — platform constraint, see SEV-001 in 2026-03-02-patreon-integration.md)
3. Uses `crypto.timingSafeEqual()` to prevent timing attacks during signature comparison
4. Looks up the affected Google user via the `patreon-user:{patreonUserId}` KV index
5. Updates the stored entitlement based on the event type

### 8.6 CSRF Protection for Patreon OAuth State

Unlike the Google PKCE flow where state is a random hex string in `sessionStorage`,
the Patreon state token is AES-256-GCM encrypted on the server:

| Property | Google PKCE | Patreon OAuth |
|---|---|---|
| State storage | Browser sessionStorage | Encrypted in URL parameter |
| CSRF protection | State comparison | Encryption integrity (AES-GCM) + expiry |
| State expiry | Browser tab close | 10 minutes (hard-coded) |
| Server-side storage | None | None (stateless; see SEV-006) |

The state token embeds `{ googleSub, nonce, createdAt }` encrypted with the same key
used for token encryption (`ENTITLEMENT_ENCRYPTION_KEY`). Decryption failure causes
an immediate redirect to `/settings?patreon=error&reason=state_mismatch`.

### 8.7 Trust Boundary Update for Patreon

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (untrusted)                                                 │
│                                                                      │
│  localStorage["fenrir:auth"]  ← Google tokens, user profile         │
│  localStorage["fenrir:drive-token"]  ← Drive access token           │
│  localStorage["fenrir_ledger:{sub}:cards"]  ← card data             │
│  sessionStorage["fenrir:pkce"]  ← transient PKCE state              │
│                                                                      │
│  NO Patreon tokens in browser — stored server-side only              │
└─────────────────────────────────┬───────────────────────────────────┘
                                   │ HTTPS
                    ───────────────┼───────────────  ← TRUST BOUNDARY
                                   │
┌─────────────────────────────────▼───────────────────────────────────┐
│  NEXT.JS SERVER (trusted — Vercel serverless)                        │
│                                                                      │
│  /api/auth/token       — Google token exchange proxy (unprotected)  │
│  /api/sheets/import    — requireAuth() → LLM extraction              │
│  /api/config/picker    — requireAuth() → Picker API key              │
│  /api/patreon/authorize — requireAuth() → Patreon OAuth redirect     │
│  /api/patreon/callback — unprotected, encrypted-state CSRF protected │
│  /api/patreon/membership — requireAuth() → KV lookup + refresh       │
│  /api/patreon/webhook  — unprotected, HMAC-MD5 authenticated         │
│                                                                      │
│  Server secrets (never sent to browser):                             │
│    GOOGLE_CLIENT_SECRET                                              │
│    FENRIR_ANTHROPIC_API_KEY                                          │
│    GOOGLE_PICKER_API_KEY  (served auth-gated)                        │
│    PATREON_CLIENT_SECRET                                             │
│    PATREON_WEBHOOK_SECRET                                            │
│    ENTITLEMENT_ENCRYPTION_KEY                                        │
│    KV_REST_API_URL                                                   │
│    KV_REST_API_TOKEN                                                 │
└─────────────────────────────────┬───────────────────────────────────┘
                                   │
┌─────────────────────────────────▼───────────────────────────────────┐
│  VERCEL KV (Upstash Redis — trusted persistent store)               │
│                                                                      │
│  entitlement:{googleSub}   → StoredEntitlement (tokens encrypted)   │
│  patreon-user:{patreonId}  → googleSub (reverse index)              │
│                                                                      │
│  All Patreon tokens encrypted with AES-256-GCM before storage        │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.8 Security Properties — Patreon Integration

| Property | Implementation | Status |
|---|---|---|
| Patreon CSRF prevention | AES-256-GCM encrypted state token | PASS |
| State token expiry | 10-minute window | PASS |
| State token single-use | Not implemented — stateless | PARTIAL (see SEV-006) |
| Patreon client_secret isolation | Server-side only | PASS |
| Token encryption at rest | AES-256-GCM, random IV | PASS |
| GCM authentication tag | 128-bit | PASS |
| Webhook signature | HMAC-MD5 (Patreon mandated) | ACCEPTED RISK (see SEV-001) |
| Timing-safe comparison | crypto.timingSafeEqual() | PASS |
| Webhook replay protection | Not implemented | GAP (see SEV-004) |
| Redirect URI validation | Host header (not allowlisted) | FAIL — fix required (see SEV-002) |
| KV TTL enforcement | 30 days | PASS |
| Rate limiting (Patreon routes) | In-memory only | PARTIAL (see SEV-003) |
| Audit logging for entitlement changes | Debug level only (suppressed in prod) | GAP (see SEV-008) |
