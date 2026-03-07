/**
 * POST /api/stripe/webhook
 *
 * Receives and processes Stripe webhook events for subscription changes.
 *
 * NOT behind requireAuth — Stripe sends webhooks, not authenticated users.
 * Security is provided by SHA-256 HMAC signature validation via
 * stripe.webhooks.constructEvent() using STRIPE_WEBHOOK_SECRET.
 *
 * Handled events:
 *   - checkout.session.completed — new subscriber (create entitlement)
 *   - customer.subscription.updated — subscription status change (update entitlement)
 *   - customer.subscription.deleted — subscription cancelled (downgrade to thrall)
 *
 * User mapping:
 *   - checkout.session.completed: uses metadata.googleSub from the session
 *   - subscription events: uses stripe-customer:{customerId} reverse index in KV
 *
 * @see ADR-010 for the Stripe Direct integration decision
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/api";
import { verifyWebhookSignature, buildEntitlementFromSubscription, mapStripeStatusToTier } from "@/lib/stripe/webhook";
import {
  getStripeEntitlement,
  setStripeEntitlement,
  getGoogleSubByStripeCustomerId,
  setAnonymousStripeEntitlement,
  getAnonymousStripeEntitlement,
  isAnonymousStripeReverseIndex,
  extractStripeCustomerIdFromReverseIndex,
} from "@/lib/kv/entitlement-store";
import { log } from "@/lib/logger";

/** Valid webhook event types we process. */
const HANDLED_EVENTS = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "billing_portal.session.created",
]);

