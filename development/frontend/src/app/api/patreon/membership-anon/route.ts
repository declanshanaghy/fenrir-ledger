/**
 * GET /api/patreon/membership-anon
 *
 * Checks Patreon membership status for an anonymous user (no Google sign-in).
 *
 * NOT behind requireAuth — anonymous users have no Google id_token.
 * Security is provided by:
 *   - The patreonUserId is opaque (Patreon's internal ID, not guessable)
 *   - Aggressive rate limiting (10 req/min per IP)
 *   - This endpoint returns only tier/active status — no tokens or PII
 *
 * Query params:
 *   - pid: Patreon user ID (required)
 *
 * Response: { tier, active, platform: "patreon", checkedAt }
 *
 * @module api/patreon/membership-anon
 */

import { NextRequest, NextResponse } from "next/server";
import { getAnonymousEntitlement } from "@/lib/kv/entitlement-store";
import { isPatreon } from "@/lib/feature-flags";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/patreon/membership-anon called");

  if (!isPatreon()) {
    return NextResponse.json(
      { error: "Patreon integration is disabled" },
      { status: 404 },
    );
  }

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`patreon-membership-anon:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("GET /api/patreon/membership-anon returning", {
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

  // Read the patreonUserId from query params
  const pid = request.nextUrl.searchParams.get("pid");
  if (!pid || pid.trim().length === 0) {
    log.debug("GET /api/patreon/membership-anon returning", {
      status: 400,
      error: "missing_pid",
    });
    return NextResponse.json(
      {
        error: "missing_pid",
        error_description: "The pid query parameter is required.",
      },
      { status: 400 },
    );
  }

  try {
    const entitlement = await getAnonymousEntitlement(pid.trim());

    if (!entitlement) {
      log.debug("GET /api/patreon/membership-anon returning", {
        status: 200,
        tier: "thrall",
        reason: "not_found",
      });
      return NextResponse.json(
        {
          tier: "thrall",
          active: false,
          platform: "patreon",
          checkedAt: new Date().toISOString(),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    log.debug("GET /api/patreon/membership-anon returning", {
      status: 200,
      tier: entitlement.tier,
      active: entitlement.active,
    });

    return NextResponse.json(
      {
        tier: entitlement.tier,
        active: entitlement.active,
        platform: "patreon",
        checkedAt: entitlement.checkedAt,
        userId: entitlement.patreonUserId,
        linkedAt: entitlement.linkedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/patreon/membership-anon failed", {
      pid,
      error: message,
    });
    log.debug("GET /api/patreon/membership-anon returning", {
      status: 500,
      error: "internal_error",
    });
    return NextResponse.json(
      {
        error: "internal_error",
        error_description: "Failed to check membership status.",
      },
      { status: 500 },
    );
  }
}
