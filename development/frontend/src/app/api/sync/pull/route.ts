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
 *   403 — user is not Karl tier, or householdId does not match user's household
 *   500 — internal error
 *
 * Security: household membership is verified via requireAuthz() before any
 * Firestore access. The authz-resolved householdId is used for all Firestore
 * operations — never the raw client-supplied query param — to prevent IDOR.
 *
 * Issue #1122, #1192
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthz } from "@/lib/auth/authz";
import { getAllFirestoreCards } from "@/lib/firebase/firestore";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/sync/pull called");

  // Validate query param before authz so we can return 400 on missing householdId
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
  // If the caller-supplied householdId does not match the user's actual household,
  // requireAuthz returns 403 before Firestore is ever accessed.
  const authz = await requireAuthz(request, { householdId, tier: "karl" });
  if (!authz.ok) return authz.response;

  // Use the authz-resolved householdId — never the raw query param — to prevent IDOR
  const resolvedHouseholdId = authz.firestoreUser.householdId;

  try {
    const cards = await getAllFirestoreCards(resolvedHouseholdId);
    const activeCount = cards.filter((c) => !c.deletedAt).length;

    log.debug("GET /api/sync/pull returning", {
      status: 200,
      householdId: resolvedHouseholdId,
      total: cards.length,
      activeCount,
    });

    return NextResponse.json(
      { cards, activeCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/sync/pull internal error", { householdId: resolvedHouseholdId, error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Pull failed due to a server error." },
      { status: 500 },
    );
  }
}
