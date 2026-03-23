/**
 * Unit tests for GET /api/household/invite/validate
 *
 * Consolidates issue-numbered test clusters:
 *   - validate-route-1820.test.ts (Regression: #1820)
 *   - validate-route-loki.test.ts (Loki edge cases)
 *
 * Issue #1123 — household invite code flow
 * Issue #1820 — join wizard shows wrong card count during merge step
 *
 * @ref Issue #1123, #1820
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

const mockFindHouseholdByInviteCode = vi.fn();
const mockGetUser = vi.fn();
const mockGetCards = vi.fn();
const mockGetUsersByHouseholdId = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  getCards: (...args: unknown[]) => mockGetCards(...args),
  findHouseholdByInviteCode: (...args: unknown[]) => mockFindHouseholdByInviteCode(...args),
  getUsersByHouseholdId: (...args: unknown[]) => mockGetUsersByHouseholdId(...args),
}));

import { GET } from "@/app/api/household/invite/validate/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "user_joiner";
const OWNER_ID = "user_owner";
const HOUSEHOLD_ID = "hh_target";
// Solo user: householdId MUST equal userId (Google sub) — that is how solo
// households are keyed in Firestore.  The old CALLER_HOUSEHOLD_ID = "hh_solo"
// was wrong; it would now trigger the already_in_household guard.
const CALLER_HOUSEHOLD_ID = USER_ID;

function makeRequest(code: string | null = "X7K2NP"): NextRequest {
  const url = code
    ? `http://localhost/api/household/invite/validate?code=${encodeURIComponent(code)}`
    : "http://localhost/api/household/invite/validate";
  return new NextRequest(url, {
    headers: { Authorization: "Bearer valid-token" },
  });
}

const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
const pastExpiry = new Date(Date.now() - 1000).toISOString();

const targetHousehold = {
  id: HOUSEHOLD_ID,
  name: "Eriksen Household",
  ownerId: OWNER_ID,
  memberIds: [OWNER_ID, "user_sigrid"],
  inviteCode: "X7K2NP",
  inviteCodeExpiresAt: futureExpiry,
  tier: "free" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const callerUser = {
  userId: USER_ID,
  email: "joiner@example.com",
  displayName: "Björn",
  householdId: CALLER_HOUSEHOLD_ID,
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const ownerUser = {
  userId: OWNER_ID,
  email: "thor@example.com",
  displayName: "Thorvald",
  householdId: HOUSEHOLD_ID,
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/household/invite/validate", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: USER_ID, email: "joiner@example.com", name: "Björn", picture: "" } });
    mockFindHouseholdByInviteCode.mockResolvedValue(targetHousehold);
    mockGetUser.mockResolvedValue(callerUser);
    mockGetCards.mockResolvedValue([]);
    mockGetUsersByHouseholdId.mockResolvedValue([ownerUser]);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "missing_token" }), { status: 401 }),
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with household preview for valid code", async () => {
    const res = await GET(makeRequest("X7K2NP"));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      householdId: string;
      householdName: string;
      memberCount: number;
      members: unknown[];
      userCardCount: number;
      targetHouseholdCardCount: number;
    };
    expect(body.householdId).toBe(HOUSEHOLD_ID);
    expect(body.householdName).toBe("Eriksen Household");
    expect(body.memberCount).toBe(2);
    expect(body.userCardCount).toBe(0);
    expect(body.targetHouseholdCardCount).toBe(0);
    expect(Array.isArray(body.members)).toBe(true);
  });

  it("returns 404 for invalid code", async () => {
    mockFindHouseholdByInviteCode.mockResolvedValue(null);
    const res = await GET(makeRequest("ZZZZZ1"));
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invite_invalid");
  });

  it("returns 410 for expired code", async () => {
    mockFindHouseholdByInviteCode.mockResolvedValue({
      ...targetHousehold,
      inviteCodeExpiresAt: pastExpiry,
    });
    const res = await GET(makeRequest("X7K2NP"));
    expect(res.status).toBe(410);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invite_expired");
  });

  it("returns 409 household_full for full household", async () => {
    mockFindHouseholdByInviteCode.mockResolvedValue({
      ...targetHousehold,
      memberIds: ["u1", "u2", "u3"],
    });
    const res = await GET(makeRequest("X7K2NP"));
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string; reason: string };
    expect(body.error).toBe("household_full");
    expect(body.reason).toBe("household_full");
  });

  it("returns 400 for missing code param", async () => {
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(400);
  });

  it("returns 400 for code with wrong format", async () => {
    const res = await GET(makeRequest("TOOLONGCODE"));
    expect(res.status).toBe(400);
  });

  // ── already_in_household guard (Regression: #1820) ────────────────────────

  // Regression: #1820 — prevents getCards(callerUser.householdId) returning shared household cards
  it("returns 409 already_in_household when caller is already in a household", async () => {
    const joinedCallerUser = { ...callerUser, householdId: "hh_already_joined" };
    mockGetUser.mockResolvedValue(joinedCallerUser);
    const res = await GET(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("already_in_household");
  });

  it("does NOT call getCards when returning already_in_household (no stale count leak)", async () => {
    const joinedCallerUser = { ...callerUser, householdId: "hh_already_joined" };
    mockGetUser.mockResolvedValue(joinedCallerUser);
    await GET(makeRequest());
    expect(mockGetCards).not.toHaveBeenCalled();
  });

  // ── userCardCount uses userId (solo household path) (Regression: #1820) ──

  // Regression: #1820 — userCardCount must use userId, not callerUser.householdId
  it("fetches userCardCount using userId, not callerUser.householdId", async () => {
    mockGetCards.mockImplementation((id: string) => {
      if (id === USER_ID) return Promise.resolve([{ id: "c1" }, { id: "c2" }]);
      return Promise.resolve([]);
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { userCardCount: number };
    expect(body.userCardCount).toBe(2);
    expect(mockGetCards).toHaveBeenCalledWith(USER_ID);
  });

  it("returns targetHouseholdCardCount in 200 response", async () => {
    mockGetCards.mockImplementation((id: string) => {
      if (id === USER_ID)           return Promise.resolve([]);
      if (id === HOUSEHOLD_ID) return Promise.resolve([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);
      return Promise.resolve([]);
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { targetHouseholdCardCount: number };
    expect(body.targetHouseholdCardCount).toBe(3);
  });

  it("returns both userCardCount and targetHouseholdCardCount independently", async () => {
    mockGetCards.mockImplementation((id: string) => {
      if (id === USER_ID)     return Promise.resolve([{ id: "u1" }]);
      if (id === HOUSEHOLD_ID) return Promise.resolve([{ id: "t1" }, { id: "t2" }]);
      return Promise.resolve([]);
    });
    const res = await GET(makeRequest());
    const body = await res.json() as { userCardCount: number; targetHouseholdCardCount: number };
    expect(body.userCardCount).toBe(1);
    expect(body.targetHouseholdCardCount).toBe(2);
  });

  // ── Edge cases (Loki) ─────────────────────────────────────────────────────

  it("returns 404 when getUser returns null (user record missing)", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("X7K2NP"));
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("user_not_found");
  });

  it("returns 400 for empty string code param", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 for whitespace-only code param", async () => {
    const res = await GET(makeRequest("   "));
    expect(res.status).toBe(400);
  });

  it("normalises lowercase code to uppercase before lookup", async () => {
    await GET(makeRequest("x7k2np"));
    expect(mockFindHouseholdByInviteCode).toHaveBeenCalledWith("X7K2NP");
  });

  it("returns 400 for code containing special characters", async () => {
    const res = await GET(makeRequest("X7!2NP"));
    expect(res.status).toBe(400);
  });

  it("200 response includes members array with name and role", async () => {
    const res = await GET(makeRequest("X7K2NP"));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      members: Array<{ displayName: string; email: string; role: string }>;
    };
    expect(body.members).toHaveLength(1);
    expect(body.members[0]?.displayName).toBe("Thorvald");
    expect(body.members[0]?.role).toBe("owner");
  });

  it("does not expose inviteCode field in response body", async () => {
    const res = await GET(makeRequest("X7K2NP"));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty("inviteCode");
  });

  // SEV-003 (HIGH) — documented by Heimdall audit issue #1126
  // The validate endpoint currently leaks member email (PII) to any invite-code holder.
  // EXPECTED AFTER FIX: email should be absent from the members array response.
  it("SEV-003: members array currently exposes email field (PII leakage — pending fix in #1194)", async () => {
    const res = await GET(makeRequest("X7K2NP"));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      members: Array<{ displayName: string; email?: string; role: string }>;
    };
    // Document current vulnerable state: email IS present in the response.
    // This assertion will need to be inverted (expect email to be absent) when SEV-003 is fixed.
    expect(body.members[0]).toHaveProperty("email");
  });

  it("includes userCardCount matching caller's solo household cards", async () => {
    // Caller (solo user) has 3 cards under their own householdId (= USER_ID).
    mockGetCards.mockImplementation((id: string) => {
      if (id === USER_ID) return Promise.resolve([{ id: "card1" }, { id: "card2" }, { id: "card3" }]);
      return Promise.resolve([]);
    });
    const res = await GET(makeRequest("X7K2NP"));
    expect(res.status).toBe(200);
    const body = await res.json() as { userCardCount: number; targetHouseholdCardCount: number };
    expect(body.userCardCount).toBe(3);
    expect(body.targetHouseholdCardCount).toBe(0);
  });
});
