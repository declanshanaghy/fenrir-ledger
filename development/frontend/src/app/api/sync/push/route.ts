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
 *   403 — user is not Karl tier (Thrall or free trial)
 *   500 — internal error
 *
 * Issue #1122
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { getAllFirestoreCards, setCards } from "@/lib/firebase/firestore";
import { mergeCardsWithStats } from "@/lib/sync/sync-engine";
import { log } from "@/lib/logger";
import type { Card } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/sync/push called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const googleSub = auth.user.sub;

  // Karl-only gate: no sync for Thrall or free-trial users
  const entitlement = await getStripeEntitlement(googleSub);
  const isKarl = entitlement?.tier === "karl" && entitlement?.active === true;

  if (!isKarl) {
    const currentTier = entitlement?.tier ?? "thrall";
    log.debug("POST /api/sync/push returning", {
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

  // Parse body
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

  const localCards = cards as Card[];

  try {
    // Fetch all remote cards (including tombstones) for LWW merge
    const remoteCards = await getAllFirestoreCards(householdId);

    // Merge: per-card last-write-wins
    const { merged, stats } = mergeCardsWithStats(localCards, remoteCards);

    // Write merged result back to Firestore
    await setCards(merged);

    log.debug("POST /api/sync/push returning", {
      status: 200,
      householdId,
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
    log.error("POST /api/sync/push internal error", { householdId, error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Sync failed due to a server error." },
      { status: 500 },
    );
  }
}
