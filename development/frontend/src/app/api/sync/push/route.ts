/**
 * POST /api/sync/push
 *
 * Uploads local cards to Firestore and returns the merged result.
 *
 * Conflict resolution: per-card last-write-wins using effectiveTimestamp
 * (max of updatedAt and deletedAt). Tombstones propagate in both directions.
 *
 * Karl-only: Thrall and free-trial users receive 403.
 *
 * Request body:
 *   { householdId: string, cards: Card[] }
 *   cards should include ALL local cards, including tombstones (deletedAt set).
 *
 * Response 200:
 *   { cards: Card[], syncedCount: number }
 *   cards — merged result (client must write this back to localStorage)
 *   syncedCount — number of active (non-tombstoned) cards after merge
 *
 * Error responses:
 *   400 — invalid request body
 *   401 — not authenticated
 *   403 — household mismatch (IDOR) or user is not Karl tier
 *   500 — internal error
 *
 * Issue #1122, #1199
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthz } from "@/lib/auth/authz";
import { getAllFirestoreCards, setCards } from "@/lib/firebase/firestore";
import { mergeCardsWithStats } from "@/lib/sync/sync-engine";
import { log } from "@/lib/logger";
import type { Card } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/sync/push called");

  // Parse body first — householdId is needed for the authz membership check.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", error_description: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "invalid_body", error_description: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const { householdId, cards } = body as Record<string, unknown>;

  if (typeof householdId !== "string" || !householdId) {
    return NextResponse.json(
      {
        error: "invalid_body",
        error_description: "Body must include { householdId: string, cards: Card[] }.",
      },
      { status: 400 },
    );
  }

  if (!Array.isArray(cards)) {
    return NextResponse.json(
      {
        error: "invalid_body",
        error_description: "Body must include { householdId: string, cards: Card[] }.",
      },
      { status: 400 },
    );
  }

  // Auth + household membership + Karl-tier gate in one call.
  // Passes householdId so requireAuthz verifies it matches the user's own household,
  // closing the IDOR vector (SEV-002).
  const authz = await requireAuthz(request, { tier: "karl", householdId });
  if (!authz.ok) return authz.response;

  const localCards = cards as Card[];

  try {
    // ALWAYS use authz.firestoreUser.householdId — never the caller-supplied param.
    const verifiedHouseholdId = authz.firestoreUser.householdId;

    // Fetch all remote cards (including tombstones) for LWW merge
    const remoteCards = await getAllFirestoreCards(verifiedHouseholdId);

    // Merge: per-card last-write-wins
    const { merged, stats } = mergeCardsWithStats(localCards, remoteCards);

    // Write merged result back to Firestore
    await setCards(merged);

    log.debug("POST /api/sync/push returning", {
      status: 200,
      householdId: verifiedHouseholdId,
      ...stats,
    });

    return NextResponse.json(
      {
        cards: merged,
        syncedCount: stats.activeCount,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/sync/push internal error", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Sync failed due to a server error." },
      { status: 500 },
    );
  }
}
