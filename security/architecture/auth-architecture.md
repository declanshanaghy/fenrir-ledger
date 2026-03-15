# Auth Architecture — Fenrir Ledger

**Owner**: Heimdall
**Last reviewed**: 2026-03-14 (updated for GKE Autopilot — replaced Vercel references)
**References**: ADR-005, ADR-006, ADR-008, ADR-010

---

## Overview

Fenrir Ledger uses Google OAuth 2.0 with PKCE (Proof Key for Code Exchange) as its
authentication mechanism. The application is anonymous-first: users may use the app
without signing in; signing in is a voluntary upgrade that enables cross-device sync.

There is no server-side session. All session state lives in the browser
(`localStorage`). The server validates identity on every API request by verifying
the Google `id_token` JWT against Google's public JWKS keys.

Subscription management is handled by Stripe Direct. There is no Patreon integration.
Entitlements are stored in Upstash Redis (KV store).

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

- **Origin allowlist**: `redirect_uri` origin must be in `ALLOWED_ORIGINS` (localhost, production)
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

Every API route handler (except `/api/auth/token` and `/api/stripe/webhook`) calls
`requireAuth(request)` as the first operation.

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

## 5. Stripe Subscription Authentication

### 5.1 Overview

Subscription management uses Stripe Direct exclusively. Users subscribe via Stripe
Checkout (hosted payment page). Entitlements are stored in Upstash Redis keyed on the
Google `sub` claim.

The Stripe integration creates a **layered model**:
- Google `id_token` in `localStorage` — identity on every API request
- Stripe subscription status in Upstash Redis — entitlement lookup

No Stripe secrets are stored in KV. The Stripe secret key is a server-side
process.env variable used server-to-server only.

### 5.2 Checkout Flow

```
Browser (authenticated with Google)    /api/stripe/checkout     Stripe / Upstash Redis
   |                                        |                           |
   |-- POST /api/stripe/checkout            |                           |
   |   Authorization: Bearer id_token       |                           |
   |                                        |                           |
   |   requireAuth() -> verifyIdToken()     |                           |
   |   auth.user.sub (googleSub)            |                           |
   |   auth.user.email (customerEmail)      |                           |
   |                                        |                           |
   |   stripe.checkout.sessions.create({    |                           |
   |     customer_email,                    |                           |
   |     metadata: { googleSub },           |                           |
   |     success_url: APP_BASE_URL + "..."  |                           |
   |     cancel_url: APP_BASE_URL + "..."   |                           |
   |   })                                   |                           |
   |                                        |-- Stripe API call ------> |
   |                                        |<-- { url } ------------- |
   |                                        |                           |
   |<-- { url: "checkout.stripe.com/..." }  |                           |
   |                                        |                           |
   |-- Redirect to Stripe-hosted checkout   |                           |
   |   User completes payment               |                           |
   |                                        |                           |
   |   Stripe --> POST /api/stripe/webhook  |                           |
   |   checkout.session.completed           |                           |
   |   [SHA-256 HMAC verified]              |                           |
   |   setStripeEntitlement(googleSub) ---- |-- KV.set ---------------> |
```

### 5.3 Webhook Authentication

The `/api/stripe/webhook` route is not behind `requireAuth`. It is authenticated by:

1. Reading the raw request body (before JSON parsing) for HMAC validation
2. Validating `stripe-signature` using `stripe.webhooks.constructEvent()` with SHA-256 HMAC
3. Using `STRIPE_WEBHOOK_SECRET` from process.env — never logged or returned

This is a stronger cryptographic guarantee than the previous Patreon HMAC-MD5 design.

### 5.4 Entitlement Storage

| Key Pattern | Value | TTL | Purpose |
|---|---|---|---|
| `entitlement:{googleSub}` | `StripeEntitlement` JSON | 30 days | Primary lookup by Google user |
| `stripe-customer:{customerId}` | `{googleSub}` string | 30 days | Reverse index for webhook routing |

No tokens are encrypted at rest (unlike Patreon). No user credentials are stored.
The Stripe subscription ID and status are the only data in KV.

### 5.5 Accepted Webhook Exemption

`/api/stripe/webhook` is the only Stripe route that does not call `requireAuth`.
This is documented in the API route checklist as an accepted exception. The
compensating control is SHA-256 HMAC via `stripe.webhooks.constructEvent()`.

---

## 6. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (untrusted)                                                 │
│                                                                      │
│  localStorage["fenrir:auth"]  ← Google tokens, user profile         │
│  localStorage["fenrir:drive-token"]  ← Drive access token           │
│  localStorage["fenrir_ledger:{sub}:cards"]  ← card data             │
│  sessionStorage["fenrir:pkce"]  ← transient PKCE state              │
│                                                                      │
│  NO Stripe secrets in browser — server-side only                     │
│  NO entitlement data in browser — fetched on demand from API         │
└─────────────────────────────────┬───────────────────────────────────┘
                                   │ HTTPS
                    ───────────────┼───────────────  ← TRUST BOUNDARY
                                   │
