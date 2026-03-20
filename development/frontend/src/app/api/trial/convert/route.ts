/**
 * POST /api/trial/convert
 *
 * Marks a trial as converted after successful Stripe subscription.
 * Updates the KV trial record with a convertedDate timestamp.
 *
 * Behind requireAuth (ADR-008).
 *
 * Request body: { fingerprint: string } (UUID v4 or legacy 64-char SHA-256 hex)
 *
 * Response: { converted: boolean }
 *
 * @see plans/001-trial.md (Phase 5)
 * @see Issue #623
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthz } from "@/lib/auth/authz";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { isValidFingerprint } from "@/lib/trial-utils";
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

  // Require authentication (ADR-015)
  const authz = await requireAuthz(request, {});
  if (!authz.ok) return authz.response;

  // Parse and validate body
  let fingerprint: string;
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("fingerprint" in body) ||
      typeof (body as Record<string, unknown>).fingerprint !== "string"
    ) {
      return NextResponse.json(
        { error: "invalid_body", error_description: "Body must include { fingerprint: string }." },
        { status: 400 },
      );
    }
    fingerprint = (body as Record<string, unknown>).fingerprint as string;
  } catch {
    return NextResponse.json(
      { error: "invalid_json", error_description: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!isValidFingerprint(fingerprint)) {
    log.debug("POST /api/trial/convert returning", { status: 400, error: "invalid_fingerprint" });
    return NextResponse.json(
      {
        error: "invalid_fingerprint",
        error_description: "Fingerprint must be a UUID v4 or 64-character lowercase hex string.",
      },
      { status: 400 },
    );
  }

  // Mark trial as converted
  try {
    const converted = await markTrialConverted(fingerprint);
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
