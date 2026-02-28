# ADR-005 — Auth Migration: Authorization Code + PKCE, Public Client, localStorage Session

**Status:** Accepted
**Date:** 2026-02-27
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

Replace Auth.js v5 with a browser-native **Authorization Code + PKCE** flow:

### Public client
- No `client_secret`. The Google OAuth client is registered as a web
  application without generating a secret.
- Google accepts PKCE-protected token requests without a `client_secret` from
  public clients. The `code_verifier` replaces the secret's role.

### PKCE (RFC 7636)
- `code_verifier`: 96-byte cryptographically random value, base64url-encoded.
- `code_challenge`: `base64url(SHA-256(code_verifier))`, method `S256`.
- Both generated in the browser using the Web Crypto API (`crypto.getRandomValues`,
  `crypto.subtle.digest`).
- The verifier is stored in `sessionStorage` during the redirect and sent to
  Google's token endpoint to complete the exchange.

### Token exchange in the browser
- The `/auth/callback` page calls `https://oauth2.googleapis.com/token`
  directly from the browser (no server proxy).
- Returns `access_token`, `id_token`, `expires_in`.

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
| `src/app/auth/callback/page.tsx` | OAuth callback — code exchange |
| `src/app/sign-in/page.tsx` | Sign-in page — initiates PKCE redirect |
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
| `.env.example` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` only |

---

## Consequences

### Positive
- **No server secrets** — `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is the only env var.
- **Zero server-side session state** — consistent with the localStorage-first
  architecture.
- **OIDC claims available** — `picture` and `email` are in the session from
  the start, enabling the header profile display.
- **Reduced attack surface** — no `AUTH_SECRET` to leak; no HttpOnly cookie
  to steal via XSS (localStorage has the same XSS exposure but no CSRF risk).
- **Simpler dependency tree** — `next-auth` removed.

### Negative / Trade-offs
- **No automatic token refresh** — when `expires_at` lapses (~1 hour), the
  user is redirected to `/sign-in`. A future sprint can add a refresh token
  flow using the offline_access scope.
- **localStorage is XSS-exposed** — same risk as any SPA storing tokens
  client-side. Mitigated by CSP headers and no eval/innerHTML patterns.
- **No SSR auth check** — pages render a loading state briefly on first load
  while `AuthContext` evaluates the session. This is acceptable for Fenrir
  Ledger's SPA model.

---

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Keep Auth.js v5 | Requires `AUTH_SECRET` + `GOOGLE_CLIENT_SECRET`; no direct id_token access; server-side middleware incompatible with localStorage-first model |
| BFF (Backend for Frontend) proxy | Adds server complexity for no benefit in a stateless SPA |
| Third-party auth SDK (Clerk, Auth0) | External dependency, cost, vendor lock-in |