┌─────────────────────────────────▼───────────────────────────────────┐
│  NEXT.JS SERVER (trusted — GKE Autopilot)                            │
│                                                                      │
│  /api/auth/token       — Google token exchange proxy (unprotected)  │
│  /api/sheets/import    — requireAuth() → LLM extraction              │
│  /api/config/picker    — requireAuth() → Picker API key              │
│  /api/stripe/checkout  — requireAuth() → Stripe checkout session     │
│  /api/stripe/membership — requireAuth() → KV entitlement lookup     │
│  /api/stripe/portal    — requireAuth() → Stripe billing portal       │
│  /api/stripe/unlink    — requireAuth() → KV delete + Stripe cancel  │
│  /api/stripe/webhook   — unprotected, SHA-256 HMAC authenticated     │
│                                                                      │
│  Server secrets (never sent to browser):                             │
│    GOOGLE_CLIENT_SECRET                                              │
│    FENRIR_ANTHROPIC_API_KEY                                          │
│    GOOGLE_PICKER_API_KEY  (served auth-gated)                        │
│    STRIPE_SECRET_KEY                                                 │
│    STRIPE_WEBHOOK_SECRET                                             │
│    STRIPE_PRICE_ID                                                   │
│    KV_REST_API_URL                                                   │
│    KV_REST_API_TOKEN                                                 │
└─────────────────────────────────┬───────────────────────────────────┘
                                   │
┌─────────────────────────────────▼───────────────────────────────────┐
│  UPSTASH REDIS (trusted persistent store)                           │
│                                                                      │
│  entitlement:{googleSub}          → StripeEntitlement               │
│  stripe-customer:{stripeId}       → googleSub (reverse index)       │
│                                                                      │
│  No token encryption required — no credentials stored               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Anonymous-First Model

Users who do not sign in receive an anonymous household ID (`getAnonHouseholdId()`),
stored in `localStorage`. Their card data lives under
`fenrir_ledger:<anon-id>:cards`. When they sign in, `mergeAnonymousCards()` offers
to migrate anonymous data into their Google account's namespace.

The anonymous model means the sign-in page is an upsell destination, not a gate.
This is intentional (ADR-006).

---

## 8. Internal Service Auth — oauth2-proxy Sidecar Pattern

Internal admin services (Umami analytics, Odin's Throne monitor) use a standardised
**oauth2-proxy sidecar** pattern instead of handrolled OAuth middleware.

### 8.1 Architecture

```
Internet → GKE Ingress → Service → Pod
                                   ├── oauth2-proxy (:4180)   ← all external traffic
                                   │     ↓ authenticated pass-through
                                   └── App container (:3001 / :3000)
```

oauth2-proxy intercepts all HTTP requests, enforces Google OAuth 2.0, and proxies
authenticated requests to the upstream app container over localhost. The app
container is not directly reachable from outside the pod.

### 8.2 Services Using This Pattern

| Service | Namespace | oauth2-proxy port | App port | Skip-auth routes |
|---|---|---|---|---|
| Umami analytics | fenrir-analytics | 4180 | 3000 | `GET /script.js`, `POST /api/send` |
| Odin's Throne monitor | fenrir-monitor | 4180 | 3001 | `GET /healthz` |

### 8.3 Secret Management

Each service has its own K8s secret (`<service>-oauth2-proxy-secrets`) containing:
- `GOOGLE_CLIENT_ID` — OAuth client ID
- `GOOGLE_CLIENT_SECRET` — OAuth client secret
- `OAUTH2_PROXY_COOKIE_SECRET` — 32-byte random cookie signing key
- `emails.txt` — allowlist of authorised email addresses

Secrets are created imperatively by the CI/CD pipeline and never rendered into
Helm chart values. `SESSION_SECRET` and `ALLOWED_EMAIL` env vars are no longer
used by Odin's Throne (removed in issue #933).

### 8.4 Security Properties

| Property | Implementation |
|---|---|
| Auth enforcement | oauth2-proxy validates Google OAuth on every request |
| Email allowlist | `--authenticated-emails-file` from K8s secret volume |
| CSRF protection | oauth2-proxy state parameter |
| Cookie signing | `OAUTH2_PROXY_COOKIE_SECRET` — 32-byte random key |
| Cookie flags | `secure=true`, `samesite=lax` |
| Health check bypass | `--skip-auth-route` per service (e.g. `/healthz`) |
| No custom session tokens | Removed handrolled HMAC-SHA256 sessions (issue #933) |

---

## 9. Security Properties Summary

| Property | Implementation | Status |
|---|---|---|
| Code interception prevention | PKCE S256 | PASS |
| CSRF prevention | state parameter | PASS |
| client_secret isolation | Server-side proxy | PASS |
| Token signature verification | jose + Google JWKS | PASS |
| Audience binding | `aud === CLIENT_ID` | PASS |
| Expiration enforcement | `exp` checked by jose | PASS |
| Open redirect prevention | `isSafeCallbackUrl()` | PASS |
| Rate limiting on token endpoint | In-memory, per-instance | PARTIAL (not distributed) |
| Token storage | localStorage (XSS-accessible) | RESIDUAL RISK |
| Drive token persistence | localStorage | RESIDUAL RISK |
| Automatic token refresh | Not implemented | KNOWN GAP |
| Stripe webhook authentication | SHA-256 HMAC via `constructEvent()` | PASS |
| Stripe redirect URL safety | APP_BASE_URL only | PASS (fixed SEV-002) |
| Stripe CSP coverage | js.stripe.com, api.stripe.com, hooks.stripe.com | PASS (fixed SEV-003) |
| Prompt injection prevention | System/user role separation + RAW DATA instruction | PASS (PR #171) |
