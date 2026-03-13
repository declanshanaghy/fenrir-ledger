/**
 * POST /api/trial/status
 *
 * Returns the trial status for a given browser fingerprint.
 * Computes remaining days from KV startDate and returns the current status.
 *
 * Behind requireAuth (ADR-008).
 *
 * Request body: { fingerprint: string } (64-char SHA-256 hex)
 *
 * Response: { remainingDays: number, status: 'active' | 'expired' | 'converted' | 'none', convertedDate?: string }
 *
 * @see plans/001-trial.md
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { isValidFingerprint } from "@/lib/trial-utils";
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

  // Require authentication (ADR-008)
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

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
    log.debug("POST /api/trial/status returning", { status: 400, error: "invalid_fingerprint" });
    return NextResponse.json(
      {
        error: "invalid_fingerprint",
        error_description: "Fingerprint must be a 64-character lowercase hex string.",
      },
      { status: 400 },
    );
  }

  // Retrieve trial and compute status
  try {
    const trial = await getTrial(fingerprint);
    const result = computeTrialStatus(trial);

    log.debug("POST /api/trial/status returning", {
      status: 200,
      trialStatus: result.status,
      remainingDays: result.remainingDays,
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/trial/status failed", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to retrieve trial status." },
      { status: 500 },
    );
  }
}
