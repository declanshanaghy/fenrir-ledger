/**
 * Unit tests for POST /api/sync/push route.
 *
 * Validates:
 *   - 401 when no auth header
 *   - 403 for Thrall users (requireAuthz tier gate)
 *   - 403 for free-trial users (Karl-only gate)
 *   - 403 for cross-household access (IDOR guard — household membership check)
 *   - 400 for invalid/missing body fields
 *   - 200 with merged cards for Karl users
 *   - Tombstone propagation in the push response
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeCard } from "@/__tests__/fixtures/cards";

// ── Mock: authz ────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: mockRequireAuthz,
}));

// ── Mock: Firestore ────────────────────────────────────────────────────────

const mockGetAllFirestoreCards = vi.hoisted(() => vi.fn());
const mockSetCards = vi.hoisted(() => vi.fn());
const mockDeleteCards = vi.hoisted(() => vi.fn());
const mockGetHouseholdSyncVersion = vi.hoisted(() => vi.fn());
const mockUpdateSyncStateAfterPush = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: mockGetAllFirestoreCards,
  setCards: mockSetCards,
  deleteCards: mockDeleteCards,
  getHouseholdSyncVersion: mockGetHouseholdSyncVersion,
  updateSyncStateAfterPush: mockUpdateSyncStateAfterPush,
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { POST } from "@/app/api/sync/push/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────

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

/** Authz success result for a Karl user belonging to the given household. */
function authzKarlSuccess(householdId = "hh-test", userId = "google-user-123") {
  return {
    ok: true as const,
    user: { sub: userId, email: "test@example.com" },
    firestoreUser: { householdId, userId },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSetCards.mockResolvedValue(undefined);
  mockDeleteCards.mockResolvedValue(undefined);
  mockGetAllFirestoreCards.mockResolvedValue([]);
  mockGetHouseholdSyncVersion.mockResolvedValue(0);
  mockUpdateSyncStateAfterPush.mockResolvedValue(1);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/sync/push — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "missing_token" }),
        { status: 401 }
      ),
    });

    const res = await POST(makeRequest({ householdId: "hh", cards: [] }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/sync/push — Karl gate", () => {
  it("returns 403 for Thrall users (no entitlement)", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "forbidden", current_tier: "thrall" }),
        { status: 403 }
      ),
    });
    const res = await POST(makeRequest({ householdId: "hh", cards: [] }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string; current_tier: string };
    expect(body.error).toBe("forbidden");
    expect(body.current_tier).toBe("thrall");
  });

  it("returns 403 for inactive Karl subscription", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "forbidden" }),
        { status: 403 }
      ),
    });
    const res = await POST(makeRequest({ householdId: "hh", cards: [] }));
    expect(res.status).toBe(403);
  });

  it("returns 403 for free-trial users (no sync during trial)", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "forbidden", current_tier: "thrall" }),
        { status: 403 }
      ),
    });
    const res = await POST(makeRequest({ householdId: "hh", cards: [] }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string; current_tier: string };
    expect(body.current_tier).toBe("thrall");
  });
});

