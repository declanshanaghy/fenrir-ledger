/**
 * POST /api/stripe/unlink
 *
 * Cancels the Stripe subscription and removes the entitlement for the
 * authenticated user.
 *
 * Behind requireAuth (ADR-008) + isStripe() feature flag guard.
 *
 * Logic:
 *   1. Authenticate the user via Google id_token (requireAuth)
 *   2. Look up the Stripe entitlement in KV
 *   3. Cancel the subscription via Stripe API (if still active)
 *   4. Delete the entitlement record from Vercel KV
 *   5. Return success (idempotent — returns success even if no record existed)
 *
 * @see ADR-010 for the Stripe Direct integration decision
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/api";
import {
  getStripeEntitlement,
  deleteStripeEntitlement,
} from "@/lib/kv/entitlement-store";
import { isStripe } from "@/lib/feature-flags";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/stripe/unlink called");

  if (!isStripe()) {
    log.debug("POST /api/stripe/unlink returning", { status: 404, reason: "stripe disabled" });
    return NextResponse.json(
      { error: "Stripe integration is disabled" },
      { status: 404 },
    );
  }

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`stripe-unlink:${ip}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("POST /api/stripe/unlink returning", { status: 429, error: "rate_limited" });
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
    log.debug("POST /api/stripe/unlink returning", { status: 401, reason: "auth failed" });
    return auth.response;
  }

  const googleSub = auth.user.sub;

  try {
    // Look up the existing entitlement to cancel the Stripe subscription
    const existing = await getStripeEntitlement(googleSub);

    if (existing?.stripeSubscriptionId) {
      try {
        // Cancel the subscription at Stripe — immediate cancellation
        await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
        log.debug("POST /api/stripe/unlink: subscription cancelled at Stripe", {
          subscriptionId: existing.stripeSubscriptionId,
          googleSub,
        });
      } catch (stripeErr) {
        // If the subscription is already cancelled or doesn't exist, that's fine
        const stripeMessage = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        log.debug("POST /api/stripe/unlink: Stripe cancellation failed (may already be cancelled)", {
          subscriptionId: existing.stripeSubscriptionId,
          error: stripeMessage,
        });
      }
    }

    // Delete the entitlement from KV (idempotent)
    await deleteStripeEntitlement(googleSub);

    log.debug("POST /api/stripe/unlink returning", {
      status: 200,
      googleSub,
      success: true,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/stripe/unlink: failed", {
      googleSub,
      error: message,
    });
    log.debug("POST /api/stripe/unlink returning", {
      status: 500,
      googleSub,
      error: "unlink_failed",
    });

    return NextResponse.json(
      {
        error: "unlink_failed",
        error_description: "Could not remove Stripe subscription. Please try again.",
      },
      { status: 500 },
    );
  }
}
