/**
 * Unit tests for GET /api/sync/pull route.
 *
 * Validates:
 *   - 401 when no auth header
 *   - 403 for Thrall / trial users (Karl-only gate, via requireAuthz)
 *   - 403 when householdId does not match user's household (IDOR, SEV-001)
 *   - 400 for missing householdId query param
 *   - 200 with all cards including tombstones
 *   - activeCount reflects only non-tombstoned cards
 *   - Firestore is always called with authz.firestoreUser.householdId (never raw param)
 *
 * Issue #1199
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";
import type { FirestoreUser } from "@/lib/firebase/firestore-types";

// ── Mock: requireAuthz ─────────────────────────────────────────────────────

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

function makeFirestoreUser(householdId = "hh-test"): FirestoreUser {
  return {
    clerkUserId: "google-123",
    email: "test@example.com",
    displayName: "Test User",
    householdId,
    role: "owner",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

function authzSuccess(householdId = "hh-test") {
  return {
    ok: true as const,
    user: { sub: "google-123", email: "test@example.com" },
    firestoreUser: makeFirestoreUser(householdId),
  };
}

function authzFailure(status: number, error: string) {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error }), { status }),
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

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFirestoreCards.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/sync/pull — missing householdId (checked before auth)", () => {
  it("returns 400 when householdId query param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("missing_param");
    // requireAuthz should not be called at all
    expect(mockRequireAuthz).not.toHaveBeenCalled();
  });
});

describe("GET /api/sync/pull — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuthz.mockResolvedValue(authzFailure(401, "missing_token"));
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/sync/pull — Karl gate", () => {
  it("returns 403 for Thrall / non-Karl user", async () => {
    mockRequireAuthz.mockResolvedValue(authzFailure(403, "forbidden"));
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/sync/pull — IDOR protection (SEV-001)", () => {
  it("returns 403 when householdId does not match user's household", async () => {
    // requireAuthz detects the household_mismatch and returns 403
    mockRequireAuthz.mockResolvedValue(authzFailure(403, "forbidden"));

    const res = await GET(makeRequest("another-household-id"));
    expect(res.status).toBe(403);
  });

  it("requireAuthz is called with the supplied householdId for membership check", async () => {
    mockRequireAuthz.mockResolvedValue(authzSuccess("hh-test"));
    mockGetAllFirestoreCards.mockResolvedValue([]);

    await GET(makeRequest("hh-test"));

    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ householdId: "hh-test", tier: "karl" }),
    );
  });

  it("Firestore is called with authz.firestoreUser.householdId, not the raw query param", async () => {
    // The user's real household is "real-hh", but query param says "hh-test".
    // After requireAuthz succeeds, the route must use firestoreUser.householdId.
    mockRequireAuthz.mockResolvedValue(authzSuccess("real-hh"));
    mockGetAllFirestoreCards.mockResolvedValue([]);

    await GET(makeRequest("hh-test"));

    // Must use "real-hh" (firestoreUser.householdId), not "hh-test" (raw param)
    expect(mockGetAllFirestoreCards).toHaveBeenCalledWith("real-hh");
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalledWith("hh-test");
  });
});

describe("GET /api/sync/pull — response", () => {
  beforeEach(() => {
    mockRequireAuthz.mockResolvedValue(authzSuccess("hh-test"));
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
