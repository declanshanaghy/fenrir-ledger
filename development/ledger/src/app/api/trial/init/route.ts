/**
 * POST /api/trial/init
 *
 * Initializes a trial for the authenticated user at /households/{userId}/trial.
 * Idempotent for active or converted trials — returns existing data without modification.
 * Returns 409 if the trial has already expired (restart blocked).
 *
 * Requires authentication (Bearer id_token).
 *
 * Request body: {} (empty — userId comes from auth token)
 *
 * Response: { startDate: string, expiresAt: string, isNew: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { initTrialForUser } from "@/lib/trial/init-trial";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/trial/init called");

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`trial-init:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("POST /api/trial/init returning", { status: 429, error: "rate_limited" });
    return NextResponse.json(
      {
        error: "rate_limited",
        error_description: "Too many requests. Try again later.",
      },
      { status: 429 },
    );
  }

  // Require authentication — userId comes from auth token
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const result = await initTrialForUser({
    userId: auth.user.sub,
    email: auth.user.email,
    displayName: auth.user.email,
  });

  if (result.ok) {
    log.debug("POST /api/trial/init returning", {
      status: 200,
      isNew: result.isNew,
      startDate: result.startDate,
    });
    return NextResponse.json(
      { startDate: result.startDate, expiresAt: result.expiresAt, isNew: result.isNew },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (result.error === "trial_expired") {
    log.debug("POST /api/trial/init returning", { status: 409, error: "trial_expired" });
    return NextResponse.json(
      {
        error: "trial_expired",
        message: "Contact customer service",
      },
      { status: 409 },
    );
  }

  // internal_error
  log.error("POST /api/trial/init failed", { error: result.message });
  return NextResponse.json(
    { error: "internal_error", error_description: "Failed to initialize trial." },
    { status: 500 },
  );
}
