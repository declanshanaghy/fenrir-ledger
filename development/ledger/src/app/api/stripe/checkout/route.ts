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
import { requireAuthz } from "@/lib/auth/authz";
import { stripe } from "@/lib/stripe/api";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { getStripeEntitlement, setStripeEntitlement } from "@/lib/kv/entitlement-store";
import { buildEntitlementFromSubscription } from "@/lib/stripe/webhook";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";
import type { StripeCheckoutResponse } from "@/lib/stripe/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a 429 response if the IP is rate-limited, otherwise null. */
function checkRateLimit(request: NextRequest): NextResponse | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(`stripe-checkout:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!success) {
    log.debug("POST /api/stripe/checkout returning", { status: 429, error: "rate_limited" });
    return NextResponse.json(
      { error: "rate_limited", error_description: "Too many requests. Try again later." },
      { status: 429 },
    );
  }
  return null;
}

/** Parses the optional returnPath from the request body, defaulting to /ledger/settings. */
async function parseReturnPath(request: NextRequest): Promise<string> {
  try {
    const body = await request.json() as { returnPath?: string };
    if (body.returnPath && typeof body.returnPath === "string" && body.returnPath.startsWith("/")) {
      return body.returnPath;
    }
  } catch {
    // No body or invalid JSON — use default
  }
  return "/ledger/settings";
}

/**
 * Revives a scheduled-cancel subscription, updates KV, and returns the revived response.
 * Stripe rejects both cancel params in the same request — only one is sent.
 */
async function reviveSubscription(
  subscriptionId: string,
  cancelAt: number | null,
  customerId: string,
  googleSub: string,
  linkedAt?: string,
): Promise<NextResponse<StripeCheckoutResponse>> {
  const updateParams: { cancel_at_period_end: false } | { cancel_at: "" } =
    cancelAt !== null ? { cancel_at: "" } : { cancel_at_period_end: false };

  const revived = await stripe.subscriptions.update(subscriptionId, updateParams);
  const updatedEntitlement = buildEntitlementFromSubscription(revived, customerId);
  if (linkedAt) updatedEntitlement.linkedAt = linkedAt;
  await setStripeEntitlement(googleSub, updatedEntitlement);

  log.debug("POST /api/stripe/checkout: subscription revived", {
    subscriptionId,
    googleSub,
    newStatus: revived.status,
    cancelAtPeriodEnd: revived.cancel_at_period_end,
  });

  return NextResponse.json<StripeCheckoutResponse>({
    revived: true,
    message: "Your subscription has been reactivated.",
  });
}

/**
 * Handles the subscription found via KV entitlement (Cases 1–3).
 * Returns a short-circuit response if the user should not proceed to checkout,
 * plus the customer ID to reuse.
 */
async function handleKvEntitlement(
  entitlement: StoredStripeEntitlement,
  googleSub: string,
): Promise<{ response?: NextResponse; customerId: string }> {
  const customerId = entitlement.stripeCustomerId;

  if (!entitlement.stripeSubscriptionId) {
    log.debug("POST /api/stripe/checkout: customer exists, no subscription", {
      stripeCustomerId: customerId,
      googleSub,
    });
    return { customerId };
  }

  let subscription: Awaited<ReturnType<typeof stripe.subscriptions.retrieve>> | null = null;
  try {
    subscription = await stripe.subscriptions.retrieve(entitlement.stripeSubscriptionId);
    log.debug("POST /api/stripe/checkout: retrieved Stripe subscription", {
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at,
    });
  } catch (err) {
    log.debug("POST /api/stripe/checkout: could not retrieve existing subscription", {
      subscriptionId: entitlement.stripeSubscriptionId,
      error: err instanceof Error ? err.message : String(err),
      googleSub,
    });
  }

  if (!subscription) return { customerId };

  const isScheduledToCancel =
    subscription.cancel_at_period_end || subscription.cancel_at !== null;

  // Case 1: Active + scheduled cancel → revive
  if (subscription.status === "active" && isScheduledToCancel) {
    log.debug("POST /api/stripe/checkout: reviving scheduled-cancel subscription", {
      subscriptionId: subscription.id,
      googleSub,
    });
    const response = await reviveSubscription(
      subscription.id,
      subscription.cancel_at,
      customerId,
      googleSub,
      entitlement.linkedAt,
    );
    return { response, customerId };
  }

  // Case 2: Still fully active (not canceling) → already subscribed
  if (
    (subscription.status === "active" || subscription.status === "trialing") &&
    !isScheduledToCancel
  ) {
    // Re-sync KV if it wrongly shows cancelling
    if (entitlement.cancelAtPeriodEnd) {
      log.debug("POST /api/stripe/checkout: KV stale — re-syncing cancelAtPeriodEnd", {
        subscriptionId: subscription.id,
        googleSub,
      });
      const synced = buildEntitlementFromSubscription(subscription, customerId);
      synced.linkedAt = entitlement.linkedAt;
      await setStripeEntitlement(googleSub, synced);
    }
    log.debug("POST /api/stripe/checkout: user already has active subscription", {
      subscriptionId: subscription.id,
      status: subscription.status,
      googleSub,
    });
    return {
      response: NextResponse.json(
        { error: "already_subscribed", error_description: "You already have an active Karl subscription." },
        { status: 409 },
      ),
      customerId,
    };
  }

  // Case 3: past_due/unpaid → cancel before fresh checkout
  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    log.debug("POST /api/stripe/checkout: canceling stale subscription before new checkout", {
      subscriptionId: subscription.id,
      status: subscription.status,
      googleSub,
    });
    await stripe.subscriptions.cancel(subscription.id);
  }

  log.debug("POST /api/stripe/checkout: terminal subscription, proceeding to new checkout", {
    subscriptionId: subscription.id,
    status: subscription.status,
    googleSub,
  });
  return { customerId };
}

/**
 * Stripe-level guard: checks for active subscriptions on the customer before
 * creating a new checkout. Catches stale-KV duplicates or failed retrieve above.
 * Returns a short-circuit response, or null to proceed.
 */
async function runStripeGuard(
  customerId: string,
  googleSub: string,
  linkedAt?: string,
): Promise<NextResponse | null> {
  log.debug("POST /api/stripe/checkout: Stripe guard — checking for active subscriptions", {
    stripeCustomerId: customerId,
    googleSub,
  });

  const existingSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  if (existingSubs.data.length === 0) {
    log.debug("POST /api/stripe/checkout: Stripe guard — no active subscriptions, proceeding", {
      stripeCustomerId: customerId,
      googleSub,
    });
    return null;
  }

  const activeSub = existingSubs.data[0]!;
  const isCanceling = activeSub.cancel_at_period_end || activeSub.cancel_at !== null;

  if (isCanceling) {
    log.debug("POST /api/stripe/checkout: Stripe guard — reviving canceling subscription", {
      subscriptionId: activeSub.id,
      googleSub,
    });
    return reviveSubscription(activeSub.id, activeSub.cancel_at, customerId, googleSub, linkedAt);
  }

  log.debug("POST /api/stripe/checkout: Stripe guard — active subscription, blocking duplicate", {
    subscriptionId: activeSub.id,
    googleSub,
  });
  return NextResponse.json(
    { error: "already_subscribed", error_description: "You already have an active Karl subscription." },
    { status: 409 },
  );
}

/** Creates a Stripe Checkout Session and returns the session URL response. */
async function buildCheckoutSession(params: {
  priceId: string;
  customerParam: { customer: string } | { customer_email: string };
  baseUrl: string;
  returnPath: string;
  googleSub: string;
}): Promise<NextResponse> {
  const { priceId, customerParam, baseUrl, returnPath, googleSub } = params;
  const sep = returnPath.includes("?") ? "&" : "?";

  log.debug("POST /api/stripe/checkout: creating checkout session", {
    googleSub,
    reusingCustomer: "customer" in customerParam,
    ...("customer" in customerParam ? { stripeCustomerId: customerParam.customer } : {}),
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    ...customerParam,
    success_url: `${baseUrl}${returnPath}${sep}stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}${returnPath}${sep}stripe=cancel`,
    metadata: { googleSub },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    log.error("POST /api/stripe/checkout: session created but no URL returned", {
      sessionId: session.id,
    });
    return NextResponse.json(
      { error: "checkout_error", error_description: "Failed to create checkout session." },
      { status: 500 },
    );
  }

  log.debug("POST /api/stripe/checkout: session created", {
    status: 200,
    sessionId: session.id,
    googleSub,
    reusingCustomer: "customer" in customerParam,
  });
  return NextResponse.json<StripeCheckoutResponse>({ url: session.url });
}

// ---------------------------------------------------------------------------
// Route handler — complexity ≤ 15
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/stripe/checkout called");

  const rateLimitResponse = checkRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const authz = await requireAuthz(request, {});
  if (!authz.ok) {
    log.debug("POST /api/stripe/checkout returning", { reason: "authz failed" });
    return authz.response;
  }

  const customerEmail = authz.user.email;
  const googleSub = authz.user.sub;
  log.debug("POST /api/stripe/checkout: authenticated user", { googleSub, customerEmail });

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    log.error("POST /api/stripe/checkout: STRIPE_PRICE_ID not configured");
    return NextResponse.json(
      { error: "config_error", error_description: "Stripe price not configured." },
      { status: 500 },
    );
  }

  try {
    const returnPath = await parseReturnPath(request);
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:9653";
    const entitlement = await getStripeEntitlement(googleSub);
    let existingCustomerId: string | undefined;

    if (entitlement?.stripeCustomerId) {
      const { response, customerId } = await handleKvEntitlement(entitlement, googleSub);
      if (response) return response;
      existingCustomerId = customerId;
    } else {
      log.debug("POST /api/stripe/checkout: no existing entitlement, creating fresh checkout", {
        googleSub,
      });
    }

    if (existingCustomerId) {
      const guardResponse = await runStripeGuard(
        existingCustomerId,
        googleSub,
        entitlement?.linkedAt,
      );
      if (guardResponse) return guardResponse;
    }

    const customerParam: { customer: string } | { customer_email: string } =
      existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: customerEmail };

    return await buildCheckoutSession({ priceId, customerParam, baseUrl, returnPath, googleSub });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/stripe/checkout: session creation failed", {
      googleSub,
      error: message,
    });
    return NextResponse.json(
      { error: "checkout_error", error_description: `Failed to create checkout session: ${message}` },
      { status: 500 },
    );
  }
}
