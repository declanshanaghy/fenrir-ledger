/**
 * Stripe SDK client — lazy singleton initialization.
 *
 * Reads `STRIPE_SECRET_KEY` from the environment and creates a Stripe
 * instance on first access. The key is server-side only (no NEXT_PUBLIC_ prefix).
 *
 * Initialization is deferred to avoid failing at build time when the env var
 * is not yet available (e.g. `next build` in CI without secrets).
 *
 * Usage:
 *   import { getStripe } from "@/lib/stripe/api";
 *   const stripe = getStripe();
 *   const session = await stripe.checkout.sessions.create({ ... });
 *
 * Or use the convenience re-export:
 *   import { stripe } from "@/lib/stripe/api";
 *   // NOTE: `stripe` is a lazy proxy — safe to import at module level
 *
 * @module stripe/api
 * @see ADR-010 for the Stripe Direct integration decision
 */

import Stripe from "stripe";
import { log } from "@/lib/logger";

/** Cached Stripe client instance. */
let _stripe: Stripe | null = null;

/**
 * Returns the singleton Stripe client, creating it on first call.
 *
 * @returns Stripe SDK instance
 * @throws Error if STRIPE_SECRET_KEY is not configured
 */
export function getStripe(): Stripe {
  if (_stripe) {
    return _stripe;
  }

  log.debug("getStripe: initializing Stripe client");
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const error = "STRIPE_SECRET_KEY is not configured. Set it in .env.local or Vercel environment variables.";
    log.error("getStripe: missing key", { error });
    throw new Error(error);
  }
  log.debug("getStripe: key present", { keyLength: key.length });

  _stripe = new Stripe(key, {
    apiVersion: "2026-02-25.clover",
    typescript: true,
    appInfo: {
      name: "Fenrir Ledger",
      version: "1.0.0",
    },
  });

  log.debug("getStripe returning", { initialized: true });
  return _stripe;
}

/**
 * Convenience export — lazy proxy that defers initialization until first use.
 *
 * Safe to import at module top-level; the actual Stripe client is not created
 * until a property is accessed (i.e. when a route handler runs).
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const instance = getStripe();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
