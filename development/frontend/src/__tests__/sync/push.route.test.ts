/**
 * Unit tests for POST /api/sync/push route.
 *
 * Validates:
 *   - 400 for invalid/missing body fields (checked before auth)
 *   - 401 when not authenticated (via requireAuthz)
 *   - 403 for Thrall users (Karl-only gate, via requireAuthz)
 *   - 403 when householdId does not match user's household (IDOR, SEV-002)
 *   - 200 with merged cards for Karl users
 *   - Tombstone propagation in the push response
 *   - Firestore is always called with authz.firestoreUser.householdId (never raw body param)
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
const mockSetCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: mockGetAllFirestoreCards,
  setCards: mockSetCards,
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { POST } from "@/app/api/sync/push/route";
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
    clerkUserId: "google-user-123",
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
    user: { sub: "google-user-123", email: "test@example.com" },
    firestoreUser: makeFirestoreUser(householdId),
  };
}

function authzFailure(status: number, error: string) {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error }), { status }),
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sync/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSetCards.mockResolvedValue(undefined);
  mockGetAllFirestoreCards.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/sync/push — body validation (checked before auth)", () => {
  it("returns 400 when body is not valid JSON", async () => {
    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_json");
    expect(mockRequireAuthz).not.toHaveBeenCalled();
  });

  it("returns 400 when householdId is missing", async () => {
    const res = await POST(makeRequest({ cards: [] }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
    expect(mockRequireAuthz).not.toHaveBeenCalled();
  });

  it("returns 400 when cards is not an array", async () => {
    const res = await POST(makeRequest({ householdId: "hh", cards: "not-an-array" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
    expect(mockRequireAuthz).not.toHaveBeenCalled();
  });
});

describe("POST /api/sync/push — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuthz.mockResolvedValue(authzFailure(401, "missing_token"));
    const res = await POST(makeRequest({ householdId: "hh", cards: [] }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/sync/push — Karl gate", () => {
  it("returns 403 for Thrall / non-Karl user", async () => {
    mockRequireAuthz.mockResolvedValue(authzFailure(403, "forbidden"));
    const res = await POST(makeRequest({ householdId: "hh", cards: [] }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });
});

describe("POST /api/sync/push — IDOR protection (SEV-002)", () => {
  it("returns 403 when householdId does not match user's household", async () => {
    // requireAuthz detects household_mismatch and returns 403
    mockRequireAuthz.mockResolvedValue(authzFailure(403, "forbidden"));

    const res = await POST(makeRequest({ householdId: "another-household-id", cards: [] }));
    expect(res.status).toBe(403);
  });

  it("requireAuthz is called with the supplied householdId for membership check", async () => {
    mockRequireAuthz.mockResolvedValue(authzSuccess("hh-test"));

    await POST(makeRequest({ householdId: "hh-test", cards: [] }));

    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ householdId: "hh-test", tier: "karl" }),
    );
  });

  it("Firestore is called with authz.firestoreUser.householdId, not the raw body param", async () => {
    // The route must use firestoreUser.householdId ("real-hh"), not the body param ("hh-test")
    mockRequireAuthz.mockResolvedValue(authzSuccess("real-hh"));

    await POST(makeRequest({ householdId: "hh-test", cards: [] }));

    expect(mockGetAllFirestoreCards).toHaveBeenCalledWith("real-hh");
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalledWith("hh-test");
  });
});

describe("POST /api/sync/push — merge and response", () => {
  beforeEach(() => {
    mockRequireAuthz.mockResolvedValue(authzSuccess("hh-test"));
  });

  it("returns 200 with merged cards when both sides empty", async () => {
    mockGetAllFirestoreCards.mockResolvedValue([]);
    const res = await POST(makeRequest({ householdId: "hh-test", cards: [] }));
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[]; syncedCount: number };
    expect(body.cards).toEqual([]);
    expect(body.syncedCount).toBe(0);
  });

  it("returns 200 with local cards when remote is empty", async () => {
    mockGetAllFirestoreCards.mockResolvedValue([]);
    const local = [makeCard({ id: "l1" }), makeCard({ id: "l2" })];
    const res = await POST(makeRequest({ householdId: "hh-test", cards: local }));
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[]; syncedCount: number };
    expect(body.cards).toHaveLength(2);
    expect(body.syncedCount).toBe(2);
  });

  it("LWW: local card wins when local is newer", async () => {
    const id = "conflict-card";
    const remote = makeCard({
      id,
      cardName: "Remote",
      updatedAt: "2025-06-01T00:00:00.000Z",
    });
    mockGetAllFirestoreCards.mockResolvedValue([remote]);

    const local = makeCard({
      id,
      cardName: "Local",
      updatedAt: "2025-06-10T00:00:00.000Z",
    });
    const res = await POST(makeRequest({ householdId: "hh-test", cards: [local] }));
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[] };
    expect(body.cards[0]?.cardName).toBe("Local");
  });

  it("LWW: remote card wins when remote is newer", async () => {
    const id = "conflict-card";
    const remote = makeCard({
      id,
      cardName: "Remote",
      updatedAt: "2025-06-10T00:00:00.000Z",
    });
    mockGetAllFirestoreCards.mockResolvedValue([remote]);

    const local = makeCard({
      id,
      cardName: "Local",
      updatedAt: "2025-06-01T00:00:00.000Z",
    });
    const res = await POST(makeRequest({ householdId: "hh-test", cards: [local] }));
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[] };
    expect(body.cards[0]?.cardName).toBe("Remote");
  });

  it("tombstone propagates: local deletion beats older remote update", async () => {
    const id = "tombstone-card";
    const remote = makeCard({
      id,
      updatedAt: "2025-06-05T00:00:00.000Z",
    });
    mockGetAllFirestoreCards.mockResolvedValue([remote]);

    const local = makeCard({
      id,
      updatedAt: "2025-06-01T00:00:00.000Z",
      deletedAt: "2025-06-10T00:00:00.000Z",
    });
    const res = await POST(makeRequest({ householdId: "hh-test", cards: [local] }));
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[]; syncedCount: number };
    expect(body.cards[0]?.deletedAt).toBe("2025-06-10T00:00:00.000Z");
    expect(body.syncedCount).toBe(0);
  });

  it("tombstone propagates: remote deletion beats older local update", async () => {
    const id = "tombstone-card";
    const remote = makeCard({
      id,
      updatedAt: "2025-06-01T00:00:00.000Z",
      deletedAt: "2025-06-10T00:00:00.000Z",
    });
    mockGetAllFirestoreCards.mockResolvedValue([remote]);

    const local = makeCard({
      id,
      updatedAt: "2025-06-05T00:00:00.000Z",
    });
    const res = await POST(makeRequest({ householdId: "hh-test", cards: [local] }));
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[]; syncedCount: number };
    expect(body.cards[0]?.deletedAt).toBe("2025-06-10T00:00:00.000Z");
    expect(body.syncedCount).toBe(0);
  });

  it("calls setCards with merged result", async () => {
    mockGetAllFirestoreCards.mockResolvedValue([]);
    const local = [makeCard({ id: "c1" })];
    await POST(makeRequest({ householdId: "hh-test", cards: local }));
    expect(mockSetCards).toHaveBeenCalledOnce();
    const savedCards = mockSetCards.mock.calls[0]?.[0] as Card[];
    expect(savedCards).toHaveLength(1);
  });

  it("returns 500 when Firestore throws", async () => {
    mockGetAllFirestoreCards.mockRejectedValue(new Error("Firestore unavailable"));
    const res = await POST(makeRequest({ householdId: "hh-test", cards: [] }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });
});
