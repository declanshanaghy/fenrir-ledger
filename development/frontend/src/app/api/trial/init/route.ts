/**
 * POST /api/trial/init
 *
 * Initializes a trial for a browser fingerprint. Called on first card creation
 * (import or manual add). Idempotent — if a trial already exists for this
 * fingerprint, returns the existing trial data without modification.
 *
 * Supports anonymous access — fingerprint is the sole identifier (Issue #1413).
 * No Bearer token required; rate-limited by IP to prevent abuse.
 *
 * Request body: { fingerprint: string } (64-char SHA-256 hex)
 *
 * Response: { startDate: string, isNew: boolean }
 *
 * @see plans/001-trial.md
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { isValidFingerprint } from "@/lib/trial-utils";
import { getTrial, initTrial } from "@/lib/kv/trial-store";

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
    log.debug("POST /api/trial/init returning", { status: 400, error: "invalid_fingerprint" });
    return NextResponse.json(
      {
        error: "invalid_fingerprint",
        error_description: "Fingerprint must be a 64-character lowercase hex string.",
      },
      { status: 400 },
    );
  }

  // Check if trial already exists
  const existing = await getTrial(fingerprint);
  if (existing) {
    log.debug("POST /api/trial/init returning", { status: 200, isNew: false, startDate: existing.startDate });
    return NextResponse.json(
      { startDate: existing.startDate, isNew: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Initialize new trial
  try {
    const trial = await initTrial(fingerprint);
    log.debug("POST /api/trial/init returning", { status: 200, isNew: true, startDate: trial.startDate });
    return NextResponse.json(
      { startDate: trial.startDate, isNew: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/trial/init failed", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to initialize trial." },
      { status: 500 },
    );
  }
}
