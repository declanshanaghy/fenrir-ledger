/**
 * GET /api/stripe/membership
 *
 * Returns the current user's Stripe subscription/entitlement status.
 *
 * Behind requireAuth (ADR-008) + isStripe() feature flag guard.
 *
 * Logic:
 *   1. Look up cached entitlement in Vercel KV (keyed by Google sub)
 *   2. Return cached data (Stripe webhooks keep it fresh)
 *   3. If no entitlement exists, return thrall tier (not subscribed)
 *
 * Unlike Patreon, we do not need to re-check via API here — Stripe webhooks
 * proactively update KV on subscription changes. The cached state is authoritative.
 *
 * Response: { tier, active, platform: "stripe", checkedAt, customerId?, linkedAt? }
 *
 * @see ADR-010 for the Stripe Direct integration decision
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { isStripe } from "@/lib/feature-flags";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { StripeMembershipResponse } from "@/lib/stripe/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/stripe/membership called");

  if (!isStripe()) {
    log.debug("GET /api/stripe/membership returning", { status: 404, reason: "stripe disabled" });
    return NextResponse.json(
      { error: "Stripe integration is disabled" },
      { status: 404 },
    );
  }

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`stripe-membership:${ip}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("GET /api/stripe/membership returning", { status: 429, error: "rate_limited" });
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
    log.debug("GET /api/stripe/membership returning", { status: 401, reason: "auth failed" });
    return auth.response;
  }

  const googleSub = auth.user.sub;

  // Fetch cached entitlement from Vercel KV
  const cached = await getStripeEntitlement(googleSub);

  // If no entitlement exists, user has not subscribed via Stripe
  if (!cached) {
    const response: StripeMembershipResponse = {
      tier: "thrall",
      active: false,
      platform: "stripe",
      checkedAt: new Date().toISOString(),
    };
    log.debug("GET /api/stripe/membership returning", {
      status: 200,
      tier: "thrall",
      reason: "not subscribed",
    });
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Return the cached entitlement — Stripe webhooks keep it up to date
  const response: StripeMembershipResponse = {
    tier: cached.tier,
    active: cached.active,
    platform: "stripe",
    checkedAt: cached.checkedAt,
    customerId: cached.stripeCustomerId,
    linkedAt: cached.linkedAt,
  };
  log.debug("GET /api/stripe/membership returning", {
    status: 200,
    tier: cached.tier,
    active: cached.active,
    reason: "cached entitlement",
  });
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
