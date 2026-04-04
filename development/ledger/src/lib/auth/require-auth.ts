/**
 * Route-level auth guard for Next.js API routes — Fenrir Ledger
 *
 * Extracts the Bearer token from the Authorization header, verifies it as a
 * valid Fenrir JWT (HS256, signed with KMS-decrypted secret), and returns the
 * verified user or an error response ready to return from the route handler.
 *
 * Sliding window refresh (issue #2060):
 *   If the verified JWT was issued more than 15 days ago, requireAuth mints a
 *   fresh 30-day JWT and includes it in AuthSuccess as `newToken`. Callers pass
 *   this to `applyTokenRefresh(response, auth)` before returning, which sets the
 *   `X-Fenrir-Token` response header. The client (auth-fetch.ts) detects this
 *   header and swaps in the new token transparently — no background timers needed.
 *
 * Usage in a route handler:
 *   const auth = await requireAuth(request);
 *   if (!auth.ok) return auth.response;
 *   // auth.user is now the verified user
 *   const response = NextResponse.json({ ... });
 *   return applyTokenRefresh(response, auth); // adds X-Fenrir-Token if refreshed
 *
 * Why per-route guards instead of middleware:
 *   - /api/auth/token must remain unprotected (OAuth token exchange)
 *   - Per-route guards are explicit and auditable in each handler
 *   - Runs in Node.js runtime — has access to KMS-decrypted secret via getJwtSecret()
 *   - Avoids Edge Runtime constraints (KMS SDK requires Node.js APIs)
 *
 * See ADR-008 for the full rationale.
 * See issue #2060 for the JWT session migration.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyFenrirJwt, signFenrirJwt, needsSlidingRefresh } from "./fenrir-jwt";
import { log } from "@/lib/logger";

/** Decoded user from a verified Fenrir JWT. */
export interface VerifiedUser {
  /** Google account immutable ID (maps to householdId) */
  sub: string;
  /** User's email address */
  email: string;
  /** Household ID from JWT payload (defaults to sub for new users) */
  householdId: string;
}

/** Auth check succeeded — verified user is available. */
export type AuthSuccess = {
  ok: true;
  user: VerifiedUser;
  /**
   * New Fenrir JWT when sliding window refresh was triggered (token age > 15 days).
   * Pass to applyTokenRefresh() before returning from the route handler.
   * Undefined when the token is still fresh.
   */
  newToken?: string;
};

/** Auth check failed — pre-built NextResponse is ready to return. */
export type AuthFailure = { ok: false; response: NextResponse };

/** Result type for requireAuth(). */
export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Verifies the caller is authenticated via a Fenrir JWT.
 *
 * Expects: `Authorization: Bearer <fenrir_token>` header.
 *
 * Sliding window: if the JWT was issued > 15 days ago, a new JWT is minted and
 * returned in `auth.newToken`. Pass to applyTokenRefresh() before returning.
 *
 * @param request - The incoming Next.js request
 * @returns AuthResult — either { ok: true, user, newToken? } or { ok: false, response }
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  log.debug("requireAuth called", {
    hasAuthHeader: !!authHeader,
    hasBearerPrefix: authHeader?.startsWith("Bearer ") ?? false,
  });

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    log.debug("requireAuth returning", { ok: false, error: "missing_token", status: 401 });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "missing_token",
          error_description: "Authorization: Bearer <fenrir_token> header is required.",
        },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.slice(7); // Strip "Bearer " prefix

  const result = await verifyFenrirJwt(token);

  if (!result.ok) {
    log.debug("requireAuth returning", { ok: false, error: "invalid_token", status: result.status });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "invalid_token",
          error_description: result.error,
        },
        { status: result.status },
      ),
    };
  }

  const { payload } = result;
  const user: VerifiedUser = {
    sub: payload.sub,
    email: payload.email,
    householdId: payload.householdId,
  };

  // ── Sliding window refresh ──────────────────────────────────────────────────
  // If the token is past the 15-day midpoint, mint a new 30-day token.
  // The caller passes it through applyTokenRefresh() → X-Fenrir-Token header.
  let newToken: string | undefined;
  if (needsSlidingRefresh(payload.iat)) {
    try {
      newToken = await signFenrirJwt(payload.sub, payload.email, payload.householdId);
      log.debug("requireAuth: sliding window refresh issued", { sub: payload.sub });
    } catch (err) {
      // Non-fatal: log and continue. The existing token is still valid.
      log.warn("requireAuth: sliding window mint failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.debug("requireAuth returning", { ok: true, userSub: user.sub, slidingRefresh: !!newToken });
  return { ok: true, user, newToken };
}

/**
 * Adds the `X-Fenrir-Token` header to a response when a sliding window refresh
 * was triggered. The client (auth-fetch.ts) detects this header and swaps the
 * stored session token transparently.
 *
 * Usage: `return applyTokenRefresh(NextResponse.json(data), auth);`
 *
 * @param response - The NextResponse to mutate
 * @param auth - AuthSuccess result from requireAuth() or requireAuthz()
 * @returns The same response (mutated in place)
 */
export function applyTokenRefresh(response: NextResponse, auth: AuthSuccess): NextResponse {
  if (auth.newToken) {
    response.headers.set("X-Fenrir-Token", auth.newToken);
  }
  return response;
}
