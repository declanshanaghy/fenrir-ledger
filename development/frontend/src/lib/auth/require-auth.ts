/**
 * Route-level auth guard for Next.js API routes — Fenrir Ledger
 *
 * Extracts the Bearer token from the Authorization header, verifies it
 * as a valid Google id_token, and returns the verified user or an error
 * response ready to return from the route handler.
 *
 * Usage in a route handler:
 *   const auth = await requireAuth(request);
 *   if (!auth.ok) return auth.response;
 *   // auth.user is now the verified Google user
 *
 * Why per-route guards instead of middleware:
 *   - /api/auth/token must remain unprotected (OAuth token exchange)
 *   - Per-route guards are explicit and auditable in each handler
 *   - Route-specific error formats are preserved (import uses SheetImportError)
 *   - Avoids Edge Runtime constraints in Next.js middleware
 *
 * See ADR-008 for the full rationale.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, type VerifiedUser } from "./verify-id-token";

/** Auth check succeeded — verified user is available. */
export type AuthSuccess = { ok: true; user: VerifiedUser };

/** Auth check failed — pre-built NextResponse is ready to return. */
export type AuthFailure = { ok: false; response: NextResponse };

/** Result type for requireAuth(). */
export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Verifies the caller is authenticated via a Google id_token.
 *
 * Expects: `Authorization: Bearer <id_token>` header.
 *
 * @param request - The incoming Next.js request
 * @returns AuthResult — either { ok: true, user } or { ok: false, response }
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "missing_token",
          error_description:
            "Authorization: Bearer <id_token> header is required.",
        },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.slice(7); // Strip "Bearer " prefix

  const result = await verifyIdToken(token);

  if (!result.ok) {
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

  return { ok: true, user: result.user };
}
