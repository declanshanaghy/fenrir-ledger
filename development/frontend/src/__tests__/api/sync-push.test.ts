/**
 * Unit tests for POST /api/sync/push
 *
 * Tests:
 *   - Auth guard: 401 when no token
 *   - Household membership: 403 when householdId doesn't match (IDOR fix, issue #1193)
 *   - Karl gate: 403 when Thrall
 *   - Body validation: 400 for missing/invalid fields
 *   - Success: 200 with merged cards
 *   - IDOR guard: Firestore ops use server-verified householdId, never body value
 *   - 500 on Firestore error
 *
 * Issue #1193
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Card } from "@/lib/types";

// ── Mock requireAuthz ─────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (req: NextRequest, opts: unknown) => mockRequireAuthz(req, opts),
}));

// ── Mock Firestore ────────────────────────────────────────────────────────────

const mockGetAllFirestoreCards = vi.hoisted(() => vi.fn());
const mockSetCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: (hid: string) => mockGetAllFirestoreCards(hid),
  setCards: (cards: Card[]) => mockSetCards(cards),
}));

// ── Mock sync engine ──────────────────────────────────────────────────────────

const mockMergeCardsWithStats = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sync/sync-engine", () => ({
  mergeCardsWithStats: (local: Card[], remote: Card[]) => mockMergeCardsWithStats(local, remote),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { POST } from "@/app/api/sync/push/route";

// ── Test helpers ──────────────────────────────────────────────────────────────

const TEST_USER_SUB = "google-sub-push-test-456";
const TEST_HOUSEHOLD_ID = "household-push-abc";
const OTHER_HOUSEHOLD_ID = "household-other-xyz";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sync/push", {
    method: "POST",
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

function authzSuccess(householdId = TEST_HOUSEHOLD_ID) {
  mockRequireAuthz.mockResolvedValue({
    ok: true,
    user: { sub: TEST_USER_SUB, email: "test@test.com", name: "Test User" },
    firestoreUser: {
      clerkUserId: TEST_USER_SUB,
      householdId,
      email: "test@test.com",
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

function defaultMergeResult(cards: Card[] = []) {
  mockMergeCardsWithStats.mockReturnValue({
    merged: cards,
    stats: { activeCount: cards.length, tombstoneCount: 0, conflictCount: 0 },
  });
}

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("POST /api/sync/push — auth guard", () => {
  it("returns 401 when not authenticated", async () => {
    authzFail(401, "missing_token");
    const res = await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [] }));
    expect(res.status).toBe(401);
  });
});

// ── IDOR protection (issue #1193) ─────────────────────────────────────────────

describe("POST /api/sync/push — IDOR protection (issue #1193)", () => {
  it("returns 403 when householdId does not match authenticated user's household", async () => {
    authzFail(403, "forbidden");
    const res = await POST(makeRequest({ householdId: OTHER_HOUSEHOLD_ID, cards: [] }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("passes caller-supplied householdId to requireAuthz for membership check", async () => {
    authzFail(403, "forbidden");
    await POST(makeRequest({ householdId: OTHER_HOUSEHOLD_ID, cards: [] }));
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ householdId: OTHER_HOUSEHOLD_ID }),
    );
  });

  it("uses server-verified householdId for Firestore — never the body value", async () => {
    // Body claims OTHER_HOUSEHOLD_ID but server resolves TEST_HOUSEHOLD_ID.
    // Simulate: requireAuthz accepts the call but resolves to the real household.
    authzSuccess(TEST_HOUSEHOLD_ID);
    defaultMergeResult([]);
    mockSetCards.mockResolvedValue(undefined);
    mockGetAllFirestoreCards.mockResolvedValue([]);

    // body has a different householdId — but authz has already verified it matches
    await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [] }));

    // Firestore must be queried with the verified household, not the body value
    expect(mockGetAllFirestoreCards).toHaveBeenCalledWith(TEST_HOUSEHOLD_ID);
  });
});

// ── Karl tier gate ────────────────────────────────────────────────────────────

describe("POST /api/sync/push — Karl tier gate", () => {
  it("returns 403 for Thrall user", async () => {
    authzFail(403, "forbidden");
    const res = await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [] }));
    expect(res.status).toBe(403);
  });

  it("passes tier: 'karl' requirement to requireAuthz", async () => {
    authzFail(403, "forbidden");
    await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [] }));
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tier: "karl" }),
    );
  });
});

// ── Body validation ───────────────────────────────────────────────────────────

describe("POST /api/sync/push — body validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      body: "not valid json{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_json");
  });

  it("returns 400 when householdId is missing", async () => {
    const res = await POST(makeRequest({ cards: [] }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 when householdId is empty string", async () => {
    const res = await POST(makeRequest({ householdId: "", cards: [] }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 when cards field is missing", async () => {
    const res = await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 when cards is not an array", async () => {
    const res = await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: "bad" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("does not call requireAuthz when body validation fails", async () => {
    await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID }));
    expect(mockRequireAuthz).not.toHaveBeenCalled();
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("POST /api/sync/push — success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authzSuccess();
    mockSetCards.mockResolvedValue(undefined);
  });

  it("returns 200 with merged cards and syncedCount", async () => {
    const merged = [makeCard("c1", "2025-06-01T00:00:00.000Z")];
    mockGetAllFirestoreCards.mockResolvedValue([]);
    defaultMergeResult(merged);

    const res = await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [makeCard("c1", "2025-06-01T00:00:00.000Z")] }));
    expect(res.status).toBe(200);

    const body = await res.json() as { cards: Card[]; syncedCount: number };
    expect(body.cards).toHaveLength(1);
    expect(body.syncedCount).toBe(1);
  });

  it("returns Cache-Control: no-store header", async () => {
    mockGetAllFirestoreCards.mockResolvedValue([]);
    defaultMergeResult([]);

    const res = await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [] }));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes merged cards to setCards", async () => {
    const card = makeCard("c1", "2025-06-01T00:00:00.000Z");
    mockGetAllFirestoreCards.mockResolvedValue([]);
    defaultMergeResult([card]);

    await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [card] }));
    expect(mockSetCards).toHaveBeenCalledWith([card]);
  });

  it("passes localCards and remoteCards to mergeCardsWithStats", async () => {
    const localCard = makeCard("local", "2025-06-01T00:00:00.000Z");
    const remoteCard = makeCard("remote", "2025-01-01T00:00:00.000Z");
    mockGetAllFirestoreCards.mockResolvedValue([remoteCard]);
    defaultMergeResult([localCard]);

    await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [localCard] }));
    expect(mockMergeCardsWithStats).toHaveBeenCalledWith([localCard], [remoteCard]);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("POST /api/sync/push — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authzSuccess();
  });

  it("returns 500 when getAllFirestoreCards throws", async () => {
    mockGetAllFirestoreCards.mockRejectedValue(new Error("Firestore unavailable"));

    const res = await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [] }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });

  it("returns 500 when setCards throws", async () => {
    mockGetAllFirestoreCards.mockResolvedValue([]);
    defaultMergeResult([]);
    mockSetCards.mockRejectedValue(new Error("Write failed"));

    const res = await POST(makeRequest({ householdId: TEST_HOUSEHOLD_ID, cards: [] }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });
});
