/**
 * Stripe webhook processing helpers.
 *
 * Provides signature verification and event-to-entitlement mapping logic
 * used by the POST /api/stripe/webhook route.
 *
 * Security model:
 *   - Signature verification via `stripe.webhooks.constructEvent()` using
 *     the STRIPE_WEBHOOK_SECRET (SHA-256 HMAC).
 *   - No Bearer auth — Stripe sends webhooks, not authenticated users.
 *
 * @module stripe/webhook
 * @see ADR-010 for the Stripe Direct integration decision
 */

import type Stripe from "stripe";
import { stripe } from "./api";
import { ACTIVE_STRIPE_STATUSES } from "./types";
import type { StripeTier, StoredStripeEntitlement } from "./types";
import { log } from "@/lib/logger";

/**
 * Verifies a Stripe webhook signature and constructs the event object.
 *
 * @param rawBody - The raw request body as a string (NOT parsed JSON)
 * @param signature - Value from the `stripe-signature` header
 * @returns The verified Stripe event, or null if verification fails
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): Stripe.Event | null {
  log.debug("verifyWebhookSignature called", {
    bodyLength: rawBody.length,
    signatureLength: signature.length,
  });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.error("verifyWebhookSignature: STRIPE_WEBHOOK_SECRET not configured");
    log.debug("verifyWebhookSignature returning", { verified: false, reason: "no secret" });
    return null;
  }

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    log.debug("verifyWebhookSignature returning", {
      verified: true,
      eventId: event.id,
      eventType: event.type,
    });
    return event;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("verifyWebhookSignature: signature verification failed", { error: message });
    log.debug("verifyWebhookSignature returning", { verified: false, reason: "invalid signature" });
    return null;
  }
}

/**
 * Maps a Stripe subscription status string to a tier and active flag.
 *
 * @param stripeStatus - The Stripe subscription status
 * @returns Tier and active flag
 */
export function mapStripeStatusToTier(stripeStatus: string): {
  tier: StripeTier;
  active: boolean;
} {
  log.debug("mapStripeStatusToTier called", { stripeStatus });

  const active = ACTIVE_STRIPE_STATUSES.has(stripeStatus);
  const tier: StripeTier = active ? "karl" : "thrall";

  log.debug("mapStripeStatusToTier returning", { tier, active });
  return { tier, active };
}

/**
 * Builds a StoredStripeEntitlement from a Stripe subscription object.
 *
 * @param subscription - The Stripe subscription object
 * @param customerId - The Stripe customer ID
 * @returns A StoredStripeEntitlement ready for KV storage
 */
export function buildEntitlementFromSubscription(
  subscription: Stripe.Subscription,
  customerId: string,
): StoredStripeEntitlement {
  log.debug("buildEntitlementFromSubscription called", {
    subscriptionId: subscription.id,
    customerId,
    status: subscription.status,
  });

  const { tier, active } = mapStripeStatusToTier(subscription.status);
  const now = new Date().toISOString();

  const entitlement: StoredStripeEntitlement = {
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
    linkedAt: now,
    checkedAt: now,
  };

  log.debug("buildEntitlementFromSubscription returning", {
    tier,
    active,
    subscriptionId: subscription.id,
  });

  return entitlement;
}
