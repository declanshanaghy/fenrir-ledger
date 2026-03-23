/**
 * Unit tests for GET /api/household/invite/validate
 *
 * Issue #1123 — household invite code flow
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
    ? `http://localhost/api/household/invite/validate?code=${code}`
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
    vi.clearAllMocks();
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

  it("includes userCardCount matching caller's solo household cards", async () => {
    // Caller (solo user) has 3 cards under their own householdId (= USER_ID).
    // Target household has 0 cards.
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
});
