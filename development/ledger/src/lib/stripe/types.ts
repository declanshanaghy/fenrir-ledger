/**
 * Stripe integration — Type Definitions
 *
 * Types for Stripe checkout sessions, subscriptions, webhooks, and stored
 * entitlements. Used exclusively by server-side code (API routes and the
 * Stripe client wrapper).
 *
 * See ADR-010 for the Stripe Direct integration decision.
 *
 * @module stripe/types
 */

// ---------------------------------------------------------------------------
// Tier model
// ---------------------------------------------------------------------------

/**
 * Subscription tier names using Norse-themed naming.
 * - thrall: Free tier (all current features, no subscription required)
 * - karl: Paid supporter tier (via Stripe subscription)
 */
export type StripeTier = "thrall" | "karl";

// ---------------------------------------------------------------------------
// Stripe subscription status mapping
// ---------------------------------------------------------------------------

/**
 * Stripe subscription statuses that we consider "active" (karl tier).
 * All other statuses map to thrall.
 *
 * @see https://docs.stripe.com/api/subscriptions/object#subscription_object-status
 */
export const ACTIVE_STRIPE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due", // Users with payment issues still have access
]);

// ---------------------------------------------------------------------------
// Stored Stripe entitlement (Redis)
// ---------------------------------------------------------------------------

/**
 * Stripe-specific entitlement record stored in Redis.
 *
 * Keyed by Google user sub: `entitlement:{googleSub}`.
 */
export interface StoredStripeEntitlement {
  /** Current subscription tier */
  tier: StripeTier;
  /** Whether the subscription is currently active */
  active: boolean;
  /** Stripe customer ID (cus_xxx) */
  stripeCustomerId: string;
  /** Stripe subscription ID (sub_xxx) */
  stripeSubscriptionId: string;
  /** Raw Stripe subscription status string */
  stripeStatus: string;
  /** Whether the subscription is set to cancel at period end */
  cancelAtPeriodEnd?: boolean;
  /** ISO 8601 timestamp of current billing period end */
  currentPeriodEnd?: string;
  /** ISO 8601 timestamp when Stripe was linked */
  linkedAt: string;
  /** ISO 8601 timestamp of last status check */
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Webhook event types
// ---------------------------------------------------------------------------

/**
 * Stripe webhook event types that we handle.
 */
export type StripeWebhookEventType =
  | "checkout.session.completed"
  | "customer.subscription.updated"
  | "customer.subscription.deleted";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

/** Response from GET /api/stripe/membership */
export interface StripeMembershipResponse {
  tier: StripeTier;
  active: boolean;
  platform: "stripe";
  checkedAt: string;
  /** Stripe customer ID — included when the user has a linked entitlement */
  customerId?: string;
  /** ISO 8601 timestamp when Stripe was linked — included when linked */
  linkedAt?: string;
  /** Raw Stripe subscription status (e.g. "active", "canceled") */
  stripeStatus?: string;
  /** Whether the subscription is set to cancel at period end */
  cancelAtPeriodEnd?: boolean;
  /** ISO 8601 timestamp of current billing period end */
  currentPeriodEnd?: string;
}

/** Response from POST /api/stripe/checkout */
export interface StripeCheckoutResponse {
  /** Stripe Checkout Session URL to redirect the user to (absent when revived) */
  url?: string;
  /** Whether an existing canceling subscription was revived instead of creating a new one */
  revived?: boolean;
  /** Human-readable message for the revive/cleanup action taken */
  message?: string;
}

/** Response from POST /api/stripe/portal */
export interface StripePortalResponse {
  /** Stripe Customer Portal URL to redirect the user to */
  url: string;
}
