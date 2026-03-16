/**
 * POST /api/household/invite
 *
 * Regenerates the invite code for the authenticated user's household.
 * Only the household owner may call this endpoint.
 *
 * Returns 409 if the household is at max capacity (3/3) — no invite needed.
 * Returns 403 if the caller is not the household owner.
 *
 * Request body: { action: "regenerate" }
 * Response: { inviteCode: string, inviteCodeExpiresAt: string }
 *
 * Issue #1123 — household invite code flow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import {
  getUser,
  getHousehold,
  regenerateInviteCode,
} from "@/lib/firebase/firestore";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/household/invite called");

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.sub;

  // Parse body
  let action: string;
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("action" in body) ||
      typeof (body as Record<string, unknown>).action !== "string"
    ) {
      return NextResponse.json(
        { error: "invalid_body", error_description: "Body must include { action: \"regenerate\" }." },
        { status: 400 }
      );
    }
    action = (body as Record<string, unknown>).action as string;
  } catch {
    return NextResponse.json(
      { error: "invalid_json", error_description: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (action !== "regenerate") {
    return NextResponse.json(
      { error: "invalid_action", error_description: "Only action=regenerate is supported." },
      { status: 400 }
    );
  }

  try {
    // Get the user's household
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

    // Only owner may regenerate
    if (household.ownerId !== userId) {
      return NextResponse.json(
        { error: "forbidden", error_description: "Only the household owner can regenerate the invite code." },
        { status: 403 }
      );
    }

    // Reject if household is full (3/3) — no new members possible
    if (household.memberIds.length >= 3) {
      return NextResponse.json(
        {
          error: "household_full",
          error_description: "Household is at max capacity (3/3). Invite codes cannot be issued.",
        },
        { status: 409 }
      );
    }

    const updated = await regenerateInviteCode(user.householdId);

    log.debug("POST /api/household/invite: code regenerated", {
      householdId: user.householdId,
    });

    return NextResponse.json(
      {
        inviteCode: updated.inviteCode,
        inviteCodeExpiresAt: updated.inviteCodeExpiresAt,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/household/invite failed", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to regenerate invite code." },
      { status: 500 }
    );
  }
}
