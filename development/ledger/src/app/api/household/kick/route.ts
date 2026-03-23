/**
 * POST /api/household/kick
 *
 * Allows a household owner to remove (kick) a non-owner member from their household.
 * A new solo household is automatically created for the kicked member.
 *
 * Request body: { memberId: string }
 *
 * Steps (atomic Firestore transaction):
 *   1. Verify caller is authenticated and is the household owner
 *   2. Verify target memberId is a non-owner member of the same household
 *   3. Remove memberId from household.memberIds
 *   4. Create new solo household for the kicked member (id = memberId)
 *   5. Update kicked member's user doc: householdId = memberId, role = "owner"
 *
 * Cards are NOT moved — they remain with the caller's household.
 *
 * Response (200): {
 *   success: true,
 *   newHouseholdId: string,
 * }
 *
 * Error responses:
 *   400 — missing/invalid body or memberId
 *   401 — not authenticated
 *   403 — caller is not the owner, or target is not a member
 *   500 — internal_error
 *
 * Issue #1818 — Allow household owner to kick/remove members
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import { kickMemberTransaction } from "@/lib/firebase/firestore";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/household/kick called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const callerId = auth.user.sub;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", error_description: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const memberId =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).memberId
      : undefined;

  if (typeof memberId !== "string" || memberId.trim() === "") {
    return NextResponse.json(
      { error: "invalid_body", error_description: "Body must be { memberId: string }." },
      { status: 400 },
    );
  }

  if (memberId === callerId) {
    return NextResponse.json(
      { error: "forbidden", error_description: "You cannot remove yourself from the household." },
      { status: 403 },
    );
  }

  try {
    const result = await kickMemberTransaction(callerId, memberId);

    log.debug("POST /api/household/kick returning", {
      status: 200,
      newHouseholdId: result.newHousehold.id,
    });
    return NextResponse.json({
      success: true,
      newHouseholdId: result.newHousehold.id,
    });
  } catch (err) {
    const e = err as Error;
    if (e.message === "not_owner" || e.message === "caller_not_found") {
      return NextResponse.json(
        { error: "forbidden", error_description: "Only the household owner can remove members." },
        { status: 403 },
      );
    }
    if (e.message === "not_member" || e.message === "target_not_found") {
      return NextResponse.json(
        { error: "forbidden", error_description: "That user is not a member of your household." },
        { status: 403 },
      );
    }
    if (e.message === "cannot_kick_owner") {
      return NextResponse.json(
        { error: "forbidden", error_description: "You cannot remove the household owner." },
        { status: 403 },
      );
    }
    log.error("POST /api/household/kick error", { error: String(e) });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to remove member. Please try again." },
      { status: 500 },
    );
  }
}
