/**
 * Security regression tests — Firestore sync and household data access audit
 *
 * These tests document the security findings from Heimdall's audit (issue #1126).
 * They prove that the IDOR vulnerabilities exist in the current implementation
 * and will serve as regression markers when the fixes land in follow-up PRs.
 *
 * SEV-001 (CRITICAL): GET /api/sync/pull — IDOR via client-supplied ?householdId=
 * SEV-002 (CRITICAL): POST /api/sync/push — IDOR via client-supplied body householdId
 * SEV-003 (HIGH): GET /api/household/invite/validate — email (PII) in members array
 *
 * When SEV-001/SEV-002 fixes land: update assertions to expect 403 on cross-household access.
 * When SEV-003 fix lands: update assertion to expect email to be absent from members.
 *
 * Issue #1126
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";
import { NextRequest } from "next/server";

// ── Mocks: pull route ───────────────────────────────────────────────────────

const mockRequireAuthPull = vi.hoisted(() => vi.fn());
const mockGetEntitlementPull = vi.hoisted(() => vi.fn());
const mockGetAllFirestoreCardsPull = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mockRequireAuthPull }));
vi.mock("@/lib/kv/entitlement-store", () => ({ getStripeEntitlement: mockGetEntitlementPull }));
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

function karlAuth(sub = "attacker-user-sub") {
  mockRequireAuthPull.mockResolvedValue({ ok: true, user: { sub } });
  mockGetEntitlementPull.mockResolvedValue({ tier: "karl", active: true });
}

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
  vi.clearAllMocks();
  mockGetAllFirestoreCardsPull.mockResolvedValue([]);
});

// ── SEV-001: IDOR in GET /api/sync/pull ─────────────────────────────────────

describe("SEV-001 — IDOR: GET /api/sync/pull accepts arbitrary householdId", () => {
  it("passes client-supplied householdId directly to Firestore without membership check", async () => {
    karlAuth("attacker-user-sub");
    mockGetAllFirestoreCardsPull.mockResolvedValue([makeCard()]);

    const req = new NextRequest(
      "http://localhost/api/sync/pull?householdId=victim-household",
      { method: "GET", headers: { Authorization: "Bearer attacker-token" } },
    );

    const res = await pullGET(req);

    // IDOR documented: the route returns 200 using the attacker-supplied householdId
    // without verifying the caller belongs to "victim-household".
    // EXPECTED AFTER FIX: this should return 403 when caller is not a member of victim-household.
    expect(res.status).toBe(200);
    expect(mockGetAllFirestoreCardsPull).toHaveBeenCalledWith("victim-household");
  });
});

// ── SEV-002: IDOR in POST /api/sync/push ────────────────────────────────────

describe("SEV-002 — IDOR: POST /api/sync/push accepts arbitrary householdId from body", () => {
  it("passes client-supplied body householdId to Firestore without membership check", async () => {
    karlAuth("attacker-user-sub");
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

    // IDOR documented: the route returns 200 using the attacker-supplied householdId
    // without verifying the caller belongs to "victim-household".
    // EXPECTED AFTER FIX: this should return 403 when caller is not a member of victim-household.
    expect(res.status).toBe(200);
    expect(mockGetAllFirestoreCardsPull).toHaveBeenCalledWith("victim-household");
  });
});
