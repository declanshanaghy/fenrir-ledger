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
 *   403 — user is not Karl tier (Thrall or free trial)
 *   500 — internal error
 *
 * Issue #1122
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { getAllFirestoreCards } from "@/lib/firebase/firestore";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/sync/pull called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const googleSub = auth.user.sub;

  // Karl-only gate: no sync for Thrall or free-trial users
  const entitlement = await getStripeEntitlement(googleSub);
  const isKarl = entitlement?.tier === "karl" && entitlement?.active === true;

  if (!isKarl) {
    const currentTier = entitlement?.tier ?? "thrall";
    log.debug("GET /api/sync/pull returning", {
      status: 403,
      reason: "not_karl",
      currentTier,
    });
    return NextResponse.json(
      {
        error: "forbidden",
        error_description:
          "Cloud sync is a Karl-tier feature. Upgrade to Karl to enable sync.",
        current_tier: currentTier,
      },
      { status: 403 },
    );
  }

  // Validate query param
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

  try {
    const cards = await getAllFirestoreCards(householdId);
    const activeCount = cards.filter((c) => !c.deletedAt).length;

    log.debug("GET /api/sync/pull returning", {
      status: 200,
      householdId,
      total: cards.length,
      activeCount,
    });

    return NextResponse.json(
      { cards, activeCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/sync/pull internal error", { householdId, error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Pull failed due to a server error." },
      { status: 500 },
    );
  }
}
