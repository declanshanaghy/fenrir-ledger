# Trust Boundaries — Fenrir Ledger

**Owner**: Heimdall
**Last reviewed**: 2026-03-02

---

## Overview

Fenrir Ledger has two primary trust zones: the browser (untrusted) and the Next.js
server (trusted). A third zone, Google's infrastructure, is treated as trusted for
OAuth token responses and JWKS key material.

```
┌──────────────────────────────────────────────────────────────┐
│  ZONE 1: Browser (Untrusted)                                 │
│                                                              │
│  - localStorage (accessible to all same-origin scripts)      │
│  - sessionStorage (tab-scoped; accessible to same-origin JS) │
│  - React component state (memory)                            │
│  - URL parameters                                            │
│                                                              │
│  Threat: XSS can read all of localStorage                    │
│  Threat: Compromised dependency (supply chain) can do same   │
└───────────────────────────┬──────────────────────────────────┘
                             │  HTTPS only (HSTS enforced)
        ─────────────────────┼─────────────────── TRUST BOUNDARY A
                             │
┌───────────────────────────▼──────────────────────────────────┐
│  ZONE 2: Next.js Server (Trusted — Vercel Serverless)        │
│                                                              │
│  - process.env (server-only secrets)                         │
│  - API route handlers                                        │
│  - LLM provider (Anthropic/OpenAI via API key)               │
│                                                              │
│  Threat: Server-side code injection (supply chain)           │
│  Threat: SSRF from import pipeline                           │
└───────────────────────────┬──────────────────────────────────┘
                             │  HTTPS only
        ─────────────────────┼─────────────────── TRUST BOUNDARY B
                             │
┌───────────────────────────▼──────────────────────────────────┐
│  ZONE 3: Google Infrastructure (Trusted)                     │
│                                                              │
│  - accounts.google.com (OAuth consent, GIS)                  │
│  - oauth2.googleapis.com (token endpoint)                    │
│  - www.googleapis.com (JWKS)                                 │
│  - sheets.googleapis.com (Sheets API v4)                     │
│  - docs.google.com (Picker iframe, CSV export)               │
└──────────────────────────────────────────────────────────────┘
```

---

## Secrets and Their Locations

| Secret | Location | Accessible to Browser? | Notes |
|--------|----------|----------------------|-------|
| `GOOGLE_CLIENT_SECRET` | `process.env` (server) | No | Used only in `/api/auth/token` |
| `FENRIR_ANTHROPIC_API_KEY` | `process.env` (server) | No | Used only in `extract.ts` |
| `FENRIR_OPENAI_API_KEY` | `process.env` (server) | No | Optional; same module |
| `GOOGLE_PICKER_API_KEY` | `process.env` (server) | Yes — served on request | Auth-gated; GCP referrer restriction required |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `process.env` (public) | Yes — by design | OAuth Client ID is public; embedded in auth URL |
| Google `access_token` | `localStorage["fenrir:auth"]` | Yes — same-origin JS | XSS risk; 1-hour TTL |
| Google `id_token` | `localStorage["fenrir:auth"]` | Yes — same-origin JS | XSS risk; used as API Bearer token |
| Google `refresh_token` | `localStorage["fenrir:auth"]` | Yes — same-origin JS | XSS risk; long-lived |
| Drive `access_token` | `localStorage["fenrir:drive-token"]` | Yes — same-origin JS | XSS risk; 1-hour TTL |
| PKCE `code_verifier` | `sessionStorage["fenrir:pkce"]` | Yes — same-origin JS | Transient; removed after callback |

---

## What Crosses Each Boundary

### Boundary A: Browser → Server

Every request to an API route crosses this boundary. The following data crosses:

**Inbound (browser → server)**:
- `Authorization: Bearer <id_token>` header — on all protected routes
- Request body: `{ url }` or `{ csv }` for import, `{ code, code_verifier, redirect_uri }` for token exchange
- IP address (via `x-forwarded-for`)
- Origin header (used for redirect_uri validation)

**Outbound (server → browser)**:
- Token exchange response: `{ access_token, id_token, expires_in, refresh_token? }`
- Import result: `{ cards: Card[] }` or `{ error: ... }`
- Picker config: `{ pickerApiKey }` — the one server secret served to the browser

**What must never cross outbound:**
- `GOOGLE_CLIENT_SECRET`
- `FENRIR_ANTHROPIC_API_KEY`
- `FENRIR_OPENAI_API_KEY`
- Stack traces
- Internal error messages

### Boundary B: Server → Google

**Outbound (server → Google)**:
- Token exchange: `{ code, code_verifier, redirect_uri, client_id, client_secret, grant_type }`

**Inbound (Google → server)**:
- Token response: `{ access_token, id_token, expires_in, refresh_token? }`
- JWKS public keys (for signature verification)

---

## localStorage as an Untrusted Store

`localStorage` is **origin-scoped** but not **script-scoped**. Any JavaScript
executing on the same origin (`https://fenrir-ledger.vercel.app`) can read
`localStorage`. This includes:

1. First-party application code (intended)
2. XSS payloads injected via a content injection vulnerability
3. Compromised npm dependencies with access to `window.localStorage`
4. Browser extensions with access to page content (outside Fenrir's control)

### What an XSS payload could steal

A successful XSS attack on fenrir-ledger.vercel.app could read:
- `fenrir:auth` → full Google access token + id_token (valid for ~1 hour)
- `fenrir:drive-token` → Google Drive access token (valid for ~1 hour)
- `fenrir_ledger:{sub}:cards` → all credit card financial metadata
- `fenrir:pkce` → PKCE verifier if XSS fires during OAuth flow (tab-scoped)

### Mitigations in place

| Mitigation | Status |
|------------|--------|
| Content Security Policy | PASS (next.config.ts) |
| X-Frame-Options: DENY | PASS |
| X-Content-Type-Options: nosniff | PASS |
| HSTS (max-age=63072000) | PASS |
| Strict Referrer-Policy | PASS |
| React's default HTML escaping | PASS (protects against reflected XSS) |
| No `dangerouslySetInnerHTML` (verify per PR) | Should verify on each PR |

### Residual risk

- `refresh_token` in localStorage has no enforced TTL — if stolen, an attacker can
  obtain new access tokens indefinitely until the user revokes access in Google's
  account settings.
- Drive access token (`fenrir:drive-token`) is persisted rather than kept in React
  state, widening the XSS window (SEV-006 from 2026-03-02 report).
- LLM extraction output is passed through Zod validation before reaching the
  application, limiting injection through the AI path.

---

## Card Data Storage

Card data lives entirely in `localStorage` under per-household keys:

```
fenrir_ledger:{householdId}:cards   → Card[]
fenrir_ledger:{householdId}:household → Household
```

The `householdId` is the Google `sub` claim from the verified `id_token`. This
prevents cross-user data contamination on shared browsers (key namespacing).

**No card data is transmitted to the Fenrir server** except as CSV text during
import, which is processed by the LLM and discarded. Cards returned from the LLM
are stored by the browser; the server holds no persistent card records.

This means:
- There is no server-side authorization for card CRUD operations (they are local)
- An XSS attack can exfiltrate the entire card portfolio
- The application has no server-side audit trail of card data changes
