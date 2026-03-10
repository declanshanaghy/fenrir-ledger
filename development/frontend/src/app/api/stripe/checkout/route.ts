/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session and returns the session URL for
 * client-side redirect. Requires Google authentication (ADR-008).
 *
 * Flow:
 *   1. Verify Google id_token from Authorization header
 *   2. Check for existing Stripe subscription via KV entitlement
 *   3. If canceling (cancel_at_period_end) → revive instead of new checkout
 *   4. If canceled/terminal → clean up, then create new checkout with existing customer
 *   5. If no prior subscription → create fresh checkout session
 *
 * Anonymous users are redirected to /sign-in by the frontend before reaching
 * this endpoint. The checkout session always includes googleSub metadata so
 * the webhook handler can map the subscription to the authenticated user.
 *
 * @see ADR-010 for the Stripe Direct integration decision
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/api";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { getStripeEntitlement, setStripeEntitlement } from "@/lib/kv/entitlement-store";
import { buildEntitlementFromSubscription } from "@/lib/stripe/webhook";
import type { StripeCheckoutResponse } from "@/lib/stripe/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/stripe/checkout called");

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`stripe-checkout:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("POST /api/stripe/checkout returning", { status: 429, error: "rate_limited" });
    return NextResponse.json(
      {
        error: "rate_limited",
        error_description: "Too many requests. Try again later.",
      },
      { status: 429 },
    );
  }

  // Require Google authentication — anonymous checkout is not supported.
  // Anonymous users are redirected to sign-in first by the frontend.
  const auth = await requireAuth(request);
  if (!auth.ok) {
    log.debug("POST /api/stripe/checkout returning", { status: 401, reason: "auth required" });
    return auth.response;
  }

  const customerEmail = auth.user.email;
  const googleSub = auth.user.sub;
  log.debug("POST /api/stripe/checkout: authenticated user", { googleSub, customerEmail });

  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    log.error("POST /api/stripe/checkout: STRIPE_PRICE_ID not configured");
    log.debug("POST /api/stripe/checkout returning", { status: 500, error: "config_error" });
    return NextResponse.json(
      { error: "config_error", error_description: "Stripe price not configured." },
      { status: 500 },
    );
  }

  try {
    // Parse optional returnPath from request body (defaults to /ledger/settings)
    let returnPath = "/ledger/settings";
    try {
      const body = await request.json() as { returnPath?: string };
      if (body.returnPath && typeof body.returnPath === "string" && body.returnPath.startsWith("/")) {
        returnPath = body.returnPath;
      }
    } catch {
      // No body or invalid JSON — use default
    }

    // Determine the base URL for success/cancel redirects (SEV-002 fix: never use Origin header)
    // vercel dev sets VERCEL_URL but runs plain HTTP — only use https for deployed environments
    const baseUrl = process.env.APP_BASE_URL
      ?? (process.env.VERCEL_URL
        ? (process.env.VERCEL_ENV === "development"
          ? `http://${process.env.VERCEL_URL}`
          : `https://${process.env.VERCEL_URL}`)
        : "http://localhost:9653");

    // -----------------------------------------------------------------------
    // Pre-checkout: check for existing subscription to prevent duplicates
    // -----------------------------------------------------------------------
    const entitlement = await getStripeEntitlement(googleSub);
    let existingCustomerId: string | undefined;

    if (entitlement?.stripeSubscriptionId && entitlement?.stripeCustomerId) {
      log.debug("POST /api/stripe/checkout: found existing entitlement", {
        googleSub,
        stripeCustomerId: entitlement.stripeCustomerId,
        stripeSubscriptionId: entitlement.stripeSubscriptionId,
        stripeStatus: entitlement.stripeStatus,
        cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
      });

      // Always remember the existing customer ID to reuse later if needed
      existingCustomerId = entitlement.stripeCustomerId;

      try {
        const subscription = await stripe.subscriptions.retrieve(
          entitlement.stripeSubscriptionId,
        );

        log.debug("POST /api/stripe/checkout: retrieved Stripe subscription", {
          subscriptionId: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        // Case 1: Active subscription with scheduled cancel → revive it
        if (
          subscription.status === "active" &&
          subscription.cancel_at_period_end
        ) {
          log.debug("POST /api/stripe/checkout: reviving cancel_at_period_end subscription", {
            subscriptionId: subscription.id,
            googleSub,
          });

          const revived = await stripe.subscriptions.update(subscription.id, {
            cancel_at_period_end: false,
          });

          // Update KV entitlement to reflect revived state
          const updatedEntitlement = buildEntitlementFromSubscription(
            revived,
            entitlement.stripeCustomerId,
          );
          updatedEntitlement.linkedAt = entitlement.linkedAt;
          await setStripeEntitlement(googleSub, updatedEntitlement);

          log.debug("POST /api/stripe/checkout: subscription revived successfully", {
            subscriptionId: subscription.id,
            googleSub,
            newStatus: revived.status,
            cancelAtPeriodEnd: revived.cancel_at_period_end,
          });

          const response: StripeCheckoutResponse = {
            revived: true,
            message: "Your subscription has been reactivated.",
          };
          return NextResponse.json(response);
        }

        // Case 2: Still fully active (not canceling) → already subscribed
        if (
          (subscription.status === "active" || subscription.status === "trialing") &&
          !subscription.cancel_at_period_end
        ) {
          log.debug("POST /api/stripe/checkout: user already has active subscription", {
            subscriptionId: subscription.id,
            status: subscription.status,
            googleSub,
          });
          return NextResponse.json(
            {
              error: "already_subscribed",
              error_description: "You already have an active Karl subscription.",
            },
            { status: 409 },
          );
        }

        // Case 3: Canceled, past_due, unpaid, or other terminal state → clean up
        // For canceled subs, Stripe has already terminated them — no need to cancel again.
        // For past_due/unpaid, cancel them so the user can start fresh.
        if (subscription.status === "past_due" || subscription.status === "unpaid") {
          log.debug("POST /api/stripe/checkout: canceling stale subscription before new checkout", {
            subscriptionId: subscription.id,
            status: subscription.status,
            googleSub,
          });
          await stripe.subscriptions.cancel(subscription.id);
        }

        log.debug("POST /api/stripe/checkout: existing subscription is terminal, proceeding to new checkout", {
          subscriptionId: subscription.id,
          status: subscription.status,
          googleSub,
        });
      } catch (stripeErr) {
        // Subscription may no longer exist in Stripe (e.g. deleted) — proceed with new checkout
        const errMsg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        log.debug("POST /api/stripe/checkout: could not retrieve existing subscription, proceeding to new checkout", {
          subscriptionId: entitlement.stripeSubscriptionId,
          error: errMsg,
          googleSub,
        });
      }
    } else if (entitlement?.stripeCustomerId) {
      // Entitlement exists with customer ID but no subscription — reuse customer
      existingCustomerId = entitlement.stripeCustomerId;
      log.debug("POST /api/stripe/checkout: found existing customer ID without subscription", {
        stripeCustomerId: existingCustomerId,
        googleSub,
      });
    } else {
      log.debug("POST /api/stripe/checkout: no existing entitlement, creating fresh checkout", {
        googleSub,
      });
    }

    // -----------------------------------------------------------------------
    // Create new checkout session — reuse existing customer ID when available
    // -----------------------------------------------------------------------
    const customerParam: { customer: string } | { customer_email: string } =
      existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: customerEmail };

    log.debug("POST /api/stripe/checkout: creating checkout session", {
      googleSub,
      reusingCustomer: !!existingCustomerId,
      ...(existingCustomerId ? { stripeCustomerId: existingCustomerId } : {}),
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...customerParam,
      success_url: `${baseUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}stripe=cancel`,
      metadata: { googleSub },
      // Allow promotion codes
      allow_promotion_codes: true,
    });

    if (!session.url) {
      log.error("POST /api/stripe/checkout: session created but no URL returned", {
        sessionId: session.id,
      });
      log.debug("POST /api/stripe/checkout returning", { status: 500, error: "no_url" });
      return NextResponse.json(
        { error: "checkout_error", error_description: "Failed to create checkout session." },
        { status: 500 },
      );
    }

    const response: StripeCheckoutResponse = { url: session.url };
    log.debug("POST /api/stripe/checkout returning", {
      status: 200,
      sessionId: session.id,
      googleSub,
      reusingCustomer: !!existingCustomerId,
    });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/stripe/checkout: session creation failed", {
      googleSub,
      error: message,
    });
    log.debug("POST /api/stripe/checkout returning", { status: 500, error: "stripe_error" });
    return NextResponse.json(
      { error: "checkout_error", error_description: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
