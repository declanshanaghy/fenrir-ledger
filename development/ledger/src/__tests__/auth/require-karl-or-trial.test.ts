/**
 * Unit tests for requireKarlOrTrial() — Fenrir Ledger
 *
 * Tests the import entitlement guard that allows Karl subscribers OR
 * active trial users to access Google Sheets import (#892).
 *
 * All external dependencies (getStripeEntitlement, getTrial,
 * computeTrialStatus) are mocked via vi.mock.
 *
 * @see src/lib/auth/require-karl-or-trial.ts
 * @ref #892
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { requireKarlOrTrial } from "@/lib/auth/require-karl-or-trial";
import type { VerifiedUser } from "@/lib/auth/require-auth";
import type { NextRequest } from "next/server";
import type { StoredTrial } from "@/lib/kv/trial-store";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
}));

vi.mock("@/lib/kv/trial-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/kv/trial-store")>();
  return {
    ...actual,
    getTrial: vi.fn(),
    computeTrialStatus: vi.fn(),
  };
});

// trial-utils: isValidFingerprint removed in #1634 — requireKarlOrTrial no longer
// checks fingerprints; it uses user.sub directly.
vi.mock("@/lib/trial-utils", () => ({}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn() },
}));

import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { getTrial, computeTrialStatus } from "@/lib/kv/trial-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KARL_USER: VerifiedUser = {
  sub: "google-sub-karl",
  email: "karl@fenrir.dev",
  householdId: "google-sub-karl",
};

const THRALL_USER: VerifiedUser = {
  sub: "google-sub-thrall",
  email: "thrall@fenrir.dev",
  householdId: "google-sub-thrall",
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
  startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
  expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days from now
};

/**
 * Creates a minimal NextRequest mock.
 */
function makeRequest(): NextRequest {
  return {
    headers: {
      get: (_name: string) => null,
    },
  } as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireKarlOrTrial", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Karl-tier passes immediately
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true for active Karl subscriber (no trial check needed)", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    const result = await requireKarlOrTrial(KARL_USER, makeRequest());

    expect(result.ok).toBe(true);
    expect(getTrial).not.toHaveBeenCalled();
  });

  it("returns ok:true for Karl subscriber without any trial", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(KARL_ENTITLEMENT);

    const result = await requireKarlOrTrial(KARL_USER, makeRequest());

    expect(result.ok).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Active trial passes
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true for non-Karl user with active trial", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(ACTIVE_TRIAL);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 25, status: "active" });

    const result = await requireKarlOrTrial(THRALL_USER, makeRequest());

    expect(result.ok).toBe(true);
    // Function uses user.sub as trial key (no fingerprint)
    expect(getTrial).toHaveBeenCalledWith(THRALL_USER.sub);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // No trial — blocked (no auto-init since #1635)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 402 when no trial exists and user is not Karl", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(null);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "none" });

    const result = await requireKarlOrTrial(THRALL_USER, makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(402);
    }
    // No auto-init — initTrial must NOT be called
    expect(getTrial).toHaveBeenCalledWith(THRALL_USER.sub);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Expired trial is blocked
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 402 for user with expired trial (no Karl)", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue({
      startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "expired" });

    const result = await requireKarlOrTrial(THRALL_USER, makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(402);
      expect(body.error).toBe("subscription_required");
    }
  });

  it("returns 402 for user with converted (paid) trial if Karl entitlement is inactive", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue({
      ...KARL_ENTITLEMENT,
      tier: "karl",
      active: false,
      stripeStatus: "canceled",
    });
    vi.mocked(getTrial).mockResolvedValue({
      startDate: "2024-01-01T00:00:00Z",
      expiresAt: "2024-01-31T00:00:00Z",
      convertedDate: "2024-01-10T00:00:00Z",
    });
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "converted" });

    const result = await requireKarlOrTrial(THRALL_USER, makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(402);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Expired trial — full response check
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 402 when trial is expired and user has no active Karl subscription", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue({
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "expired" });

    const result = await requireKarlOrTrial(THRALL_USER, makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(402);
      expect(body.error).toBe("subscription_required");
      expect(body.required_tier).toBe("karl");
      expect(body.current_tier).toBe("thrall");
    }
    expect(getTrial).toHaveBeenCalledWith(THRALL_USER.sub);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 402 response body shape
  // ═══════════════════════════════════════════════════════════════════════

  it("402 response includes correct error shape", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);
    vi.mocked(getTrial).mockResolvedValue(null);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "none" });

    const result = await requireKarlOrTrial(THRALL_USER, makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body).toMatchObject({
        error: "subscription_required",
        required_tier: "karl",
        current_tier: "thrall",
      });
      expect(typeof body.message).toBe("string");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Inactive Karl + active trial — trial path grants access
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true via trial path when Karl subscription is inactive but trial is active", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue({
      ...KARL_ENTITLEMENT,
      active: false,
      stripeStatus: "canceled",
    });
    vi.mocked(getTrial).mockResolvedValue(ACTIVE_TRIAL);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 10, status: "active" });

    const result = await requireKarlOrTrial(THRALL_USER, makeRequest());

    expect(result.ok).toBe(true);
  });
});
