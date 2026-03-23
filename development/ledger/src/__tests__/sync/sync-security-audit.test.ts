/**
 * Security regression tests — Firestore sync and household data access audit
 *
 * These tests document the security findings from Heimdall's audit (issue #1126).
 *
 * SEV-001 (FIXED in #1192): GET /api/sync/pull — IDOR via client-supplied ?householdId=
 *   Fix: requireAuthz() now verifies caller's household membership before any Firestore access.
 *   The route returns 403 when the caller is not a member of the requested household.
 *
 * SEV-002 (FIXED in #1193): POST /api/sync/push — IDOR via client-supplied body householdId
 *   Fix: requireAuthz() now verifies caller's household membership before any Firestore access.
 *   The route returns 403 when the caller is not a member of the requested household.
 *
 * SEV-003 (HIGH): GET /api/household/invite/validate — email (PII) in members array
 *   When SEV-003 fix lands: update assertion to expect email to be absent from members.
 *
 * Issue #1126, #1192, #1193
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";
import { NextRequest } from "next/server";

// ── Mocks: authz (both routes use requireAuthz after fix) ────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/authz", () => ({ requireAuthz: mockRequireAuthz }));

// ── Mocks: Firestore ─────────────────────────────────────────────────────────

const mockGetAllFirestoreCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: mockGetAllFirestoreCards,
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

beforeEach(() => {
  mockGetAllFirestoreCards.mockResolvedValue([]);
});

// ── SEV-001: IDOR in GET /api/sync/pull — FIXED (#1192) ─────────────────────

describe("SEV-001 — FIXED: GET /api/sync/pull blocks cross-household access", () => {
  it("returns 403 when caller requests a household they do not belong to", async () => {
    // requireAuthz detects household mismatch and returns 403 before Firestore is accessed
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

    const req = new NextRequest(
      "http://localhost/api/sync/pull?householdId=victim-household",
      { method: "GET", headers: { Authorization: "Bearer attacker-token" } },
    );

    const res = await pullGET(req);

    // IDOR is fixed: cross-household requests are blocked at authz, not at Firestore
    expect(res.status).toBe(403);
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalled();
  });
});

// ── SEV-002: IDOR in POST /api/sync/push — FIXED (#1193) ────────────────────

describe("SEV-002 — FIXED: POST /api/sync/push blocks cross-household access", () => {
  it("returns 403 when caller supplies a householdId they do not belong to", async () => {
    // requireAuthz detects household mismatch and returns 403 before Firestore is accessed
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

    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer attacker-token",
      },
      body: JSON.stringify({ householdId: "victim-household", cards: [makeCard()] }),
    });

    const res = await pushPOST(req);

    // IDOR is fixed: cross-household requests are blocked at authz, not at Firestore
    expect(res.status).toBe(403);
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalled();
  });
});
