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
 *   { householdId: string, cards: Card[], clientSyncVersion?: number }
 *   cards should include ALL local cards, including tombstones (deletedAt set).
 *   clientSyncVersion — optional. When provided, the server rejects the push
 *   with 409 if the household syncVersion has advanced past this value,
 *   indicating another member has pushed since the client last synced.
 *
 * Response 200:
 *   { cards: Card[], syncedCount: number, syncVersion: number }
 *   cards — merged result (client must write this back to localStorage)
 *   syncedCount — number of active (non-tombstoned) cards after merge
 *   syncVersion — new household sync version after this push
 *
 * Error responses:
 *   400 — invalid request body
 *   401 — not authenticated
 *   403 — user is not Karl tier (Thrall or free trial), or householdId does
 *          not match the authenticated user's household (IDOR guard)
 *   409 — clientSyncVersion is stale (another push has occurred since client synced)
 *   500 — internal error
 *
 * Security: household membership is verified via requireAuthz() before any
 * Firestore access. The authz-resolved householdId is used for all Firestore
 * operations — never the raw client-supplied body value — to prevent IDOR.
 *
 * Issue #1122, #1193, #1208, #2004
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthz } from "@/lib/auth/authz";
import {
  getAllFirestoreCards,
  setCards,
  deleteCards,
  getHouseholdSyncVersion,
  updateSyncStateAfterPush,
} from "@/lib/firebase/firestore";
import { mergeCardsWithStats } from "@/lib/sync/sync-engine";
import { log } from "@/lib/logger";
import type { Card } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/sync/push called");

  // Parse body first — householdId is required for the membership check in requireAuthz
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

  const { householdId, cards, clientSyncVersion } = body as Record<string, unknown>;

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

  // requireAuthz: authentication + user resolution + household membership + Karl tier
  // If the caller-supplied householdId does not match the user's actual household,
  // requireAuthz returns 403 before Firestore is ever accessed.
  const authz = await requireAuthz(request, { householdId, tier: "karl" });
  if (!authz.ok) return authz.response;

  // Use the authz-resolved householdId — never the raw body value — to prevent IDOR
  const verifiedHouseholdId = authz.firestoreUser.householdId;
  const pushingUserId = authz.firestoreUser.userId;

  // Sanitize card-level householdId to prevent second-order IDOR (Issue #1208):
  // An attacker can pass their own valid householdId at the top level (passing authz)
  // while embedding a victim's householdId inside individual cards. setCards() uses
  // card.householdId for Firestore path resolution, so any unsanitized card that wins
  // LWW merge would be written to the victim's Firestore path.
  const localCards = (cards as Card[]).map((card) => ({
    ...card,
    householdId: verifiedHouseholdId,
  }));

  try {
    // 409 stale-client check: if clientSyncVersion is provided and the household
    // has advanced past it, reject so the client can pull before retrying.
    if (typeof clientSyncVersion === "number") {
      const currentVersion = await getHouseholdSyncVersion(verifiedHouseholdId);
      if (clientSyncVersion < currentVersion) {
        log.debug("POST /api/sync/push rejected: stale client", {
          householdId: verifiedHouseholdId,
          clientSyncVersion,
          currentVersion,
        });
        return NextResponse.json(
          {
            error: "sync_conflict",
            error_description: "Client sync version is stale. Pull the latest changes before pushing.",
            currentSyncVersion: currentVersion,
          },
          { status: 409 },
        );
      }
    }

    // Fetch all remote cards (including tombstones) for LWW merge
    const remoteCards = await getAllFirestoreCards(verifiedHouseholdId);

    // Identify expunged cards: present in Firestore but absent from local.
    // localStorage is authoritative — a remote-only card was expunged locally
    // (expungeCard / expungeAllCards removes it entirely, no tombstone).
    // Delete these from Firestore so they cannot reappear on the next pull.
    // Issue #1974.
    //
    // Safety guard (Issue #2002): skip expunge entirely when the client sends
    // zero cards. An empty push is the fingerprint of a brand-new device that
    // has never synced — its empty localStorage must NOT be treated as "the
    // user deleted everything." Without this guard every remote card would be
    // classified as expunged and wiped from Firestore.
    const localIds = new Set(localCards.map((c) => c.id));

    if (localCards.length > 0) {
      const expungedIds = remoteCards
        .filter((c) => !localIds.has(c.id))
        .map((c) => c.id);

      if (expungedIds.length > 0) {
        await deleteCards(verifiedHouseholdId, expungedIds);
      }
    }

    // Drop local tombstones for cards expunged by another household member.
    // Issue #2120: When another member expunges card C, it is deleted from
    // Firestore entirely (no tombstone). If this client still holds a tombstone
    // for C (deletedAt set), the LWW merge would treat it as "local-only" and
    // write it back to Firestore — making C reappear for all members. Filtering
    // these orphaned tombstones out before the merge prevents the resurrection.
    //
    // Guard: only applies when localCards is non-empty (same new-device guard as
    // above) so a brand-new device does not silently discard remote tombstones.
    const remoteIds = new Set(remoteCards.map((c) => c.id));
    const cardsToMerge =
      localCards.length > 0
        ? localCards.filter((c) => !c.deletedAt || remoteIds.has(c.id))
        : localCards;

    // Merge only non-expunged remote cards with local (LWW per-card).
    // When localCards is empty (new device) all remote cards are kept so they
    // are returned to the client and written back to localStorage on first sync.
    const nonExpungedRemote =
      localCards.length > 0 ? remoteCards.filter((c) => localIds.has(c.id)) : remoteCards;
    const { merged, stats } = mergeCardsWithStats(cardsToMerge, nonExpungedRemote);

    // Write merged result back to Firestore
    await setCards(merged);

    // Increment syncVersion and mark other household members as needing download.
    // Returns the new syncVersion for inclusion in the response.
    const syncVersion = await updateSyncStateAfterPush(verifiedHouseholdId, pushingUserId);

    log.debug("POST /api/sync/push returning", {
      status: 200,
      householdId: verifiedHouseholdId,
      syncVersion,
      ...stats,
    });

    return NextResponse.json(
      {
        cards: merged,
        syncedCount: stats.activeCount,
        syncVersion,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/sync/push internal error", { householdId: verifiedHouseholdId, error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Sync failed due to a server error." },
      { status: 500 },
    );
  }
}
