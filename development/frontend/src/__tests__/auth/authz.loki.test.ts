/**
 * Loki QA — additional tests for requireAuthz()
 *
 * Supplements FiremanDecko's authz.test.ts with edge cases, boundary
 * conditions, and security invariants that devil's-advocate QA should cover.
 *
 * Focus areas:
 *   - Empty-string householdId boundary (should trigger check, not skip it)
 *   - IDOR invariant: success result carries server-resolved householdId
 *   - No information leakage of actualHouseholdId in 403 response body
 *   - Explicit undefined tier treated as auth-only (no tier check)
 *   - ADR-015 document completeness
 *   - Tier check skipped entirely when not specified
 *   - log.warn NOT called on success paths
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
import { log } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
  clerkUserId: "google-sub-karl",
  email: "karl@fenrir.dev",
  displayName: "Karl the Worthy",
  householdId: "household-abc",
  role: "owner",
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

// ---------------------------------------------------------------------------
// Tests
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
