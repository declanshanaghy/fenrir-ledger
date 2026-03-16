/**
 * GET /api/household/members
 *
 * Returns the current household members list with roles for the authenticated user.
 * Used by HouseholdSettingsSection to render the members list and invite code.
 *
 * Response (200): {
 *   householdId: string,
 *   householdName: string,
 *   ownerId: string,
 *   memberCount: number,
 *   isFull: boolean,
 *   inviteCode: string | null,          — null for non-owners
 *   inviteCodeExpiresAt: string | null, — null for non-owners
 *   members: Array<{
 *     userId: string,
 *     displayName: string,
 *     email: string,
 *     role: "owner" | "member",
 *     isCurrentUser: boolean,
 *   }>,
 * }
 *
 * Issue #1123 — Household invite code flow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import { getUser, getFirestore } from "@/lib/firebase/firestore";
import type { FirestoreUser, FirestoreHousehold } from "@/lib/firebase/firestore-types";

const MAX_HOUSEHOLD_MEMBERS = 3;

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/household/members called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.sub;

  const callerUser = await getUser(userId);
  if (!callerUser) {
    return NextResponse.json(
      { error: "user_not_found", error_description: "User record not found. Sign in again." },
      { status: 404 },
    );
  }

  const db = getFirestore();
  const householdSnap = await db.doc(`households/${callerUser.householdId}`).get();
  if (!householdSnap.exists) {
    return NextResponse.json(
      { error: "household_not_found", error_description: "Household record not found." },
      { status: 404 },
    );
  }

  const household = householdSnap.data() as FirestoreHousehold;
  const isOwner = callerUser.role === "owner";
  const isSolo = household.memberIds.length === 1;
  const isFull = household.memberIds.length >= MAX_HOUSEHOLD_MEMBERS;

  // Fetch all member docs
  const memberDocs = await Promise.all(
    household.memberIds.map(async (memberId) => {
      const snap = await db.doc(`users/${memberId}`).get();
      return snap.exists ? (snap.data() as FirestoreUser) : null;
    })
  );

  const members = memberDocs
    .filter((m): m is FirestoreUser => m !== null)
    .map((m) => ({
      userId: m.clerkUserId,
      displayName: m.displayName,
      email: m.email,
      role: m.role,
      isCurrentUser: m.clerkUserId === userId,
    }));

  log.debug("GET /api/household/members returning", { status: 200, memberCount: members.length });
  return NextResponse.json({
    householdId: household.id,
    householdName: household.name,
    ownerId: household.ownerId,
    memberCount: household.memberIds.length,
    isSolo,
    isFull,
    // Only expose invite code to the owner
    inviteCode: isOwner ? household.inviteCode : null,
    inviteCodeExpiresAt: isOwner ? household.inviteCodeExpiresAt : null,
    members,
  });
}
