/**
 * requireKarlOrTrial — route-level guard for Karl tier OR active trial.
 *
 * Allows access to Google Sheets import for:
 *   - Karl-tier users (active Stripe subscription)
 *   - Active trial users (browser fingerprint in X-Trial-Fingerprint header)
 *
 * If the fingerprint is valid but no trial exists yet, the trial is
 * auto-initialized — satisfying the "trial starts on sign-up" requirement
 * (first import IS the sign-up flow for most new users, #892).
 *
 * Expired trial users and Thrall users with no trial receive 402.
 *
 * Must be called AFTER requireAuth() — requires the verified user.
 *
 * @module auth/require-karl-or-trial
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { getTrial, initTrial, computeTrialStatus } from "@/lib/kv/trial-store";
import { isValidFingerprint } from "@/lib/trial-utils";
import { log } from "@/lib/logger";
import type { VerifiedUser } from "./verify-id-token";

/** Karl-or-trial check succeeded. */
export type KarlOrTrialSuccess = { ok: true };

/** Karl-or-trial check failed — pre-built 402 NextResponse ready to return. */
export type KarlOrTrialFailure = { ok: false; response: NextResponse };

/** Result type for requireKarlOrTrial(). */
export type KarlOrTrialResult = KarlOrTrialSuccess | KarlOrTrialFailure;

/**
 * Verifies the authenticated user has Karl-tier access OR an active trial.
 *
 * Checks in order:
 *   1. Karl-tier Stripe subscription
 *   2. Active trial via X-Trial-Fingerprint request header
 *
 * @param user    - The verified Google user from requireAuth()
 * @param request - The incoming NextRequest (reads X-Trial-Fingerprint header)
 * @returns KarlOrTrialResult — either { ok: true } or { ok: false, response }
 */
export async function requireKarlOrTrial(
  user: VerifiedUser,
  request: NextRequest,
): Promise<KarlOrTrialResult> {
  log.debug("requireKarlOrTrial called", { googleSub: user.sub });

  // 1. Check Karl-tier Stripe subscription
  const entitlement = await getStripeEntitlement(user.sub);
  const isKarl = entitlement?.tier === "karl" && entitlement?.active === true;

  if (isKarl) {
    log.debug("requireKarlOrTrial returning", { ok: true, reason: "karl" });
    return { ok: true };
  }

  // 2. Check active trial via X-Trial-Fingerprint header
  const fingerprint = request.headers.get("x-trial-fingerprint");

  if (fingerprint && isValidFingerprint(fingerprint)) {
    let trial = await getTrial(fingerprint);

    // Auto-initialize trial if none exists yet (trial starts on sign-up, #892).
    // First import is the sign-up action for most new users.
    if (!trial) {
      try {
        trial = await initTrial(fingerprint);
        log.debug("requireKarlOrTrial: auto-initialized trial", { fingerprint });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error("requireKarlOrTrial: failed to auto-init trial", { fingerprint, error: message });
        // Fall through — trial is null, computeTrialStatus returns "none"
      }
    }

    const { status } = computeTrialStatus(trial);

    if (status === "active") {
      log.debug("requireKarlOrTrial returning", { ok: true, reason: "trial" });
      return { ok: true };
    }

    log.debug("requireKarlOrTrial: trial not active", { fingerprint, trialStatus: status });
  }

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
