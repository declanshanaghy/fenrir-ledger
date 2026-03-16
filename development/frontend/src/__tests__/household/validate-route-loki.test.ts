/**
 * Loki QA tests for GET /api/household/invite/validate — gap-filling tests
 *
 * Covers edge cases NOT tested by FiremanDecko's validate-route.test.ts:
 *   - user_not_found when getUser returns null
 *   - caller already in target household (no guard — documents current behaviour)
 *   - empty string code param (treated as missing)
 *   - whitespace-only code param
 *   - code normalised to uppercase before lookup
 *
 * Issue #1123 — Household invite code flow
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
const CALLER_HOUSEHOLD_ID = "hh_solo";

function makeRequest(code: string | null): NextRequest {
  const url =
    code !== null
      ? `http://localhost/api/household/invite/validate?code=${encodeURIComponent(code)}`
      : "http://localhost/api/household/invite/validate";
  return new NextRequest(url, {
    headers: { Authorization: "Bearer valid-token" },
  });
}

const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

const targetHousehold = {
  id: HOUSEHOLD_ID,
  name: "Eriksen Household",
  ownerId: OWNER_ID,
  memberIds: [OWNER_ID],
  inviteCode: "X7K2NP",
  inviteCodeExpiresAt: futureExpiry,
  tier: "free" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const callerUser = {
  clerkUserId: USER_ID,
  email: "joiner@example.com",
  displayName: "Björn",
  householdId: CALLER_HOUSEHOLD_ID,
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const ownerUser = {
  clerkUserId: OWNER_ID,
  email: "thor@example.com",
  displayName: "Thorvald",
  householdId: HOUSEHOLD_ID,
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/household/invite/validate — Loki edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      ok: true,
      user: { sub: USER_ID, email: "joiner@example.com", name: "Björn", picture: "" },
    });
    mockFindHouseholdByInviteCode.mockResolvedValue(targetHousehold);
    mockGetUser.mockResolvedValue(callerUser);
    mockGetCards.mockResolvedValue([]);
    mockGetUsersByHouseholdId.mockResolvedValue([ownerUser]);
  });

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

  it("200 response: caller already in target household — no guard, returns preview", async () => {
    // Document current behaviour: validate does NOT block users already in the
    // household. The transaction's "already_member" guard fires at join time.
    const callerAlreadyMember = { ...callerUser, householdId: HOUSEHOLD_ID };
    mockGetUser.mockResolvedValue(callerAlreadyMember);
    mockFindHouseholdByInviteCode.mockResolvedValue({
      ...targetHousehold,
      memberIds: [USER_ID, OWNER_ID],
    });
    const res = await GET(makeRequest("X7K2NP"));
    // Currently returns 200 — the join transaction will reject with already_member
    expect(res.status).toBe(200);
  });

  it("does not expose inviteCode field in response body", async () => {
    const res = await GET(makeRequest("X7K2NP"));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty("inviteCode");
  });
});
