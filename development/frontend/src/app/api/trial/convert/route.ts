/**
 * POST /api/trial/convert
 *
 * Marks a trial as converted after successful Stripe subscription.
 * Updates the trial record at /households/{userId}/trial with a convertedDate.
 *
 * Behind requireAuth (ADR-008). userId comes from auth token.
 *
 * Request body: {} (empty — userId comes from auth token)
 *
 * Response: { converted: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { markTrialConverted } from "@/lib/kv/trial-store";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/trial/convert called");

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`trial-convert:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("POST /api/trial/convert returning", { status: 429, error: "rate_limited" });
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

  // Mark trial as converted
  try {
    const converted = await markTrialConverted(userId);
    log.debug("POST /api/trial/convert returning", { status: 200, converted });
    return NextResponse.json(
      { converted },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/trial/convert failed", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to mark trial as converted." },
      { status: 500 },
    );
  }
}
