/**
 * Version tracking tests for GET /api/sync/pull route — issue #2004
 *
 * Validates:
 *   - Response includes syncVersion
 *   - updateSyncStateAfterPull called with resolved householdId and userId
 *   - getHouseholdSyncVersion called with authz-resolved householdId
 *   - Correct syncVersion value returned from getHouseholdSyncVersion
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
const mockGetHouseholdSyncVersion = vi.hoisted(() => vi.fn());
const mockUpdateSyncStateAfterPull = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: mockGetAllFirestoreCards,
  getHouseholdSyncVersion: mockGetHouseholdSyncVersion,
  updateSyncStateAfterPull: mockUpdateSyncStateAfterPull,
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { GET } from "@/app/api/sync/pull/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(householdId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/sync/pull?householdId=${householdId}`,
    { method: "GET", headers: { Authorization: "Bearer test-token" } },
  );
}

function authzSuccess(householdId = "hh-test", userId = "user-001") {
  mockRequireAuthz.mockResolvedValue({
    ok: true,
    user: { sub: userId, email: "test@example.com" },
    firestoreUser: {
      userId,
      householdId,
      email: "test@example.com",
      displayName: "Test User",
      role: "owner",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFirestoreCards.mockResolvedValue([]);
  mockGetHouseholdSyncVersion.mockResolvedValue(5);
  mockUpdateSyncStateAfterPull.mockResolvedValue(undefined);
});

// ── syncVersion in response ───────────────────────────────────────────────

describe("GET /api/sync/pull — syncVersion in response (issue #2004)", () => {
  beforeEach(() => {
    authzSuccess();
  });

  it("includes syncVersion in 200 response", async () => {
    mockGetHouseholdSyncVersion.mockResolvedValue(7);

    const res = await GET(makeRequest("hh-test"));

    expect(res.status).toBe(200);
    const body = await res.json() as { syncVersion: number };
    expect(body.syncVersion).toBe(7);
  });

  it("includes syncVersion alongside cards and activeCount", async () => {
    const card = makeCard({ id: "c1" });
    mockGetAllFirestoreCards.mockResolvedValue([card]);
    mockGetHouseholdSyncVersion.mockResolvedValue(3);

    const res = await GET(makeRequest("hh-test"));

    const body = await res.json() as { cards: unknown[]; activeCount: number; syncVersion: number };
    expect(body).toHaveProperty("cards");
    expect(body).toHaveProperty("activeCount");
    expect(body.syncVersion).toBe(3);
  });

  it("returns syncVersion=0 when household has never been pushed", async () => {
    mockGetHouseholdSyncVersion.mockResolvedValue(0);

    const res = await GET(makeRequest("hh-test"));

    expect(res.status).toBe(200);
    const body = await res.json() as { syncVersion: number };
    expect(body.syncVersion).toBe(0);
  });

  it("calls getHouseholdSyncVersion with authz-resolved householdId", async () => {
    authzSuccess("hh-resolved", "user-abc");

    await GET(makeRequest("hh-raw"));

    expect(mockGetHouseholdSyncVersion).toHaveBeenCalledWith("hh-resolved");
    expect(mockGetHouseholdSyncVersion).not.toHaveBeenCalledWith("hh-raw");
  });
});

// ── updateSyncStateAfterPull calls ────────────────────────────────────────

describe("GET /api/sync/pull — updateSyncStateAfterPull (issue #2004)", () => {
  beforeEach(() => {
    authzSuccess("hh-test", "user-123");
  });

  it("calls updateSyncStateAfterPull with resolved householdId and userId", async () => {
    await GET(makeRequest("hh-test"));

    expect(mockUpdateSyncStateAfterPull).toHaveBeenCalledWith("hh-test", "user-123");
  });

  it("calls updateSyncStateAfterPull with authz-resolved values, not raw query param", async () => {
    authzSuccess("hh-resolved", "user-xyz");

    await GET(makeRequest("hh-raw"));

    expect(mockUpdateSyncStateAfterPull).toHaveBeenCalledWith("hh-resolved", "user-xyz");
    expect(mockUpdateSyncStateAfterPull).not.toHaveBeenCalledWith("hh-raw", expect.anything());
  });

  it("calls updateSyncStateAfterPull exactly once per request", async () => {
    await GET(makeRequest("hh-test"));

    expect(mockUpdateSyncStateAfterPull).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when updateSyncStateAfterPull throws", async () => {
    mockUpdateSyncStateAfterPull.mockRejectedValue(new Error("Firestore unavailable"));

    const res = await GET(makeRequest("hh-test"));

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });

  it("returns 500 when getHouseholdSyncVersion throws", async () => {
    mockGetHouseholdSyncVersion.mockRejectedValue(new Error("Firestore unavailable"));

    const res = await GET(makeRequest("hh-test"));

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("internal_error");
  });

  it("updateSyncStateAfterPull called after fetch resolves (call order invariant)", async () => {
    // The route must not mark the member as synced before the fetch returns.
    // If updateSyncStateAfterPull fires before Promise.all resolves, a network
    // failure would silently suppress needsDownload even though no data was delivered.
    const callOrder: string[] = [];
    mockGetAllFirestoreCards.mockImplementation(async () => {
      callOrder.push("getAllFirestoreCards");
      return [];
    });
    mockGetHouseholdSyncVersion.mockImplementation(async () => {
      callOrder.push("getHouseholdSyncVersion");
      return 5;
    });
    mockUpdateSyncStateAfterPull.mockImplementation(async () => {
      callOrder.push("updateSyncStateAfterPull");
    });

    await GET(makeRequest("hh-test"));

    // Both fetches must complete before the state update
    expect(callOrder.indexOf("updateSyncStateAfterPull")).toBeGreaterThan(
      Math.max(
        callOrder.indexOf("getAllFirestoreCards"),
        callOrder.indexOf("getHouseholdSyncVersion"),
      ),
    );
  });
});
