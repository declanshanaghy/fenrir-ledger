/**
 * Unit tests for GET /api/sync/pull route.
 *
 * Validates:
 *   - 401 when no auth header
 *   - 403 for Thrall / trial users (Karl-only gate)
 *   - 400 for missing householdId query param
 *   - 200 with all cards including tombstones
 *   - activeCount reflects only non-tombstoned cards
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";

// ── Mock: require-auth ─────────────────────────────────────────────────────

const mockRequireAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: mockRequireAuth,
}));

// ── Mock: entitlement-store ────────────────────────────────────────────────

const mockGetStripeEntitlement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: mockGetStripeEntitlement,
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

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFirestoreCards.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/sync/pull — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "missing_token" }), { status: 401 }),
    });
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/sync/pull — Karl gate", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({
      ok: true,
      user: { sub: "google-123", email: "test@example.com" },
    });
  });

  it("returns 403 for Thrall user (no entitlement)", async () => {
    mockGetStripeEntitlement.mockResolvedValue(null);
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string; current_tier: string };
    expect(body.error).toBe("forbidden");
    expect(body.current_tier).toBe("thrall");
  });

  it("returns 403 for inactive Karl subscription", async () => {
    mockGetStripeEntitlement.mockResolvedValue({ tier: "karl", active: false });
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for free-trial users (no sync during trial)", async () => {
    mockGetStripeEntitlement.mockResolvedValue({ tier: "thrall", active: false });
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/sync/pull — validation", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({
      ok: true,
      user: { sub: "google-123", email: "test@example.com" },
    });
    mockGetStripeEntitlement.mockResolvedValue({ tier: "karl", active: true });
  });

  it("returns 400 when householdId query param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("missing_param");
  });
});

describe("GET /api/sync/pull — response", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({
      ok: true,
      user: { sub: "google-123", email: "test@example.com" },
    });
    mockGetStripeEntitlement.mockResolvedValue({ tier: "karl", active: true });
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

  it("passes householdId to getAllFirestoreCards", async () => {
    await GET(makeRequest("my-household-id"));
    expect(mockGetAllFirestoreCards).toHaveBeenCalledWith("my-household-id");
  });
});
