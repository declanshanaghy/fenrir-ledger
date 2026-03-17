/**
 * Unit tests for GET /api/sync/pull route.
 *
 * Validates:
 *   - 400 for missing householdId query param (before auth)
 *   - 401 when not authenticated
 *   - 403 for Thrall / trial users (Karl-only gate)
 *   - 403 when householdId does not match user's household (IDOR prevention, issue #1192)
 *   - 200 with all cards including tombstones
 *   - activeCount reflects only non-tombstoned cards
 *   - getAllFirestoreCards called with authz-resolved householdId, not raw query param
 *
 * Issue #1122, #1192
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";

// ── Mock: authz ────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: mockRequireAuthz,
}));

// ── Mock: Firestore ────────────────────────────────────────────────────────

const mockGetAllFirestoreCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: mockGetAllFirestoreCards,
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { GET } from "@/app/api/sync/pull/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────

let _seq = 0;

function makeCard(overrides: Partial<Card> = {}): Card {
  _seq++;
  return {
    id: `card-${_seq}`,
    householdId: "hh-test",
    issuerId: "chase",
    cardName: `Test Card ${_seq}`,
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 500000,
    annualFee: 0,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRequest(householdId?: string): NextRequest {
  const url = householdId
    ? `http://localhost/api/sync/pull?householdId=${householdId}`
    : "http://localhost/api/sync/pull";
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer test-token" },
  });
}

function authzSuccess(householdId = "hh-test") {
  mockRequireAuthz.mockResolvedValue({
    ok: true,
    user: { sub: "google-123", email: "test@example.com" },
    firestoreUser: {
      clerkUserId: "google-123",
      householdId,
      email: "test@example.com",
      displayName: "Test User",
      role: "owner",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  });
}

function authzFail(status: number, error: string) {
  mockRequireAuthz.mockResolvedValue({
    ok: false,
    response: new Response(JSON.stringify({ error }), { status }),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFirestoreCards.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/sync/pull — validation", () => {
  it("returns 400 when householdId query param is missing", async () => {
    // 400 is returned before authz is called
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("missing_param");
    expect(mockRequireAuthz).not.toHaveBeenCalled();
  });
});

describe("GET /api/sync/pull — auth", () => {
  it("returns 401 when not authenticated", async () => {
    authzFail(401, "missing_token");
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/sync/pull — Karl gate", () => {
  it("returns 403 for Thrall user (not Karl tier)", async () => {
    authzFail(403, "forbidden");
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("returns 403 for inactive Karl subscription", async () => {
    authzFail(403, "forbidden");
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/sync/pull — IDOR prevention (issue #1192)", () => {
  it("returns 403 when householdId does not match user's actual household", async () => {
    // authz detects household mismatch and returns 403 before Firestore is accessed
    authzFail(403, "forbidden");
    const res = await GET(makeRequest("victim-household"));
    expect(res.status).toBe(403);
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalled();
  });

  it("passes authz-resolved householdId to Firestore, not the raw query param", async () => {
    // Simulate: query param says "raw-query-param-id" but authz resolves "resolved-hh-id"
    // (in practice these match after the membership check, but we verify the route
    // uses firestoreUser.householdId — not the raw string — for Firestore ops)
    authzSuccess("resolved-hh-id");
    await GET(makeRequest("raw-query-param-id"));
    expect(mockGetAllFirestoreCards).toHaveBeenCalledWith("resolved-hh-id");
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalledWith("raw-query-param-id");
  });
});

describe("GET /api/sync/pull — response", () => {
  beforeEach(() => {
    authzSuccess("hh-test");
  });

  it("returns 200 with empty cards when Firestore is empty", async () => {
    mockGetAllFirestoreCards.mockResolvedValue([]);
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[]; activeCount: number };
    expect(body.cards).toEqual([]);
    expect(body.activeCount).toBe(0);
  });

  it("returns all cards including tombstones", async () => {
    const active = makeCard({ id: "active" });
    const tombstone = makeCard({ id: "dead", deletedAt: "2025-06-01T00:00:00.000Z" });
    mockGetAllFirestoreCards.mockResolvedValue([active, tombstone]);

    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[]; activeCount: number };
    expect(body.cards).toHaveLength(2);
    expect(body.cards.find((c) => c.id === "dead")?.deletedAt).toBeDefined();
  });

  it("activeCount reflects only non-tombstoned cards", async () => {
    const cards = [
      makeCard({ id: "a1" }),
      makeCard({ id: "a2" }),
      makeCard({ id: "d1", deletedAt: "2025-06-01T00:00:00.000Z" }),
    ];
    mockGetAllFirestoreCards.mockResolvedValue(cards);

    const res = await GET(makeRequest("hh-test"));
    const body = await res.json() as { cards: Card[]; activeCount: number };
    expect(body.activeCount).toBe(2);
    expect(body.cards).toHaveLength(3);
  });

  it("returns 500 when Firestore throws", async () => {
    mockGetAllFirestoreCards.mockRejectedValue(new Error("connection refused"));
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });
});
