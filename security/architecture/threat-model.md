# Threat Model — Fenrir Ledger

**Owner**: Heimdall
**Last reviewed**: 2026-03-02
**Methodology**: STRIDE-lite with OWASP Top 10 mapping

---

## 1. Assets

| Asset | Sensitivity | Location | Impact if Compromised |
|-------|------------|----------|----------------------|
| Google `id_token` | HIGH | localStorage["fenrir:auth"] | Attacker can call all API routes as victim |
| Google `access_token` | HIGH | localStorage["fenrir:auth"] | Attacker can act on victim's Google account (limited to authorized scopes) |
| Google `refresh_token` | CRITICAL | localStorage["fenrir:auth"] | Attacker can obtain new access tokens indefinitely (until revoked) |
| Drive `access_token` | HIGH | localStorage["fenrir:drive-token"] | Attacker can read victim's Google Sheets/Drive files |
| `GOOGLE_CLIENT_SECRET` | CRITICAL | Server env only | Attacker can exchange any valid auth code for tokens |
| `FENRIR_ANTHROPIC_API_KEY` | HIGH | Server env only | Attacker can use Fenrir's LLM quota; prompt injection escalation |
| `GOOGLE_PICKER_API_KEY` | MEDIUM | Server env, served to browser | Attacker can display Picker UI with Fenrir's quota |
| Card portfolio data | MEDIUM | localStorage per-user | Financial metadata exposure (no PAN/CVV stored) |
| User PII (email, name, picture) | MEDIUM | localStorage["fenrir:auth"].user | Identity exposure |

---

## 2. Threat Actors

### 2.1 Unauthenticated External Attacker

**Capabilities**: Can send arbitrary HTTP requests to API routes. Cannot read the victim's localStorage. Cannot obtain Google tokens without browser-side exploit.

**Primary attack surfaces**:
- `/api/auth/token` (only unprotected route) — token exchange brute force, DoS
- OAuth state forgery (blocked by PKCE + state parameter)

**Current mitigations**: Rate limiting on `/api/auth/token`, redirect_uri origin allowlist, PKCE.

### 2.2 Authenticated User (Insider Threat)

**Capabilities**: Has a valid session. Can call all protected API routes with their own `id_token`. Cannot directly access other users' data (no server-side shared state).

**Primary attack surfaces**:
- Import pipeline — can submit adversarial CSV or URL input
- Prompt injection in LLM extraction

**Current mitigations**: Auth guard, CSV truncation, Zod output validation, LLM security rules.

### 2.3 XSS Payload (Injected Script)

**Capabilities**: Executes as same-origin JavaScript. Can read all localStorage. Can make authenticated API calls using the victim's tokens. Can exfiltrate data to external servers.

**Primary attack surfaces**:
- `localStorage["fenrir:auth"]` → token theft
- `localStorage["fenrir:drive-token"]` → Drive access
- `localStorage[fenrir_ledger:*:cards]` → card data exfiltration

**Current mitigations**: CSP with `script-src 'self' 'unsafe-inline'`... (note: `unsafe-inline` reduces CSP effectiveness against inline XSS).

**Residual risk**: `unsafe-inline` in CSP script-src allows inline script execution. A DOM-based XSS vulnerability could still execute. Nonce-based or hash-based CSP would provide stronger protection.

### 2.4 Compromised npm Dependency (Supply Chain Attack)

**Capabilities**: Executes server-side in Next.js API routes. Can read `process.env`. Can read/write to any storage accessible from server code. Can exfiltrate secrets to external endpoints.

**Primary attack surfaces**:
- `GOOGLE_CLIENT_SECRET` exposure
- `FENRIR_ANTHROPIC_API_KEY` exposure
- Modification of LLM extraction output before Zod validation

**Current mitigations**: Zod validation on LLM output, no eval/dynamic code execution, no server-side localStorage access. No mitigations specifically for dependency compromise.

---

## 3. Attack Surfaces

### 3.1 OAuth Flow

| Attack | STRIDE | Mitigation | Residual Risk |
|--------|--------|-----------|---------------|
| Authorization code interception | Spoofing | PKCE S256 | Low |
| CSRF via forged redirect | Spoofing | state parameter | Low |
| Open redirect post-auth | Tampering | `isSafeCallbackUrl()` | Low (fixed post-SEV-001) |
| token endpoint DoS/brute force | DoS | In-memory rate limit (10/min) | Medium — not distributed |
| client_secret exposure | Information Disclosure | Server-side proxy | Low |

