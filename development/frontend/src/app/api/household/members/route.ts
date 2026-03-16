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
 *   inviteCode?: string,          — only for owners on non-full households
 *   inviteCodeExpiresAt?: string, — only for owners on non-full households
 *   members: Array<{
 *     clerkUserId: string,
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
import { getUser, getHousehold, getUsersByHouseholdId } from "@/lib/firebase/firestore";

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

  // Fetch all member docs via household query
  const memberDocs = await getUsersByHouseholdId(household.id);

  // Sort: owner first, then members alphabetically
  const members = memberDocs
    .map((m) => ({
      clerkUserId: m.clerkUserId,
      displayName: m.displayName,
      email: m.email,
      role: m.role,
      isCurrentUser: m.clerkUserId === userId,
    }))
    .sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (a.role !== "owner" && b.role === "owner") return 1;
      return a.displayName.localeCompare(b.displayName);
    });

  const response: Record<string, unknown> = {
    householdId: household.id,
    householdName: household.name,
    ownerId: household.ownerId,
    memberCount: household.memberIds.length,
    maxMembers: MAX_HOUSEHOLD_MEMBERS,
    isSolo,
    isFull,
    isOwner,
    members,
  };

  // Only expose invite code to the owner on non-full households
  if (isOwner && !isFull) {
    response.inviteCode = household.inviteCode;
    response.inviteCodeExpiresAt = household.inviteCodeExpiresAt;
  }

  log.debug("GET /api/household/members returning", { status: 200, memberCount: members.length });
  return NextResponse.json(response);
}
