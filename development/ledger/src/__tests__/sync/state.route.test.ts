/**
 * Unit tests for GET /api/sync/state route.
 *
 * Validates:
 *   - 400 for missing householdId query param
 *   - 401 when not authenticated
 *   - 403 for non-Karl users
 *   - 403 when householdId does not match user's household (IDOR prevention)
 *   - 200 with correct { syncVersion, lastSyncedVersion, needsDownload } when sync state exists
 *   - 200 with defaults (0, false) when sync state doc is missing (first access)
 *   - Uses authz-resolved householdId and userId for Firestore ops (never raw params)
 *
 * Issue #2001
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock: authz ────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: mockRequireAuthz,
}));

// ── Mock: Firestore ────────────────────────────────────────────────────────

const mockGetMemberSyncState = vi.hoisted(() => vi.fn());
const mockGetHouseholdSyncVersion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getMemberSyncState: mockGetMemberSyncState,
  getHouseholdSyncVersion: mockGetHouseholdSyncVersion,
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { GET } from "@/app/api/sync/state/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(householdId?: string): NextRequest {
  const url = householdId
    ? `http://localhost/api/sync/state?householdId=${householdId}`
    : "http://localhost/api/sync/state";
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer test-token" },
  });
}

function authzSuccess(householdId = "hh-test", userId = "user-owner") {
  mockRequireAuthz.mockResolvedValue({
    ok: true,
    user: { sub: userId, email: "test@example.com" },
    firestoreUser: {
      userId,
      householdId,
      email: "test@example.com",
      displayName: "Test User",
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
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
  mockGetHouseholdSyncVersion.mockResolvedValue(0);
  mockGetMemberSyncState.mockResolvedValue(null);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/sync/state", () => {
  it("returns 400 when householdId query param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_param");
  });

  it("returns 401 when not authenticated", async () => {
    authzFail(401, "missing_token");
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-Karl users", async () => {
    authzFail(403, "forbidden");
    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when householdId does not match user's household", async () => {
    authzFail(403, "forbidden");
    const res = await GET(makeRequest("hh-other"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with defaults when sync state doc is missing (first access)", async () => {
    authzSuccess("hh-test", "user-owner");
    mockGetHouseholdSyncVersion.mockResolvedValue(3);
    mockGetMemberSyncState.mockResolvedValue(null);

    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      syncVersion: 3,
      lastSyncedVersion: 0,
      needsDownload: false,
    });
  });

  it("returns 200 with existing sync state values", async () => {
    authzSuccess("hh-test", "user-owner");
    mockGetHouseholdSyncVersion.mockResolvedValue(7);
    mockGetMemberSyncState.mockResolvedValue({
      userId: "user-owner",
      lastSyncedVersion: 5,
      needsDownload: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      syncVersion: 7,
      lastSyncedVersion: 5,
      needsDownload: true,
    });
  });

  it("uses authz-resolved householdId and userId for Firestore ops", async () => {
    authzSuccess("hh-resolved", "user-resolved");
    mockGetHouseholdSyncVersion.mockResolvedValue(0);
    mockGetMemberSyncState.mockResolvedValue(null);

    await GET(makeRequest("hh-resolved"));

    expect(mockGetHouseholdSyncVersion).toHaveBeenCalledWith("hh-resolved");
    expect(mockGetMemberSyncState).toHaveBeenCalledWith("hh-resolved", "user-resolved");
  });

  it("returns no-store Cache-Control header", async () => {
    authzSuccess();
    mockGetHouseholdSyncVersion.mockResolvedValue(0);
    mockGetMemberSyncState.mockResolvedValue(null);

    const res = await GET(makeRequest("hh-test"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 500 on internal error", async () => {
    authzSuccess();
    mockGetHouseholdSyncVersion.mockRejectedValue(new Error("Firestore boom"));

    const res = await GET(makeRequest("hh-test"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("internal_error");
  });
});
