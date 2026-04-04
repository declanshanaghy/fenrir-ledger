# ADR-005 — Auth Migration: Authorization Code + PKCE, Server Token Proxy, localStorage Session

**Status:** Accepted
**Date:** 2026-02-27
**Last amended:** 2026-02-28 — added server-side token proxy (see amendment below)
**Authors:** FiremanDecko (Principal Engineer)
**Supersedes:** ADR-004 (Auth.js v5 + HttpOnly cookie + server-side middleware)

---

## Context

ADR-004 established Google OAuth via Auth.js v5 with:
- A server-side `AUTH_SECRET` used to sign the JWT session cookie.
- An HttpOnly cookie carrying the session.
- Next.js middleware (`src/middleware.ts`) reading `req.auth` to protect routes.
- A `GOOGLE_CLIENT_SECRET` sent from the server to exchange the auth code.

This pattern works well for confidential clients (traditional web apps with a
back end) but introduces unnecessary complexity for Fenrir Ledger, which is:
- A **single-page application** (Next.js App Router with all data in localStorage).
- **Stateless on the server** — no database, no server-side session store.
- Already storing all user data in `localStorage` per-household.

The product requirements from Freya (Sprint 3) added two new constraints:
1. The **id_token** claims (`picture`, `email`) must be available to the header.
2. The auth pattern should align with the "public client" model — no secrets.

---

## Decision

Replace Auth.js v5 with a browser-native **Authorization Code + PKCE** flow
with a thin server-side token exchange proxy:

### PKCE (RFC 7636) — browser-owned
- `code_verifier`: 96-byte cryptographically random value, base64url-encoded.
- `code_challenge`: `base64url(SHA-256(code_verifier))`, method `S256`.
- Both generated in the browser using the Web Crypto API (`crypto.getRandomValues`,
  `crypto.subtle.digest`).
- The verifier is stored in `sessionStorage` during the redirect and sent to
  the server proxy to complete the exchange.
- The browser retains full ownership of the PKCE flow (verifier, challenge,
  state). PKCE protection against code interception remains intact.

### Token exchange via server proxy (`/api/auth/token`)
- **Root cause of the original approach failing:** Google requires a
  `client_secret` for Web Application type OAuth clients even when PKCE is
  used. It will not accept a PKCE-only exchange without a secret.
- **Desktop/Installed app clients** omit the secret but restrict redirect URIs
  to `localhost` only — incompatible with Vercel production deployments.
- **Resolution:** a thin Next.js API route (`/api/auth/token`) proxies the
  final token exchange server-side. The browser POSTs
  `{ code, code_verifier, redirect_uri }` to this route; the route adds
  `client_secret` (from `process.env.GOOGLE_CLIENT_SECRET`) before forwarding
  to `https://oauth2.googleapis.com/token`.
- `client_secret` never appears in the browser or client bundle. Only
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` remains client-side.
- The proxy validates the `redirect_uri` origin against a whitelist
  (`http://localhost:9653`, `https://fenrir-ledger.vercel.app`) as an
  additional anti-CSRF measure.
- Google's response is forwarded unchanged (status + body).

### Token exchange response
- Returns `access_token`, `id_token`, `expires_in` — identical shape to the
  previous direct Google call. No change to session construction.

### localStorage session
- The `id_token` JWT payload is base64url-decoded in the browser to extract
  `{ sub, email, name, picture }`. No signature verification is needed —
  the token was received directly from Google's token endpoint over HTTPS,
  and the exchange was PKCE-protected.
- A `FenrirSession` object is stored under `localStorage("fenrir:auth")`.
- `householdId` continues to be the Google `sub` claim.

### Client-side route protection
- `AuthContext` reads `localStorage("fenrir:auth")` on mount.
- If absent or `expires_at < Date.now()`, redirects to `/sign-in?callbackUrl={path}`.
- The Next.js middleware is a pass-through (no server-side auth check).

---

## Session Shape

```typescript
interface FenrirSession {
  access_token: string;
  id_token: string;
  expires_at: number;       // Date.now() + expires_in * 1000
  user: {
    sub: string;            // householdId — immutable Google account ID
    email: string;
    name: string;
    picture: string;        // Google CDN avatar URL
  };
}
```

Stored at: `localStorage("fenrir:auth")`

---

## Files Changed

