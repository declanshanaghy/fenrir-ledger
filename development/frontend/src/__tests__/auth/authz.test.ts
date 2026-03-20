/**
 * Unit tests for requireAuthz() — Fenrir Ledger
 *
 * Tests the centralized authorization module that sequences:
 *   1. Authentication (requireAuth)
 *   2. User resolution (getUser → FirestoreUser)
 *   3. Household membership check
 *   4. Tier check (karl / karl-or-trial)
 *   5. Audit logging on every denial
 *
 * All external dependencies are mocked via vi.mock.
 *
 * @see src/lib/auth/authz.ts
 * @see architecture/adrs/ADR-015-authz-layer.md
 * @ref #1198
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { requireAuthz } from "@/lib/auth/authz";
import type { NextRequest } from "next/server";
import type { VerifiedUser } from "@/lib/auth/verify-id-token";
import type { FirestoreUser } from "@/lib/firebase/firestore-types";
import type { StoredTrial } from "@/lib/kv/trial-store";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
}));

vi.mock("@/lib/kv/trial-store", () => ({
  getTrial: vi.fn(),
  initTrial: vi.fn(),
  computeTrialStatus: vi.fn(),
}));

vi.mock("@/lib/trial-utils", () => ({
  isValidFingerprint: vi.fn((fp: string) => /^[0-9a-f]{64}$/.test(fp)),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { requireAuth } from "@/lib/auth/require-auth";
import { getUser } from "@/lib/firebase/firestore";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { getTrial, initTrial, computeTrialStatus } from "@/lib/kv/trial-store";
import { log } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_FINGERPRINT = "a".repeat(64);

const KARL_USER: VerifiedUser = {
  sub: "google-sub-karl",
  email: "karl@fenrir.dev",
  name: "Karl the Worthy",
  picture: "https://example.com/karl.jpg",
};

const THRALL_USER: VerifiedUser = {
  sub: "google-sub-thrall",
  email: "thrall@fenrir.dev",
  name: "Thrall the Free",
  picture: "https://example.com/thrall.jpg",
};

const FIRESTORE_USER: FirestoreUser = {
  userId: "google-sub-karl",
  email: "karl@fenrir.dev",
  displayName: "Karl the Worthy",
  householdId: "household-abc",
  role: "owner",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const THRALL_FIRESTORE_USER: FirestoreUser = {
  userId: "google-sub-thrall",
  email: "thrall@fenrir.dev",
  displayName: "Thrall the Free",
  householdId: "household-abc",
  role: "member",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const KARL_ENTITLEMENT = {
  tier: "karl" as const,
  active: true,
  stripeCustomerId: "cus_karl123",
  stripeSubscriptionId: "sub_karl123",
  stripeStatus: "active",
  linkedAt: "2024-01-01T00:00:00Z",
  checkedAt: "2024-01-15T00:00:00Z",
};

const ACTIVE_TRIAL: StoredTrial = {
  startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
};

function makeRequest(
  headers: Record<string, string> = {},
  url = "http://localhost:3000/api/test",
): NextRequest {
  const headerMap = new Map(Object.entries(headers));
  return {
    headers: { get: (name: string) => headerMap.get(name.toLowerCase()) ?? null },
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

function makeAuthSuccess(user: VerifiedUser) {
  return Promise.resolve({ ok: true as const, user });
}

function makeAuthFailure(status: number, error: string) {
  const { NextResponse } = require("next/server");
  return Promise.resolve({
    ok: false as const,
    response: NextResponse.json({ error }, { status }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireAuthz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Auth-only (no requirements)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true with user and firestoreUser when no requirements", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    const result = await requireAuthz(makeRequest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toEqual(KARL_USER);
      expect(result.firestoreUser).toEqual(FIRESTORE_USER);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 401 — missing/invalid token
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 401 when no Authorization header", async () => {
    vi.mocked(requireAuth).mockReturnValue(
      makeAuthFailure(401, "missing_token"),
    );

    const result = await requireAuthz(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    vi.mocked(requireAuth).mockReturnValue(
      makeAuthFailure(401, "invalid_token"),
    );

    const result = await requireAuthz(
      makeRequest({ authorization: "Bearer bad-token" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 403 — user not found in Firestore
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 403 when getUser returns null (user not bootstrapped)", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(null);

    const result = await requireAuthz(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(403);
      expect(body.error).toBe("forbidden");
    }
  });

  it("logs warn with reason user_not_found when user doc missing", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(null);

    await requireAuthz(makeRequest());

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({ reason: "user_not_found" }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Household membership checks
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true when supplied householdId matches firestoreUser.householdId", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    const result = await requireAuthz(makeRequest(), {
      householdId: "household-abc",
      tier: "karl",
    });

    expect(result.ok).toBe(true);
  });

  it("returns ok:true when supplied householdId matches user's Google sub (legacy client compat)", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    // Client sends session.user.sub as householdId (localStorage key pattern).
    // This differs from firestoreUser.householdId but should be accepted
    // because it matches the authenticated user's own Google sub.
    const result = await requireAuthz(makeRequest(), {
      householdId: KARL_USER.sub, // "google-sub-karl" !== "household-abc"
      tier: "karl",
    });

    expect(result.ok).toBe(true);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("returns 403 when supplied householdId does not match", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    const result = await requireAuthz(makeRequest(), {
      householdId: "household-WRONG",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(403);
      expect(body.error).toBe("forbidden");
    }
  });

  it("logs warn with household_mismatch reason and both IDs on household mismatch", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    await requireAuthz(makeRequest(), { householdId: "household-WRONG" });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({
        reason: "household_mismatch",
        googleSub: KARL_USER.sub,
        suppliedHouseholdId: "household-WRONG",
        actualHouseholdId: "household-abc",
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tier: "karl"
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true for valid Karl user with tier: karl", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    const result = await requireAuthz(makeRequest(), { tier: "karl" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.firestoreUser).toEqual(FIRESTORE_USER);
    }
  });

  it("returns 403 for thrall user with tier: karl", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);

    const result = await requireAuthz(makeRequest(), { tier: "karl" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(403);
      expect(body.error).toBe("forbidden");
      expect(body.required_tier).toBe("karl");
      expect(body.current_tier).toBe("thrall");
    }
  });

  it("returns 403 for inactive Karl subscription with tier: karl", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue({
      ...KARL_ENTITLEMENT,
      active: false,
      stripeStatus: "canceled",
    });

    const result = await requireAuthz(makeRequest(), { tier: "karl" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("logs warn with tier_required_karl reason on Karl tier denial", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);

    await requireAuthz(makeRequest(), { tier: "karl" });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({
        reason: "tier_required_karl",
        googleSub: THRALL_USER.sub,
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tier: "karl-or-trial"
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true for Karl user with tier: karl-or-trial", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    const result = await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(result.ok).toBe(true);
    expect(getTrial).not.toHaveBeenCalled();
  });

  it("returns ok:true for trial user with tier: karl-or-trial and active trial", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(ACTIVE_TRIAL);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 25, status: "active" });

    const result = await requireAuthz(
      makeRequest({ "x-trial-fingerprint": VALID_FINGERPRINT }),
      { tier: "karl-or-trial" },
    );

    expect(result.ok).toBe(true);
  });

  it("returns 402 for thrall user with tier: karl-or-trial and no trial", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(null);
    vi.mocked(initTrial).mockResolvedValue(ACTIVE_TRIAL);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "none" });

    const result = await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(402);
      expect(body.error).toBe("subscription_required");
    }
  });

  it("returns 402 for thrall user with tier: karl-or-trial and expired trial", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue({
      startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    });
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "expired" });

    const result = await requireAuthz(
      makeRequest({ "x-trial-fingerprint": VALID_FINGERPRINT }),
      { tier: "karl-or-trial" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(402);
    }
  });

  it("logs warn with tier_required_karl_or_trial reason on karl-or-trial denial", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(null);
    vi.mocked(initTrial).mockResolvedValue(ACTIVE_TRIAL);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "none" });

    await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({
        reason: "tier_required_karl_or_trial",
        googleSub: THRALL_USER.sub,
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Combined: householdId + tier
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true for Karl user with correct householdId and tier:karl", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    const result = await requireAuthz(makeRequest(), {
      householdId: "household-abc",
      tier: "karl",
    });

    expect(result.ok).toBe(true);
  });

  it("returns 403 on household mismatch even if tier check would pass", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    const result = await requireAuthz(makeRequest(), {
      householdId: "household-WRONG",
      tier: "karl",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
    // Tier check should not be reached
    expect(getStripeEntitlement).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Audit logging on 403
  // ═══════════════════════════════════════════════════════════════════════

  it("always calls log.warn with googleSub and route on any denial", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);

    await requireAuthz(
      makeRequest({}, "http://localhost:3000/api/sync/pull"),
      { tier: "karl" },
    );

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({
        googleSub: KARL_USER.sub,
        route: "/api/sync/pull",
      }),
    );
  });

  it("does not call log.warn on successful authorization", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    await requireAuthz(makeRequest(), {
      householdId: "household-abc",
      tier: "karl",
    });

    expect(log.warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Loki edge cases (merged from authz.loki.test.ts — issue #1198)
// ---------------------------------------------------------------------------

describe("requireAuthz — Loki edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Boundary: empty-string householdId triggers the check
  // ═══════════════════════════════════════════════════════════════════════

  it("treats empty-string householdId as a supplied value — triggers check → 403", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER); // householdId: "household-abc"

    // Empty string does not match "household-abc" → must be rejected
    const result = await requireAuthz(makeRequest(), { householdId: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("logs household_mismatch when empty-string householdId supplied", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    await requireAuthz(makeRequest(), { householdId: "" });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({
        reason: "household_mismatch",
        suppliedHouseholdId: "",
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // IDOR invariant: success carries server-resolved householdId
  // ═══════════════════════════════════════════════════════════════════════

  it("success result firestoreUser.householdId is server-resolved, not caller-supplied", async () => {
    const CALLER_SUPPLIED = "household-abc"; // happens to match, but still
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER); // householdId: "household-abc"
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    const result = await requireAuthz(makeRequest(), {
      householdId: CALLER_SUPPLIED,
      tier: "karl",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Must be the value from Firestore, not the caller-supplied string
      expect(result.firestoreUser.householdId).toBe(
        FIRESTORE_USER.householdId,
      );
      // Verify the Firestore user object is the actual document
      expect(result.firestoreUser).toEqual(FIRESTORE_USER);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Security: no actualHouseholdId leakage in 403 response body
  // ═══════════════════════════════════════════════════════════════════════

  it("403 response body on household mismatch does not expose actualHouseholdId", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    const result = await requireAuthz(makeRequest(), {
      householdId: "household-ATTACKER",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      // Actual householdId must NOT appear in the response body
      expect(JSON.stringify(body)).not.toContain("household-abc");
    }
  });

  it("403 response body on household mismatch does not expose suppliedHouseholdId from internal logs", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    const result = await requireAuthz(makeRequest(), {
      householdId: "household-ATTACKER",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      // Body should be generic — no specific household IDs
      expect(body.error).toBe("forbidden");
      expect(body).not.toHaveProperty("actualHouseholdId");
      expect(body).not.toHaveProperty("suppliedHouseholdId");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Explicit undefined tier = auth-only (no tier gate run)
  // ═══════════════════════════════════════════════════════════════════════

  it("explicit { tier: undefined } skips tier check — auth-only → success", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    // Thrall would fail tier:karl, but with tier:undefined no tier check
    const result = await requireAuthz(makeRequest(), { tier: undefined });

    expect(result.ok).toBe(true);
    expect(getStripeEntitlement).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tier check: getStripeEntitlement not called when tier not specified
  // ═══════════════════════════════════════════════════════════════════════

  it("getStripeEntitlement is not called when no tier requirement", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    await requireAuthz(makeRequest());

    expect(getStripeEntitlement).not.toHaveBeenCalled();
  });

  it("getStripeEntitlement is not called when only householdId requirement (no tier)", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    await requireAuthz(makeRequest(), { householdId: "household-abc" });

    expect(getStripeEntitlement).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Pipeline short-circuits: 401 prevents getUser call
  // ═══════════════════════════════════════════════════════════════════════

  it("getUser is not called when requireAuth returns 401", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockReturnValue(
      Promise.resolve({
        ok: false as const,
        response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      }),
    );

    await requireAuthz(makeRequest(), { tier: "karl" });

    expect(getUser).not.toHaveBeenCalled();
    expect(getStripeEntitlement).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 402 vs 403 response codes — correct HTTP semantics
  // ═══════════════════════════════════════════════════════════════════════

  it("tier:karl denial returns 403 Forbidden (not 402)", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);

    const result = await requireAuthz(makeRequest(), { tier: "karl" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(result.response.status).not.toBe(402);
    }
  });

  it("tier:karl-or-trial denial returns 402 Payment Required (not 403)", async () => {
    const { computeTrialStatus } = await import("@/lib/kv/trial-store");
    const { getTrial, initTrial } = await import("@/lib/kv/trial-store");

    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(null);
    vi.mocked(initTrial).mockResolvedValue({ startDate: new Date().toISOString() });
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "none" });

    const result = await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(402);
      expect(result.response.status).not.toBe(403);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // log.warn not called on all-green success
  // ═══════════════════════════════════════════════════════════════════════

  it("log.warn is never called when all checks pass (auth-only)", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    await requireAuthz(makeRequest());

    expect(log.warn).not.toHaveBeenCalled();
  });

  it("log.warn is never called when Karl tier passes", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    await requireAuthz(makeRequest(), { tier: "karl" });

    expect(log.warn).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ADR-015 document completeness
  // ═══════════════════════════════════════════════════════════════════════

  it("ADR-015 document exists at architecture/adrs/ADR-015-authz-layer.md", () => {
    const adrPath = path.resolve(
      __dirname,
      "../../../../../architecture/adrs/ADR-015-authz-layer.md",
    );
    expect(fs.existsSync(adrPath)).toBe(true);
  });

  it("ADR-015 has Status: Accepted", () => {
    const adrPath = path.resolve(
      __dirname,
      "../../../../../architecture/adrs/ADR-015-authz-layer.md",
    );
    const content = fs.readFileSync(adrPath, "utf-8");
    expect(content).toMatch(/\*\*Status:\*\*\s*Accepted/);
  });

  it("ADR-015 covers Context section", () => {
    const adrPath = path.resolve(
      __dirname,
      "../../../../../architecture/adrs/ADR-015-authz-layer.md",
    );
    const content = fs.readFileSync(adrPath, "utf-8");
    expect(content).toContain("## Context");
  });

  it("ADR-015 covers Decision section", () => {
    const adrPath = path.resolve(
      __dirname,
      "../../../../../architecture/adrs/ADR-015-authz-layer.md",
    );
    const content = fs.readFileSync(adrPath, "utf-8");
    expect(content).toContain("## Decision");
  });

  it("ADR-015 covers Consequences section", () => {
    const adrPath = path.resolve(
      __dirname,
      "../../../../../architecture/adrs/ADR-015-authz-layer.md",
    );
    const content = fs.readFileSync(adrPath, "utf-8");
    expect(content).toContain("## Consequences");
  });

  it("ADR-015 documents the IDOR fix pattern", () => {
    const adrPath = path.resolve(
      __dirname,
      "../../../../../architecture/adrs/ADR-015-authz-layer.md",
    );
    const content = fs.readFileSync(adrPath, "utf-8");
    expect(content).toContain("IDOR");
    expect(content).toContain("firestoreUser.householdId");
  });

  it("ADR-015 references issue #1198", () => {
    const adrPath = path.resolve(
      __dirname,
      "../../../../../architecture/adrs/ADR-015-authz-layer.md",
    );
    const content = fs.readFileSync(adrPath, "utf-8");
    expect(content).toContain("1198");
  });

  it("ADR-015 documents audit logging requirement", () => {
    const adrPath = path.resolve(
      __dirname,
      "../../../../../architecture/adrs/ADR-015-authz-layer.md",
    );
    const content = fs.readFileSync(adrPath, "utf-8");
    expect(content).toMatch(/audit/i);
    expect(content).toMatch(/log\.warn/);
  });
});