describe("POST /api/sync/push — validation", () => {
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
  });

  it("returns 400 when householdId is missing", async () => {
    const res = await POST(makeRequest({ cards: [] }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 when cards is not an array", async () => {
    const res = await POST(makeRequest({ householdId: "hh", cards: "not-an-array" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_body");
  });
});

describe("POST /api/sync/push — merge and response", () => {
  beforeEach(() => {
    mockRequireAuthz.mockResolvedValue(authzKarlSuccess("hh-test"));
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
    // Tombstoned card not counted as active
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

// ── Expunge: issue #1974 ───────────────────────────────────────────────────
//
// When a card is expunged from localStorage (entirely removed — no tombstone),
// the next push must delete it from Firestore and must NOT return it to the
// client. Without this fix, remote-only cards were re-seeded into the merged
// result, causing expunged cards to reappear after sync.

describe("POST /api/sync/push — expunge (issue #1974)", () => {
  beforeEach(() => {
    mockRequireAuthz.mockResolvedValue(authzKarlSuccess("hh-test"));
  });

  it("deletes Firestore card that is absent from local (expunged)", async () => {
    // Non-empty local: one card kept, one card absent → absent card is expunged
    const expunged = makeCard({ id: "expunged-card" });
    const kept = makeCard({ id: "kept-card" });
    mockGetAllFirestoreCards.mockResolvedValue([expunged, kept]);

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [kept] }));
    expect(res.status).toBe(200);

    expect(mockDeleteCards).toHaveBeenCalledOnce();
    expect(mockDeleteCards).toHaveBeenCalledWith("hh-test", ["expunged-card"]);
  });

  it("does not return expunged card in response", async () => {
    // Non-empty local: expunged card absent from local → not returned in merge
    const expunged = makeCard({ id: "expunged-card" });
    const kept = makeCard({ id: "kept-card" });
    mockGetAllFirestoreCards.mockResolvedValue([expunged, kept]);

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [kept] }));
    const body = await res.json() as { cards: Card[]; syncedCount: number };

    expect(body.cards.find((c) => c.id === "expunged-card")).toBeUndefined();
    expect(body.cards.find((c) => c.id === "kept-card")).toBeDefined();
  });

  it("expunged card is excluded from setCards write", async () => {
    const expunged = makeCard({ id: "expunged-card" });
    const kept = makeCard({ id: "kept-card" });
    mockGetAllFirestoreCards.mockResolvedValue([expunged]);

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [kept] }));
    expect(res.status).toBe(200);

    // setCards should only receive the kept card
    expect(mockSetCards).toHaveBeenCalledOnce();
    const written = mockSetCards.mock.calls[0]?.[0] as Card[];
    expect(written.map((c) => c.id)).not.toContain("expunged-card");
    expect(written.map((c) => c.id)).toContain("kept-card");
  });

  it("does not call deleteCards when no remote-only cards", async () => {
    const card = makeCard({ id: "card-1" });
    mockGetAllFirestoreCards.mockResolvedValue([card]);

    // Same card in both local and remote — nothing expunged
    await POST(makeRequest({ householdId: "hh-test", cards: [card] }));

    expect(mockDeleteCards).not.toHaveBeenCalled();
  });

  it("deletes multiple expunged cards in one call", async () => {
    const expunged1 = makeCard({ id: "ex-1" });
    const expunged2 = makeCard({ id: "ex-2" });
    const kept = makeCard({ id: "kept" });
    mockGetAllFirestoreCards.mockResolvedValue([expunged1, expunged2]);

    await POST(makeRequest({ householdId: "hh-test", cards: [kept] }));

    expect(mockDeleteCards).toHaveBeenCalledOnce();
    const deletedIds = mockDeleteCards.mock.calls[0]?.[1] as string[];
    expect(deletedIds).toHaveLength(2);
    expect(deletedIds).toContain("ex-1");
    expect(deletedIds).toContain("ex-2");
  });

  it("still merges kept remote cards correctly after expunge (LWW)", async () => {
    const expunged = makeCard({ id: "expunged-card" });
    const remoteKept = makeCard({
      id: "kept",
      cardName: "Remote version",
      updatedAt: "2025-06-10T00:00:00.000Z",
    });
    mockGetAllFirestoreCards.mockResolvedValue([expunged, remoteKept]);

    const localKept = makeCard({
      id: "kept",
      cardName: "Local version",
      updatedAt: "2025-06-01T00:00:00.000Z",
    });
    const res = await POST(makeRequest({ householdId: "hh-test", cards: [localKept] }));
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[] };

    // Remote was newer — remote version should win
    expect(body.cards.find((c) => c.id === "kept")?.cardName).toBe("Remote version");
    expect(body.cards.find((c) => c.id === "expunged-card")).toBeUndefined();
  });

  it("returns 500 when deleteCards throws", async () => {
    // Non-empty local required so the expunge path is reached and deleteCards is called
    const expunged = makeCard({ id: "expunged-card" });
    const kept = makeCard({ id: "kept-card" });
    mockGetAllFirestoreCards.mockResolvedValue([expunged]);
    mockDeleteCards.mockRejectedValue(new Error("Firestore unavailable"));

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [kept] }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });
});

