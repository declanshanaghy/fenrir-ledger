/**
 * Centralized authorization middleware for Fenrir Ledger API routes.
 *
 * `requireAuthz()` sequences authentication, user resolution, household
 * membership validation, and tier gating into a single composable call.
 *
 * Design rationale and security consequences: ADR-015
 *
 * Usage in a route handler:
 *   const authz = await requireAuthz(request, { householdId, tier: "karl" });
 *   if (!authz.ok) return authz.response;
 *   // authz.user       — VerifiedUser (Google id_token claims)
 *   // authz.firestoreUser — FirestoreUser (householdId, role)
 *   // Use authz.firestoreUser.householdId for ALL Firestore ops — never the
 *   // caller-supplied householdId — to prevent IDOR.
 *
 * Pipeline (sequential):
 *   1. requireAuth(request)           → 401 on missing/invalid token
 *   2. getUser(user.sub)              → 403 if user doc not found
 *   3. household membership check     → 403 if supplied id ≠ actual id
 *   4. tier check (karl)              → 403 if not active Karl subscriber
 *   4. tier check (karl-or-trial)     → 402 if neither Karl nor active trial
 *   5. audit log on every denial
 *   6. return { ok: true, user, firestoreUser }
 *
 * See ADR-015 for full rationale including the IDOR fix pattern and the
 * tradeoff of always hitting Firestore (no caching).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "./require-auth";
import { getUser } from "@/lib/firebase/firestore";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { getTrial, initTrial, computeTrialStatus, TrialRestartError } from "@/lib/kv/trial-store";
import { log } from "@/lib/logger";
import type { VerifiedUser } from "./verify-id-token";
import type { FirestoreUser } from "@/lib/firebase/firestore-types";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Authorization requirements for a route.
 * All fields are optional — omitting tier enforces auth-only.
 */
export interface AuthzRequirement {
  /** Triggers household membership check: supplied value must match firestoreUser.householdId. */
  householdId?: string;
  /** Tier gate: "karl" → 403 if not Karl; "karl-or-trial" → 402 if neither. */
  tier?: "karl" | "karl-or-trial";
}

/** Authorization succeeded — both user representations are available. */
export type AuthzSuccess = {
  ok: true;
  user: VerifiedUser;
  firestoreUser: FirestoreUser;
};

/** Authorization failed — pre-built NextResponse is ready to return. */
export type AuthzFailure = { ok: false; response: NextResponse };

/** Discriminated union result from requireAuthz(). */
export type AuthzResult = AuthzSuccess | AuthzFailure;

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Verifies the caller is authenticated, belongs to the specified household,
 * and meets the tier requirement.
 *
 * @param request     - Incoming Next.js request
 * @param requirement - Optional household + tier requirements
 * @returns AuthzResult — { ok: true, user, firestoreUser } or { ok: false, response }
 */
export async function requireAuthz(
  request: NextRequest,
  requirement?: AuthzRequirement,
): Promise<AuthzResult> {
  // ── Step 1: Authentication ────────────────────────────────────────────────
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;

  const { user } = auth;
  const googleSub = user.sub;

  // ── Step 2: User resolution ───────────────────────────────────────────────
  const firestoreUser = await getUser(googleSub);
  if (!firestoreUser) {
    log.warn("requireAuthz: access denied", {
      reason: "user_not_found",
      googleSub,
      route: request.nextUrl.pathname,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", error_description: "User account not found." },
        { status: 403 },
      ),
    };
  }

  // ── Step 3: Household membership check ───────────────────────────────────
  // Legacy client compat: the client sends session.user.sub (Google sub) as
  // householdId for localStorage keying. Accept it as "my own household"
  // since the authenticated user's identity is already verified. The server
  // still uses firestoreUser.householdId for all Firestore operations, so
  // IDOR protection is intact.
  if (requirement?.householdId !== undefined) {
    const isOwnSub = requirement.householdId === googleSub;
    if (!isOwnSub && requirement.householdId !== firestoreUser.householdId) {
      log.warn("requireAuthz: access denied", {
        reason: "household_mismatch",
        googleSub,
        suppliedHouseholdId: requirement.householdId,
        actualHouseholdId: firestoreUser.householdId,
        route: request.nextUrl.pathname,
      });
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "forbidden",
            error_description:
              "You do not have access to the requested household.",
          },
          { status: 403 },
        ),
      };
    }
  }

  // ── Step 4: Tier check ────────────────────────────────────────────────────
  if (requirement?.tier === "karl") {
    const entitlement = await getStripeEntitlement(googleSub);
    const isKarl = entitlement?.tier === "karl" && entitlement?.active === true;

    if (!isKarl) {
      const currentTier = entitlement?.tier ?? "thrall";
      log.warn("requireAuthz: access denied", {
        reason: "tier_required_karl",
        googleSub,
        currentTier,
        route: request.nextUrl.pathname,
      });
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "forbidden",
            error_description:
              "This feature requires a Karl-tier subscription.",
            current_tier: currentTier,
            required_tier: "karl",
          },
          { status: 403 },
        ),
      };
    }
  }

  if (requirement?.tier === "karl-or-trial") {
    const denied = await checkKarlOrTrial(request, googleSub);
    if (denied) {
      log.warn("requireAuthz: access denied", {
        reason: denied.reason,
        googleSub,
        route: request.nextUrl.pathname,
      });
      return { ok: false, response: denied.response };
    }
  }

  // ── Step 5: Authorized ────────────────────────────────────────────────────
  return { ok: true, user, firestoreUser };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Checks Karl-tier OR active trial access.
 * Returns a denial descriptor if access should be blocked, or null if allowed.
 *
 * Trial is looked up by googleSub directly in /households/{googleSub}/trial.
 * Auto-initializes trial if none exists yet (trial starts on first eligible action).
 */
async function checkKarlOrTrial(
  _request: NextRequest,
  googleSub: string,
): Promise<{ reason: string; response: NextResponse } | null> {
  // 1. Karl-tier subscription
  const entitlement = await getStripeEntitlement(googleSub);
  const isKarl = entitlement?.tier === "karl" && entitlement?.active === true;

  if (isKarl) return null; // allowed

  // 2. Active trial via userId-based lookup
  let trial = await getTrial(googleSub);

  if (!trial) {
    try {
      const result = await initTrial(googleSub);
      trial = result.trial;
      log.debug("requireAuthz: auto-initialized trial", { googleSub });
    } catch (err) {
      if (err instanceof TrialRestartError) {
        // Trial expired — fall through to deny
        log.debug("requireAuthz: trial restart blocked", { googleSub });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        log.error("requireAuthz: failed to auto-init trial", { googleSub, error: message });
      }
      // Fall through — trial is null → computeTrialStatus returns "none"
    }
  }

  const { status } = computeTrialStatus(trial);
  if (status === "active") return null; // allowed

  // 3. Neither Karl nor active trial
  const currentTier = entitlement?.tier ?? "thrall";
  return {
    reason: "tier_required_karl_or_trial",
    response: NextResponse.json(
      {
        error: "subscription_required",
        required_tier: "karl",
        current_tier: currentTier,
        message:
          "Upgrade to Karl or start a free trial to access this feature.",
      },
      { status: 402 },
    ),
  };
}
