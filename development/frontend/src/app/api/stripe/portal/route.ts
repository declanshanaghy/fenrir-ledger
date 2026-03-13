/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for the authenticated user
 * and returns the session URL for client-side redirect.
 *
 * Behind requireAuth (ADR-008).
 *
 * The Customer Portal allows users to:
 *   - Update payment method
 *   - Cancel subscription
 *   - View billing history
 *
 * Requires the user to have an existing Stripe entitlement (with customer ID)
 * in the KV store. If no entitlement exists, returns 404.
 *
 * @see ADR-010 for the Stripe Direct integration decision
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/api";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { StripePortalResponse } from "@/lib/stripe/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/stripe/portal called");

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`stripe-portal:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("POST /api/stripe/portal returning", { status: 429, error: "rate_limited" });
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
    log.debug("POST /api/stripe/portal returning", { status: 401, reason: "auth failed" });
    return auth.response;
  }

  const googleSub = auth.user.sub;

  // Look up the Stripe entitlement to get the customer ID
  const entitlement = await getStripeEntitlement(googleSub);
  if (!entitlement) {
    log.debug("POST /api/stripe/portal returning", {
      status: 404,
      reason: "no entitlement",
      googleSub,
    });
    return NextResponse.json(
      { error: "not_subscribed", error_description: "No Stripe subscription found." },
      { status: 404 },
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

    // SEV-002 fix: never use Origin header for redirect URLs.
    // APP_BASE_URL is set per-environment via K8s secrets (production) or .env.local (dev).
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:9653";

    const session = await stripe.billingPortal.sessions.create({
      customer: entitlement.stripeCustomerId,
      return_url: `${baseUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}stripe=portal_return`,
    });

    const response: StripePortalResponse = { url: session.url };
    log.debug("POST /api/stripe/portal returning", {
      status: 200,
      googleSub,
      customerId: entitlement.stripeCustomerId,
    });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/stripe/portal: session creation failed", {
      googleSub,
      customerId: entitlement.stripeCustomerId,
      error: message,
    });
    log.debug("POST /api/stripe/portal returning", { status: 500, error: "portal_error" });
    return NextResponse.json(
      { error: "portal_error", error_description: "Failed to create portal session." },
      { status: 500 },
    );
  }
}
