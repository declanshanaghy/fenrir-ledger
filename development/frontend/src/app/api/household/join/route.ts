/**
 * POST /api/household/join
 *
 * Executes the join + card merge transaction.
 * Must be called AFTER validating the code via GET /api/household/invite/validate.
 *
 * Request body: { inviteCode: string, confirm: true }
 *
 * The merge is a Firestore transaction:
 *   1. Re-validate invite code (still valid, not expired, household not full)
 *   2. Copy all cards from old solo household to new household (update householdId)
 *   3. Delete old solo household doc
 *   4. Update user doc: householdId + role = "member"
 *   5. Add userId to new household's memberIds
 *
 * If the transaction fails partway, the solo household remains intact (idempotent).
 *
 * Response (200): {
 *   householdId: string,
 *   householdName: string,
 *   cardsMerged: number,
 * }
 *
 * Error responses:
 *   400 — invalid body
 *   401 — not authenticated
 *   404 — code not found
 *   409 — household full (race condition) { reason: "household_full" }
 *   410 — code expired
 *   500 — merge failed
 *
 * Issue #1123 — Household invite code flow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import { getUser, getFirestore } from "@/lib/firebase/firestore";
import { FIRESTORE_PATHS, isInviteCodeValid } from "@/lib/firebase/firestore-types";
import type { FirestoreHousehold, FirestoreCard } from "@/lib/firebase/firestore-types";

const MAX_HOUSEHOLD_MEMBERS = 3;

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/household/join called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.sub;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", error_description: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).inviteCode !== "string" ||
    (body as Record<string, unknown>).confirm !== true
  ) {
    return NextResponse.json(
      { error: "invalid_body", error_description: 'Body must be { inviteCode: string, confirm: true }.' },
      { status: 400 },
    );
  }

  const inviteCode = ((body as Record<string, unknown>).inviteCode as string).trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(inviteCode)) {
    return NextResponse.json(
      { error: "invalid_code_format", error_description: "Invite code must be 6 alphanumeric characters." },
      { status: 400 },
    );
  }

  const callerUser = await getUser(userId);
  if (!callerUser) {
    return NextResponse.json(
      { error: "user_not_found", error_description: "User record not found. Sign in again." },
      { status: 404 },
    );
  }

  const db = getFirestore();

  // Execute join+merge as a Firestore transaction
  try {
    let cardsMerged = 0;
    let targetHouseholdName = "";
    let targetHouseholdId = "";

    await db.runTransaction(async (tx) => {
      // 1. Find the target household by invite code
      const householdQuery = await db
        .collection("households")
        .where("inviteCode", "==", inviteCode)
        .limit(1)
        .get();

      if (householdQuery.empty) {
        throw Object.assign(new Error("invalid_code"), { status: 404 });
      }

      const targetHousehold = householdQuery.docs[0]!.data() as FirestoreHousehold;
      targetHouseholdId = targetHousehold.id;
      targetHouseholdName = targetHousehold.name;

      // 2. Re-validate: expiry check
      if (!isInviteCodeValid(targetHousehold.inviteCodeExpiresAt)) {
        throw Object.assign(new Error("code_expired"), { status: 410 });
      }

      // 3. Re-validate: capacity check (handles race condition)
      if (targetHousehold.memberIds.length >= MAX_HOUSEHOLD_MEMBERS) {
        throw Object.assign(new Error("household_full"), { status: 409, reason: "household_full" });
      }

      // 4. Get caller's existing cards from their solo household
      const oldHouseholdId = callerUser.householdId;
      const cardsSnap = await db
        .collection(FIRESTORE_PATHS.cards(oldHouseholdId))
        .get();

      const existingCards = cardsSnap.docs
        .map((d) => d.data() as FirestoreCard)
        .filter((c) => !c.deletedAt);

      cardsMerged = existingCards.length;

      const now = new Date().toISOString();

      // 5. Move each card to the new household
      for (const card of existingCards) {
        const updatedCard = { ...card, householdId: targetHouseholdId, updatedAt: now };
        const newCardRef = db.doc(FIRESTORE_PATHS.card(targetHouseholdId, card.id));
        tx.set(newCardRef, updatedCard);
        // Soft-delete from old household
        const oldCardRef = db.doc(FIRESTORE_PATHS.card(oldHouseholdId, card.id));
        tx.update(oldCardRef, { deletedAt: now });
      }

      // 6. Delete old solo household doc
      const oldHouseholdRef = db.doc(FIRESTORE_PATHS.household(oldHouseholdId));
      tx.delete(oldHouseholdRef);

      // 7. Update target household: add userId to memberIds
      const targetHouseholdRef = db.doc(FIRESTORE_PATHS.household(targetHouseholdId));
      tx.update(targetHouseholdRef, {
        memberIds: [...targetHousehold.memberIds, userId],
        updatedAt: now,
      });

      // 8. Update user doc: switch household + role
      const userRef = db.doc(FIRESTORE_PATHS.user(userId));
      tx.update(userRef, {
        householdId: targetHouseholdId,
        role: "member",
        updatedAt: now,
      });
    });

    log.debug("POST /api/household/join returning", { status: 200, cardsMerged });
    return NextResponse.json({ householdId: targetHouseholdId, householdName: targetHouseholdName, cardsMerged });
  } catch (err) {
    const e = err as Error & { status?: number; reason?: string };
    if (e.message === "invalid_code") {
      return NextResponse.json(
        { error: "invalid_code", error_description: "Invite code not found." },
        { status: 404 },
      );
    }
    if (e.message === "code_expired") {
      return NextResponse.json(
        { error: "code_expired", error_description: "This invite code has expired." },
        { status: 410 },
      );
    }
    if (e.message === "household_full") {
      return NextResponse.json(
        { error: "household_full", reason: "household_full", error_description: "Household became full while you were confirming." },
        { status: 409 },
      );
    }
    log.debug("POST /api/household/join error", { error: String(e) });
    return NextResponse.json(
      { error: "merge_failed", error_description: "Merge failed. Your cards were not moved. Please try again." },
      { status: 500 },
    );
  }
}
