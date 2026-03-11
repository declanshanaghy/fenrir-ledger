/**
 * Route-level Karl tier guard for Next.js API routes -- Fenrir Ledger
 *
 * Checks that an authenticated user has an active Karl subscription.
 * Must be called AFTER requireAuth() — requires the verified user.
 *
 * Usage in a route handler:
 *   const auth = await requireAuth(request);
 *   if (!auth.ok) return auth.response;
 *   const karl = await requireKarl(auth.user);
 *   if (!karl.ok) return karl.response;
 *   // user is Karl tier — proceed
 *
 * Returns 402 Payment Required for Thrall users per Odin clarification (#559):
 *   - 401 = not authenticated
 *   - 402 = authenticated but insufficient subscription tier
 *   - 403 = authenticated but not permitted (role/permission issue)
 *
 * @module auth/require-karl
 */

import { NextResponse } from "next/server";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { log } from "@/lib/logger";
import type { VerifiedUser } from "./verify-id-token";

/** Karl check succeeded — user has an active Karl subscription. */
export type KarlSuccess = { ok: true };

/** Karl check failed — pre-built 402 NextResponse is ready to return. */
export type KarlFailure = { ok: false; response: NextResponse };

/** Result type for requireKarl(). */
export type KarlResult = KarlSuccess | KarlFailure;

/**
 * Verifies the authenticated user has an active Karl-tier subscription.
 *
 * Looks up the user's entitlement in Vercel KV (kept fresh by Stripe webhooks).
 * Returns 402 Payment Required if the user is on the Thrall (free) tier.
 *
 * @param user - The verified Google user from requireAuth()
 * @returns KarlResult — either { ok: true } or { ok: false, response }
 */
export async function requireKarl(user: VerifiedUser): Promise<KarlResult> {
  log.debug("requireKarl called", { googleSub: user.sub });

  const entitlement = await getStripeEntitlement(user.sub);
  const isKarl = entitlement?.tier === "karl" && entitlement?.active === true;

  if (!isKarl) {
    const currentTier = entitlement?.tier ?? "thrall";
    log.debug("requireKarl returning", {
      ok: false,
      currentTier,
      active: entitlement?.active ?? false,
      status: 402,
    });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "subscription_required",
          required_tier: "karl",
          current_tier: currentTier,
          message: "Upgrade to Karl to access this feature.",
        },
        { status: 402 },
      ),
    };
  }

  log.debug("requireKarl returning", { ok: true, googleSub: user.sub });
  return { ok: true };
}
