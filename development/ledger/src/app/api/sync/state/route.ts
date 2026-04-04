/**
 * GET /api/sync/state
 *
 * Returns the current sync state for the authenticated user within their
 * household. Creates the sync state document on first access.
 *
 * Karl-only: Thrall and free-trial users receive 403.
 *
 * Query params:
 *   ?householdId=<string>   required — the household to query sync state for
 *
 * Response 200:
 *   {
 *     syncVersion: number,        — household-level change counter
 *     lastSyncedVersion: number,  — this member's last acknowledged version
 *     needsDownload: boolean      — true if another member pushed since last pull
 *   }
 *
 * Error responses:
 *   400 — missing householdId
 *   401 — not authenticated
 *   403 — user is not Karl tier, or householdId does not match user's household
 *   500 — internal error
 *
 * Security: household membership is verified via requireAuthz() before any
 * Firestore access. The authz-resolved householdId and userId are used for all
 * Firestore operations — never raw client-supplied values — to prevent IDOR.
 *
 * Issue #2001
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthz } from "@/lib/auth/authz";
import {
  getMemberSyncState,
  getHouseholdSyncVersion,
} from "@/lib/firebase/firestore";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/sync/state called");

  const householdId = request.nextUrl.searchParams.get("householdId");
  if (!householdId) {
    return NextResponse.json(
      {
        error: "missing_param",
        error_description: "Query param ?householdId=<string> is required.",
      },
      { status: 400 },
    );
  }

  // requireAuthz: authentication + user resolution + household membership + Karl tier
  const authz = await requireAuthz(request, { householdId, tier: "karl" });
  if (!authz.ok) return authz.response;

  // Use authz-resolved values — never raw query params — to prevent IDOR
  const resolvedHouseholdId = authz.firestoreUser.householdId;
  const userId = authz.firestoreUser.userId;

  try {
    // Fetch current household syncVersion and member's sync state in parallel
    const [syncVersion, existingSyncState] = await Promise.all([
      getHouseholdSyncVersion(resolvedHouseholdId),
      getMemberSyncState(resolvedHouseholdId, userId),
    ]);

    // Return existing sync state, or default values for first access
    const lastSyncedVersion = existingSyncState?.lastSyncedVersion ?? 0;
    const needsDownload = existingSyncState?.needsDownload ?? false;

    log.debug("GET /api/sync/state returning", {
      status: 200,
      householdId: resolvedHouseholdId,
      userId,
      syncVersion,
      lastSyncedVersion,
      needsDownload,
    });

    return NextResponse.json(
      { syncVersion, lastSyncedVersion, needsDownload },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/sync/state internal error", {
      householdId: resolvedHouseholdId,
      userId,
      error: message,
    });
    return NextResponse.json(
      {
        error: "internal_error",
        error_description: "Failed to fetch sync state.",
      },
      { status: 500 },
    );
  }
}
