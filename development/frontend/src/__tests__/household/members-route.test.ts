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
const mockEnsureSoloHousehold = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  getHousehold: (...args: unknown[]) => mockGetHousehold(...args),
  getUsersByHouseholdId: (...args: unknown[]) => mockGetUsersByHouseholdId(...args),
  ensureSoloHousehold: (...args: unknown[]) => mockEnsureSoloHousehold(...args),
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

  // ── Bootstrap path tests (issue #1159) ──────────────────────────────────────

  it("bootstraps a solo household when user doc not found (first sign-in)", async () => {
    mockGetUser.mockResolvedValue(null);
    mockEnsureSoloHousehold.mockResolvedValue({
      user: ownerUserDoc,
      household: { ...baseHousehold, memberIds: [OWNER_ID] },
      created: true,
    });
    mockGetHousehold.mockResolvedValue({ ...baseHousehold, memberIds: [OWNER_ID] });
    mockGetUsersByHouseholdId.mockResolvedValue([ownerUserDoc]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // ensureSoloHousehold must be called with sub, email, name from auth token
    expect(mockEnsureSoloHousehold).toHaveBeenCalledWith({
      clerkUserId: OWNER_ID,
      email: "thor@example.com",
      displayName: "Thorvald",
    });

    const body = await res.json() as {
      householdId: string;
      isSolo: boolean;
      isOwner: boolean;
      memberCount: number;
    };
    expect(body.householdId).toBe(HOUSEHOLD_ID);
    expect(body.isSolo).toBe(true);
    expect(body.isOwner).toBe(true);
    expect(body.memberCount).toBe(1);
  });

  it("does not duplicate user when bootstrap called for existing user (idempotent)", async () => {
    // Simulate a second request: getUser returns the existing doc (bootstrap not needed)
    mockGetUser.mockResolvedValue(ownerUserDoc);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // ensureSoloHousehold must NOT be called — user already exists
    expect(mockEnsureSoloHousehold).not.toHaveBeenCalled();
  });

  it("returns 404 when household doc missing after bootstrap", async () => {
    mockGetUser.mockResolvedValue(null);
    mockEnsureSoloHousehold.mockResolvedValue({
      user: ownerUserDoc,
      household: { ...baseHousehold, memberIds: [OWNER_ID] },
      created: true,
    });
    // Simulate a corrupt state where household doc doesn't exist post-bootstrap
    mockGetHousehold.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("household_not_found");
  });

  // ── Loki edge cases (issue #1159) ────────────────────────────────────────────

  it("returns 200 when concurrent request already created household (created: false)", async () => {
    // Race condition: two simultaneous first-sign-in requests. The second one
    // finds the household was already created by the first (created: false).
    // The route must still succeed — never depend on the created flag for correctness.
    mockGetUser.mockResolvedValue(null);
    mockEnsureSoloHousehold.mockResolvedValue({
      user: ownerUserDoc,
      household: { ...baseHousehold, memberIds: [OWNER_ID] },
      created: false, // ← already existed when we got there (race)
    });
    mockGetHousehold.mockResolvedValue({ ...baseHousehold, memberIds: [OWNER_ID] });
    mockGetUsersByHouseholdId.mockResolvedValue([ownerUserDoc]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { householdId: string; isOwner: boolean; isSolo: boolean };
    expect(body.householdId).toBe(HOUSEHOLD_ID);
    expect(body.isOwner).toBe(true);
    expect(body.isSolo).toBe(true);
    // ensureSoloHousehold must have been called (getUser returned null)
    expect(mockEnsureSoloHousehold).toHaveBeenCalledOnce();
  });
});
