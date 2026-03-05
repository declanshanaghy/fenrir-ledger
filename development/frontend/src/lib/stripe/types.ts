/**
 * Stripe integration — Type Definitions
 *
 * Types for Stripe checkout sessions, subscriptions, webhooks, and stored
 * entitlements. Used exclusively by server-side code (API routes and the
 * Stripe client wrapper).
 *
 * Mirrors the Patreon types structure for consistency across subscription
 * platforms. See ADR-010 for the Stripe Direct integration decision.
 *
 * @module stripe/types
 */

// ---------------------------------------------------------------------------
// Tier model (shared with Patreon)
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
]);

// ---------------------------------------------------------------------------
// Stored Stripe entitlement (Vercel KV)
// ---------------------------------------------------------------------------

/**
 * Stripe-specific entitlement record stored in Vercel KV.
 *
 * Keyed by Google user sub: `entitlement:{googleSub}`
 * Same key namespace as Patreon entitlements — only one platform is active at
 * a time (controlled by SUBSCRIPTION_PLATFORM feature flag).
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
}

/** Response from POST /api/stripe/checkout */
export interface StripeCheckoutResponse {
  /** Stripe Checkout Session URL to redirect the user to */
  url: string;
}

/** Response from POST /api/stripe/portal */
export interface StripePortalResponse {
  /** Stripe Customer Portal URL to redirect the user to */
  url: string;
}
