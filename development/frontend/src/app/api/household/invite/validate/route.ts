/**
 * GET /api/household/invite/validate?code=X7K2NP
 *
 * Validates an invite code and returns the household preview.
 * Also returns the caller's current card count (for merge confirmation UI).
 *
 * Response (200): {
 *   householdId: string,
 *   householdName: string,
 *   memberCount: number,
 *   members: Array<{ displayName: string, email: string, role: string }>,
 *   userCardCount: number,
 * }
 *
 * Error responses:
 *   400 — missing or malformed code param
 *   401 — not authenticated
 *   404 — code not found / invalid
 *   409 — household full { reason: "household_full" }
 *   410 — code expired
 *   500 — internal error
 *
 * Issue #1123 — Household invite code flow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import { getUser, getFirestore, getCards } from "@/lib/firebase/firestore";
import { isInviteCodeValid } from "@/lib/firebase/firestore-types";
import type { FirestoreHousehold, FirestoreUser } from "@/lib/firebase/firestore-types";

const MAX_HOUSEHOLD_MEMBERS = 3;

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/household/invite/validate called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.sub;

  const code = request.nextUrl.searchParams.get("code");
  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json(
      { error: "missing_code", error_description: "Query param ?code= is required." },
      { status: 400 },
    );
  }

  const normalizedCode = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
    return NextResponse.json(
      { error: "invalid_code_format", error_description: "Invite code must be 6 alphanumeric characters." },
      { status: 400 },
    );
  }

  // Get caller's user record to find their current household
  const callerUser = await getUser(userId);
  if (!callerUser) {
    return NextResponse.json(
      { error: "user_not_found", error_description: "User record not found. Sign in again." },
      { status: 404 },
    );
  }

  // Check if caller is already in a multi-member household
  const db = getFirestore();
  const callerHouseholdSnap = await db
    .collection("households")
    .where("memberIds", "array-contains", userId)
    .limit(1)
    .get();

  if (!callerHouseholdSnap.empty) {
    const callerHouseholdDoc = callerHouseholdSnap.docs[0];
    const callerHousehold = callerHouseholdDoc!.data() as FirestoreHousehold;
    if (callerHousehold.memberIds.length > 1) {
      return NextResponse.json(
        { error: "already_in_household", error_description: "You are already in a multi-member household." },
        { status: 409 },
      );
    }
  }

  // Search for household with this invite code
  const householdSnap = await db
    .collection("households")
    .where("inviteCode", "==", normalizedCode)
    .limit(1)
    .get();

  if (householdSnap.empty) {
    log.debug("GET /api/household/invite/validate returning", { status: 404, reason: "code_not_found" });
    return NextResponse.json(
      { error: "invalid_code", error_description: "Invite code not found." },
      { status: 404 },
    );
  }

  const household = householdSnap.docs[0]!.data() as FirestoreHousehold;

  // Check expiry
  if (!isInviteCodeValid(household.inviteCodeExpiresAt)) {
    log.debug("GET /api/household/invite/validate returning", { status: 410, reason: "code_expired" });
    return NextResponse.json(
      { error: "code_expired", error_description: "This invite code has expired. Ask the owner to regenerate." },
      { status: 410 },
    );
  }

  // Check capacity
  if (household.memberIds.length >= MAX_HOUSEHOLD_MEMBERS) {
    log.debug("GET /api/household/invite/validate returning", { status: 409, reason: "household_full" });
    return NextResponse.json(
      { error: "household_full", reason: "household_full", error_description: "This household is full (3/3 members)." },
      { status: 409 },
    );
  }

  // Fetch member display info
  const memberDocs = await Promise.all(
    household.memberIds.map(async (memberId) => {
      const snap = await db.doc(`users/${memberId}`).get();
      return snap.exists ? (snap.data() as FirestoreUser) : null;
    })
  );

  const members = memberDocs
    .filter((m): m is FirestoreUser => m !== null)
    .map((m) => ({ displayName: m.displayName, email: m.email, role: m.role }));

  // Count caller's existing cards
  const userCards = await getCards(callerUser.householdId);
  const userCardCount = userCards.length;

  log.debug("GET /api/household/invite/validate returning", { status: 200 });
  return NextResponse.json({
    householdId: household.id,
    householdName: household.name,
    memberCount: household.memberIds.length,
    members,
    userCardCount,
  });
}
