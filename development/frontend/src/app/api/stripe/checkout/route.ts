/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the authenticated user and returns
 * the session URL for client-side redirect.
 *
 * Behind requireAuth (ADR-008) + isStripe() feature flag guard.
 *
 * Flow:
 *   1. Authenticate user via Google id_token
 *   2. Create Stripe Checkout Session with metadata linking to Google sub
 *   3. Return the session URL for redirect
 *
 * The checkout session metadata includes `googleSub` so that the webhook
 * handler (checkout.session.completed) can map the Stripe customer to the
 * authenticated user.
 *
 * @see ADR-010 for the Stripe Direct integration decision
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/api";
import { isStripe } from "@/lib/feature-flags";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { StripeCheckoutResponse } from "@/lib/stripe/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/stripe/checkout called");

  if (!isStripe()) {
    log.debug("POST /api/stripe/checkout returning", { status: 404, reason: "stripe disabled" });
    return NextResponse.json(
      { error: "Stripe integration is disabled" },
      { status: 404 },
    );
  }

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

  // Require Google authentication (ADR-008)
  const auth = await requireAuth(request);
  if (!auth.ok) {
    log.debug("POST /api/stripe/checkout returning", { status: 401, reason: "auth failed" });
    return auth.response;
  }

  const googleSub = auth.user.sub;
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
    // Determine the base URL for success/cancel redirects
    const origin = request.headers.get("origin") ?? process.env.APP_BASE_URL ?? "http://localhost:9653";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/settings?stripe=success`,
      cancel_url: `${origin}/settings?stripe=cancel`,
      metadata: {
        googleSub,
      },
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