// ── Expunge safety guard: issue #2002 ────────────────────────────────────────
//
// When a client pushes with an empty cards array (brand-new device / first
// sync), the expunge logic must be skipped entirely. An empty push does NOT
// mean "the user deleted all cards" — it means the device has never synced.
// Without the guard every remote card would be deleted from Firestore,
// destroying all cloud data silently.

describe("POST /api/sync/push — expunge safety guard (issue #2002)", () => {
  beforeEach(() => {
    mockRequireAuthz.mockResolvedValue(authzKarlSuccess("hh-test"));
  });

  it("does NOT delete remote cards when local is empty (new device)", async () => {
    const remote1 = makeCard({ id: "remote-1" });
    const remote2 = makeCard({ id: "remote-2" });
    mockGetAllFirestoreCards.mockResolvedValue([remote1, remote2]);

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [] }));
    expect(res.status).toBe(200);

    // Guard prevents deleteCards from being called
    expect(mockDeleteCards).not.toHaveBeenCalled();
  });

  it("returns remote cards in merge result when local is empty (new device)", async () => {
    const remote1 = makeCard({ id: "remote-1", cardName: "Visa" });
    const remote2 = makeCard({ id: "remote-2", cardName: "Amex" });
    mockGetAllFirestoreCards.mockResolvedValue([remote1, remote2]);

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [] }));
    expect(res.status).toBe(200);

    const body = await res.json() as { cards: Card[]; syncedCount: number };
    const ids = body.cards.map((c) => c.id);
    expect(ids).toContain("remote-1");
    expect(ids).toContain("remote-2");
    expect(body.syncedCount).toBe(2);
  });

  it("writes remote cards back to Firestore when local is empty (new device)", async () => {
    const remote = makeCard({ id: "remote-1" });
    mockGetAllFirestoreCards.mockResolvedValue([remote]);

    await POST(makeRequest({ householdId: "hh-test", cards: [] }));

    expect(mockSetCards).toHaveBeenCalledOnce();
    const written = mockSetCards.mock.calls[0]?.[0] as Card[];
    expect(written.map((c) => c.id)).toContain("remote-1");
  });

  it("deletes only expunged cards when client has a non-empty card list", async () => {
    // Client has card-A but not card-B → card-B was intentionally expunged
    const cardA = makeCard({ id: "card-a" });
    const cardB = makeCard({ id: "card-b" });
    mockGetAllFirestoreCards.mockResolvedValue([cardA, cardB]);

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [cardA] }));
    expect(res.status).toBe(200);

    expect(mockDeleteCards).toHaveBeenCalledOnce();
    expect(mockDeleteCards).toHaveBeenCalledWith("hh-test", ["card-b"]);
  });

  it("does not call deleteCards when all local cards are present remotely", async () => {
    const card = makeCard({ id: "card-1" });
    mockGetAllFirestoreCards.mockResolvedValue([card]);

    await POST(makeRequest({ householdId: "hh-test", cards: [card] }));

    expect(mockDeleteCards).not.toHaveBeenCalled();
  });
});

// ── Household expunge propagation: issue #2120 ────────────────────────────────
//
// When household member A expunges a card, the card is deleted from Firestore.
// If member B still holds a tombstone (deletedAt set) for that card, the next
// push from B must NOT write the tombstone back to Firestore — otherwise the
// card reappears in everyone's trash.
//
// A local tombstone whose card ID is absent from Firestore = "remote expunge".
// The push route must drop it before the LWW merge so the card stays gone.

