/**
 * POST /api/household/join
 *
 * Executes the join + card merge transaction.
 * Must be called AFTER validating the code via GET /api/household/invite/validate.
 *
 * Request body: { inviteCode: string, confirm: true }
 *
 * Delegates to joinHouseholdTransaction() which runs as an atomic Firestore transaction:
 *   1. Re-validate invite code (still valid, not expired, household not full)
 *   2. Copy all cards from old solo household to new household (update householdId)
 *   3. Delete old solo household doc
 *   4. Update user doc: householdId + role = "member"
 *   5. Add userId to new household's memberIds
 *
 * If the transaction fails partway, the solo household remains intact (idempotent).
 *
 * Response (200): {
 *   success: true,
 *   householdId: string,
 *   householdName: string,
 *   movedCardCount: number,
 * }
 *
 * Error responses:
 *   400 — invalid body
 *   401 — not authenticated
 *   404 — invite_invalid (code not found)
 *   409 — household_full (race condition) { reason: "household_full" }
 *   410 — invite_expired
 *   500 — internal_error
 *
 * Issue #1123 — Household invite code flow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import { joinHouseholdTransaction } from "@/lib/firebase/firestore";

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

  const inviteCode = (body as Record<string, unknown>).inviteCode as string;

  if (!/^[A-Za-z0-9]{6}$/.test(inviteCode)) {
    return NextResponse.json(
      { error: "invalid_code_format", error_description: "Invite code must be 6 alphanumeric characters." },
      { status: 400 },
    );
  }

  try {
    const result = await joinHouseholdTransaction(userId, inviteCode);

    log.debug("POST /api/household/join returning", {
      status: 200,
      movedCardCount: result.movedCardIds.length,
    });
    return NextResponse.json({
      success: true,
      householdId: result.newHousehold.id,
      householdName: result.newHousehold.name,
      movedCardCount: result.movedCardIds.length,
    });
  } catch (err) {
    const e = err as Error;
    if (e.message === "invite_invalid") {
      return NextResponse.json(
        { error: "invite_invalid", error_description: "Invite code not found." },
        { status: 404 },
      );
    }
    if (e.message === "invite_expired") {
      return NextResponse.json(
        { error: "invite_expired", error_description: "This invite code has expired." },
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
      { error: "internal_error", error_description: "Merge failed. Your cards were not moved. Please try again." },
      { status: 500 },
    );
  }
}
