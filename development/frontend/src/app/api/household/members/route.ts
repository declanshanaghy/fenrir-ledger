/**
 * GET /api/household/members
 *
 * Returns the authenticated user's household details including:
 *   - Household name, id, tier
 *   - All members (displayName, email, role) — owner listed first
 *   - Whether the caller is the owner
 *   - Invite code + expiry (only if caller is owner AND household not full)
 *
 * Response: HouseholdMembersResponse
 *
 * Issue #1123 — household invite code flow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import {
  getUser,
  getHousehold,
  getUsersByHouseholdId,
} from "@/lib/firebase/firestore";

export interface HouseholdMember {
  clerkUserId: string;
  displayName: string;
  email: string;
  role: "owner" | "member";
  isCurrentUser: boolean;
}

export interface HouseholdMembersResponse {
  householdId: string;
  householdName: string;
  memberCount: number;
  maxMembers: 3;
  isFull: boolean;
  isOwner: boolean;
  members: HouseholdMember[];
  /** Present only if caller is owner and household is not full */
  inviteCode?: string;
  /** Present only if caller is owner and household is not full */
  inviteCodeExpiresAt?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/household/members called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.sub;

  try {
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json(
        { error: "user_not_found", error_description: "User record not found." },
        { status: 404 }
      );
    }

    const household = await getHousehold(user.householdId);
    if (!household) {
      return NextResponse.json(
        { error: "household_not_found", error_description: "Household not found." },
        { status: 404 }
      );
    }

    const allUsers = await getUsersByHouseholdId(household.id);
    const isOwner = household.ownerId === userId;
    const isFull = household.memberIds.length >= 3;

    // Owner first, then members, caller marked with isCurrentUser
    const members: HouseholdMember[] = allUsers
      .sort((a, b) => {
        if (a.role === "owner") return -1;
        if (b.role === "owner") return 1;
        return a.displayName.localeCompare(b.displayName);
      })
      .map((u) => ({
        clerkUserId: u.clerkUserId,
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        isCurrentUser: u.clerkUserId === userId,
      }));

    const response: HouseholdMembersResponse = {
      householdId: household.id,
      householdName: household.name,
      memberCount: household.memberIds.length,
      maxMembers: 3,
      isFull,
      isOwner,
      members,
      ...(isOwner && !isFull
        ? {
            inviteCode: household.inviteCode,
            inviteCodeExpiresAt: household.inviteCodeExpiresAt,
          }
        : {}),
    };

    log.debug("GET /api/household/members: returning", {
      householdId: household.id,
      memberCount: household.memberIds.length,
      isOwner,
    });

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/household/members failed", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to fetch household members." },
      { status: 500 }
    );
  }
}
