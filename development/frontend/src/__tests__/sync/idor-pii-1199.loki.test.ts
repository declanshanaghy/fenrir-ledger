/**
 * Loki QA — security fix validation for issue #1199
 *
 * Validates all three security fixes identified by Heimdall:
 *
 *   SEV-001 (CRITICAL): GET /api/sync/pull — IDOR via client-supplied ?householdId=
 *     FIX: requireAuthz with householdId membership check → 403 on mismatch
 *     Validates: attacker GET with wrong householdId → 403 (IDOR blocked)
 *     Validates: legitimate user with correct householdId → 200 (no regression)
 *
 *   SEV-002 (CRITICAL): POST /api/sync/push — IDOR via client-supplied body householdId
 *     FIX: requireAuthz with householdId membership check → 403 on mismatch
 *     Validates: attacker POST with wrong householdId → 403 (IDOR blocked)
 *     Validates: legitimate user with correct householdId → 200 (no regression)
 *
 *   SEV-003 (HIGH): GET /api/household/invite/validate — email (PII) in members array
 *     FIX: email field intentionally omitted from members map
 *     Validates: response members[] has no email field
 *     Validates: response members[] still has displayName and role
 *
 *   AUDIT LOG: requireAuthz fires log.warn on IDOR attempt with userId + householdId
 *     Validates via requireAuthz directly (not mocked) to confirm the audit trail
 *     logs reason, userId (googleSub), and both household IDs for forensics.
 *
 * Issue #1199
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";
import { NextRequest } from "next/server";

// ── Mocks: requireAuthz (for route-level tests SEV-001, SEV-002) ────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authz", () => ({ requireAuthz: mockRequireAuthz }));

// ── Mocks: Firestore (for route-level tests) ────────────────────────────────

const mockGetAllFirestoreCards = vi.hoisted(() => vi.fn());
const mockSetCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: mockGetAllFirestoreCards,
  setCards: mockSetCards,
  getUser: vi.fn(),
  getCards: vi.fn().mockResolvedValue([]),
  findHouseholdByInviteCode: vi.fn(),
  getUsersByHouseholdId: vi.fn().mockResolvedValue([]),
}));

// ── Mocks: Logger (for audit log assertion tests via authz) ─────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Mocks: requireAuth (used by validate route via require-auth) ────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

// ── Import routes (after all mocks) ────────────────────────────────────────

import { GET as pullGET } from "@/app/api/sync/pull/route";
import { POST as pushPOST } from "@/app/api/sync/push/route";
import { GET as validateGET } from "@/app/api/household/invite/validate/route";

// ── Import requireAuth mock (for SEV-003 validate route) ───────────────────

import { requireAuth } from "@/lib/auth/require-auth";

// ── Fixtures & helpers ──────────────────────────────────────────────────────

let _seq = 0;

function makeCard(overrides: Partial<Card> = {}): Card {
  _seq++;
  return {
    id: `card-${_seq}`,
    householdId: "victim-hh",
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

function authzDenied403() {
  mockRequireAuthz.mockResolvedValue({
    ok: false as const,
    response: new Response(
      JSON.stringify({ error: "forbidden", error_description: "You do not have access to the requested household." }),
      { status: 403 },
    ),
  });
}

function authzAllowed(householdId: string) {
  mockRequireAuthz.mockResolvedValue({
    ok: true as const,
    user: { sub: "user-sub-legit", email: "legit@example.com" },
    firestoreUser: {
      clerkUserId: "user-sub-legit",
      email: "legit@example.com",
      displayName: "Legit User",
      householdId,
      role: "owner",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  });
}

const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

const baseHousehold = {
  id: "hh-target",
  name: "Eriksen Household",
  ownerId: "owner-uid",
  memberIds: ["owner-uid"],
  inviteCode: "X7K2NP",
  inviteCodeExpiresAt: futureExpiry,
  tier: "free" as const,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const callerUserFirestore = {
  clerkUserId: "joiner-uid",
  email: "joiner@example.com",
  displayName: "Björn",
  householdId: "hh-solo",
  role: "owner" as const,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const ownerMember = {
  clerkUserId: "owner-uid",
  email: "thor@example.com",
  displayName: "Thorvald",
  householdId: "hh-target",
  role: "owner" as const,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFirestoreCards.mockResolvedValue([]);
  mockSetCards.mockResolvedValue(undefined);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEV-001: GET /api/sync/pull — IDOR (fixed in #1199)
// ═══════════════════════════════════════════════════════════════════════════════

describe("SEV-001 #1199 — GET /api/sync/pull IDOR fix", () => {
  it("returns 403 when attacker supplies a householdId they don't belong to", async () => {
    authzDenied403();
    mockGetAllFirestoreCards.mockResolvedValue([makeCard()]);

    const req = new NextRequest(
      "http://localhost/api/sync/pull?householdId=victim-hh",
      { method: "GET", headers: { Authorization: "Bearer attacker-token" } },
    );

    const res = await pullGET(req);

    expect(res.status).toBe(403);
    // Firestore MUST NOT be called — data never accessed for attacker
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalled();
  });

  it("does NOT return victim data in the 403 body (no data leak)", async () => {
    authzDenied403();
    mockGetAllFirestoreCards.mockResolvedValue([
      makeCard({ id: "secret-card", cardName: "Victim Amex Platinum" }),
    ]);

    const req = new NextRequest(
      "http://localhost/api/sync/pull?householdId=victim-hh",
      { method: "GET", headers: { Authorization: "Bearer attacker-token" } },
    );

    const res = await pullGET(req);
    const body = await res.json() as { error: string; cards?: unknown };

    expect(res.status).toBe(403);
    expect(body).not.toHaveProperty("cards");
    expect(JSON.stringify(body)).not.toContain("Victim Amex Platinum");
  });

  it("returns 200 for a legitimate user with the correct householdId (no regression)", async () => {
    authzAllowed("my-hh");
    mockGetAllFirestoreCards.mockResolvedValue([makeCard({ householdId: "my-hh" })]);

    const req = new NextRequest(
      "http://localhost/api/sync/pull?householdId=my-hh",
      { method: "GET", headers: { Authorization: "Bearer legit-token" } },
    );

    const res = await pullGET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[]; activeCount: number };
    expect(body.cards).toHaveLength(1);
    expect(body.activeCount).toBe(1);
  });

  it("route calls requireAuthz with the supplied householdId (so membership check fires)", async () => {
    authzAllowed("my-hh");

    const req = new NextRequest(
      "http://localhost/api/sync/pull?householdId=my-hh",
      { method: "GET", headers: { Authorization: "Bearer legit-token" } },
    );

    await pullGET(req);

    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ householdId: "my-hh", tier: "karl" }),
    );
  });

  it("Firestore is called with authz.firestoreUser.householdId, never the raw query param", async () => {
    // After authz, route must ignore the raw param and use firestoreUser.householdId
    authzAllowed("server-verified-hh");

    const req = new NextRequest(
      "http://localhost/api/sync/pull?householdId=client-supplied-hh",
      { method: "GET", headers: { Authorization: "Bearer token" } },
    );

    await pullGET(req);

    expect(mockGetAllFirestoreCards).toHaveBeenCalledWith("server-verified-hh");
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalledWith("client-supplied-hh");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEV-002: POST /api/sync/push — IDOR (fixed in #1199)
// ═══════════════════════════════════════════════════════════════════════════════

describe("SEV-002 #1199 — POST /api/sync/push IDOR fix", () => {
  it("returns 403 when attacker supplies a householdId they don't belong to", async () => {
    authzDenied403();
    mockGetAllFirestoreCards.mockResolvedValue([makeCard()]);

    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer attacker-token" },
      body: JSON.stringify({ householdId: "victim-hh", cards: [] }),
    });

    const res = await pushPOST(req);

    expect(res.status).toBe(403);
    // Firestore MUST NOT be called for write
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalled();
    expect(mockSetCards).not.toHaveBeenCalled();
  });

  it("does NOT write cards when IDOR is blocked", async () => {
    authzDenied403();
    const attackerCards = [makeCard({ id: "attacker-card" })];

    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer attacker-token" },
      body: JSON.stringify({ householdId: "victim-hh", cards: attackerCards }),
    });

    await pushPOST(req);

    expect(mockSetCards).not.toHaveBeenCalled();
  });

  it("returns 200 for a legitimate user with the correct householdId (no regression)", async () => {
    authzAllowed("my-hh");
    mockGetAllFirestoreCards.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer legit-token" },
      body: JSON.stringify({ householdId: "my-hh", cards: [makeCard()] }),
    });

    const res = await pushPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { cards: Card[]; syncedCount: number };
    expect(body.syncedCount).toBeGreaterThanOrEqual(0);
  });

  it("route calls requireAuthz with the body householdId (so membership check fires)", async () => {
    authzAllowed("my-hh");

    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer legit-token" },
      body: JSON.stringify({ householdId: "my-hh", cards: [] }),
    });

    await pushPOST(req);

    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ householdId: "my-hh", tier: "karl" }),
    );
  });

  it("Firestore is called with authz.firestoreUser.householdId, never the raw body param", async () => {
    authzAllowed("server-verified-hh");

    const req = new NextRequest("http://localhost/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify({ householdId: "client-supplied-hh", cards: [] }),
    });

    await pushPOST(req);

    expect(mockGetAllFirestoreCards).toHaveBeenCalledWith("server-verified-hh");
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalledWith("client-supplied-hh");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEV-003: GET /api/household/invite/validate — PII leak (fixed in #1199)
// ═══════════════════════════════════════════════════════════════════════════════

describe("SEV-003 #1199 — GET /api/household/invite/validate PII fix", () => {
  // Import the mocked firestore functions for this group
  let mockRequireAuth: ReturnType<typeof vi.fn>;
  let mockFindHousehold: ReturnType<typeof vi.fn>;
  let mockGetUserFn: ReturnType<typeof vi.fn>;
  let mockGetCardsFn: ReturnType<typeof vi.fn>;
  let mockGetUsersByHh: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const firestoreMod = await import("@/lib/firebase/firestore");
    const authMod = await import("@/lib/auth/require-auth");

    mockRequireAuth = vi.mocked(authMod.requireAuth);
    mockFindHousehold = vi.mocked(firestoreMod.findHouseholdByInviteCode);
    mockGetUserFn = vi.mocked(firestoreMod.getUser);
    mockGetCardsFn = vi.mocked(firestoreMod.getCards);
    mockGetUsersByHh = vi.mocked(firestoreMod.getUsersByHouseholdId);

    mockRequireAuth.mockResolvedValue({
      ok: true as const,
      user: { sub: "joiner-uid", email: "joiner@example.com", name: "Björn", picture: "" },
    });
    mockFindHousehold.mockResolvedValue(baseHousehold);
    mockGetUserFn.mockResolvedValue(callerUserFirestore);
    mockGetCardsFn.mockResolvedValue([]);
    mockGetUsersByHh.mockResolvedValue([ownerMember]);
  });

  it("SEV-003: members[] does NOT contain email field (PII stripped)", async () => {
    const req = new NextRequest(
      "http://localhost/api/household/invite/validate?code=X7K2NP",
      { headers: { Authorization: "Bearer valid-token" } },
    );

    const res = await validateGET(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { members: Array<Record<string, unknown>> };
    expect(body.members).toHaveLength(1);

    // Email MUST NOT appear in any member object
    for (const member of body.members) {
      expect(member).not.toHaveProperty("email");
      expect(Object.keys(member)).not.toContain("email");
    }
  });

  it("SEV-003: members[] email is absent even when member has email in Firestore", async () => {
    // ownerMember has email: "thor@example.com" in Firestore — must not appear in response
    mockGetUsersByHh.mockResolvedValue([
      { ...ownerMember, email: "thor@example.com" },
    ]);

    const req = new NextRequest(
      "http://localhost/api/household/invite/validate?code=X7K2NP",
      { headers: { Authorization: "Bearer valid-token" } },
    );

    const res = await validateGET(req);
    const body = await res.json() as { members: Array<Record<string, unknown>> };

    // Even though Firestore has the email, the API response must not include it
    expect(body.members[0]).not.toHaveProperty("email");
    expect(JSON.stringify(body.members)).not.toContain("thor@example.com");
  });

  it("SEV-003: members[] still includes displayName (required for UI)", async () => {
    const req = new NextRequest(
      "http://localhost/api/household/invite/validate?code=X7K2NP",
      { headers: { Authorization: "Bearer valid-token" } },
    );

    const res = await validateGET(req);
    const body = await res.json() as { members: Array<{ displayName: string; role: string }> };

    expect(body.members[0]).toHaveProperty("displayName", "Thorvald");
  });

  it("SEV-003: members[] still includes role (required for UI)", async () => {
    const req = new NextRequest(
      "http://localhost/api/household/invite/validate?code=X7K2NP",
      { headers: { Authorization: "Bearer valid-token" } },
    );

    const res = await validateGET(req);
    const body = await res.json() as { members: Array<{ displayName: string; role: string }> };

    expect(body.members[0]).toHaveProperty("role", "owner");
  });

  it("SEV-003: multiple members — email absent from all of them", async () => {
    const member1 = { ...ownerMember, email: "thor@example.com" };
    const member2 = {
      clerkUserId: "sigrid-uid",
      email: "sigrid@example.com",
      displayName: "Sigrid",
      householdId: "hh-target",
      role: "member" as const,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    mockGetUsersByHh.mockResolvedValue([member1, member2]);

    const req = new NextRequest(
      "http://localhost/api/household/invite/validate?code=X7K2NP",
      { headers: { Authorization: "Bearer valid-token" } },
    );

    const res = await validateGET(req);
    const body = await res.json() as { members: Array<Record<string, unknown>> };

    expect(body.members).toHaveLength(2);
    for (const member of body.members) {
      expect(member).not.toHaveProperty("email");
    }
    // Full JSON body must not contain any email address
    expect(JSON.stringify(body.members)).not.toContain("@example.com");
  });
});

// Audit log tests live in a separate file so requireAuthz runs for real:
//   src/__tests__/sync/idor-audit-log-1199.loki.test.ts
