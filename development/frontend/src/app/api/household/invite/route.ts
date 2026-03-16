/**
 * POST /api/household/invite
 *
 * Regenerates the invite code for the caller's household. Owner-only.
 *
 * Request body: { action: "regenerate" }
 *
 * Response: { inviteCode: string, inviteCodeExpiresAt: string }
 *
 * Error responses:
 *   401 — not authenticated
 *   403 — caller is not the household owner
 *   404 — household not found
 *   409 — household is full (3/3), no new invite codes accepted
 *   500 — internal error
 *
 * Issue #1123 — Household invite code flow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import {
  getUser,
  getFirestore,
  getHousehold,
} from "@/lib/firebase/firestore";
import { FIRESTORE_PATHS, generateInviteCode, generateInviteCodeExpiry } from "@/lib/firebase/firestore-types";

const MAX_HOUSEHOLD_MEMBERS = 3;

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/household/invite called");

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
    (body as Record<string, unknown>).action !== "regenerate"
  ) {
    return NextResponse.json(
      { error: "invalid_body", error_description: 'Body must be { action: "regenerate" }.' },
      { status: 400 },
    );
  }

  const user = await getUser(userId);
  if (!user) {
    return NextResponse.json(
      { error: "user_not_found", error_description: "User record not found. Sign in again." },
      { status: 404 },
    );
  }

  if (user.role !== "owner") {
    log.debug("POST /api/household/invite returning", { status: 403, reason: "not_owner" });
    return NextResponse.json(
      { error: "forbidden", error_description: "Only the household owner can regenerate the invite code." },
      { status: 403 },
    );
  }

  const household = await getHousehold(user.householdId);
  if (!household) {
    return NextResponse.json(
      { error: "household_not_found", error_description: "Household record not found." },
      { status: 404 },
    );
  }

  if (household.memberIds.length >= MAX_HOUSEHOLD_MEMBERS) {
    log.debug("POST /api/household/invite returning", { status: 409, reason: "household_full" });
    return NextResponse.json(
      { error: "household_full", error_description: "Household is full (3/3 members). Cannot issue invite codes." },
      { status: 409 },
    );
  }

  const inviteCode = generateInviteCode();
  const inviteCodeExpiresAt = generateInviteCodeExpiry();
  const now = new Date().toISOString();

  const db = getFirestore();
  await db.doc(FIRESTORE_PATHS.household(household.id)).update({
    inviteCode,
    inviteCodeExpiresAt,
    updatedAt: now,
  });

  log.debug("POST /api/household/invite returning", { status: 200 });
  return NextResponse.json({ inviteCode, inviteCodeExpiresAt });
}
