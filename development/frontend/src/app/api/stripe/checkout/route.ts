/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session and returns the session URL for
 * client-side redirect. Requires Google authentication (ADR-008).
 *
 * Flow:
 *   1. Verify Google id_token from Authorization header
 *   2. Create Stripe Checkout Session with metadata.googleSub + customer_email
 *   3. Return the session URL for redirect
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
    // Determine the base URL for success/cancel redirects (SEV-002 fix: never use Origin header)
    const baseUrl = process.env.APP_BASE_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:9653");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      success_url: `${baseUrl}/settings?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings?stripe=cancel`,
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
