/**
 * Issue #1820 — Join wizard shows wrong card count during merge step.
 *
 * Regression tests for:
 *   1. validate returns 409 already_in_household when caller is not solo
 *      (prevents getCards(callerUser.householdId) returning shared household cards)
 *   2. validate returns targetHouseholdCardCount in the 200 response
 *   3. userCardCount is read from the caller's solo household (userId), not
 *      callerUser.householdId (which would be wrong if already in a household)
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

// ── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = "google-sub-solo-user";
const TARGET_HOUSEHOLD_ID = "hh_target";
const OWNER_ID = "user_owner";

function makeRequest(code = "X7K2NP"): NextRequest {
  return new NextRequest(
    `http://localhost/api/household/invite/validate?code=${code}`,
    { headers: { Authorization: "Bearer valid-token" } },
  );
}

const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

const targetHousehold = {
  id: TARGET_HOUSEHOLD_ID,
  name: "Valhalla",
  ownerId: OWNER_ID,
  memberIds: [OWNER_ID],
  inviteCode: "X7K2NP",
  inviteCodeExpiresAt: futureExpiry,
  tier: "free" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/** Solo user — householdId equals their own userId (Google sub). */
const soloCallerUser = {
  userId: USER_ID,
  email: "solo@example.com",
  displayName: "Solo",
  householdId: USER_ID,          // solo: householdId === userId
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/** Already-joined user — householdId is a different household's ID. */
const joinedCallerUser = {
  ...soloCallerUser,
  householdId: "hh_already_joined",  // NOT equal to userId → already in a household
  role: "member" as const,
};

const ownerUser = {
  userId: OWNER_ID,
  email: "odin@valhalla.com",
  displayName: "Odin",
  householdId: TARGET_HOUSEHOLD_ID,
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/household/invite/validate — issue #1820", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      ok: true,
      user: { sub: USER_ID, email: "solo@example.com", name: "Solo", picture: "" },
    });
    mockFindHouseholdByInviteCode.mockResolvedValue(targetHousehold);
    mockGetUser.mockResolvedValue(soloCallerUser);
    mockGetCards.mockResolvedValue([]);
    mockGetUsersByHouseholdId.mockResolvedValue([ownerUser]);
  });

  // ── already_in_household guard ─────────────────────────────────────────────

  it("returns 409 already_in_household when caller is already in a household", async () => {
    mockGetUser.mockResolvedValue(joinedCallerUser);
    const res = await GET(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("already_in_household");
  });

  it("does NOT call getCards when returning already_in_household (no stale count leak)", async () => {
    mockGetUser.mockResolvedValue(joinedCallerUser);
    await GET(makeRequest());
    expect(mockGetCards).not.toHaveBeenCalled();
  });

  it("returns 200 for a solo user (householdId === userId)", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  // ── userCardCount uses userId (solo household path) ────────────────────────

  it("fetches userCardCount using userId, not callerUser.householdId", async () => {
    // For a solo user these are identical, but we verify the argument passed to getCards.
    mockGetCards.mockImplementation((id: string) => {
      if (id === USER_ID) return Promise.resolve([{ id: "c1" }, { id: "c2" }]);
      return Promise.resolve([]);
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { userCardCount: number };
    expect(body.userCardCount).toBe(2);
    // First getCards call must be for the solo household (userId)
    expect(mockGetCards).toHaveBeenCalledWith(USER_ID);
  });

  it("returns userCardCount 0 when solo user has no cards", async () => {
    mockGetCards.mockResolvedValue([]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { userCardCount: number };
    expect(body.userCardCount).toBe(0);
  });

  // ── targetHouseholdCardCount in response ───────────────────────────────────

  it("returns targetHouseholdCardCount in 200 response", async () => {
    mockGetCards.mockImplementation((id: string) => {
      if (id === USER_ID)           return Promise.resolve([]);
      if (id === TARGET_HOUSEHOLD_ID) return Promise.resolve([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);
      return Promise.resolve([]);
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { targetHouseholdCardCount: number };
    expect(body.targetHouseholdCardCount).toBe(3);
  });

  it("returns targetHouseholdCardCount 0 when target household has no cards", async () => {
    mockGetCards.mockResolvedValue([]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { targetHouseholdCardCount: number };
    expect(body.targetHouseholdCardCount).toBe(0);
  });

  it("returns both userCardCount and targetHouseholdCardCount independently", async () => {
    mockGetCards.mockImplementation((id: string) => {
      if (id === USER_ID)             return Promise.resolve([{ id: "u1" }]);
      if (id === TARGET_HOUSEHOLD_ID) return Promise.resolve([{ id: "t1" }, { id: "t2" }]);
      return Promise.resolve([]);
    });
    const res = await GET(makeRequest());
    const body = await res.json() as { userCardCount: number; targetHouseholdCardCount: number };
    expect(body.userCardCount).toBe(1);
    expect(body.targetHouseholdCardCount).toBe(2);
  });
});
