/**
 * POST /api/patreon/migrate
 *
 * Migrates an anonymous Patreon entitlement to an authenticated (Google-keyed) entitlement.
 *
 * Behind requireAuth (ADR-008) — the user must be signed in with Google to migrate.
 *
 * Flow:
 *   1. Verify Google auth (requireAuth)
 *   2. Read `patreonUserId` from request body
 *   3. Look up anonymous entitlement at `entitlement:patreon:{patreonUserId}`
 *   4. Copy to `entitlement:{googleSub}`
 *   5. Update reverse index `patreon-user:{pid}` to point to `{googleSub}`
 *   6. Delete the anonymous key
 *   7. Return migration result
 *
 * Idempotent: if a Google-keyed entry already exists for this user, returns success.
 *
 * Rate limit: 5 requests per minute per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { migrateEntitlement } from "@/lib/kv/entitlement-store";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

/** Request body shape for the migration endpoint. */
interface MigrateRequestBody {
  patreonUserId: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/patreon/migrate called");

  // Require Google auth (ADR-008)
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const googleSub = auth.user.sub;

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`patreon-migrate:${ip}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("POST /api/patreon/migrate returning", {
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

  // Parse request body
  let body: MigrateRequestBody;
  try {
    body = (await request.json()) as MigrateRequestBody;
  } catch {
    log.debug("POST /api/patreon/migrate returning", {
      status: 400,
      error: "invalid_body",
    });
    return NextResponse.json(
      {
        error: "invalid_body",
        error_description: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  // Validate patreonUserId
  const { patreonUserId } = body;
  if (!patreonUserId || typeof patreonUserId !== "string" || patreonUserId.trim().length === 0) {
    log.debug("POST /api/patreon/migrate returning", {
      status: 400,
      error: "invalid_patreon_user_id",
    });
    return NextResponse.json(
      {
        error: "invalid_patreon_user_id",
        error_description: "patreonUserId must be a non-empty string.",
      },
      { status: 400 },
    );
  }

  log.debug("POST /api/patreon/migrate: migrating entitlement", {
    patreonUserId,
    googleSub,
  });

  try {
    const result = await migrateEntitlement(patreonUserId.trim(), googleSub);

    log.debug("POST /api/patreon/migrate returning", {
      status: 200,
      migrated: result.migrated,
      tier: result.tier,
      active: result.active,
      reason: result.reason,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/patreon/migrate: migration failed", {
      patreonUserId,
      googleSub,
      error: message,
    });
    log.debug("POST /api/patreon/migrate returning", {
      status: 500,
      error: "migration_failed",
    });
    return NextResponse.json(
      {
        error: "migration_failed",
        error_description: "Failed to migrate entitlement. Please try again.",
      },
      { status: 500 },
    );
  }
}
