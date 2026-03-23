/**
 * Unit tests for POST /api/household/kick
 *
 * Issue #1818 — Allow household owner to kick/remove members
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockKickMemberTransaction = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  kickMemberTransaction: (...args: unknown[]) => mockKickMemberTransaction(...args),
}));

import { POST } from "@/app/api/household/kick/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const OWNER_ID = "user_owner_abc";
const MEMBER_ID = "user_member_xyz";

function makeAuthOk(userId = OWNER_ID) {
  return {
    ok: true as const,
    user: { sub: userId, email: "owner@example.com", name: "Bjorn", picture: "" },
  };
}

function makeRequest(body: unknown = { memberId: MEMBER_ID }): NextRequest {
  return new NextRequest("http://localhost/api/household/kick", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
    },
    body: JSON.stringify(body),
  });
}

const newSoloHousehold = {
  id: MEMBER_ID,
  name: "Sigrid's Household",
  ownerId: MEMBER_ID,
  memberIds: [MEMBER_ID],
  inviteCode: "N3WC0D",
  inviteCodeExpiresAt: "2026-04-23T00:00:00.000Z",
  createdAt: "2026-03-23T00:00:00.000Z",
  updatedAt: "2026-03-23T00:00:00.000Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/household/kick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(makeAuthOk());
    mockKickMemberTransaction.mockResolvedValue({ newHousehold: newSoloHousehold });
  });

  // Auth
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "missing_token" }), { status: 401 }),
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("does not call kickMemberTransaction when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response("{}", { status: 401 }),
    });
    await POST(makeRequest());
    expect(mockKickMemberTransaction).not.toHaveBeenCalled();
  });

  // Body validation
  it("returns 400 when body is not valid JSON", async () => {
    const req = new NextRequest("http://localhost/api/household/kick", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_json");
  });

  it("returns 400 when memberId is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 when memberId is empty string", async () => {
    const res = await POST(makeRequest({ memberId: "   " }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 when memberId is a number", async () => {
    const res = await POST(makeRequest({ memberId: 42 }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  // Self-kick guard
  it("returns 403 when caller tries to kick themselves", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/household/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
        body: JSON.stringify({ memberId: OWNER_ID }),
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  // Success
  it("returns 200 with success and newHouseholdId on success", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; newHouseholdId: string };
    expect(body.success).toBe(true);
    expect(body.newHouseholdId).toBe(MEMBER_ID);
  });

  it("calls kickMemberTransaction with callerId and memberId", async () => {
    await POST(makeRequest());
    expect(mockKickMemberTransaction).toHaveBeenCalledWith(OWNER_ID, MEMBER_ID);
  });

  // Authorization errors from transaction
  it("returns 403 when caller is not the owner (not_owner)", async () => {
    mockKickMemberTransaction.mockRejectedValue(new Error("not_owner"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("returns 403 when caller user doc is missing (caller_not_found)", async () => {
    mockKickMemberTransaction.mockRejectedValue(new Error("caller_not_found"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("returns 403 when target is not a member (not_member)", async () => {
    mockKickMemberTransaction.mockRejectedValue(new Error("not_member"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("returns 403 when target user doc is missing (target_not_found)", async () => {
    mockKickMemberTransaction.mockRejectedValue(new Error("target_not_found"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("returns 403 when attempting to kick the household owner (cannot_kick_owner)", async () => {
    mockKickMemberTransaction.mockRejectedValue(new Error("cannot_kick_owner"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  // Internal errors
  it("returns 500 on unexpected Firestore error", async () => {
    mockKickMemberTransaction.mockRejectedValue(new Error("firestore_timeout"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });
});
