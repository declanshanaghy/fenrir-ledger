/**
 * GET /api/patreon/membership
 *
 * Checks the current user's Patreon membership status.
 *
 * Behind requireAuth (ADR-008) — the user must be signed in with Google.
 *
 * Logic:
 *   1. Look up cached entitlement in Vercel KV (keyed by Google sub)
 *   2. If fresh (< 1 hour old), return cached data
 *   3. If stale, re-check Patreon API using the stored refresh token
 *   4. On Patreon API failure, return last-known state with { stale: true }
 *   5. If no entitlement exists, return thrall tier (not linked)
 *
 * Response: { tier, active, platform: "patreon", checkedAt, stale? }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getEntitlement, setEntitlement } from "@/lib/kv/entitlement-store";
import { decrypt } from "@/lib/crypto/encrypt";
import { encrypt } from "@/lib/crypto/encrypt";
import { getMembership, refreshToken } from "@/lib/patreon/api";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { MembershipResponse, StoredEntitlement } from "@/lib/patreon/types";

/** Staleness threshold: 1 hour in milliseconds. */
const STALENESS_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * Checks whether a stored entitlement is stale (older than 1 hour).
 */
function isStale(entitlement: StoredEntitlement): boolean {
  log.debug("isStale called", { checkedAt: entitlement.checkedAt });
  const checkedAt = new Date(entitlement.checkedAt).getTime();
  const age = Date.now() - checkedAt;
  const stale = age > STALENESS_THRESHOLD_MS;
  log.debug("isStale returning", { stale, ageMs: age });
  return stale;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/patreon/membership called");

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`patreon-membership:${ip}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("GET /api/patreon/membership returning", {
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

  // Require Google authentication (ADR-008)
  const auth = await requireAuth(request);
  if (!auth.ok) {
    log.debug("GET /api/patreon/membership returning", {
      status: 401,
      reason: "auth failed",
    });
    return auth.response;
  }

  const googleSub = auth.user.sub;

  // Fetch cached entitlement from Vercel KV
  const cached = await getEntitlement(googleSub);

  // If no entitlement exists, user has not linked Patreon
  if (!cached) {
    const response: MembershipResponse = {
      tier: "thrall",
      active: false,
      platform: "patreon",
      checkedAt: new Date().toISOString(),
    };
    log.debug("GET /api/patreon/membership returning", {
      status: 200,
      tier: "thrall",
      reason: "not linked",
    });
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // If the cached entitlement is fresh, return it
  if (!isStale(cached)) {
    const response: MembershipResponse = {
      tier: cached.tier,
      active: cached.active,
      platform: "patreon",
      checkedAt: cached.checkedAt,
    };
    log.debug("GET /api/patreon/membership returning", {
      status: 200,
      tier: cached.tier,
      active: cached.active,
      reason: "fresh cache",
    });
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Entitlement is stale — re-check Patreon API
  log.debug("GET /api/patreon/membership: entitlement stale, re-checking", {
    googleSub,
    checkedAt: cached.checkedAt,
  });

  try {
    // Decrypt the stored refresh token
    const decryptedRefreshToken = decrypt(cached.patreonRefreshToken);

    // Refresh the Patreon access token
    const newTokens = await refreshToken(decryptedRefreshToken);

    // Check membership with the fresh access token
    const membership = await getMembership(
      newTokens.access_token,
      cached.campaignId,
    );

    // Update the KV store with fresh data
    const now = new Date().toISOString();
    const updatedEntitlement: StoredEntitlement = {
      ...cached,
      tier: membership.tier,
      active: membership.active,
      patreonAccessToken: encrypt(newTokens.access_token),
      patreonRefreshToken: encrypt(newTokens.refresh_token),
      checkedAt: now,
    };

    await setEntitlement(googleSub, updatedEntitlement);

    const response: MembershipResponse = {
      tier: membership.tier,
      active: membership.active,
      platform: "patreon",
      checkedAt: now,
    };
    log.debug("GET /api/patreon/membership returning", {
      status: 200,
      tier: membership.tier,
      active: membership.active,
      reason: "refreshed from Patreon API",
    });
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // On Patreon API failure, return last-known state with stale flag
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/patreon/membership: re-check failed", {
      googleSub,
      error: message,
    });

    const response: MembershipResponse = {
      tier: cached.tier,
      active: cached.active,
      platform: "patreon",
      checkedAt: cached.checkedAt,
      stale: true,
    };
    log.debug("GET /api/patreon/membership returning", {
      status: 200,
      tier: cached.tier,
      active: cached.active,
      stale: true,
      reason: "API failure, returning stale cache",
    });
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
