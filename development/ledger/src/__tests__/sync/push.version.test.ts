/**
 * Version tracking tests for POST /api/sync/push route — issue #2004
 *
 * Validates:
 *   - 409 when clientSyncVersion is stale (behind current household syncVersion)
 *   - No 409 when clientSyncVersion equals current syncVersion
 *   - No 409 when clientSyncVersion is ahead (should not happen in practice, but allowed)
 *   - No 409 check performed when clientSyncVersion is omitted (backwards compat)
 *   - Response includes syncVersion on 200
 *   - updateSyncStateAfterPush called with householdId and pushing userId
 *   - getHouseholdSyncVersion not called when clientSyncVersion is omitted
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

function authzSuccess(householdId = "hh-test", userId = "user-001") {
  mockRequireAuthz.mockResolvedValue({
    ok: true as const,
    user: { sub: userId, email: "test@example.com" },
    firestoreUser: { householdId, userId },
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFirestoreCards.mockResolvedValue([]);
  mockSetCards.mockResolvedValue(undefined);
  mockDeleteCards.mockResolvedValue(undefined);
  // Default: household is at version 3, push increments to 4
  mockGetHouseholdSyncVersion.mockResolvedValue(3);
  mockUpdateSyncStateAfterPush.mockResolvedValue(4);
});

// ── 409 stale-client checks ───────────────────────────────────────────────

describe("POST /api/sync/push — 409 stale-client detection (issue #2004)", () => {
  beforeEach(() => {
    authzSuccess();
  });

  it("returns 409 when clientSyncVersion is behind current syncVersion", async () => {
    // Household is at version 3, client thinks it's at version 1
    mockGetHouseholdSyncVersion.mockResolvedValue(3);

    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [], clientSyncVersion: 1 }),
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string; currentSyncVersion: number };
    expect(body.error).toBe("sync_conflict");
    expect(body.currentSyncVersion).toBe(3);
  });

  it("returns 409 with correct currentSyncVersion in response body", async () => {
    mockGetHouseholdSyncVersion.mockResolvedValue(10);

    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [], clientSyncVersion: 5 }),
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string; currentSyncVersion: number };
    expect(body.currentSyncVersion).toBe(10);
  });

  it("does NOT call setCards when returning 409 (push is rejected)", async () => {
    mockGetHouseholdSyncVersion.mockResolvedValue(5);

    await POST(
      makeRequest({ householdId: "hh-test", cards: [], clientSyncVersion: 2 }),
    );

    expect(mockSetCards).not.toHaveBeenCalled();
  });

  it("does NOT call updateSyncStateAfterPush when returning 409", async () => {
    mockGetHouseholdSyncVersion.mockResolvedValue(5);

    await POST(
      makeRequest({ householdId: "hh-test", cards: [], clientSyncVersion: 2 }),
    );

    expect(mockUpdateSyncStateAfterPush).not.toHaveBeenCalled();
  });

  it("returns 200 when clientSyncVersion equals current syncVersion (not stale)", async () => {
    // Household is at version 3, client is also at version 3 — no conflict
    mockGetHouseholdSyncVersion.mockResolvedValue(3);

    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [], clientSyncVersion: 3 }),
    );

    expect(res.status).toBe(200);
  });

  it("returns 200 when clientSyncVersion is ahead of current (no conflict)", async () => {
    // Unusual state but must not 409
    mockGetHouseholdSyncVersion.mockResolvedValue(2);

    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [], clientSyncVersion: 5 }),
    );

    expect(res.status).toBe(200);
  });

  it("calls getHouseholdSyncVersion with authz-resolved householdId", async () => {
    authzSuccess("hh-resolved", "user-abc");
    mockGetHouseholdSyncVersion.mockResolvedValue(0);

    await POST(
      makeRequest({ householdId: "hh-raw", cards: [], clientSyncVersion: 0 }),
    );

    expect(mockGetHouseholdSyncVersion).toHaveBeenCalledWith("hh-resolved");
    expect(mockGetHouseholdSyncVersion).not.toHaveBeenCalledWith("hh-raw");
  });
});

// ── No 409 when clientSyncVersion omitted (backwards compat) ──────────────

describe("POST /api/sync/push — backwards compat: no 409 when clientSyncVersion omitted", () => {
  beforeEach(() => {
    authzSuccess();
  });

  it("does not call getHouseholdSyncVersion when clientSyncVersion is absent", async () => {
    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [] }),
    );

    expect(res.status).toBe(200);
    expect(mockGetHouseholdSyncVersion).not.toHaveBeenCalled();
  });

  it("does not 409 when clientSyncVersion is null", async () => {
    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [], clientSyncVersion: null }),
    );

    expect(res.status).toBe(200);
    expect(mockGetHouseholdSyncVersion).not.toHaveBeenCalled();
  });

  it("does not 409 when clientSyncVersion is a string (ignored)", async () => {
    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [], clientSyncVersion: "3" }),
    );

    expect(res.status).toBe(200);
    expect(mockGetHouseholdSyncVersion).not.toHaveBeenCalled();
  });
});

// ── syncVersion in response ───────────────────────────────────────────────

describe("POST /api/sync/push — syncVersion in response (issue #2004)", () => {
  beforeEach(() => {
    authzSuccess();
  });

  it("includes syncVersion in 200 response", async () => {
    mockUpdateSyncStateAfterPush.mockResolvedValue(7);

    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [] }),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { syncVersion: number };
    expect(body.syncVersion).toBe(7);
  });

  it("includes syncVersion alongside cards and syncedCount", async () => {
    const card = makeCard({ id: "c1" });
    mockGetAllFirestoreCards.mockResolvedValue([]);
    mockUpdateSyncStateAfterPush.mockResolvedValue(5);

    const res = await POST(
      makeRequest({ householdId: "hh-test", cards: [card] }),
    );

    const body = await res.json() as { cards: unknown[]; syncedCount: number; syncVersion: number };
    expect(body).toHaveProperty("cards");
    expect(body).toHaveProperty("syncedCount");
    expect(body.syncVersion).toBe(5);
  });

  it("calls updateSyncStateAfterPush with authz-resolved householdId and userId", async () => {
    authzSuccess("hh-resolved", "user-xyz");

    await POST(
      makeRequest({ householdId: "hh-raw", cards: [] }),
    );

    expect(mockUpdateSyncStateAfterPush).toHaveBeenCalledWith("hh-resolved", "user-xyz");
  });

  it("updateSyncStateAfterPush called after setCards (order matters)", async () => {
    const callOrder: string[] = [];
    mockSetCards.mockImplementation(async () => { callOrder.push("setCards"); });
    mockUpdateSyncStateAfterPush.mockImplementation(async () => { callOrder.push("updateSyncState"); return 1; });

    await POST(makeRequest({ householdId: "hh-test", cards: [] }));

    expect(callOrder).toEqual(["setCards", "updateSyncState"]);
  });

  it("returns 500 when updateSyncStateAfterPush throws", async () => {
    mockUpdateSyncStateAfterPush.mockRejectedValue(new Error("Firestore error"));

    const res = await POST(makeRequest({ householdId: "hh-test", cards: [] }));

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });
});
