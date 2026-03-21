/**
 * Shared trial initialization logic.
 *
 * Extracted so it can be called from both:
 *  - POST /api/trial/init (HTTP route handler)
 *  - POST /api/auth/token (server-side, fire-and-forget after token exchange)
 *
 * Includes household provisioning (ensureSoloHousehold) before trial init,
 * since the trial doc lives under the household (Issue #1707).
 *
 * @module lib/trial/init-trial
 */

import { initTrial, TrialRestartError } from "@/lib/kv/trial-store";
import { ensureSoloHousehold } from "@/lib/firebase/firestore";
import { log } from "@/lib/logger";

export interface InitTrialResult {
  ok: true;
  startDate: string;
  expiresAt: string;
  isNew: boolean;
}

export interface InitTrialExpired {
  ok: false;
  error: "trial_expired";
}

export interface InitTrialError {
  ok: false;
  error: "internal_error";
  message: string;
}

export type InitTrialOutcome = InitTrialResult | InitTrialExpired | InitTrialError;

export interface InitTrialInput {
  /** Google OAuth `sub` claim */
  userId: string;
  /** User email for household provisioning */
  email: string;
  /** User display name for household provisioning */
  displayName: string;
}

/**
 * Ensures the household exists, then initializes a trial for the given user.
 *
 * - Returns `{ ok: true, ... }` on success (new or existing active/converted trial).
 * - Returns `{ ok: false, error: "trial_expired" }` if trial already expired (restart blocked).
 * - Returns `{ ok: false, error: "internal_error", message }` on unexpected failures.
 */
export async function initTrialForUser(input: InitTrialInput): Promise<InitTrialOutcome> {
  const { userId, email, displayName } = input;
  log.debug("initTrialForUser called", { userId });

  // Ensure household + user Firestore documents exist (idempotent on subsequent sign-ins).
  // Issue #1707: must happen before trial init so the household doc is present.
  try {
    await ensureSoloHousehold({ userId, email, displayName });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("initTrialForUser ensureSoloHousehold failed", { userId, error: message });
    return { ok: false, error: "internal_error", message };
  }

  try {
    const { trial, isNew } = await initTrial(userId);
    log.debug("initTrialForUser returning", {
      userId,
      isNew,
      startDate: trial.startDate,
    });
    return {
      ok: true,
      startDate: trial.startDate,
      expiresAt: trial.expiresAt,
      isNew,
    };
  } catch (err) {
    if (err instanceof TrialRestartError) {
      log.debug("initTrialForUser returning", { userId, error: "trial_expired" });
      return { ok: false, error: "trial_expired" };
    }
    const message = err instanceof Error ? err.message : String(err);
    log.error("initTrialForUser failed", { userId, error: message });
    return { ok: false, error: "internal_error", message };
  }
}