### 3.2 Import Pipeline

| Attack | STRIDE | Mitigation | Residual Risk |
|--------|--------|-----------|---------------|
| SSRF via URL import | Elevation of Privilege | hostname.endsWith("google.com") | Low — `redirect:follow` is residual |
| Prompt injection via CSV | Tampering | LLM security rules, Zod validation | Medium — no structural separation |
| Oversized CSV DoS | DoS | 100,000 char truncation | Low |
| LLM output injection | Tampering | Zod schema validation | Low |
| Unauthenticated import | Elevation of Privilege | requireAuth() | Low |

### 3.3 localStorage / Session

| Attack | STRIDE | Mitigation | Residual Risk |
|--------|--------|-----------|---------------|
| Token theft via XSS | Information Disclosure | CSP, HSTS, X-Frame-Options | Medium — unsafe-inline in CSP |
| Refresh token theft | Information Disclosure | Same | High impact — no TTL |
| Session fixation | Spoofing | Tokens are derived from Google auth; no server session | Low |
| Cross-user data contamination | Information Disclosure | Per-household key namespacing | Low |
| Anonymous card merge without validation | Tampering | None (SEV-013) | Low — pre-auth data only |

### 3.4 Google Picker / Drive

| Attack | STRIDE | Mitigation | Residual Risk |
|--------|--------|-----------|---------------|
| Picker API key abuse | Elevation of Privilege | Auth-gated endpoint, GCP referrer restriction (recommended) | Medium |
| Drive token theft via XSS | Information Disclosure | CSP | Medium — stored in localStorage |
| Malicious spreadsheet content | Tampering | Zod validation, LLM security rules | Low–Medium |

---

## 4. Mitigations In Place

### Authentication

- PKCE S256 with 768-bit code verifier entropy
- CSRF state parameter (128-bit entropy)
- Server-side JWKS verification (jose library)
- `aud` and `iss` claim validation on every API request
- `exp` check on every API request (automatic via jose)
- Redirect URI origin allowlist on token proxy
- Per-IP rate limiting on token endpoint (in-memory)

### Transport

- HSTS with 2-year max-age and preload flag (`max-age=63072000; includeSubDomains; preload`)
- All API routes served over HTTPS in production
- `Referrer-Policy: strict-origin-when-cross-origin`

### Content Security

- CSP restricting scripts to self, Google APIs, and Vercel analytics
- `X-Frame-Options: DENY` (prevents clickjacking)
- `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `form-action: 'self'` (prevents form hijacking)
- `base-uri: 'self'` (prevents base tag injection)

### Data Integrity

- Zod schema validation on all LLM output
- LLM prompt includes explicit rules against PAN/CVV/SSN in output
- CSV truncation at 100,000 characters
- Per-household key namespacing in localStorage

### Input Validation

- URL import: hostname must end with `google.com`
- Sheet ID: `[a-zA-Z0-9_-]+` regex
- Token proxy: requires `code`, `code_verifier`, `redirect_uri`
- Import route: exactly one of `url` or `csv` required; both checked as strings

---

## 5. Residual Risks

| Risk | Severity | Description | Recommended Mitigation |
|------|----------|-------------|------------------------|
| Refresh token in localStorage | HIGH | Long-lived token accessible to XSS; no server-side revocation | Move to HttpOnly cookie or shorten TTL |
| Drive token in localStorage | MEDIUM | Persisted despite 1-hour TTL; widens XSS window | Keep in React state only (SEV-006) |
| `unsafe-inline` in CSP | MEDIUM | Allows inline script execution; reduces XSS protection | Move to nonce-based CSP |
| Non-distributed rate limiting | MEDIUM | In-memory rate limiter doesn't work across serverless instances | Upstash Redis / Vercel KV |
| Prompt injection via CSV | MEDIUM | No structural separator between instructions and data | Use separate system/user message roles |
| Anonymous data merge without Zod | LOW | Malformed localStorage data merged without validation | Add `CardsArraySchema.safeParse()` |
| No refresh token rotation | LOW | Refresh token never rotated; stolen token remains valid | Implement token refresh + rotation via server proxy |
| LLM singleton caches stale key | LOW | API key rotation may not take effect until cold start | Document; add version check to invalidate singleton |
