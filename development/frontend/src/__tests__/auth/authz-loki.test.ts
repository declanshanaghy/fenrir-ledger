/**
 * Loki QA augmentation — trial pipeline edge cases for requireAuthz() — issue #1198
 *
 * Supplements authz.loki.test.ts (already on branch) with trial-pipeline
 * edge cases not covered by FiremanDecko or the first Loki pass:
 *   - Auto-initialized trial success path (null trial → initTrial → active → ok)
 *   - Trial initTrial error fallthrough → 402
 *   - Invalid fingerprint format skips trial branch entirely
 *   - No fingerprint header: getTrial/initTrial never called
 *   - Inactive Karl subscription + active trial passes karl-or-trial
 *
 * @see src/lib/auth/authz.ts
 * @ref #1198
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { requireAuthz } from "@/lib/auth/authz";
import type { NextRequest } from "next/server";
import type { VerifiedUser } from "@/lib/auth/verify-id-token";
import type { FirestoreUser } from "@/lib/firebase/firestore-types";
import type { StoredTrial } from "@/lib/kv/trial-store";

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
const INVALID_FINGERPRINT = "not-a-valid-hex-fingerprint";

const THRALL_USER: VerifiedUser = {
  sub: "google-sub-thrall",
  email: "thrall@fenrir.dev",
  name: "Thrall the Free",
  picture: "https://example.com/thrall.jpg",
};

const KARL_USER: VerifiedUser = {
  sub: "google-sub-karl",
  email: "karl@fenrir.dev",
  name: "Karl the Worthy",
  picture: "https://example.com/karl.jpg",
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

const THRALL_FIRESTORE_USER: FirestoreUser = {
  clerkUserId: "google-sub-thrall",
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

// ---------------------------------------------------------------------------
// Trial pipeline edge cases
// ---------------------------------------------------------------------------

describe("requireAuthz — trial pipeline edge cases (Loki augmentation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Auto-initialized trial success
  // ═══════════════════════════════════════════════════════════════════════

  it("allows access when trial is auto-initialized and active (null → initTrial → ok)", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(null); // no existing trial
    vi.mocked(initTrial).mockResolvedValue(ACTIVE_TRIAL); // auto-init succeeds
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 30, status: "active" });

    const result = await requireAuthz(
      makeRequest({ "x-trial-fingerprint": VALID_FINGERPRINT }),
      { tier: "karl-or-trial" },
    );

    expect(result.ok).toBe(true);
    expect(initTrial).toHaveBeenCalledWith(VALID_FINGERPRINT);
    expect(computeTrialStatus).toHaveBeenCalledWith(ACTIVE_TRIAL);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // initTrial error → fallthrough to 402
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 402 when initTrial throws (error falls through to denial)", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(null);
    vi.mocked(initTrial).mockRejectedValue(new Error("Redis connection failed"));
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "none" });

    const result = await requireAuthz(
      makeRequest({ "x-trial-fingerprint": VALID_FINGERPRINT }),
      { tier: "karl-or-trial" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(402);
    }
    expect(log.error).toHaveBeenCalledWith(
      "requireAuthz: failed to auto-init trial",
      expect.objectContaining({ error: "Redis connection failed" }),
    );
  });

  it("calls computeTrialStatus with null when initTrial errors (trial stays null)", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(null);
    vi.mocked(initTrial).mockRejectedValue(new Error("timeout"));
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "none" });

    await requireAuthz(
      makeRequest({ "x-trial-fingerprint": VALID_FINGERPRINT }),
      { tier: "karl-or-trial" },
    );

    expect(computeTrialStatus).toHaveBeenCalledWith(null);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Invalid fingerprint format
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 402 when fingerprint is invalid format — skips trial lookup entirely", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);

    const result = await requireAuthz(
      makeRequest({ "x-trial-fingerprint": INVALID_FINGERPRINT }),
      { tier: "karl-or-trial" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(402);
    }
    expect(getTrial).not.toHaveBeenCalled();
    expect(initTrial).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // No fingerprint header → trial path never entered
  // ═══════════════════════════════════════════════════════════════════════

  it("never calls getTrial or initTrial when no x-trial-fingerprint header", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(THRALL_USER));
    vi.mocked(getUser).mockResolvedValue(THRALL_FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);

    await requireAuthz(makeRequest(), { tier: "karl-or-trial" }); // no headers

    expect(getTrial).not.toHaveBeenCalled();
    expect(initTrial).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Inactive Karl + active trial → allowed via trial path
  // ═══════════════════════════════════════════════════════════════════════

  it("allows access when Karl subscription is inactive but trial is active", async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuthSuccess(KARL_USER));
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue({
      ...KARL_ENTITLEMENT,
      active: false,
      stripeStatus: "canceled",
    });
    vi.mocked(getTrial).mockResolvedValue(ACTIVE_TRIAL);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 15, status: "active" });

    const result = await requireAuthz(
      makeRequest({ "x-trial-fingerprint": VALID_FINGERPRINT }),
      { tier: "karl-or-trial" },
    );

    expect(result.ok).toBe(true);
    expect(log.warn).not.toHaveBeenCalled();
  });
});
