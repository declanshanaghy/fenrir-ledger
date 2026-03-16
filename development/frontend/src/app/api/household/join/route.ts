/**
 * POST /api/household/join
 *
 * Executes the join + card merge operation for the authenticated user.
 * Runs as an atomic Firestore transaction: all-or-nothing.
 *
 * Request body: { inviteCode: string, confirm: true }
 * Response shapes:
 *   200 — { success: true, householdId, householdName, movedCardCount }
 *   400 — { error: "invalid_body" }
 *   404 — { error: "invite_invalid" }
 *   409 — { error: "household_full", reason: "household_full" }
 *   410 — { error: "invite_expired" }
 *   500 — { error: "internal_error" }
 *
 * Idempotency: if the transaction fails mid-way, Firestore rolls back automatically.
 * The user's original solo household remains intact on any failure.
 *
 * Issue #1123 — household invite code flow
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

  // Parse and validate body
  let inviteCode: string;
  let confirm: boolean;
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("inviteCode" in body) ||
      typeof (body as Record<string, unknown>).inviteCode !== "string" ||
      !("confirm" in body) ||
      (body as Record<string, unknown>).confirm !== true
    ) {
      return NextResponse.json(
        {
          error: "invalid_body",
          error_description: "Body must include { inviteCode: string, confirm: true }.",
        },
        { status: 400 }
      );
    }
    inviteCode = (body as Record<string, unknown>).inviteCode as string;
    confirm = (body as Record<string, unknown>).confirm as boolean;
  } catch {
    return NextResponse.json(
      { error: "invalid_json", error_description: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!confirm) {
    return NextResponse.json(
      { error: "confirm_required", error_description: "confirm must be true to execute the join." },
      { status: 400 }
    );
  }

  if (!/^[A-Z0-9]{6}$/i.test(inviteCode)) {
    return NextResponse.json(
      {
        error: "invalid_code_format",
        error_description: "Invite code must be 6 alphanumeric characters.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await joinHouseholdTransaction(userId, inviteCode);

    log.debug("POST /api/household/join: success", {
      userId,
      newHouseholdId: result.newHousehold.id,
      movedCardCount: result.movedCardIds.length,
    });

    return NextResponse.json(
      {
        success: true,
        householdId: result.newHousehold.id,
        householdName: result.newHousehold.name,
        movedCardCount: result.movedCardIds.length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message === "invite_invalid") {
      return NextResponse.json(
        { error: "invite_invalid", error_description: "Invite code not found." },
        { status: 404 }
      );
    }
    if (message === "invite_expired") {
      return NextResponse.json(
        { error: "invite_expired", error_description: "This invite code has expired." },
        { status: 410 }
      );
    }
    if (message === "household_full") {
      return NextResponse.json(
        {
          error: "household_full",
          reason: "household_full",
          error_description:
            "Household is now full. Another member joined while you were confirming.",
        },
        { status: 409 }
      );
    }
    if (message === "already_member") {
      return NextResponse.json(
        { error: "already_member", error_description: "You are already a member of this household." },
        { status: 409 }
      );
    }

    log.error("POST /api/household/join failed", { error: message });
    return NextResponse.json(
      { error: "internal_error", error_description: "Join failed. Your cards were not moved." },
      { status: 500 }
    );
  }
}
