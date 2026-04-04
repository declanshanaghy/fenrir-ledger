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
 *   maxMembers: number,
 *   isSolo: boolean,
 *   isFull: boolean,
 *   isOwner: boolean,
 *   isKarl: boolean,              — true when household has an active Karl subscription
 *   inviteCode?: string,          — omitted for non-owners and when household is full
 *   inviteCodeExpiresAt?: string, — omitted for non-owners and when household is full
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
 * Issue #1780 — Solo Karl owner must see invite code
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import { getUser, getHousehold, getUsersByHouseholdId, ensureSoloHousehold, getStripeSubscription } from "@/lib/firebase/firestore";

const MAX_HOUSEHOLD_MEMBERS = 3;

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/household/members called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.sub;

  let callerUser = await getUser(userId);
  if (!callerUser) {
    // First sign-in: bootstrap a solo household atomically, then continue normal flow.
    log.debug("GET /api/household/members: user not found, bootstrapping solo household", { userId });
    const bootstrapped = await ensureSoloHousehold({
      userId: userId,
      email: auth.user.email,
      displayName: auth.user.email,
    });
    callerUser = bootstrapped.user;
    log.debug("GET /api/household/members: solo household bootstrapped", {
      userId,
      householdId: bootstrapped.household.id,
      created: bootstrapped.created,
    });
  }

  const household = await getHousehold(callerUser.householdId);
  if (!household) {
    return NextResponse.json(
      { error: "household_not_found", error_description: "Household record not found." },
      { status: 404 },
    );
  }

  const isOwner = callerUser.role === "owner";
  const isSolo = household.memberIds.length === 1;
  const isFull = household.memberIds.length >= MAX_HOUSEHOLD_MEMBERS;

  // Determine Karl tier — needed so the component can show invite code for solo Karl owners
  const stripeSub = await getStripeSubscription(household.id);
  const isKarl = stripeSub?.active === true && stripeSub?.tier === "karl";

  // Fetch all member docs
  const memberDocs = await getUsersByHouseholdId(household.id);

  // Owner always first
  const members = memberDocs
    .slice()
    .sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (a.role !== "owner" && b.role === "owner") return 1;
      return 0;
    })
    .map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      email: m.email,
      role: m.role,
      isCurrentUser: m.userId === userId,
    }));

  const response: Record<string, unknown> = {
    householdId: household.id,
    householdName: household.name,
    ownerId: household.ownerId,
    memberCount: household.memberIds.length,
    maxMembers: MAX_HOUSEHOLD_MEMBERS,
    isSolo,
    isFull,
    isOwner,
    isKarl,
    members,
  };

  // Only expose invite code to the owner when household is not full
  if (isOwner && !isFull) {
    response.inviteCode = household.inviteCode;
    response.inviteCodeExpiresAt = household.inviteCodeExpiresAt;
  }

  log.debug("GET /api/household/members returning", { status: 200, memberCount: members.length });
  return NextResponse.json(response);
}
