/**
 * @deprecated Use requireAuthz(request, { tier: "karl-or-trial" }) from "@/lib/auth/authz"
 * instead. This module will be removed in a future cleanup sprint.
 */

/**
 * requireKarlOrTrial — route-level guard for Karl tier OR active trial.
 *
 * Allows access to Google Sheets import for:
 *   - Karl-tier users (active Stripe subscription)
 *   - Active trial users (trial stored at /households/{userId}/trial)
 *
 * Expired trial users and Thrall users with no trial receive 402.
 * Does NOT auto-initialize a trial — callers must call /api/trial/init explicitly.
 *
 * Must be called AFTER requireAuth() — requires the verified user.
 *
 * @module auth/require-karl-or-trial
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { getTrial, computeTrialStatus } from "@/lib/kv/trial-store";
import { log } from "@/lib/logger";
import type { VerifiedUser } from "./require-auth";

/** Karl-or-trial check succeeded. */
export type KarlOrTrialSuccess = { ok: true };

/** Karl-or-trial check failed — pre-built 402 NextResponse ready to return. */
export type KarlOrTrialFailure = { ok: false; response: NextResponse };

/** Result type for requireKarlOrTrial(). */
export type KarlOrTrialResult = KarlOrTrialSuccess | KarlOrTrialFailure;

/**
 * Verifies the authenticated user has Karl-tier access OR an active trial.
 *
 * @param user    - The verified Google user from requireAuth()
 * @param _request - Unused (kept for API compatibility)
 * @returns KarlOrTrialResult — either { ok: true } or { ok: false, response }
 */
export async function requireKarlOrTrial(
  user: VerifiedUser,
  _request: NextRequest,
): Promise<KarlOrTrialResult> {
  log.debug("requireKarlOrTrial called", { googleSub: user.sub });

  // 1. Check Karl-tier Stripe subscription
  const entitlement = await getStripeEntitlement(user.sub);
  const isKarl = entitlement?.tier === "karl" && entitlement?.active === true;

  if (isKarl) {
    log.debug("requireKarlOrTrial returning", { ok: true, reason: "karl" });
    return { ok: true };
  }

  // 2. Check active trial via userId-based lookup (no auto-init)
  const trial = await getTrial(user.sub);
  const { status } = computeTrialStatus(trial);

  if (status === "active") {
    log.debug("requireKarlOrTrial returning", { ok: true, reason: "trial" });
    return { ok: true };
  }

  log.debug("requireKarlOrTrial: trial not active", { googleSub: user.sub, trialStatus: status });

  // 3. Neither Karl nor active trial — return 402
  const currentTier = entitlement?.tier ?? "thrall";
  log.debug("requireKarlOrTrial returning", {
    ok: false,
    currentTier,
    status: 402,
  });

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "subscription_required",
        required_tier: "karl",
        current_tier: currentTier,
        message: "Upgrade to Karl or start a free trial to access this feature.",
      },
      { status: 402 },
    ),
  };
}
