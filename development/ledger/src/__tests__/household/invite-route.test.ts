/**
 * Unit tests for POST /api/household/invite (regenerate invite code)
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
const mockRegenerateInviteCode = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  getHousehold: (...args: unknown[]) => mockGetHousehold(...args),
  regenerateInviteCode: (...args: unknown[]) => mockRegenerateInviteCode(...args),
}));

// Import after mocks
import { POST } from "@/app/api/household/invite/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const OWNER_ID = "user_owner123";
const MEMBER_ID = "user_member456";
const HOUSEHOLD_ID = "hh_abc";

function makeRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost/api/household/invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
    },
    body: JSON.stringify(body),
  });
}

const baseUser = {
  userId: OWNER_ID,
  email: "owner@example.com",
  displayName: "Thor",
  householdId: HOUSEHOLD_ID,
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const baseHousehold = {
  id: HOUSEHOLD_ID,
  name: "Thor's Household",
  ownerId: OWNER_ID,
  memberIds: [OWNER_ID],
  inviteCode: "X7K2NP",
  inviteCodeExpiresAt: "2026-04-16T00:00:00.000Z",
  tier: "free" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/household/invite", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: OWNER_ID, email: "owner@example.com", name: "Thor", picture: "" } });
    mockGetUser.mockResolvedValue(baseUser);
    mockGetHousehold.mockResolvedValue(baseHousehold);
    mockRegenerateInviteCode.mockResolvedValue({
      ...baseHousehold,
      inviteCode: "NEW123",
      inviteCodeExpiresAt: "2026-05-01T00:00:00.000Z",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "missing_token" }), { status: 401 }),
    });
    const res = await POST(makeRequest({ action: "regenerate" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 with new invite code for owner", async () => {
    const res = await POST(makeRequest({ action: "regenerate" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { inviteCode: string; inviteCodeExpiresAt: string };
    expect(body.inviteCode).toBe("NEW123");
    expect(body.inviteCodeExpiresAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("returns 403 when caller is not the owner", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: MEMBER_ID, email: "member@example.com", name: "Sigrid", picture: "" } });
    mockGetUser.mockResolvedValue({ ...baseUser, userId: MEMBER_ID, role: "member" });
    // Household ownerId is still OWNER_ID
    const res = await POST(makeRequest({ action: "regenerate" }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("returns 409 when household is full (3/3)", async () => {
    mockGetHousehold.mockResolvedValue({
      ...baseHousehold,
      memberIds: ["u1", "u2", "u3"],
    });
    const res = await POST(makeRequest({ action: "regenerate" }));
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("household_full");
  });

  it("returns 400 for missing action", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported action", async () => {
    const res = await POST(makeRequest({ action: "delete" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_action");
  });

  it("returns 403 when user not found", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ action: "regenerate" }));
    expect(res.status).toBe(403);
  });
});