/**
 * Handles checkout.session.completed — links the new Stripe customer to the
 * authenticated Google user (via metadata.googleSub) or stores as anonymous.
 *
 * Dual path:
 *   - metadata.googleSub present -> authenticated: store as entitlement:{googleSub},
 *     reverse index stripe-customer:{customerId} -> {googleSub}
 *   - metadata.googleSub absent -> anonymous: store as entitlement:stripe:{customerId},
 *     reverse index stripe-customer:{customerId} -> stripe:{customerId}
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<NextResponse> {
  log.debug("handleCheckoutCompleted called", {
    sessionId: session.id,
    customerId: session.customer,
    hasGoogleSub: !!session.metadata?.googleSub,
  });

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;

  if (!subscriptionId) {
    log.error("handleCheckoutCompleted: no subscription ID in session", {
      sessionId: session.id,
    });
    log.debug("handleCheckoutCompleted returning", { status: 200, reason: "no subscription" });
    return NextResponse.json({ status: "ignored", reason: "no_subscription" });
  }

  const customerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id;

  if (!customerId) {
    log.error("handleCheckoutCompleted: no customer ID in session", {
      sessionId: session.id,
    });
    log.debug("handleCheckoutCompleted returning", { status: 200, reason: "no customer" });
    return NextResponse.json({ status: "ignored", reason: "no_customer" });
  }

  // Fetch the full subscription to get status details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const entitlement = buildEntitlementFromSubscription(subscription, customerId);

  const googleSub = session.metadata?.googleSub;

  if (googleSub) {
    // Authenticated path: store under Google sub with reverse index
    await setStripeEntitlement(googleSub, entitlement);
    log.debug("handleCheckoutCompleted returning (authenticated)", {
      status: 200,
      googleSub,
      tier: entitlement.tier,
      active: entitlement.active,
    });
  } else {
    // Anonymous path: store under Stripe customer ID with anonymous reverse index
    await setAnonymousStripeEntitlement(customerId, entitlement);
    log.debug("handleCheckoutCompleted returning (anonymous)", {
      status: 200,
      stripeCustomerId: customerId,
      tier: entitlement.tier,
      active: entitlement.active,
    });
  }

  return NextResponse.json({
    status: "processed",
    eventType: "checkout.session.completed",
    tier: entitlement.tier,
    active: entitlement.active,
    anonymous: !googleSub,
  });
}

/**
 * Handles customer.subscription.updated — updates the entitlement tier/status.
 * Supports both authenticated and anonymous users via the reverse index.
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<NextResponse> {
  log.debug("handleSubscriptionUpdated called", {
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    itemsCount: subscription.items?.data?.length ?? 0,
  });

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  const identity = await getGoogleSubByStripeCustomerId(customerId);
  if (!identity) {
    log.debug("handleSubscriptionUpdated: no identity for customer", { customerId });
    log.debug("handleSubscriptionUpdated returning", { status: 200, reason: "unknown customer" });
    return NextResponse.json({ status: "ignored", reason: "unknown_customer" });
  }

  const isAnonymous = isAnonymousStripeReverseIndex(identity);
  const { tier, active } = mapStripeStatusToTier(subscription.status);

  const entitlement = {
    tier,
    active,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
    currentPeriodEnd: subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : subscription.items.data[0]
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : new Date().toISOString(),
    linkedAt: new Date().toISOString(),
    checkedAt: new Date().toISOString(),
  };

  if (isAnonymous) {
    // Anonymous path: look up existing to preserve linkedAt, then store under Stripe customer ID
    const stripeId = extractStripeCustomerIdFromReverseIndex(identity);
    const existing = await getAnonymousStripeEntitlement(stripeId);
    entitlement.linkedAt = existing?.linkedAt ?? entitlement.linkedAt;
    await setAnonymousStripeEntitlement(stripeId, entitlement);
    log.debug("handleSubscriptionUpdated returning (anonymous)", {
      status: 200,
      tier,
      active,
      stripeCustomerId: stripeId,
    });
  } else {
    // Authenticated path: store under Google sub
    const existing = await getStripeEntitlement(identity);
    entitlement.linkedAt = existing?.linkedAt ?? entitlement.linkedAt;
    await setStripeEntitlement(identity, entitlement);
    log.debug("handleSubscriptionUpdated returning (authenticated)", {
      status: 200,
      tier,
      active,
      googleSub: identity,
    });
  }

  return NextResponse.json({
    status: "processed",
    eventType: "customer.subscription.updated",
    tier,
    active,
  });
}

/**
 * Handles customer.subscription.deleted — downgrades to thrall.
 * Supports both authenticated and anonymous users via the reverse index.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<NextResponse> {
  log.debug("handleSubscriptionDeleted called", {
    subscriptionId: subscription.id,
  });

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  const identity = await getGoogleSubByStripeCustomerId(customerId);
  if (!identity) {
    log.debug("handleSubscriptionDeleted: no identity for customer", { customerId });
    log.debug("handleSubscriptionDeleted returning", { status: 200, reason: "unknown customer" });
    return NextResponse.json({ status: "ignored", reason: "unknown_customer" });
  }

  const isAnonymous = isAnonymousStripeReverseIndex(identity);

  const entitlement = {
    tier: "thrall" as const,
    active: false,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeStatus: "canceled",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: subscription.items.data[0]
      ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
      : new Date().toISOString(),
    linkedAt: new Date().toISOString(),
    checkedAt: new Date().toISOString(),
  };

  if (isAnonymous) {
    const stripeId = extractStripeCustomerIdFromReverseIndex(identity);
    const existing = await getAnonymousStripeEntitlement(stripeId);
    entitlement.linkedAt = existing?.linkedAt ?? entitlement.linkedAt;
    await setAnonymousStripeEntitlement(stripeId, entitlement);
    log.debug("handleSubscriptionDeleted returning (anonymous)", {
      status: 200,
      tier: "thrall",
      active: false,
      stripeCustomerId: stripeId,
    });
  } else {
    const existing = await getStripeEntitlement(identity);
    entitlement.linkedAt = existing?.linkedAt ?? entitlement.linkedAt;
    await setStripeEntitlement(identity, entitlement);
    log.debug("handleSubscriptionDeleted returning (authenticated)", {
      status: 200,
      tier: "thrall",
      active: false,
      googleSub: identity,
    });
  }

  return NextResponse.json({
    status: "processed",
    eventType: "customer.subscription.deleted",
    tier: "thrall",
    active: false,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/stripe/webhook called");

  // --- Read raw body for signature validation ---
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    log.debug("POST /api/stripe/webhook returning", { status: 400, error: "invalid_body" });
    return NextResponse.json(
      { error: "invalid_body", error_description: "Could not read request body." },
      { status: 400 },
    );
  }

  // --- Validate webhook signature (SHA-256 HMAC) ---
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    log.debug("POST /api/stripe/webhook returning", { status: 400, error: "missing_signature" });
    return NextResponse.json(
      { error: "missing_signature", error_description: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  const event = verifyWebhookSignature(rawBody, signature);
  if (!event) {
    log.debug("POST /api/stripe/webhook returning", { status: 400, error: "invalid_signature" });
    return NextResponse.json(
      { error: "invalid_signature", error_description: "Webhook signature validation failed." },
      { status: 400 },
    );
  }

  // --- Check if this is an event type we handle ---
  if (!HANDLED_EVENTS.has(event.type)) {
    log.debug("POST /api/stripe/webhook returning", {
      status: 200,
      reason: "unhandled event type",
      eventType: event.type,
    });
    return NextResponse.json({ status: "ignored", eventType: event.type });
  }

  log.debug("POST /api/stripe/webhook: processing event", {
    eventType: event.type,
    eventId: event.id,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return await handleCheckoutCompleted(session);
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        return await handleSubscriptionUpdated(subscription);
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        return await handleSubscriptionDeleted(subscription);
      }
      case "billing_portal.session.created": {
        // No-op acknowledgment — portal sessions are informational only
        log.debug("billing_portal.session.created received — no action needed");
        log.debug("POST /api/stripe/webhook returning", {
          status: 200,
          eventType: "billing_portal.session.created",
          reason: "portal session acknowledged (no-op)",
        });
        return NextResponse.json({
          status: "acknowledged",
          eventType: "billing_portal.session.created",
          reason: "portal session acknowledged (no-op)",
        });
      }
      default: {
        log.debug("POST /api/stripe/webhook returning", { status: 200, reason: "unexpected event" });
        return NextResponse.json({ status: "ignored" });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/stripe/webhook: processing failed", {
      eventType: event.type,
      eventId: event.id,
      error: message,
    });
    log.debug("POST /api/stripe/webhook returning", { status: 500, error: "processing_error" });
    return NextResponse.json(
      { error: "processing_error", error_description: "Failed to process webhook event." },
      { status: 500 },
    );
  }
}
