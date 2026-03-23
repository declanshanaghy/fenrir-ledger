/**
 * Unit tests for POST /api/household/leave
 *
 * Issue #1798 — Re-create solo household when member leaves a household
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockLeaveHouseholdTransaction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase/firestore", () => ({
  leaveHouseholdTransaction: (...args: unknown[]) => mockLeaveHouseholdTransaction(...args),
}));

import { POST } from "@/app/api/household/leave/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "user_member_abc";
const OWNER_ID = "user_owner_xyz";

function makeAuthOk(userId = USER_ID) {
  return {
    ok: true as const,
    user: { sub: userId, email: "member@example.com", name: "Sigrid", picture: "" },
  };
}

function makeRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost/api/household/leave", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
    },
    body: JSON.stringify(body),
  });
}

const newSoloHousehold = {
  id: USER_ID,
  name: "Sigrid's Household",
  ownerId: USER_ID,
  memberIds: [USER_ID],
  inviteCode: "N3WC0D",
  inviteCodeExpiresAt: "2026-04-23T00:00:00.000Z",
  createdAt: "2026-03-23T00:00:00.000Z",
  updatedAt: "2026-03-23T00:00:00.000Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/household/leave", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(makeAuthOk());
    mockLeaveHouseholdTransaction.mockResolvedValue({ newHousehold: newSoloHousehold });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "missing_token" }), { status: 401 }),
    });
    const res = await POST(makeRequest({ confirm: true }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is missing confirm:true", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 when confirm is false", async () => {
    const res = await POST(makeRequest({ confirm: false }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/household/leave", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_json");
  });

  it("returns 200 with newHouseholdId on success", async () => {
    const res = await POST(makeRequest({ confirm: true }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; newHouseholdId: string };
    expect(body.success).toBe(true);
    expect(body.newHouseholdId).toBe(USER_ID);
  });

  it("calls leaveHouseholdTransaction with the authenticated userId", async () => {
    await POST(makeRequest({ confirm: true }));
    expect(mockLeaveHouseholdTransaction).toHaveBeenCalledWith(USER_ID);
  });

  it("returns 403 when caller is the household owner", async () => {
    mockLeaveHouseholdTransaction.mockRejectedValue(new Error("is_owner"));
    const res = await POST(makeRequest({ confirm: true }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("returns 403 when caller is not a member", async () => {
    mockLeaveHouseholdTransaction.mockRejectedValue(new Error("not_member"));
    const res = await POST(makeRequest({ confirm: true }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("returns 403 when user_not_found", async () => {
    mockLeaveHouseholdTransaction.mockRejectedValue(new Error("user_not_found"));
    const res = await POST(makeRequest({ confirm: true }));
    expect(res.status).toBe(403);
  });

  it("returns 500 on unexpected error", async () => {
    mockLeaveHouseholdTransaction.mockRejectedValue(new Error("firestore_timeout"));
    const res = await POST(makeRequest({ confirm: true }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });

  it("does not call leaveHouseholdTransaction when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response("{}", { status: 401 }),
    });
    await POST(makeRequest({ confirm: true }));
    expect(mockLeaveHouseholdTransaction).not.toHaveBeenCalled();
  });
});
