/**
 * POST /api/household/leave
 *
 * Allows a household member (non-owner) to leave their current household.
 * A new solo household is re-created for the departing user automatically.
 *
 * Request body: { confirm: true }
 *
 * Steps (atomic Firestore transaction):
 *   1. Verify caller is a member (not owner)
 *   2. Remove caller from household.memberIds
 *   3. Create new solo household (id = userId, fresh invite code)
 *   4. Update user doc: householdId = userId, role = "owner"
 *
 * Cards remain with the old household — the new solo household starts empty.
 *
 * Response (200): {
 *   success: true,
 *   newHouseholdId: string,
 * }
 *
 * Error responses:
 *   400 — missing/invalid body
 *   401 — not authenticated
 *   403 — caller is the household owner (must transfer ownership first)
 *   500 — internal_error
 *
 * Issue #1798 — Re-create solo household when member leaves
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";
import { leaveHouseholdTransaction } from "@/lib/firebase/firestore";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/household/leave called");

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
    (body as Record<string, unknown>).confirm !== true
  ) {
    return NextResponse.json(
      { error: "invalid_body", error_description: "Body must be { confirm: true }." },
      { status: 400 },
    );
  }

  try {
    const result = await leaveHouseholdTransaction(userId);

    log.debug("POST /api/household/leave returning", {
      status: 200,
      newHouseholdId: result.newHousehold.id,
    });
    return NextResponse.json({
      success: true,
      newHouseholdId: result.newHousehold.id,
    });
  } catch (err) {
    const e = err as Error;
    if (e.message === "is_owner") {
      return NextResponse.json(
        {
          error: "forbidden",
          error_description:
            "Household owners cannot leave. Transfer ownership or delete the household first.",
        },
        { status: 403 },
      );
    }
    if (e.message === "not_member" || e.message === "user_not_found") {
      return NextResponse.json(
        { error: "forbidden", error_description: "You are not a member of this household." },
        { status: 403 },
      );
    }
    log.error("POST /api/household/leave error", { error: String(e) });
    return NextResponse.json(
      { error: "internal_error", error_description: "Failed to leave household. Please try again." },
      { status: 500 },
    );
  }
}
