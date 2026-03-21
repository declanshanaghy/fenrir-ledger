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
import { initTrial, TrialRestartError } from "@/lib/kv/trial-store";
import { ensureSoloHousehold } from "@/lib/firebase/firestore";

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

  const userId = auth.user.sub;

  // Ensure household + user Firestore documents exist (idempotent on subsequent sign-ins).
  // Issue #1707: must happen before trial init so the household doc is present.
  try {
    await ensureSoloHousehold({
      userId,
      email: auth.user.email,
      displayName: auth.user.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/trial/init ensureSoloHousehold failed", { userId, error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to initialize household." },
      { status: 500 }
    );
  }

  // Initialize trial (idempotent for active/converted; throws on expired restart)
  try {
    const { trial, isNew } = await initTrial(userId);
    log.debug("POST /api/trial/init returning", {
      status: 200,
      isNew,
      startDate: trial.startDate,
    });
    return NextResponse.json(
      { startDate: trial.startDate, expiresAt: trial.expiresAt, isNew },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof TrialRestartError) {
      log.debug("POST /api/trial/init returning", { status: 409, error: "trial_expired" });
      return NextResponse.json(
        {
          error: "trial_expired",
          message: "Contact customer service",
        },
        { status: 409 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/trial/init failed", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to initialize trial." },
      { status: 500 },
    );
  }
}
