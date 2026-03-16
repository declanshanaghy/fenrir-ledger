/**
 * Unit tests for GET /api/household/members
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

const mockGetUser = vi.fn();
const mockGetHousehold = vi.fn();
const mockGetUsersByHouseholdId = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  getHousehold: (...args: unknown[]) => mockGetHousehold(...args),
  getUsersByHouseholdId: (...args: unknown[]) => mockGetUsersByHouseholdId(...args),
}));

import { GET } from "@/app/api/household/members/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const OWNER_ID = "user_owner";
const MEMBER_ID = "user_member";
const HOUSEHOLD_ID = "hh_abc";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/household/members", {
    headers: { Authorization: "Bearer valid-token" },
  });
}

const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

const baseHousehold = {
  id: HOUSEHOLD_ID,
  name: "Eriksen Household",
  ownerId: OWNER_ID,
  memberIds: [OWNER_ID, MEMBER_ID],
  inviteCode: "X7K2NP",
  inviteCodeExpiresAt: futureExpiry,
  tier: "free" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const ownerUserDoc = {
  clerkUserId: OWNER_ID,
  email: "thor@example.com",
  displayName: "Thorvald",
  householdId: HOUSEHOLD_ID,
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const memberUserDoc = {
  clerkUserId: MEMBER_ID,
  email: "sigrid@example.com",
  displayName: "Sigrid",
  householdId: HOUSEHOLD_ID,
  role: "member" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/household/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: OWNER_ID, email: "thor@example.com", name: "Thorvald", picture: "" } });
    mockGetUser.mockResolvedValue(ownerUserDoc);
    mockGetHousehold.mockResolvedValue(baseHousehold);
    mockGetUsersByHouseholdId.mockResolvedValue([ownerUserDoc, memberUserDoc]);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "missing_token" }), { status: 401 }),
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with household data for owner", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as {
      householdId: string;
      householdName: string;
      memberCount: number;
      maxMembers: number;
      isFull: boolean;
      isOwner: boolean;
      members: Array<{ clerkUserId: string; role: string; isCurrentUser: boolean }>;
      inviteCode: string;
      inviteCodeExpiresAt: string;
    };
    expect(body.householdId).toBe(HOUSEHOLD_ID);
    expect(body.householdName).toBe("Eriksen Household");
    expect(body.memberCount).toBe(2);
    expect(body.maxMembers).toBe(3);
    expect(body.isFull).toBe(false);
    expect(body.isOwner).toBe(true);
    // Owner sees invite code
    expect(body.inviteCode).toBe("X7K2NP");
    expect(body.inviteCodeExpiresAt).toBeDefined();
  });

  it("marks caller as isCurrentUser", async () => {
    const res = await GET(makeRequest());
    const body = await res.json() as {
      members: Array<{ clerkUserId: string; isCurrentUser: boolean }>;
    };
    const callerMember = body.members.find((m) => m.clerkUserId === OWNER_ID);
    expect(callerMember?.isCurrentUser).toBe(true);
  });

  it("member does NOT see invite code", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: MEMBER_ID, email: "sigrid@example.com", name: "Sigrid", picture: "" } });
    mockGetUser.mockResolvedValue(memberUserDoc);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { inviteCode?: string; isOwner: boolean };
    expect(body.isOwner).toBe(false);
    expect(body.inviteCode).toBeUndefined();
  });

  it("owner does NOT see invite code when household is full (3/3)", async () => {
    const fullHousehold = {
      ...baseHousehold,
      memberIds: [OWNER_ID, MEMBER_ID, "user_third"],
    };
    mockGetHousehold.mockResolvedValue(fullHousehold);
    mockGetUsersByHouseholdId.mockResolvedValue([ownerUserDoc, memberUserDoc, { ...memberUserDoc, clerkUserId: "user_third", displayName: "Third" }]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { isFull: boolean; inviteCode?: string };
    expect(body.isFull).toBe(true);
    expect(body.inviteCode).toBeUndefined();
  });

  it("owner listed first in members array", async () => {
    const res = await GET(makeRequest());
    const body = await res.json() as {
      members: Array<{ role: string }>;
    };
    expect(body.members[0]?.role).toBe("owner");
  });

  it("returns 404 when user not found", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });
});
