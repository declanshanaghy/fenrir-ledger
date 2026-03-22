/**
 * POST /api/trial/status
 *
 * Returns the trial status for the authenticated user.
 * If unauthenticated, returns { status: "none" }.
 * Read-only — never initializes a trial.
 *
 * Request body: {} (empty — userId comes from auth token)
 *
 * Response: { remainingDays: number, status: 'active' | 'expired' | 'converted' | 'none', convertedDate?: string, cacheVersion: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { TRIAL_CACHE_VERSION } from "@/lib/trial-utils";
import { getTrial, computeTrialStatus } from "@/lib/kv/trial-store";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/trial/status called");

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`trial-status:${ip}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("POST /api/trial/status returning", { status: 429, error: "rate_limited" });
    return NextResponse.json(
      {
        error: "rate_limited",
        error_description: "Too many requests. Try again later.",
      },
      { status: 429 },
    );
  }

  // Try authentication — unauthenticated users get "none" (no anonymous trial)
  const auth = await requireAuth(request);
  if (!auth.ok) {
    log.debug("POST /api/trial/status: unauthenticated, returning none");
    return NextResponse.json(
      { status: "none", remainingDays: 0, cacheVersion: TRIAL_CACHE_VERSION },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const userId = auth.user.sub;

  try {
    const trial = await getTrial(userId);
    if (!trial) {
      log.debug("POST /api/trial/status: no trial found, returning none", { userId });
      return NextResponse.json(
        { status: "none", remainingDays: 0, cacheVersion: TRIAL_CACHE_VERSION },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = computeTrialStatus(trial);

    log.debug("POST /api/trial/status returning", {
      status: 200,
      trialStatus: result.status,
      remainingDays: result.remainingDays,
    });

    return NextResponse.json(
      { ...result, cacheVersion: TRIAL_CACHE_VERSION },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/trial/status failed", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to retrieve trial status." },
      { status: 500 },
    );
  }
}
