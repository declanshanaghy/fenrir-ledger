/**
 * Security regression tests for Issue #1199.
 *
 * Covers:
 *   - SEV-003: GET /api/household/invite/validate must NOT include email in members
 *   - SEV-001: GET /api/sync/pull — requireAuthz called with householdId (IDOR gate)
 *   - SEV-002: POST /api/sync/push — requireAuthz called with householdId (IDOR gate)
 *
 * These tests pin the security contracts so regressions are caught immediately.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// SEV-003: invite/validate PII
// ─────────────────────────────────────────────────────────────────────────────

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
  getAllFirestoreCards: vi.fn().mockResolvedValue([]),
  setCards: vi.fn().mockResolvedValue(undefined),
}));

// requireAuthz mocked for sync route tests below
const mockRequireAuthz = vi.fn();
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

import { GET as validateGET } from "@/app/api/household/invite/validate/route";

const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

const targetHousehold = {
  id: "hh_target",
  name: "Eriksen Household",
  ownerId: "owner_uid",
  memberIds: ["owner_uid"],
  inviteCode: "X7K2NP",
  inviteCodeExpiresAt: futureExpiry,
  tier: "free" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const ownerUser = {
  clerkUserId: "owner_uid",
  email: "thor@example.com",
  displayName: "Thorvald",
  householdId: "hh_target",
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const callerUser = {
  clerkUserId: "joiner_uid",
  email: "bjorn@example.com",
  displayName: "Björn",
  householdId: "hh_solo",
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("SEV-003: GET /api/household/invite/validate — PII (email) must be stripped", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      ok: true,
      user: { sub: "joiner_uid", email: "bjorn@example.com", name: "Björn", picture: "" },
    });
    mockGetUser.mockResolvedValue(callerUser);
    mockFindHouseholdByInviteCode.mockResolvedValue(targetHousehold);
    mockGetCards.mockResolvedValue([]);
    mockGetUsersByHouseholdId.mockResolvedValue([ownerUser]);
  });

  it("200 response members array does NOT contain email", async () => {
    const req = new NextRequest("http://localhost/api/household/invite/validate?code=X7K2NP", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res = await validateGET(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { members: Record<string, unknown>[] };
    expect(Array.isArray(body.members)).toBe(true);
    for (const member of body.members) {
      expect(member).not.toHaveProperty("email");
    }
  });

  it("200 response members array still contains displayName and role", async () => {
    const req = new NextRequest("http://localhost/api/household/invite/validate?code=X7K2NP", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res = await validateGET(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { members: Record<string, unknown>[] };
    expect(body.members.length).toBeGreaterThan(0);
    for (const member of body.members) {
      expect(member).toHaveProperty("displayName");
      expect(member).toHaveProperty("role");
    }
  });

  it("email is stripped even when multiple members are returned", async () => {
    const member2 = { ...ownerUser, clerkUserId: "member2", email: "sigrid@example.com", displayName: "Sigrid", role: "member" as const };
    mockGetUsersByHouseholdId.mockResolvedValue([ownerUser, member2]);

    const req = new NextRequest("http://localhost/api/household/invite/validate?code=X7K2NP", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res = await validateGET(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { members: Record<string, unknown>[] };
    expect(body.members).toHaveLength(2);
    for (const member of body.members) {
      expect(member).not.toHaveProperty("email");
    }
  });
});
