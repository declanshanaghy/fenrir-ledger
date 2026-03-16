/**
 * GET /api/household/invite/validate?code=X7K2NP
 *
 * Validates an invite code and returns household preview data.
 * The calling user must be authenticated and not already in a multi-member household.
 *
 * Response shapes:
 *   200 — { householdId, householdName, memberCount, members[], userCardCount }
 *   404 — { error: "invite_invalid" }
 *   409 — { error: "household_full", reason: "household_full" }
 *   410 — { error: "invite_expired" }
 *
 * Issue #1123 — household invite code flow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import {
  getUser,
  getCards,
  findHouseholdByInviteCode,
  getUsersByHouseholdId,
} from "@/lib/firebase/firestore";
import { isInviteCodeValid } from "@/lib/firebase/firestore-types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/household/invite/validate called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.sub;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code || !/^[A-Z0-9]{6}$/i.test(code)) {
    return NextResponse.json(
      {
        error: "invalid_code_format",
        error_description: "Invite code must be 6 alphanumeric characters.",
      },
      { status: 400 }
    );
  }

  try {
    // Look up household by invite code
    const household = await findHouseholdByInviteCode(code);
    if (!household) {
      return NextResponse.json(
        { error: "invite_invalid", error_description: "Invite code not found." },
        { status: 404 }
      );
    }

    // Check expiry
    if (!isInviteCodeValid(household.inviteCodeExpiresAt)) {
      return NextResponse.json(
        { error: "invite_expired", error_description: "This invite code has expired." },
        { status: 410 }
      );
    }

    // Check capacity
    if (household.memberIds.length >= 3) {
      return NextResponse.json(
        {
          error: "household_full",
          reason: "household_full",
          error_description: "This household is full (3/3 members).",
        },
        { status: 409 }
      );
    }

    // Fetch existing members for preview
    const memberUsers = await getUsersByHouseholdId(household.id);
    const members = memberUsers.map((u) => ({
      displayName: u.displayName,
      email: u.email,
      role: u.role,
    }));

    // Get the calling user's current household card count (for merge preview)
    const callerUser = await getUser(userId);
    let userCardCount = 0;
    if (callerUser) {
      const cards = await getCards(callerUser.householdId);
      userCardCount = cards.length;
    }

    log.debug("GET /api/household/invite/validate: valid", {
      householdId: household.id,
      memberCount: household.memberIds.length,
      userCardCount,
    });

    return NextResponse.json(
      {
        householdId: household.id,
        householdName: household.name,
        memberCount: household.memberIds.length,
        members,
        userCardCount,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/household/invite/validate failed", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to validate invite code." },
      { status: 500 }
    );
  }
}
