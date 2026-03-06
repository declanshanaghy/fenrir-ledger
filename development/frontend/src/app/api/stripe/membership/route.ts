/**
 * GET /api/stripe/membership
 *
 * Returns the current user's Stripe subscription/entitlement status.
 *
 * Behind requireAuth (ADR-008).
 *
 * Logic:
 *   1. Look up cached entitlement in Vercel KV (keyed by Google sub)
 *   2. Return cached data (Stripe webhooks keep it fresh)
 *   3. If no entitlement exists, return thrall tier (not subscribed)
 *
 * Stripe webhooks proactively update KV on subscription changes.
 * The cached state is authoritative -- no need for live re-checks.
 *
 * Response: { tier, active, platform: "stripe", checkedAt, customerId?, linkedAt? }
 *
 * @see ADR-010 for the Stripe Direct integration decision
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getStripeEntitlement, setStripeEntitlement, migrateStripeEntitlement } from "@/lib/kv/entitlement-store";
import { stripe } from "@/lib/stripe/api";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { StripeMembershipResponse } from "@/lib/stripe/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/stripe/membership called");

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
  let cached = await getStripeEntitlement(googleSub);

  // If no entitlement found, attempt to migrate an anonymous Stripe entitlement
  // using the checkout session_id from the success redirect
  if (!cached) {
    const sessionId = request.nextUrl.searchParams.get("session_id");
    if (sessionId) {
      log.debug("GET /api/stripe/membership: no entitlement found, attempting migration", {
        googleSub,
        sessionId,
      });
      try {
        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
        const customerId = typeof checkoutSession.customer === "string"
          ? checkoutSession.customer
          : checkoutSession.customer?.id;

        if (customerId) {
          const result = await migrateStripeEntitlement(customerId, googleSub);
          log.debug("GET /api/stripe/membership: migration result", {
            googleSub,
            customerId,
            ...result,
          });
          if (result.migrated) {
            // Re-fetch after migration
            cached = await getStripeEntitlement(googleSub);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.debug("GET /api/stripe/membership: migration attempt failed", {
          googleSub,
          sessionId,
          error: message,
        });
      }
    }
  }

  // If still no entitlement exists, user has not subscribed via Stripe
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

  // If cached entitlement is missing period end info (pre-existing records),
  // do a live Stripe lookup to backfill it
  let { cancelAtPeriodEnd, currentPeriodEnd } = cached;
  if (currentPeriodEnd === undefined && cached.stripeSubscriptionId) {
    try {
      log.debug("GET /api/stripe/membership: backfilling period end from Stripe", {
        subscriptionId: cached.stripeSubscriptionId,
      });
      const sub = await stripe.subscriptions.retrieve(cached.stripeSubscriptionId);
      cancelAtPeriodEnd = sub.cancel_at_period_end;
      currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();

      // Update KV cache with the new fields
      await setStripeEntitlement(googleSub, {
        ...cached,
        cancelAtPeriodEnd,
        currentPeriodEnd,
        stripeStatus: sub.status,
        checkedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.debug("GET /api/stripe/membership: Stripe backfill failed", { error: message });
    }
  }

  // Return the cached entitlement — Stripe webhooks keep it up to date
  const response: StripeMembershipResponse = {
    tier: cached.tier,
    active: cached.active,
    platform: "stripe",
    checkedAt: cached.checkedAt,
    customerId: cached.stripeCustomerId,
    linkedAt: cached.linkedAt,
    stripeStatus: cached.stripeStatus,
    cancelAtPeriodEnd,
    currentPeriodEnd,
  };
  log.debug("GET /api/stripe/membership returning", {
    status: 200,
    tier: cached.tier,
    active: cached.active,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    reason: "cached entitlement",
  });
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
