/**
 * Loki QA — targeted security invariants for GET /api/sync/pull
 *
 * Supplements FiremanDecko's pull.route.test.ts with devil's-advocate edge cases
 * that validate the IDOR fix at the call-site level (issue #1192).
 *
 * Focus:
 *   1. requireAuthz is called with the EXACT householdId from the query param
 *      and tier:"karl" — if this arg is ever dropped, the household membership
 *      check is silently skipped and IDOR is reintroduced.
 *   2. Successful 200 response carries Cache-Control: no-store — card data
 *      (including tombstones) must never be stored in any cache layer.
 *   3. requireAuthz is called exactly once per request — no double-auth or bypass.
 *
 * @ref #1192
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";

// ── Mock: authz ─────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: mockRequireAuthz,
}));

// ── Mock: Firestore ──────────────────────────────────────────────────────────

const mockGetAllFirestoreCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: mockGetAllFirestoreCards,
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import { GET } from "@/app/api/sync/pull/route";
import { NextRequest } from "next/server";
import type { FirestoreUser } from "@/lib/firebase/firestore-types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(householdId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/sync/pull?householdId=${householdId}`,
    { method: "GET", headers: { Authorization: "Bearer test-token" } },
  );
}

const FIRESTORE_USER: FirestoreUser = {
  clerkUserId: "google-sub-karl",
  email: "karl@fenrir.dev",
  displayName: "Karl the Worthy",
  householdId: "hh-resolved",
  role: "owner",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

function authzSuccess(householdId = "hh-resolved") {
  mockRequireAuthz.mockResolvedValue({
    ok: true,
    user: { sub: "google-sub-karl", email: "karl@fenrir.dev" },
    firestoreUser: { ...FIRESTORE_USER, householdId },
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFirestoreCards.mockResolvedValue([]);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/sync/pull — Loki IDOR fix invariants (issue #1192)", () => {
  it("passes the query-param householdId AND tier:karl to requireAuthz — IDOR check cannot be silently skipped", async () => {
    // CRITICAL: The IDOR fix depends on requireAuthz receiving the caller-supplied
    // householdId so it can compare against firestoreUser.householdId.
    // If the route ever calls requireAuthz without householdId, the membership
    // check is skipped and any Karl user can read any household's cards again.
    authzSuccess("hh-resolved");
    const req = makeRequest("hh-victim");

    await GET(req);

    expect(mockRequireAuthz).toHaveBeenCalledWith(req, {
      householdId: "hh-victim",
      tier: "karl",
    });
  });

  it("sets Cache-Control: no-store on successful 200 response", async () => {
    // Card data (including tombstones) is sensitive PII.
    // It must never be stored by browsers, CDNs, or proxy caches.
    authzSuccess("hh-resolved");
    const card: Partial<Card> = {
      id: "card-1",
      householdId: "hh-resolved",
      issuerId: "chase",
      cardName: "Chase Sapphire",
      openDate: "2025-01-01T00:00:00.000Z",
      creditLimit: 500000,
      annualFee: 9500,
      annualFeeDate: "",
      promoPeriodMonths: 0,
      signUpBonus: null,
      status: "active",
      notes: "",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    mockGetAllFirestoreCards.mockResolvedValue([card]);

    const res = await GET(makeRequest("hh-resolved"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("calls requireAuthz exactly once per request — no bypass or double-auth race", async () => {
    // Calling requireAuthz twice would introduce a TOCTOU window; skipping it
    // entirely would bypass auth. Exactly-once is the correct invariant.
    authzSuccess("hh-resolved");

    await GET(makeRequest("hh-resolved"));

    expect(mockRequireAuthz).toHaveBeenCalledTimes(1);
  });
});
