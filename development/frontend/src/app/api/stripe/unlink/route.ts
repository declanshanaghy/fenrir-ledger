/**
 * POST /api/stripe/unlink
 *
 * Cancels the Stripe subscription and removes the entitlement for the
 * authenticated user.
 *
 * Behind requireAuth (ADR-008).
 *
 * Logic:
 *   1. Authenticate the user via Google id_token (requireAuth)
 *   2. Look up the Stripe entitlement in KV
 *   3. Cancel the subscription via Stripe API (if still active)
 *   4. Write a canceled-state entitlement to KV preserving stripeCustomerId
 *      (prevents duplicate Stripe customers on re-subscribe — Ref #545)
 *   5. Return success (idempotent — returns success even if no record existed)
 *
 * @see ADR-010 for the Stripe Direct integration decision
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/api";
import {
  getStripeEntitlement,
  setStripeEntitlement,
} from "@/lib/kv/entitlement-store";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/stripe/unlink called");

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

    // Preserve the customer ID in KV so re-subscribe reuses the same
    // Stripe customer instead of creating a duplicate (Ref #545).
    // Write a canceled-state entitlement instead of deleting the record.
    if (existing?.stripeCustomerId) {
      await setStripeEntitlement(googleSub, {
        tier: "thrall",
        active: false,
        stripeCustomerId: existing.stripeCustomerId,
        stripeSubscriptionId: existing.stripeSubscriptionId,
        stripeStatus: "canceled",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: existing.currentPeriodEnd ?? new Date().toISOString(),
        linkedAt: existing.linkedAt ?? new Date().toISOString(),
        checkedAt: new Date().toISOString(),
      });

      log.debug("POST /api/stripe/unlink: wrote canceled entitlement preserving customer ID", {
        googleSub,
        stripeCustomerId: existing.stripeCustomerId,
      });
    }

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
