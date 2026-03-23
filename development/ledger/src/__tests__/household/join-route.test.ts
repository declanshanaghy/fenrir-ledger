/**
 * Unit tests for POST /api/household/join
 *
 * Issue #1123 — household invite code flow
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockRequireAuthz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

const mockJoinHouseholdTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  joinHouseholdTransaction: (...args: unknown[]) => mockJoinHouseholdTransaction(...args),
}));

import { POST } from "@/app/api/household/join/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "user_joiner";

function makeRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost/api/household/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
    },
    body: JSON.stringify(body),
  });
}

const successResult = {
  movedCardIds: ["card1", "card2"],
  newHousehold: {
    id: "hh_target",
    name: "Eriksen Household",
    ownerId: "user_owner",
    memberIds: ["user_owner", "user_sigrid", USER_ID],
    inviteCode: "X7K2NP",
    inviteCodeExpiresAt: "2026-04-16T00:00:00.000Z",
    tier: "free" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/household/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthz.mockResolvedValue({ ok: true, user: { sub: USER_ID, email: "joiner@example.com", name: "Björn", picture: "" }, firestoreUser: { userId: USER_ID, email: "joiner@example.com", displayName: "Björn", householdId: "hh-solo", role: "owner" as const, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" } });
    mockJoinHouseholdTransaction.mockResolvedValue(successResult);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "missing_token" }), { status: 401 }),
    });
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: true }));
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful join", async () => {
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: true }));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      householdId: string;
      householdName: string;
      movedCardCount: number;
    };
    expect(body.success).toBe(true);
    expect(body.householdId).toBe("hh_target");
    expect(body.householdName).toBe("Eriksen Household");
    expect(body.movedCardCount).toBe(2);
  });

  it("returns 200 with movedCardCount=0 when no cards", async () => {
    mockJoinHouseholdTransaction.mockResolvedValue({
      ...successResult,
      movedCardIds: [],
    });
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: true }));
    expect(res.status).toBe(200);
    const body = await res.json() as { movedCardCount: number };
    expect(body.movedCardCount).toBe(0);
  });

  it("returns 404 for invite_invalid error", async () => {
    mockJoinHouseholdTransaction.mockRejectedValue(new Error("invite_invalid"));
    const res = await POST(makeRequest({ inviteCode: "ZZZZZ1", confirm: true }));
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invite_invalid");
  });

  it("returns 410 for invite_expired error", async () => {
    mockJoinHouseholdTransaction.mockRejectedValue(new Error("invite_expired"));
    const res = await POST(makeRequest({ inviteCode: "EXPRD1", confirm: true }));
    expect(res.status).toBe(410);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invite_expired");
  });

  it("returns 409 household_full for race condition", async () => {
    mockJoinHouseholdTransaction.mockRejectedValue(new Error("household_full"));
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: true }));
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string; reason: string };
    expect(body.error).toBe("household_full");
    expect(body.reason).toBe("household_full");
  });

  it("returns 500 for unexpected error", async () => {
    mockJoinHouseholdTransaction.mockRejectedValue(new Error("firestore_timeout"));
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: true }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });

  it("returns 400 for missing inviteCode", async () => {
    const res = await POST(makeRequest({ confirm: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when confirm is not true", async () => {
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: false }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid code format", async () => {
    const res = await POST(makeRequest({ inviteCode: "XY", confirm: true }));
    expect(res.status).toBe(400);
  });

  it("passes uppercase code to transaction", async () => {
    await POST(makeRequest({ inviteCode: "x7k2np", confirm: true }));
    expect(mockJoinHouseholdTransaction).toHaveBeenCalledWith(USER_ID, "x7k2np");
  });
});
