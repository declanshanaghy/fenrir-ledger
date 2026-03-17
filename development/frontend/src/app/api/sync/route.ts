/**
 * GET /api/sync — fetch all Firestore cards for the authenticated user's household
 * PUT /api/sync — push local cards to Firestore with last-write-wins via updatedAt
 *
 * Both routes require a Karl-tier subscription. Thrall users receive 403.
 *
 * GET response (200):
 *   { householdId: string; cards: Card[]; syncedAt: string }
 *
 * PUT request body:
 *   { cards: Card[] }
 *
 * PUT response (200):
 *   { householdId: string; written: number; skipped: number; syncedAt: string }
 *
 * Last-write-wins: for each submitted card, the route fetches the current
 * Firestore version and only writes if submitted.updatedAt >= stored.updatedAt.
 * This prevents an older device from overwriting a newer remote edit.
 *
 * Issue #1119 — Cloud data sync via Firestore
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import { getUser } from "@/lib/firebase/firestore";
import { getCards, setCards } from "@/lib/firebase/firestore";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import type { Card } from "@/lib/types";

// ─── Karl gate ────────────────────────────────────────────────────────────────

/**
 * Returns true if the Google sub maps to an active Karl subscription.
 * Checks Redis entitlement (the authoritative billing source).
 */
async function isKarl(googleSub: string): Promise<boolean> {
  try {
    const entitlement = await getStripeEntitlement(googleSub);
    return !!(entitlement && entitlement.tier === "karl" && entitlement.active);
  } catch {
    return false;
  }
}

// ─── GET /api/sync ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/sync called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.sub;

  if (!(await isKarl(userId))) {
    log.debug("GET /api/sync returning", { status: 403, reason: "not_karl" });
    return NextResponse.json(
      { error: "forbidden", error_description: "Cloud sync requires a Karl subscription." },
      { status: 403 }
    );
  }

  const user = await getUser(userId);
  if (!user) {
    log.debug("GET /api/sync returning", { status: 404, reason: "user_not_found" });
    return NextResponse.json(
      { error: "user_not_found", error_description: "User record not found. Sign in again." },
      { status: 404 }
    );
  }

  const cards = await getCards(user.householdId);
  const syncedAt = new Date().toISOString();

  log.debug("GET /api/sync returning", {
    status: 200,
    householdId: user.householdId,
    cardCount: cards.length,
  });

  return NextResponse.json({ householdId: user.householdId, cards, syncedAt });
}

// ─── PUT /api/sync ────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest): Promise<NextResponse> {
  log.debug("PUT /api/sync called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.sub;

  if (!(await isKarl(userId))) {
    log.debug("PUT /api/sync returning", { status: 403, reason: "not_karl" });
    return NextResponse.json(
      { error: "forbidden", error_description: "Cloud sync requires a Karl subscription." },
      { status: 403 }
    );
  }

  let body: { cards?: unknown };
  try {
    body = (await request.json()) as { cards?: unknown };
  } catch {
    return NextResponse.json(
      { error: "invalid_body", error_description: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.cards)) {
    return NextResponse.json(
      { error: "invalid_body", error_description: "body.cards must be an array." },
      { status: 400 }
    );
  }

  const submittedCards = body.cards as Card[];

  const user = await getUser(userId);
  if (!user) {
    log.debug("PUT /api/sync returning", { status: 404, reason: "user_not_found" });
    return NextResponse.json(
      { error: "user_not_found", error_description: "User record not found. Sign in again." },
      { status: 404 }
    );
  }

  const householdId = user.householdId;

  // Fetch current Firestore cards to apply last-write-wins
  const existingCards = await getCards(householdId);
  const existingMap = new Map<string, Card>(existingCards.map((c) => [c.id, c]));

  const toWrite: Card[] = [];
  let skipped = 0;

  for (const submitted of submittedCards) {
    // Basic shape validation
    if (!submitted.id || !submitted.updatedAt) {
      skipped++;
      continue;
    }

    const existing = existingMap.get(submitted.id);

    // Write if: no existing record, or submitted is newer/equal
    if (!existing || submitted.updatedAt >= existing.updatedAt) {
      // Enforce householdId consistency — card must belong to this household
      toWrite.push({ ...submitted, householdId });
    } else {
      skipped++;
    }
  }

  if (toWrite.length > 0) {
    await setCards(toWrite);
  }

  const syncedAt = new Date().toISOString();

  log.debug("PUT /api/sync returning", {
    status: 200,
    householdId,
    written: toWrite.length,
    skipped,
  });

  return NextResponse.json({ householdId, written: toWrite.length, skipped, syncedAt });
}
