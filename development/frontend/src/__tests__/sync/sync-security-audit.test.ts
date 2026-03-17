/**
 * Security regression tests — Firestore sync and household data access audit
 *
 * These tests document the security findings from Heimdall's audit (issue #1126)
 * and verify the fixes landed in #1199.
 *
 * SEV-001 (CRITICAL): GET /api/sync/pull — IDOR via client-supplied ?householdId=
 *   FIX: requireAuthz with householdId membership check → 403 on mismatch
 * SEV-002 (CRITICAL): POST /api/sync/push — IDOR via client-supplied body householdId
 *   FIX: requireAuthz with householdId membership check → 403 on mismatch
 * SEV-003 (HIGH): GET /api/household/invite/validate — email (PII) in members array
 *   FIX: see validate-route-loki.test.ts SEV-003 test
 *
 * Issue #1126, #1199
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";
import { NextRequest } from "next/server";

// ── Mocks: requireAuthz ─────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authz", () => ({ requireAuthz: mockRequireAuthz }));

// ── Mocks: Firestore ─────────────────────────────────────────────────────────

const mockGetAllFirestoreCardsPull = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: mockGetAllFirestoreCardsPull,
  setCards: vi.fn().mockResolvedValue(undefined),
  getUser: vi.fn(),
  getCards: vi.fn().mockResolvedValue([]),
  findHouseholdByInviteCode: vi.fn(),
  getUsersByHouseholdId: vi.fn().mockResolvedValue([]),
}));

// ── Import routes after mocks ───────────────────────────────────────────────

import { GET as pullGET } from "@/app/api/sync/pull/route";
import { POST as pushPOST } from "@/app/api/sync/push/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    householdId: "victim-household",
    issuerId: "amex",
    cardName: "Victim Gold Card",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 1000000,
    annualFee: 25000,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "secret note",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Simulate requireAuthz detecting a household_mismatch → 403 */
function authzDenied() {
  mockRequireAuthz.mockResolvedValue({
    ok: false,
    response: new Response(
      JSON.stringify({ error: "forbidden", error_description: "You do not have access to the requested household." }),
      { status: 403 },
    ),
  });
}

/** Simulate requireAuthz passing for a legitimate member */
function authzAllowed(householdId = "attacker-household") {
  mockRequireAuthz.mockResolvedValue({
    ok: true,
    user: { sub: "attacker-user-sub" },
    firestoreUser: {
      clerkUserId: "attacker-user-sub",
      email: "attacker@example.com",
      displayName: "Attacker",
      householdId,
      role: "owner",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFirestoreCardsPull.mockResolvedValue([]);
});

// ── SEV-001: IDOR in GET /api/sync/pull — FIXED in #1199 ────────────────────

describe("SEV-001 — IDOR: GET /api/sync/pull (fixed in #1199)", () => {
  it("returns 403 when caller does not belong to the requested household", async () => {
    // requireAuthz detects household_mismatch and denies access
    authzDenied();
    mockGetAllFirestoreCardsPull.mockResolvedValue([makeCard()]);

    const req = new NextRequest(
      "http://localhost/api/sync/pull?householdId=victim-household",
      { method: "GET", headers: { Authorization: "Bearer attacker-token" } },
    );

    const res = await pullGET(req);

    // IDOR is now blocked: 403 returned, Firestore never called
    expect(res.status).toBe(403);
    expect(mockGetAllFirestoreCardsPull).not.toHaveBeenCalled();
  });

  it("returns 200 when caller belongs to the requested household (no regression)", async () => {
    authzAllowed("legit-household");
    mockGetAllFirestoreCardsPull.mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/sync/pull?householdId=legit-household",
      { method: "GET", headers: { Authorization: "Bearer legit-token" } },
    );

    const res = await pullGET(req);
    expect(res.status).toBe(200);
    // Firestore called with the verified householdId (from firestoreUser, not raw param)
    expect(mockGetAllFirestoreCardsPull).toHaveBeenCalledWith("legit-household");
  });
});

// ── SEV-002: IDOR in POST /api/sync/push — FIXED in #1199 ───────────────────

describe("SEV-002 — IDOR: POST /api/sync/push (fixed in #1199)", () => {
  it("returns 403 when caller does not belong to the requested household", async () => {
    // requireAuthz detects household_mismatch and denies access
    authzDenied();
    mockGetAllFirestoreCardsPull.mockResolvedValue([makeCard()]);

    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer attacker-token",
      },
      body: JSON.stringify({ householdId: "victim-household", cards: [] }),
    });

    const res = await pushPOST(req);

    // IDOR is now blocked: 403 returned, Firestore never called
    expect(res.status).toBe(403);
    expect(mockGetAllFirestoreCardsPull).not.toHaveBeenCalled();
  });

  it("returns 200 when caller belongs to the requested household (no regression)", async () => {
    authzAllowed("legit-household");
    mockGetAllFirestoreCardsPull.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer legit-token",
      },
      body: JSON.stringify({ householdId: "legit-household", cards: [] }),
    });

    const res = await pushPOST(req);
    expect(res.status).toBe(200);
    // Firestore called with the verified householdId (from firestoreUser, not raw body)
    expect(mockGetAllFirestoreCardsPull).toHaveBeenCalledWith("legit-household");
  });
});
