/**
 * Loki QA — authz no-auto-init contract (issue #1635)
 *
 * Validates #1635 behavioral requirements in checkKarlOrTrial():
 *   - getTrial() is called with user.sub (userId), not a fingerprint
 *   - initTrial() is NEVER called (auto-init removed in #1635)
 *   - X-Trial-Fingerprint header is ignored entirely
 *   - 402 is returned when no trial exists (not auto-init + allow)
 *
 * @see src/lib/auth/authz.ts checkKarlOrTrial()
 * @ref Issue #1635
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuthz } from "@/lib/auth/authz";
import type { NextRequest } from "next/server";
import type { VerifiedUser } from "@/lib/auth/verify-id-token";
import type { FirestoreUser } from "@/lib/firebase/firestore-types";
import type { StoredTrial } from "@/lib/kv/trial-store";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { requireAuth } from "@/lib/auth/require-auth";
import { getUser } from "@/lib/firebase/firestore";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { getTrial, initTrial, computeTrialStatus } from "@/lib/kv/trial-store";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const GOOGLE_SUB = "google-sub-1635-test";

const THRALL_USER: VerifiedUser = {
  sub: GOOGLE_SUB,
  email: "thrall1635@fenrir.dev",
  name: "Thrall 1635",
  picture: "https://example.com/1635.jpg",
};

const FIRESTORE_USER: FirestoreUser = {
  userId: GOOGLE_SUB,
  email: "thrall1635@fenrir.dev",
  displayName: "Thrall 1635",
  householdId: "hh-1635",
  role: "member",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const ACTIVE_TRIAL: StoredTrial = {
  startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
};

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const headerMap = new Map(Object.entries(headers));
  return {
    headers: { get: (name: string) => headerMap.get(name.toLowerCase()) ?? null },
    nextUrl: new URL("http://localhost:3000/api/test"),
  } as unknown as NextRequest;
}

function setupAuth(user: VerifiedUser = THRALL_USER) {
  vi.mocked(requireAuth).mockReturnValue(
    Promise.resolve({ ok: true as const, user }),
  );
  vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
  vi.mocked(getStripeEntitlement).mockResolvedValue(null); // not Karl
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("authz checkKarlOrTrial — issue #1635 no-auto-init contract", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Core #1635 requirement: getTrial called with user.sub
  // ═══════════════════════════════════════════════════════════════════════

  it("calls getTrial with user.sub (not a fingerprint or other identifier)", async () => {
    setupAuth();
    vi.mocked(getTrial).mockResolvedValue(ACTIVE_TRIAL);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 25, status: "active" });

    await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(getTrial).toHaveBeenCalledOnce();
    expect(getTrial).toHaveBeenCalledWith(GOOGLE_SUB);
  });

  it("calls getTrial with user.sub even when X-Trial-Fingerprint header is present", async () => {
    setupAuth();
    vi.mocked(getTrial).mockResolvedValue(ACTIVE_TRIAL);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 25, status: "active" });

    // Header present but must be ignored — lookup is by userId only
    await requireAuthz(
      makeRequest({ "x-trial-fingerprint": "a".repeat(64) }),
      { tier: "karl-or-trial" },
    );

    expect(getTrial).toHaveBeenCalledWith(GOOGLE_SUB);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Core #1635 requirement: no auto-init when trial is missing
  // ═══════════════════════════════════════════════════════════════════════

  it("does NOT call initTrial when trial is missing (no auto-init)", async () => {
    setupAuth();
    vi.mocked(getTrial).mockResolvedValue(null);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "none" });

    await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(initTrial).not.toHaveBeenCalled();
  });

  it("does NOT call initTrial when trial is expired", async () => {
    setupAuth();
    vi.mocked(getTrial).mockResolvedValue({
      startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "expired" });

    await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(initTrial).not.toHaveBeenCalled();
  });

  it("does NOT call initTrial when trial is converted", async () => {
    setupAuth();
    vi.mocked(getTrial).mockResolvedValue({
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      convertedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "converted" });

    await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(initTrial).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 402 returned (not auto-init) when no trial exists
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 402 immediately when no trial exists — caller must call /api/trial/init first", async () => {
    setupAuth();
    vi.mocked(getTrial).mockResolvedValue(null);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 0, status: "none" });

    const result = await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(402);
      const body = await result.response.json();
      expect(body.error).toBe("subscription_required");
    }
    // Auto-init never happens — caller must call /api/trial/init explicitly
    expect(initTrial).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Active trial still grants access (regression guard)
  // ═══════════════════════════════════════════════════════════════════════

  it("allows access when trial is active (regression: userId-based lookup works)", async () => {
    setupAuth();
    vi.mocked(getTrial).mockResolvedValue(ACTIVE_TRIAL);
    vi.mocked(computeTrialStatus).mockReturnValue({ remainingDays: 25, status: "active" });

    const result = await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(result.ok).toBe(true);
    expect(getTrial).toHaveBeenCalledWith(GOOGLE_SUB);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Karl short-circuits before getTrial (efficiency guard)
  // ═══════════════════════════════════════════════════════════════════════

  it("does NOT call getTrial when Karl entitlement is active (short-circuit)", async () => {
    vi.mocked(requireAuth).mockReturnValue(
      Promise.resolve({ ok: true as const, user: THRALL_USER }),
    );
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);
    vi.mocked(getStripeEntitlement).mockResolvedValue({
      tier: "karl" as const,
      active: true,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      stripeStatus: "active",
      linkedAt: "2026-01-01T00:00:00Z",
      checkedAt: "2026-01-01T00:00:00Z",
    });

    await requireAuthz(makeRequest(), { tier: "karl-or-trial" });

    expect(getTrial).not.toHaveBeenCalled();
    expect(initTrial).not.toHaveBeenCalled();
  });
});
