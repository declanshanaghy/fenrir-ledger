/**
 * Loki QA tests for POST /api/household/join — gap-filling tests
 *
 * Covers edge cases NOT tested by FiremanDecko's join-route.test.ts:
 *   - already_member error (user attempts to join their own household) → maps to 500
 *   - user_not_found thrown by transaction → maps to 500
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

const mockJoinHouseholdTransaction = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  joinHouseholdTransaction: (...args: unknown[]) => mockJoinHouseholdTransaction(...args),
}));

import { POST } from "@/app/api/household/join/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/household/join — Loki edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      ok: true,
      user: { sub: "user_owner", email: "owner@example.com", name: "Thor", picture: "" },
    });
  });

  it("returns 500 when user tries to join their own household (already_member)", async () => {
    // The transaction detects the user is already in the target household and
    // throws "already_member". The route doesn't have a specific handler for this,
    // so it falls through to the generic 500 internal_error.
    mockJoinHouseholdTransaction.mockRejectedValue(new Error("already_member"));
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: true }));
    // Documents current behaviour: already_member maps to 500 (not a 4xx)
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });

  it("returns 500 when user record is missing during transaction (user_not_found)", async () => {
    // The transaction fetches the user doc; if missing it throws "user_not_found".
    // The route has no dedicated handler for this — falls to generic 500.
    mockJoinHouseholdTransaction.mockRejectedValue(new Error("user_not_found"));
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: true }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });

  it("returns 400 when body is a string (not an object)", async () => {
    const req = new NextRequest("http://localhost/api/household/join", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token" },
      body: JSON.stringify("just a string"),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when inviteCode is not a string", async () => {
    const res = await POST(makeRequest({ inviteCode: 123456, confirm: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when confirm is missing entirely", async () => {
    const res = await POST(makeRequest({ inviteCode: "X7K2NP" }));
    expect(res.status).toBe(400);
  });

  it("response body includes error_description for 409 race condition", async () => {
    mockJoinHouseholdTransaction.mockRejectedValue(new Error("household_full"));
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: true }));
    expect(res.status).toBe(409);
    const body = await res.json() as { error_description: string };
    expect(typeof body.error_description).toBe("string");
    expect(body.error_description.length).toBeGreaterThan(0);
  });

  it("response body includes movedCardCount on successful join with many cards", async () => {
    mockJoinHouseholdTransaction.mockResolvedValue({
      movedCardIds: ["c1", "c2", "c3", "c4", "c5"],
      newHousehold: {
        id: "hh_new",
        name: "Eriksen Household",
        ownerId: "user_owner",
        memberIds: ["user_owner", "user_me"],
        inviteCode: "X7K2NP",
        inviteCodeExpiresAt: "2026-04-16T00:00:00.000Z",
        tier: "free" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const res = await POST(makeRequest({ inviteCode: "X7K2NP", confirm: true }));
    expect(res.status).toBe(200);
    const body = await res.json() as { movedCardCount: number };
    expect(body.movedCardCount).toBe(5);
  });
});
