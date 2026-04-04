# ADR-008 — Server-Side API Route Authentication via Google id_token Verification

**Status:** Accepted
**Date:** 2026-03-01
**Author:** FiremanDecko (Principal Engineer)
**Related:** ADR-005 (auth/PKCE), ADR-006 (anonymous-first)

---

## Context

Vercel-hosted API routes are unprotected. The client already has a Google `id_token` (signed JWT from PKCE flow). We need server-side verification before processing requests that consume LLM credits.

Constraints: anonymous-first model preserved (only API routes gated, not pages). `/api/auth/token` must remain unprotected (token exchange endpoint).

## Decision

**Verify the Google `id_token` locally against Google's JWKS using the `jose` library.**

Rejected alternatives:
- **Google tokeninfo round-trip** — 100-300ms per-request latency, unacceptable
- **Custom HMAC session token** — redundant when signed JWT already exists

### Implementation Pattern

Per-route auth guard (not middleware):

1. **`src/lib/auth/verify-id-token.ts`** — `jwtVerify()` from `jose` against Google JWKS, checking issuer, audience, expiry.
2. **`src/lib/auth/require-auth.ts`** — Extracts Bearer token, calls `verifyIdToken()`, returns `{ ok: true, user }` or `{ ok: false, response }`.
3. **Each protected route** calls `requireAuth(request)` at top of handler:
   ```typescript
   const auth = await requireAuth(request);
   if (!auth.ok) return auth.response;
   ```
4. **Client** sends `Authorization: Bearer <id_token>` on protected API calls.

### Protected Routes

| Route | Protected | Reason |
|-------|-----------|--------|
| `GET /api/config/picker` | Yes | Serves server-side API key to client |
| `POST /api/sheets/import` | Yes | Consumes LLM API credits |
| `POST /api/stripe/checkout` | Yes | Creates paid checkout sessions on behalf of user |
| `GET /api/stripe/membership` | Yes | Returns user-specific entitlement data |
| `POST /api/stripe/portal` | Yes | Creates billing portal sessions on behalf of user |
| `POST /api/stripe/unlink` | Yes | Cancels user subscription |
| `POST /api/auth/token` | No | Token exchange — no token exists yet |
| `POST /api/stripe/webhook` | No (Stripe signature) | Stripe sends webhooks — secured by SHA-256 HMAC via `constructEvent()` |

All future API routes must use `requireAuth()` (CLAUDE.md unbreakable rule).

## Consequences

**Positive:** API routes protected, no per-request latency (JWKS cached), minimal dependency (`jose` ~15KB).

**Trade-offs:** Cannot detect real-time token revocation (tokens short-lived ~1hr, acceptable). Anonymous users cannot use import (intentional — gated on LLM credits). `jose` added as dependency.

**Unchanged:** `FenrirSession` type, `AuthContext`, localStorage, anonymous-first model for pages, `.env.example` (uses existing `NEXT_PUBLIC_GOOGLE_CLIENT_ID`).
