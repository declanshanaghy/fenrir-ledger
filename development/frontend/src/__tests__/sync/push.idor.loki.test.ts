/**
 * Loki QA — IDOR regression tests for POST /api/sync/push (issue #1193)
 *
 * Focus: prove the route handler uses the SERVER-VERIFIED householdId
 * (from authz.firestoreUser.householdId) for all Firestore operations,
 * never the CALLER-SUPPLIED value from the request body.
 *
 * This is the critical property of the fix: even if requireAuthz were somehow
 * called with a mismatched householdId and returned ok:true, the route code
 * must use the server-resolved value — not whatever the caller sent.
 *
 * Tests are intentionally separate from push.route.test.ts (which is already
 * over the 10-test-per-file limit and covers orthogonal scenarios).
 *
 * @ref #1193 — IDOR fix: POST /api/sync/push
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";

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

/** Simulate authz success where the SERVER says the user belongs to serverHouseholdId */
function authzSuccess(serverHouseholdId: string) {
  mockRequireAuthz.mockResolvedValue({
    ok: true,
    user: { sub: "google-user-123", email: "user@example.com" },
    firestoreUser: {
      clerkUserId: "google-user-123",
      householdId: serverHouseholdId,
      email: "user@example.com",
      displayName: "Test User",
      role: "owner",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  });
}

/** Simulate authz failure with explicit household_mismatch description */
function authzHouseholdMismatch() {
  mockRequireAuthz.mockResolvedValue({
    ok: false,
    response: new Response(
      JSON.stringify({
        error: "forbidden",
        error_description: "You do not have access to the requested household.",
      }),
      { status: 403 },
    ),
  });
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    householdId: "hh-caller",
    issuerId: "chase",
    cardName: "Test Card",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 100000,
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

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSetCards.mockResolvedValue(undefined);
  mockGetAllFirestoreCards.mockResolvedValue([]);
});

// ── IDOR fix: route must use server-verified householdId ──────────────────

describe("POST /api/sync/push — IDOR fix #1193: server-verified householdId", () => {
  it("queries Firestore using firestoreUser.householdId, not the caller-supplied value", async () => {
    // Server says this user belongs to "hh-server-verified"
    authzSuccess("hh-server-verified");

    // Caller supplies a DIFFERENT householdId in the body
    const res = await POST(
      makeRequest({ householdId: "hh-caller-supplied", cards: [] }),
    );

    expect(res.status).toBe(200);
    // Firestore must be read from the server-verified household
    expect(mockGetAllFirestoreCards).toHaveBeenCalledWith("hh-server-verified");
    // Firestore must NOT be queried with the caller-supplied value
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalledWith(
      "hh-caller-supplied",
    );
  });

  it("returns 403 and never touches Firestore when household membership check fails", async () => {
    authzHouseholdMismatch();

    const res = await POST(
      makeRequest({ householdId: "victim-household", cards: [makeCard()] }),
    );

    expect(res.status).toBe(403);
    // Firestore must not be read or written for a rejected IDOR attempt
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalled();
    expect(mockSetCards).not.toHaveBeenCalled();
  });

  it("403 response body on IDOR rejection does not expose victim householdId", async () => {
    authzHouseholdMismatch();

    const res = await POST(
      makeRequest({ householdId: "victim-household", cards: [] }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    // Error body must not reveal the victim's householdId
    expect(JSON.stringify(body)).not.toContain("victim-household");
    expect(body.error).toBe("forbidden");
  });
});
