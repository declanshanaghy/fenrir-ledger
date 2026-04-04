/**
 * GET /api/auth/session
 *
 * Validates the caller's Bearer id_token and returns the decoded user claims.
 * Useful for checking token validity and retrieving session metadata.
 *
 * Requires authentication (ADR-008).
 *
 * Response (200):
 *   {
 *     ok: true,
 *     user: { sub: string, email: string, name: string, picture: string }
 *   }
 *
 * Error responses:
 *   401 — missing or invalid Bearer token
 *
 * Issue #2057
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/auth/session called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  log.debug("GET /api/auth/session returning", { ok: true, sub: auth.user.sub });

  return NextResponse.json(
    {
      ok: true,
      user: {
        sub: auth.user.sub,
        email: auth.user.email,
        name: auth.user.name,
        picture: auth.user.picture,
      },
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