### Created
| File | Purpose |
|------|---------|
| `src/lib/auth/pkce.ts` | PKCE utilities (verifier, challenge, state) |
| `src/lib/auth/session.ts` | localStorage session read/write |
| `src/app/auth/callback/page.tsx` | OAuth callback — code exchange via proxy |
| `src/app/sign-in/page.tsx` | Sign-in page — initiates PKCE redirect |
| `src/app/api/auth/token/route.ts` | Server proxy — adds client_secret, forwards to Google |
| `src/contexts/AuthContext.tsx` | React context for auth state |
| `src/hooks/useAuth.ts` | `useAuth()` hook (mirrors `useSession()` shape) |

### Deleted
| File | Reason |
|------|--------|
| `src/auth.ts` | Auth.js v5 config — no longer needed |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js handlers — no longer needed |
| `src/components/layout/AuthProvider.tsx` | SessionProvider wrapper — replaced |

### Modified
| File | Change |
|------|--------|
| `src/middleware.ts` | Pass-through only; no Auth.js import |
| `src/app/layout.tsx` | `AuthProvider` from `@/contexts/AuthContext` |
| `src/app/page.tsx` | `useSession()` → `useAuth()`; `householdId` from `sub` |
| `src/app/valhalla/page.tsx` | Same |
| `src/app/cards/new/page.tsx` | Same |
| `src/app/cards/[id]/edit/page.tsx` | Same |
| `src/components/layout/TopBar.tsx` | Google avatar + email + dropdown |
| `src/components/layout/KonamiHowl.tsx` | `useSession()` → `useAuth()` |
| `src/lib/types.ts` | Added `FenrirSession` interface |
| `package.json` | Removed `next-auth` |
| `.env.example` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |

---

## Consequences

### Positive
- **client_secret stays server-side** — `GOOGLE_CLIENT_SECRET` is a server-only
  env var; it never appears in the browser or Next.js client bundle.
- **PKCE protection intact** — the browser still generates and owns the
  `code_verifier` and `code_challenge`. Code interception is still prevented.
- **Zero server-side session state** — consistent with the localStorage-first
  architecture. The proxy handles only the exchange; no session is stored on
  the server.
- **OIDC claims available** — `picture` and `email` are in the session from
  the start, enabling the header profile display.
- **Reduced attack surface vs. Auth.js** — no `AUTH_SECRET` to leak; no
  HttpOnly cookie to steal via XSS (localStorage has the same XSS exposure
  but no CSRF risk).
- **Simpler dependency tree** — `next-auth` removed.

### Negative / Trade-offs
- **One additional server env var** — `GOOGLE_CLIENT_SECRET` must be set in
  Vercel project settings and in local `.env.local`. The `.env.example`
  template documents this.
- **Thin server dependency** — the token exchange now requires the Next.js
  server to be running (no static-export compatibility). Fenrir Ledger already
  requires SSR for API routes, so this is acceptable.
- **No automatic token refresh** — when `expires_at` lapses (~1 hour), the
  user is redirected to `/sign-in`. A future sprint can add a refresh token
  flow using the `offline_access` scope.
- **localStorage is XSS-exposed** — same risk as any SPA storing tokens
  client-side. Mitigated by CSP headers and no eval/innerHTML patterns.
- **No SSR auth check** — pages render a loading state briefly on first load
  while `AuthContext` evaluates the session. This is acceptable for Fenrir
  Ledger's SPA model.

---

## Amendment — 2026-02-28: Server Token Proxy

**Problem discovered:** The original decision assumed Google would accept a
PKCE-only token exchange without a `client_secret` for Web Application type
clients. In practice Google enforces `client_secret` for all Web Application
clients regardless of PKCE. The initial implementation resulted in:
```
{ error: "client_secret is missing" }
```

**Alternatives re-evaluated:**

| Option | Reason rejected |
|--------|----------------|
| Switch to Desktop/Installed app type | Restricts redirect URIs to `localhost` only — Vercel production is blocked |
| Keep direct browser exchange | Requires embedding `client_secret` in client bundle — secret is compromised |
| Full BFF session server | Adds persistent server state; over-engineered for a localStorage-first SPA |

**Resolution:** thin Next.js API route at `/api/auth/token` that proxies only
the token exchange. All other auth concerns (PKCE generation, state, session
storage) remain browser-side. This is the minimal change that satisfies
Google's requirement while keeping `client_secret` off the client.

---

## Original Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Keep Auth.js v5 | Requires `AUTH_SECRET` + `GOOGLE_CLIENT_SECRET`; no direct id_token access; server-side middleware incompatible with localStorage-first model |
| BFF (Backend for Frontend) proxy | Adds server complexity for no benefit in a stateless SPA |
| Third-party auth SDK (e.g., Auth0) | External dependency, cost, vendor lock-in |