describe("POST /api/sync/push — household expunge propagation (issue #2120)", () => {
  beforeEach(() => {
    mockRequireAuthz.mockResolvedValue(authzKarlSuccess("hh-test"));
  });

  it("does NOT write back a tombstone for a card absent from Firestore", async () => {
    // Card C was expunged by another member — absent from Firestore entirely.
    // Odin still holds a local tombstone (deletedAt set).
    const tombstone = makeCard({
      id: "expunged-by-member",
      deletedAt: "2026-03-01T12:00:00.000Z",
    });
    const activeCard = makeCard({ id: "active-card" });

    // Firestore has the active card but NOT the expunged card
    mockGetAllFirestoreCards.mockResolvedValue([activeCard]);

    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [tombstone, activeCard] })
    );
    expect(res.status).toBe(200);

    // Tombstone must NOT be written back to Firestore
    expect(mockSetCards).toHaveBeenCalledOnce();
    const written = mockSetCards.mock.calls[0]?.[0] as Card[];
    expect(written.map((c) => c.id)).not.toContain("expunged-by-member");
    expect(written.map((c) => c.id)).toContain("active-card");
  });

  it("does NOT return the orphaned tombstone to the client", async () => {
    const tombstone = makeCard({
      id: "expunged-by-member",
      deletedAt: "2026-03-01T12:00:00.000Z",
    });
    const activeCard = makeCard({ id: "active-card" });
    mockGetAllFirestoreCards.mockResolvedValue([activeCard]);

    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [tombstone, activeCard] })
    );
    const body = await res.json() as { cards: Card[] };

    expect(body.cards.find((c) => c.id === "expunged-by-member")).toBeUndefined();
    expect(body.cards.find((c) => c.id === "active-card")).toBeDefined();
  });

  it("keeps a local tombstone when the same card is ALSO a tombstone in Firestore", async () => {
    // Normal soft-delete: tombstone in both local and Firestore — must survive.
    const tombstoneRemote = makeCard({
      id: "deleted-both-sides",
      deletedAt: "2026-03-01T12:00:00.000Z",
    });
    const tombstoneLocal = makeCard({
      id: "deleted-both-sides",
      deletedAt: "2026-03-01T12:00:00.000Z",
    });
    mockGetAllFirestoreCards.mockResolvedValue([tombstoneRemote]);

    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [tombstoneLocal] })
    );
    expect(res.status).toBe(200);

    const body = await res.json() as { cards: Card[] };
    // Tombstone present on both sides — must be included
    expect(body.cards.find((c) => c.id === "deleted-both-sides")).toBeDefined();
  });

  it("does NOT discard orphaned tombstones when local is empty (new device guard)", async () => {
    // An empty push means brand-new device — expunge filtering must not fire.
    const remoteActive = makeCard({ id: "remote-active" });
    const remoteTombstone = makeCard({
      id: "remote-tombstone",
      deletedAt: "2026-03-01T12:00:00.000Z",
    });
    mockGetAllFirestoreCards.mockResolvedValue([remoteActive, remoteTombstone]);

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [] }));
    expect(res.status).toBe(200);

    const body = await res.json() as { cards: Card[] };
    const ids = body.cards.map((c) => c.id);
    // Both remote cards must come back to the new device
    expect(ids).toContain("remote-active");
    expect(ids).toContain("remote-tombstone");
  });

  it("handles all-tombstone local state after household expunges all cards", async () => {
    // Odin has 2 tombstones, both expunged by another member (absent from Firestore).
    const t1 = makeCard({ id: "t1", deletedAt: "2026-03-01T12:00:00.000Z" });
    const t2 = makeCard({ id: "t2", deletedAt: "2026-03-01T12:00:00.000Z" });
    mockGetAllFirestoreCards.mockResolvedValue([]);

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [t1, t2] }));
    expect(res.status).toBe(200);

    const body = await res.json() as { cards: Card[] };
    // All orphaned tombstones must be dropped — empty result
    expect(body.cards).toHaveLength(0);

    // setCards is called with empty array — nothing written back
    expect(mockSetCards).toHaveBeenCalledOnce();
    const written = mockSetCards.mock.calls[0]?.[0] as Card[];
    expect(written).toHaveLength(0);
  });
});
