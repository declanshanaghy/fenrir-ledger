/**
 * Loki QA — /api/sync route edge cases (issue #1119)
 *
 * Gaps NOT covered by the main sync.test.ts:
 *   - PUT /api/sync: 404 when user record not found in Firestore
 *   - PUT /api/sync: large batch (500+ cards) — all written when all are new
 *   - PUT /api/sync: large batch mixed (250 newer + 250 older) — correct counts
 *   - GET /api/sync: response shape includes all required fields
 *   - PUT /api/sync: empty card array → written:0, skipped:0 (no setCards call)
 *
 * Issue #1119
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Card } from "@/lib/types";

// ── Mock requireAuth ───────────────────────────────────────────────────────────

const mockRequireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (req: NextRequest) => mockRequireAuth(req),
}));

// ── Mock Firestore ─────────────────────────────────────────────────────────────

const mockGetUser = vi.hoisted(() => vi.fn());
const mockGetCards = vi.hoisted(() => vi.fn());
const mockSetCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (id: string) => mockGetUser(id),
  getCards: (hid: string) => mockGetCards(hid),
  setCards: (cards: Card[]) => mockSetCards(cards),
}));

// ── Mock entitlement store ─────────────────────────────────────────────────────

const mockGetStripeEntitlement = vi.hoisted(() => vi.fn());
vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: (sub: string) => mockGetStripeEntitlement(sub),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { GET, PUT } from "@/app/api/sync/route";

// ── Constants ──────────────────────────────────────────────────────────────────

const TEST_USER_SUB = "google-sub-loki-edge";
const TEST_HOUSEHOLD_ID = "household-loki-edge";

// ── Helpers ────────────────────────────────────────────────────────────────────

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
    issuerId: "amex",
    cardName: "Gold Card",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 500000,
    annualFee: 25000,
    annualFeeDate: "2026-01-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt,
  };
}

function authSuccess(): void {
  mockRequireAuth.mockResolvedValue({
    ok: true,
    user: { sub: TEST_USER_SUB, email: "loki@test.com", name: "Loki" },
  });
}

function karlEntitlement(): void {
  mockGetStripeEntitlement.mockResolvedValue({ tier: "karl", active: true, stripeCustomerId: "cus_loki" });
}

function userExists(): void {
  mockGetUser.mockResolvedValue({
    clerkUserId: TEST_USER_SUB,
    householdId: TEST_HOUSEHOLD_ID,
    email: "loki@test.com",
    displayName: "Loki",
    role: "owner",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  authSuccess();
  karlEntitlement();
});

// ── PUT 404: user not found ────────────────────────────────────────────────────

describe("PUT /api/sync — 403 when user not in Firestore", () => {
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

// ── Large batch: 500+ cards ────────────────────────────────────────────────────

describe("PUT /api/sync — large batch (500+ cards)", () => {
  beforeEach(() => {
    userExists();
    mockSetCards.mockResolvedValue(undefined);
  });

  it("writes all 500 new cards when Firestore is empty", async () => {
    mockGetCards.mockResolvedValue([]); // empty Firestore

    const cards = Array.from({ length: 500 }, (_, i) =>
      makeCard(`card-${i}`, "2025-06-01T00:00:00.000Z")
    );

    const res = await PUT(makePutRequest({ cards }));
    expect(res.status).toBe(200);

    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(500);
    expect(body.skipped).toBe(0);
    expect(mockSetCards).toHaveBeenCalledTimes(1);
    // setCards called with all 500 cards
    const writtenCards = (mockSetCards.mock.calls[0] as [Card[]])[0];
    expect(writtenCards).toHaveLength(500);
  });

  it("correctly splits written/skipped in 500-card mixed batch", async () => {
    const BATCH_SIZE = 500;
    const NEWER_COUNT = 250;
    const OLDER_COUNT = 250;

    // Firestore has older versions of all 500 cards
    const existingCards = Array.from({ length: BATCH_SIZE }, (_, i) =>
      makeCard(`card-${i}`, "2025-01-01T00:00:00.000Z")
    );
    mockGetCards.mockResolvedValue(existingCards);

    // Submit: first 250 are newer (will be written), last 250 are older (will be skipped)
    const submitted = [
      ...Array.from({ length: NEWER_COUNT }, (_, i) =>
        makeCard(`card-${i}`, "2025-12-01T00:00:00.000Z") // newer → write
      ),
      ...Array.from({ length: OLDER_COUNT }, (_, i) =>
        makeCard(`card-${NEWER_COUNT + i}`, "2024-01-01T00:00:00.000Z") // older → skip
      ),
    ];

    const res = await PUT(makePutRequest({ cards: submitted }));
    expect(res.status).toBe(200);

    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(NEWER_COUNT);
    expect(body.skipped).toBe(OLDER_COUNT);
  });

  it("all 500 cards skipped when all are older than Firestore versions", async () => {
    const existingCards = Array.from({ length: 500 }, (_, i) =>
      makeCard(`card-${i}`, "2025-12-01T00:00:00.000Z") // latest in Firestore
    );
    mockGetCards.mockResolvedValue(existingCards);

    const submitted = Array.from({ length: 500 }, (_, i) =>
      makeCard(`card-${i}`, "2024-01-01T00:00:00.000Z") // all older
    );

    const res = await PUT(makePutRequest({ cards: submitted }));
    expect(res.status).toBe(200);

    const body = await res.json() as { written: number; skipped: number };
    expect(body.written).toBe(0);
    expect(body.skipped).toBe(500);
    expect(mockSetCards).not.toHaveBeenCalled();
  });
});

// ── GET response shape ─────────────────────────────────────────────────────────

describe("GET /api/sync — response shape", () => {
  beforeEach(() => {
    userExists();
  });

  it("response includes householdId, cards, and syncedAt", async () => {
    mockGetCards.mockResolvedValue([makeCard("c1", "2025-06-01T00:00:00.000Z")]);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as { householdId: string; cards: Card[]; syncedAt: string };
    expect(typeof body.householdId).toBe("string");
    expect(Array.isArray(body.cards)).toBe(true);
    expect(typeof body.syncedAt).toBe("string");
    expect(new Date(body.syncedAt).getTime()).toBeGreaterThan(0);
  });

  it("syncedAt is a valid ISO 8601 timestamp", async () => {
    mockGetCards.mockResolvedValue([]);
    const res = await GET(makeGetRequest());
    const body = await res.json() as { syncedAt: string };
    const ts = new Date(body.syncedAt);
    expect(isNaN(ts.getTime())).toBe(false);
    expect(body.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ── PUT empty card array ───────────────────────────────────────────────────────

describe("PUT /api/sync — empty card array", () => {
  beforeEach(() => {
    userExists();
    mockGetCards.mockResolvedValue([]);
    mockSetCards.mockResolvedValue(undefined);
  });

  it("returns 200 with written:0, skipped:0 for empty cards array", async () => {
    const res = await PUT(makePutRequest({ cards: [] }));
    expect(res.status).toBe(200);

    const body = await res.json() as { written: number; skipped: number; householdId: string; syncedAt: string };
    expect(body.written).toBe(0);
    expect(body.skipped).toBe(0);
    expect(body.householdId).toBe(TEST_HOUSEHOLD_ID);
    expect(body.syncedAt).toBeDefined();
  });

  it("does not call setCards when cards array is empty", async () => {
    await PUT(makePutRequest({ cards: [] }));
    expect(mockSetCards).not.toHaveBeenCalled();
  });
});

// ── PUT householdId enforcement on large batch ─────────────────────────────────

describe("PUT /api/sync — householdId enforcement on all written cards", () => {
  beforeEach(() => {
    userExists();
    mockGetCards.mockResolvedValue([]);
    mockSetCards.mockResolvedValue(undefined);
  });

  it("all written cards have the user's householdId (not the submitted householdId)", async () => {
    const cards = Array.from({ length: 10 }, (_, i) =>
      makeCard(`card-${i}`, "2025-06-01T00:00:00.000Z", "wrong-household-from-client")
    );

    await PUT(makePutRequest({ cards }));

    const writtenCards = (mockSetCards.mock.calls[0] as [Card[]])[0];
    for (const card of writtenCards) {
      expect(card.householdId).toBe(TEST_HOUSEHOLD_ID);
    }
  });
});
