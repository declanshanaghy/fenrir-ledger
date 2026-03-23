/**
 * Unit tests for GET/PUT /api/sync route
 *
 * Tests:
 *   - Auth guard: 401 when no token
 *   - Karl gate: 403 when Thrall
 *   - GET returns cards from Firestore
 *   - PUT applies last-write-wins, writes only newer cards
 *   - PUT enforces householdId consistency
 *   - PUT rejects invalid body
 *   - Edge cases: 403 when user not found, large batches, empty arrays, response shape
 *
 * Issue #1119
 * Consolidated: sync-route-edge-cases.loki.test.ts (issue #1656)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Card } from "@/lib/types";

// ── Mock requireAuth ──────────────────────────────────────────────────────────

const mockRequireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (req: NextRequest) => mockRequireAuth(req),
}));

// ── Mock Firestore ────────────────────────────────────────────────────────────

const mockGetUser = vi.hoisted(() => vi.fn());
const mockGetCards = vi.hoisted(() => vi.fn());
const mockSetCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (id: string) => mockGetUser(id),
  getCards: (hid: string) => mockGetCards(hid),
  setCards: (cards: Card[]) => mockSetCards(cards),
}));

// ── Mock entitlement store ────────────────────────────────────────────────────

const mockGetStripeEntitlement = vi.hoisted(() => vi.fn());
vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: (sub: string) => mockGetStripeEntitlement(sub),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { GET, PUT } from "@/app/api/sync/route";

// ── Test helpers ──────────────────────────────────────────────────────────────

const TEST_USER_SUB = "google-sub-test-123";
const TEST_HOUSEHOLD_ID = "household-abc";

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/sync", { method: "GET" });
}

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sync", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeCard(id: string, updatedAt: string, householdId = TEST_HOUSEHOLD_ID): Card {
  return {
    id,
    householdId,
    issuerId: "chase",
    cardName: "Sapphire Preferred",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 1000000,
    annualFee: 9500,
    annualFeeDate: "2026-01-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt,
  };
}

function authSuccess() {
  mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: TEST_USER_SUB, email: "test@test.com", name: "Test User" } });
}

function authFail() {
  mockRequireAuth.mockResolvedValue({
    ok: false,
    response: new Response(JSON.stringify({ error: "missing_token" }), { status: 401 }),
  });
}

function karlEntitlement() {
  mockGetStripeEntitlement.mockResolvedValue({ tier: "karl", active: true, stripeCustomerId: "cus_xxx" });
}

function thrallEntitlement() {
  mockGetStripeEntitlement.mockResolvedValue({ tier: "thrall", active: false, stripeCustomerId: "cus_xxx" });
}

function userExists() {
  mockGetUser.mockResolvedValue({ userId: TEST_USER_SUB, householdId: TEST_HOUSEHOLD_ID, email: "t@t.com", displayName: "Test", role: "owner", createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z" });
}

// ── GET /api/sync tests ───────────────────────────────────────────────────────

describe("GET /api/sync — auth guard", () => {
  it("returns 401 when not authenticated", async () => {
    authFail();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });
});

describe("GET /api/sync — Karl gate", () => {
  beforeEach(() => {
    authSuccess();
  });

  it("returns 403 for Thrall user", async () => {
    thrallEntitlement();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("returns 403 when no entitlement found", async () => {
    mockGetStripeEntitlement.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });
});

describe("GET /api/sync — Karl user", () => {
  beforeEach(() => {
    authSuccess();
    karlEntitlement();
    userExists();
  });

  it("returns 200 with cards from Firestore", async () => {
    const cards = [makeCard("c1", "2025-01-01T00:00:00.000Z"), makeCard("c2", "2025-06-01T00:00:00.000Z")];
    mockGetCards.mockResolvedValue(cards);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as { householdId: string; cards: Card[]; syncedAt: string };
    expect(body.householdId).toBe(TEST_HOUSEHOLD_ID);
    expect(body.cards).toHaveLength(2);
    expect(body.syncedAt).toBeDefined();
  });

  it("returns empty cards array when Firestore has no cards", async () => {
    mockGetCards.mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as { cards: Card[] };
    expect(body.cards).toHaveLength(0);
  });

  it("returns 403 when user record not in Firestore", async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("queries getCards with the correct householdId", async () => {
    mockGetCards.mockResolvedValue([]);
    await GET(makeGetRequest());
    expect(mockGetCards).toHaveBeenCalledWith(TEST_HOUSEHOLD_ID);
  });
});

// ── PUT /api/sync tests ───────────────────────────────────────────────────────

describe("PUT /api/sync — auth guard", () => {
  it("returns 401 when not authenticated", async () => {
    authFail();
    const res = await PUT(makePutRequest({ cards: [] }));
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/sync — Karl gate", () => {
  beforeEach(() => {
    authSuccess();
  });

  it("returns 403 for Thrall user", async () => {
    thrallEntitlement();
    const res = await PUT(makePutRequest({ cards: [] }));
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/sync — request validation", () => {
  beforeEach(() => {
    authSuccess();
    karlEntitlement();
    userExists();
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new NextRequest("http://localhost/api/sync", {
      method: "PUT",
      body: "not json",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when cards field is missing", async () => {
    const res = await PUT(makePutRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 when cards is not an array", async () => {
    const res = await PUT(makePutRequest({ cards: "not-an-array" }));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/sync — last-write-wins logic", () => {
  beforeEach(() => {
    authSuccess();
    karlEntitlement();
    userExists();
    mockSetCards.mockResolvedValue(undefined);
  });

  it("writes card when no existing Firestore version", async () => {
    mockGetCards.mockResolvedValue([]); // empty Firestore
    const cards = [makeCard("new-card", "2025-06-01T00:00:00.000Z")];

    const res = await PUT(makePutRequest({ cards }));
    expect(res.status).toBe(200);

    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(1);
    expect(body.skipped).toBe(0);
    expect(mockSetCards).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "new-card" })])
    );
  });

  it("writes card when submitted is newer than Firestore version", async () => {
    mockGetCards.mockResolvedValue([makeCard("shared", "2025-01-01T00:00:00.000Z")]);
    const newerCard = makeCard("shared", "2025-12-01T00:00:00.000Z");

    const res = await PUT(makePutRequest({ cards: [newerCard] }));
    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(1);
    expect(body.skipped).toBe(0);
  });

  it("skips card when submitted is older than Firestore version", async () => {
    mockGetCards.mockResolvedValue([makeCard("shared", "2025-12-01T00:00:00.000Z")]);
    const olderCard = makeCard("shared", "2025-01-01T00:00:00.000Z");

    const res = await PUT(makePutRequest({ cards: [olderCard] }));
    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockSetCards).not.toHaveBeenCalled();
  });

  it("writes card when updatedAt is equal (same timestamp = write)", async () => {
    const ts = "2025-06-01T00:00:00.000Z";
    mockGetCards.mockResolvedValue([makeCard("shared", ts)]);
    const sameCard = makeCard("shared", ts);

    const res = await PUT(makePutRequest({ cards: [sameCard] }));
    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(1);
  });

  it("handles mix of new, newer, and older cards", async () => {
    mockGetCards.mockResolvedValue([
      makeCard("existing-old", "2025-12-01T00:00:00.000Z"),
      makeCard("existing-new", "2025-01-01T00:00:00.000Z"),
    ]);

    const submitted = [
      makeCard("brand-new", "2025-06-01T00:00:00.000Z"),       // new → write
      makeCard("existing-old", "2025-06-01T00:00:00.000Z"),    // older than firestore → skip
      makeCard("existing-new", "2025-12-01T00:00:00.000Z"),    // newer than firestore → write
    ];

    const res = await PUT(makePutRequest({ cards: submitted }));
    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(2);
    expect(body.skipped).toBe(1);
  });

  it("enforces householdId consistency — overwrites card's householdId", async () => {
    mockGetCards.mockResolvedValue([]);
    const wrongHousehold = makeCard("c1", "2025-06-01T00:00:00.000Z", "wrong-household-id");

    await PUT(makePutRequest({ cards: [wrongHousehold] }));

    // setCards should be called with the correct householdId
    expect(mockSetCards).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "c1", householdId: TEST_HOUSEHOLD_ID }),
      ])
    );
  });

  it("skips cards missing id or updatedAt", async () => {
    mockGetCards.mockResolvedValue([]);
    const badCards = [
      { id: "", updatedAt: "2025-06-01T00:00:00.000Z" },
      { id: "c1", updatedAt: "" },
    ];

    const res = await PUT(makePutRequest({ cards: badCards }));
    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(0);
    expect(body.skipped).toBe(2);
    expect(mockSetCards).not.toHaveBeenCalled();
  });

  it("returns syncedAt in response", async () => {
    mockGetCards.mockResolvedValue([]);
    const res = await PUT(makePutRequest({ cards: [] }));
    const body = await res.json() as { syncedAt: string };
    expect(body.syncedAt).toBeDefined();
    expect(new Date(body.syncedAt).getTime()).toBeGreaterThan(0);
  });

  it("does not call setCards when nothing needs to be written", async () => {
    mockGetCards.mockResolvedValue([makeCard("c1", "2025-12-01T00:00:00.000Z")]);
    const olderCard = makeCard("c1", "2025-01-01T00:00:00.000Z");

    await PUT(makePutRequest({ cards: [olderCard] }));
    expect(mockSetCards).not.toHaveBeenCalled();
  });
});

// ── Edge cases (consolidated from sync-route-edge-cases.loki.test.ts) ────────

describe("PUT /api/sync — 403 when user not in Firestore", () => {
  beforeEach(() => {
    authSuccess();
    karlEntitlement();
  });

  it("returns 403 when getUser returns null", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await PUT(makePutRequest({ cards: [] }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("does not call getCards when user not found", async () => {
    mockGetUser.mockResolvedValue(null);
    await PUT(makePutRequest({ cards: [makeCard("c1", "2025-06-01T00:00:00.000Z")] }));
    expect(mockGetCards).not.toHaveBeenCalled();
  });

  it("does not call setCards when user not found", async () => {
    mockGetUser.mockResolvedValue(null);
    await PUT(makePutRequest({ cards: [makeCard("c1", "2025-06-01T00:00:00.000Z")] }));
    expect(mockSetCards).not.toHaveBeenCalled();
  });
});

describe("PUT /api/sync — large batch (500+ cards)", () => {
  beforeEach(() => {
    authSuccess();
    karlEntitlement();
    userExists();
    mockSetCards.mockResolvedValue(undefined);
  });

  it("writes all 500 new cards when Firestore is empty", async () => {
    mockGetCards.mockResolvedValue([]);
    const cards = Array.from({ length: 500 }, (_, i) =>
      makeCard(`card-${i}`, "2025-06-01T00:00:00.000Z")
    );
    const res = await PUT(makePutRequest({ cards }));
    expect(res.status).toBe(200);
    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(500);
    expect(body.skipped).toBe(0);
  });

  it("correctly splits written/skipped in 500-card mixed batch", async () => {
    const existingCards = Array.from({ length: 500 }, (_, i) =>
      makeCard(`card-${i}`, "2025-01-01T00:00:00.000Z")
    );
    mockGetCards.mockResolvedValue(existingCards);
    const submitted = [
      ...Array.from({ length: 250 }, (_, i) =>
        makeCard(`card-${i}`, "2025-12-01T00:00:00.000Z")
      ),
      ...Array.from({ length: 250 }, (_, i) =>
        makeCard(`card-${250 + i}`, "2024-01-01T00:00:00.000Z")
      ),
    ];
    const res = await PUT(makePutRequest({ cards: submitted }));
    expect(res.status).toBe(200);
    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(250);
    expect(body.skipped).toBe(250);
  });
});

describe("PUT /api/sync — empty card array (edge case)", () => {
  beforeEach(() => {
    authSuccess();
    karlEntitlement();
    userExists();
    mockGetCards.mockResolvedValue([]);
    mockSetCards.mockResolvedValue(undefined);
  });

  it("returns 200 with written:0, skipped:0", async () => {
    const res = await PUT(makePutRequest({ cards: [] }));
    expect(res.status).toBe(200);
    const body = await res.json() as { written: number; skipped: number; householdId: string; syncedAt: string };
    expect(body.written).toBe(0);
    expect(body.skipped).toBe(0);
    expect(body.householdId).toBe(TEST_HOUSEHOLD_ID);
    expect(body.syncedAt).toBeDefined();
  });

  it("does not call setCards for empty array", async () => {
    await PUT(makePutRequest({ cards: [] }));
    expect(mockSetCards).not.toHaveBeenCalled();
  });
});

describe("GET /api/sync — response shape", () => {
  beforeEach(() => {
    authSuccess();
    karlEntitlement();
    userExists();
  });

  it("response includes householdId, cards, and valid ISO syncedAt", async () => {
    mockGetCards.mockResolvedValue([makeCard("c1", "2025-06-01T00:00:00.000Z")]);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { householdId: string; cards: Card[]; syncedAt: string };
    expect(typeof body.householdId).toBe("string");
    expect(Array.isArray(body.cards)).toBe(true);
    expect(body.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
