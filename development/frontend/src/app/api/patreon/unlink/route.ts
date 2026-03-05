/**
 * POST /api/patreon/unlink
 *
 * Removes the Patreon entitlement for the authenticated user.
 *
 * Behind requireAuth (ADR-008) -- the user must be signed in with Google.
 *
 * Logic:
 *   1. Authenticate the user via Google id_token (requireAuth)
 *   2. Delete the entitlement record from Vercel KV
 *   3. Return success (even if no record existed -- idempotent)
 *
 * The client clears its localStorage cache independently. This endpoint
 * ensures the server-side KV record is also removed so a fresh membership
 * check does not resurrect a stale entitlement.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { deleteEntitlement } from "@/lib/kv/entitlement-store";
import { isPatreon } from "@/lib/feature-flags";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/patreon/unlink called");

  if (!isPatreon()) {
    return NextResponse.json(
      { error: "Patreon integration is disabled" },
      { status: 404 },
    );
  }

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`patreon-unlink:${ip}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("POST /api/patreon/unlink returning", {
      status: 429,
      error: "rate_limited",
    });
    return NextResponse.json(
      {
        error: "rate_limited",
        error_description: "Too many requests. Try again later.",
      },
      { status: 429 },
    );
  }

  // Require Google authentication (ADR-008)
  const auth = await requireAuth(request);
  if (!auth.ok) {
    log.debug("POST /api/patreon/unlink returning", {
      status: 401,
      reason: "auth failed",
    });
    return auth.response;
  }

  const googleSub = auth.user.sub;

  try {
    await deleteEntitlement(googleSub);

    log.debug("POST /api/patreon/unlink returning", {
      status: 200,
      googleSub,
      success: true,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/patreon/unlink: deletion failed", {
      googleSub,
      error: message,
    });
    log.debug("POST /api/patreon/unlink returning", {
      status: 500,
      googleSub,
      error: "deletion_failed",
    });

    return NextResponse.json(
      {
        error: "unlink_failed",
        error_description: "Could not remove Patreon link. Please try again.",
      },
      { status: 500 },
    );
  }
}
