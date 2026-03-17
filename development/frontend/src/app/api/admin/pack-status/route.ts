/**
 * GET /api/admin/pack-status
 *
 * Returns the full pack status dashboard data as JSON.
 * Auth-gated: requireAuth + admin whitelist check.
 *
 * Response: PackStatusResult (see src/lib/admin/pack-status.ts)
 *
 * @see #654
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthz } from "@/lib/auth/authz";
import { isAdmin } from "@/lib/admin/auth";
import { getPackStatus } from "@/lib/admin/pack-status";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/admin/pack-status called");

  // Require authentication (ADR-015)
  const authz = await requireAuthz(request, {});
  if (!authz.ok) return authz.response;

  // Admin whitelist check
  if (!isAdmin(authz.user.email)) {
    log.debug("GET /api/admin/pack-status — non-admin denied", {
      email: authz.user.email,
    });
    return NextResponse.json(
      {
        error: "forbidden",
        error_description: "You are not of the Allfather's council.",
      },
      { status: 403 },
    );
  }

  try {
    const data = await getPackStatus();

    log.debug("GET /api/admin/pack-status returning", {
      status: 200,
      inFlightCount: data.in_flight_count,
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/admin/pack-status failed", { error: message });
    return NextResponse.json(
      {
        error: "internal_error",
        error_description: "Failed to fetch pack status.",
      },
      { status: 500 },
    );
  }
}
