/**
 * GET /api/sync/pull
 *
 * Downloads all cards for the authenticated user's household from Firestore,
 * including tombstones (deletedAt set), so the client can merge them with
 * local data and propagate deletions.
 *
 * Karl-only: Thrall and free-trial users receive 403.
 *
 * Query params:
 *   ?householdId=<string>   required — the household to pull cards for
 *
 * Response 200:
 *   { cards: Card[], activeCount: number }
 *   cards — all Firestore cards including tombstones
 *   activeCount — number of non-tombstoned cards
 *
 * Error responses:
 *   400 — missing householdId
 *   401 — not authenticated
 *   403 — household mismatch (IDOR) or user is not Karl tier
 *   500 — internal error
 *
 * Issue #1122, #1199
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthz } from "@/lib/auth/authz";
import { getAllFirestoreCards } from "@/lib/firebase/firestore";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/sync/pull called");

  // Validate query param before auth so we can return 400 immediately
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

  // Auth + household membership + Karl-tier gate in one call.
  // Passes householdId so requireAuthz verifies it matches the user's own household,
  // closing the IDOR vector (SEV-001).
  const authz = await requireAuthz(request, { tier: "karl", householdId });
  if (!authz.ok) return authz.response;

  try {
    // ALWAYS use authz.firestoreUser.householdId — never the caller-supplied param.
    const verifiedHouseholdId = authz.firestoreUser.householdId;
    const cards = await getAllFirestoreCards(verifiedHouseholdId);
    const activeCount = cards.filter((c) => !c.deletedAt).length;

    log.debug("GET /api/sync/pull returning", {
      status: 200,
      householdId: verifiedHouseholdId,
      total: cards.length,
      activeCount,
    });

    return NextResponse.json(
      { cards, activeCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/sync/pull internal error", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Pull failed due to a server error." },
      { status: 500 },
    );
  }
}
