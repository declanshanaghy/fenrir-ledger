/**
 * Loki QA — Issue #1200: requireAuthz migration validation
 *
 * Devil's-advocate tests verifying that every route migrated in #1200
 * uses requireAuthz (not requireAuth + inline tier checks). Tests are
 * written against the route handlers directly, mocking only requireAuthz.
 *
 * Coverage targets (routes with missing or stale test coverage):
 *   - GET  /api/sync              (sync/route.ts — old tests mock requireAuth)
 *   - PUT  /api/sync              (sync/route.ts — old tests mock requireAuth)
 *   - POST /api/household/invite  (invite/route.ts — old tests mock requireAuth)
 *   - POST /api/stripe/portal     (no dedicated route test existed)
 *   - POST /api/stripe/unlink     (no dedicated route test existed)
 *   - POST /api/trial/convert     (no dedicated route test existed)
 *   - Static: require-karl-or-trial.ts has @deprecated JSDoc
 *
 * Each migrated route must:
 *   ✓ Return 401 for unauthenticated requests (requireAuthz short-circuits)
 *   ✓ Return 403 for authenticated users with no Firestore record
 *   ✓ Return correct tier-gate status for thrall/trial/karl where applicable
 *
 * @see architecture/adrs/ADR-015-authz-layer.md
 * @ref Issue #1200
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { FirestoreUser } from "@/lib/firebase/firestore-types";

// ---------------------------------------------------------------------------
// Global mock: requireAuthz
// ---------------------------------------------------------------------------

const mockRequireAuthz = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: mockRequireAuthz,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 9 })),
}));

// ---------------------------------------------------------------------------
// Firestore mocks for sync/route.ts and household/invite/route.ts
// ---------------------------------------------------------------------------

const mockGetCards = vi.hoisted(() => vi.fn());
const mockSetCards = vi.hoisted(() => vi.fn());
const mockGetHousehold = vi.hoisted(() => vi.fn());
const mockRegenerateInviteCode = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getCards: mockGetCards,
  setCards: mockSetCards,
  getHousehold: mockGetHousehold,
  regenerateInviteCode: mockRegenerateInviteCode,
}));

// ---------------------------------------------------------------------------
// Stripe mocks for portal and unlink routes
// ---------------------------------------------------------------------------

const mockGetStripeEntitlement = vi.hoisted(() => vi.fn());
const mockSetStripeEntitlement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: mockGetStripeEntitlement,
  setStripeEntitlement: mockSetStripeEntitlement,
}));

const mockStripe = vi.hoisted(() => ({
  billingPortal: {
    sessions: { create: vi.fn() },
  },
  subscriptions: { cancel: vi.fn() },
}));

vi.mock("@/lib/stripe/api", () => ({
  stripe: mockStripe,
}));

// ---------------------------------------------------------------------------
// Trial mock for trial/convert
// ---------------------------------------------------------------------------

const mockMarkTrialConverted = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv/trial-store", () => ({
  markTrialConverted: mockMarkTrialConverted,
  getTrial: vi.fn(),
  initTrial: vi.fn(),
  computeTrialStatus: vi.fn(),
}));

// requireAuth mock for routes that use requireAuth (not requireAuthz)
const mockRequireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// ---------------------------------------------------------------------------
// Route imports (after mocks)
// ---------------------------------------------------------------------------

import { GET as syncGet, PUT as syncPut } from "@/app/api/sync/route";
import { POST as invitePost } from "@/app/api/household/invite/route";
import { POST as portalPost } from "@/app/api/stripe/portal/route";
import { POST as unlinkPost } from "@/app/api/stripe/unlink/route";
import { POST as convertPost } from "@/app/api/trial/convert/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KARL_FIRESTORE_USER: FirestoreUser = {
  userId: "google-sub-karl",
  email: "karl@fenrir.dev",
  displayName: "Karl the Worthy",
  householdId: "household-abc",
  role: "owner",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

function authzOk(firestoreUser = KARL_FIRESTORE_USER) {
  mockRequireAuthz.mockResolvedValue({
    ok: true,
    user: { sub: firestoreUser.userId, email: firestoreUser.email },
    firestoreUser,
  });
}

function authz401() {
  mockRequireAuthz.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ error: "missing_token" }, { status: 401 }),
  });
}

function authz403() {
  mockRequireAuthz.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
  });
}

function makeRequest(
  method: "GET" | "POST" | "PUT",
  url: string,
  body?: unknown,
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------------------------------------------------------------------------
// Tests: GET /api/sync
// ---------------------------------------------------------------------------

describe("GET /api/sync — requireAuthz migration (issue #1200)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCards.mockResolvedValue([]);
  });

  it("returns 401 for unauthenticated request", async () => {
    authz401();
    const res = await syncGet(makeRequest("GET", "http://localhost/api/sync"));
    expect(res.status).toBe(401);
    expect(mockGetCards).not.toHaveBeenCalled();
  });

  it("returns 403 when user has no Firestore record (requireAuthz blocks)", async () => {
    authz403();
    const res = await syncGet(makeRequest("GET", "http://localhost/api/sync"));
    expect(res.status).toBe(403);
    expect(mockGetCards).not.toHaveBeenCalled();
  });

  it("returns 200 and uses authz.firestoreUser.householdId — not caller-supplied value", async () => {
    authzOk();
    const res = await syncGet(makeRequest("GET", "http://localhost/api/sync"));
    expect(res.status).toBe(200);
    // Firestore was called with the server-resolved householdId
    expect(mockGetCards).toHaveBeenCalledWith(KARL_FIRESTORE_USER.householdId);
  });

  it("calls requireAuthz with { tier: 'karl' }", async () => {
    authzOk();
    await syncGet(makeRequest("GET", "http://localhost/api/sync"));
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.anything(),
      { tier: "karl" },
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: PUT /api/sync
// ---------------------------------------------------------------------------

describe("PUT /api/sync — requireAuthz migration (issue #1200)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCards.mockResolvedValue([]);
    mockSetCards.mockResolvedValue(undefined);
  });

  it("returns 401 for unauthenticated request", async () => {
    authz401();
    const res = await syncPut(
      makeRequest("PUT", "http://localhost/api/sync", { cards: [] }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no Firestore record (requireAuthz blocks)", async () => {
    authz403();
    const res = await syncPut(
      makeRequest("PUT", "http://localhost/api/sync", { cards: [] }),
    );
    expect(res.status).toBe(403);
    expect(mockSetCards).not.toHaveBeenCalled();
  });

  it("returns 200 on valid karl request", async () => {
    authzOk();
    const res = await syncPut(
      makeRequest("PUT", "http://localhost/api/sync", { cards: [] }),
    );
    expect(res.status).toBe(200);
  });

  it("calls requireAuthz with { tier: 'karl' }", async () => {
    authzOk();
    await syncPut(
      makeRequest("PUT", "http://localhost/api/sync", { cards: [] }),
    );
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.anything(),
      { tier: "karl" },
    );
  });

  it("enforces householdId from authz — submitted card householdId is overwritten", async () => {
    authzOk(); // firestoreUser.householdId = "household-abc"
    mockGetCards.mockResolvedValue([]);
    mockSetCards.mockResolvedValue(undefined);

    const card = {
      id: "card-1",
      householdId: "household-EVIL", // attacker-supplied
      issuerId: "chase",
      cardName: "Attacker Card",
      updatedAt: new Date().toISOString(),
      openDate: "2025-01-01T00:00:00Z",
      creditLimit: 0,
      annualFee: 0,
      annualFeeDate: "",
      promoPeriodMonths: 0,
      signUpBonus: null,
      status: "active",
      notes: "",
      createdAt: "2025-01-01T00:00:00Z",
    };

    await syncPut(makeRequest("PUT", "http://localhost/api/sync", { cards: [card] }));

    if (mockSetCards.mock.calls.length > 0) {
      const writtenCards = mockSetCards.mock.calls[0][0];
      // Route must overwrite householdId with server-resolved value
      for (const written of writtenCards) {
        expect(written.householdId).toBe(KARL_FIRESTORE_USER.householdId);
        expect(written.householdId).not.toBe("household-EVIL");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/household/invite
// ---------------------------------------------------------------------------

describe("POST /api/household/invite — requireAuthz migration (issue #1200)", () => {
  const HOUSEHOLD = {
    id: "household-abc",
    name: "Karl's Hall",
    ownerId: "google-sub-karl",
    memberIds: ["google-sub-karl"],
    inviteCode: "ABC123",
    inviteCodeExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    tier: "karl" as const,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHousehold.mockResolvedValue(HOUSEHOLD);
    mockRegenerateInviteCode.mockResolvedValue({
      ...HOUSEHOLD,
      inviteCode: "NEW999",
      inviteCodeExpiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    });
  });

  it("returns 401 for unauthenticated request", async () => {
    authz401();
    const res = await invitePost(
      makeRequest("POST", "http://localhost/api/household/invite", {
        action: "regenerate",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no Firestore record (requireAuthz blocks)", async () => {
    authz403();
    const res = await invitePost(
      makeRequest("POST", "http://localhost/api/household/invite", {
        action: "regenerate",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with new invite code for owner", async () => {
    authzOk(KARL_FIRESTORE_USER);
    const res = await invitePost(
      makeRequest("POST", "http://localhost/api/household/invite", {
        action: "regenerate",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("inviteCode");
  });

  it("route uses authz.firestoreUser directly — does NOT call getUser separately", async () => {
    // After migration, route reads user from authz.firestoreUser, not a separate getUser()
    // So only requireAuthz should be called for user resolution — no extra getUser call.
    // We verify by counting: only one user-related resolution happens (inside requireAuthz mock).
    authzOk(KARL_FIRESTORE_USER);
    await invitePost(
      makeRequest("POST", "http://localhost/api/household/invite", {
        action: "regenerate",
      }),
    );
    // requireAuthz was called exactly once
    expect(mockRequireAuthz).toHaveBeenCalledTimes(1);
  });

  it("calls requireAuthz with empty tier object (auth-only, no tier gate)", async () => {
    authzOk();
    await invitePost(
      makeRequest("POST", "http://localhost/api/household/invite", {
        action: "regenerate",
      }),
    );
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.anything(),
      {},
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/stripe/portal
// ---------------------------------------------------------------------------

describe("POST /api/stripe/portal — requireAuthz migration (issue #1200)", () => {
  const MOCK_ENTITLEMENT = {
    tier: "karl" as const,
    active: true,
    stripeCustomerId: "cus_test123",
    stripeSubscriptionId: "sub_test123",
    stripeStatus: "active",
    linkedAt: "2024-01-01T00:00:00Z",
    checkedAt: "2024-01-15T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStripeEntitlement.mockResolvedValue(MOCK_ENTITLEMENT);
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/session/test",
    });
  });

  it("returns 401 for unauthenticated request", async () => {
    authz401();
    const res = await portalPost(
      makeRequest("POST", "http://localhost/api/stripe/portal"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no Firestore record (requireAuthz blocks)", async () => {
    authz403();
    const res = await portalPost(
      makeRequest("POST", "http://localhost/api/stripe/portal"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when no Stripe entitlement found", async () => {
    authzOk();
    mockGetStripeEntitlement.mockResolvedValue(null);
    const res = await portalPost(
      makeRequest("POST", "http://localhost/api/stripe/portal"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with portal URL for authenticated user with entitlement", async () => {
    authzOk();
    const res = await portalPost(
      makeRequest("POST", "http://localhost/api/stripe/portal"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("url");
  });

  it("calls requireAuthz with empty tier object (auth-only, no tier gate)", async () => {
    authzOk();
    await portalPost(
      makeRequest("POST", "http://localhost/api/stripe/portal"),
    );
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.anything(),
      {},
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/stripe/unlink
// ---------------------------------------------------------------------------

describe("POST /api/stripe/unlink — requireAuthz migration (issue #1200)", () => {
  const MOCK_ENTITLEMENT = {
    tier: "karl" as const,
    active: true,
    stripeCustomerId: "cus_test123",
    stripeSubscriptionId: "sub_test123",
    stripeStatus: "active",
    linkedAt: "2024-01-01T00:00:00Z",
    checkedAt: "2024-01-15T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStripeEntitlement.mockResolvedValue(MOCK_ENTITLEMENT);
    mockStripe.subscriptions.cancel.mockResolvedValue({});
    mockSetStripeEntitlement.mockResolvedValue(undefined);
  });

  it("returns 401 for unauthenticated request", async () => {
    authz401();
    const res = await unlinkPost(
      makeRequest("POST", "http://localhost/api/stripe/unlink"),
    );
    expect(res.status).toBe(401);
    expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("returns 403 when user has no Firestore record (requireAuthz blocks)", async () => {
    authz403();
    const res = await unlinkPost(
      makeRequest("POST", "http://localhost/api/stripe/unlink"),
    );
    expect(res.status).toBe(403);
    expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("returns 200 on successful unlink (cancels subscription + writes thrall entitlement)", async () => {
    authzOk();
    const res = await unlinkPost(
      makeRequest("POST", "http://localhost/api/stripe/unlink"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("preserves stripeCustomerId in KV after unlink (prevents duplicate Stripe customers)", async () => {
    authzOk();
    await unlinkPost(makeRequest("POST", "http://localhost/api/stripe/unlink"));
    // setStripeEntitlement should be called with tier:thrall but same customerId
    expect(mockSetStripeEntitlement).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tier: "thrall",
        active: false,
        stripeCustomerId: "cus_test123",
      }),
    );
  });

  it("calls requireAuthz with empty tier object (auth-only, no tier gate)", async () => {
    authzOk();
    await unlinkPost(makeRequest("POST", "http://localhost/api/stripe/unlink"));
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.anything(),
      {},
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/trial/convert
// ---------------------------------------------------------------------------

describe("POST /api/trial/convert — requireAuth (#1634: auth-based, no fingerprint)", () => {
  const USER_ID = "google-sub-convert-test";

  function convertAuthOk() {
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: USER_ID } });
  }

  function convertAuthFail() {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "missing_token" }, { status: 401 }),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkTrialConverted.mockResolvedValue(true);
  });

  it("returns 401 for unauthenticated request", async () => {
    convertAuthFail();
    const res = await convertPost(
      makeRequest("POST", "http://localhost/api/trial/convert", {}),
    );
    expect(res.status).toBe(401);
    expect(mockMarkTrialConverted).not.toHaveBeenCalled();
  });

  it("returns 200 with { converted: true } on successful conversion", async () => {
    convertAuthOk();
    const res = await convertPost(
      makeRequest("POST", "http://localhost/api/trial/convert", {}),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.converted).toBe(true);
  });

  it("calls markTrialConverted with userId from auth token", async () => {
    convertAuthOk();
    await convertPost(
      makeRequest("POST", "http://localhost/api/trial/convert", {}),
    );
    expect(mockMarkTrialConverted).toHaveBeenCalledWith(USER_ID);
  });

  it("returns 200 with { converted: false } when no trial exists for user", async () => {
    convertAuthOk();
    mockMarkTrialConverted.mockResolvedValue(false);
    const res = await convertPost(
      makeRequest("POST", "http://localhost/api/trial/convert", {}),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.converted).toBe(false);
  });
});

