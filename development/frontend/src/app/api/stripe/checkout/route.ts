/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session and returns the session URL for
 * client-side redirect. Supports both authenticated and anonymous users.
 *
 * Behind isStripe() feature flag guard.
 *
 * Flow (authenticated — Google id_token present):
 *   1. Verify Google id_token from Authorization header
 *   2. Create Stripe Checkout Session with metadata.googleSub
 *   3. Return the session URL for redirect
 *
 * Flow (anonymous — no Authorization header):
 *   1. Read `email` from the JSON request body
 *   2. Create Stripe Checkout Session with customer_email (no googleSub metadata)
 *   3. Return the session URL for redirect
 *
 * The checkout session metadata includes `googleSub` only for authenticated
 * users, so the webhook handler can map authenticated vs anonymous.
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

  // --- Dual auth path: authenticated (Google id_token) or anonymous (email in body) ---
  const auth = await requireAuth(request);
  const isAuthenticated = auth.ok;

  let customerEmail: string;
  let googleSub: string | undefined;

  if (isAuthenticated) {
    customerEmail = auth.user.email;
    googleSub = auth.user.sub;
    log.debug("POST /api/stripe/checkout: authenticated user", { googleSub, customerEmail });
  } else {
    // Anonymous path — read email from request body
    let body: { email?: string };
    try {
      body = await request.json() as { email?: string };
    } catch {
      log.debug("POST /api/stripe/checkout returning", { status: 400, error: "invalid_body" });
      return NextResponse.json(
        { error: "invalid_body", error_description: "Could not parse request body as JSON." },
        { status: 400 },
      );
    }

    if (!body.email || typeof body.email !== "string" || !body.email.includes("@")) {
      log.debug("POST /api/stripe/checkout returning", { status: 400, error: "email_required" });
      return NextResponse.json(
        { error: "email_required", error_description: "A valid email address is required." },
        { status: 400 },
      );
    }

    customerEmail = body.email;
    googleSub = undefined;
    log.debug("POST /api/stripe/checkout: anonymous user", { customerEmail });
  }

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
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:9653";

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
      success_url: `${baseUrl}/settings?stripe=success`,
      cancel_url: `${baseUrl}/settings?stripe=cancel`,
      metadata: googleSub ? { googleSub } : {},
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
      isAuthenticated,
      googleSub: googleSub ?? "anonymous",
    });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/stripe/checkout: session creation failed", {
      isAuthenticated,
      googleSub: googleSub ?? "anonymous",
      error: message,
    });
    log.debug("POST /api/stripe/checkout returning", { status: 500, error: "stripe_error" });
    return NextResponse.json(
      { error: "checkout_error", error_description: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
