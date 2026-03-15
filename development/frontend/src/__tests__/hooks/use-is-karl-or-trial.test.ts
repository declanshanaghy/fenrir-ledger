/**
 * useIsKarlOrTrial — unit tests
 *
 * Verifies that the hook correctly grants Karl-tier access to:
 *   - Active Karl subscribers
 *   - Users with an active free trial
 *
 * And correctly denies access to:
 *   - Thrall users with no trial
 *   - Users with an expired trial and no Karl subscription
 *
 * This hook is used by ledger/page.tsx to compute `canImport`
 * (Issue #956 — import was blocked for trial users because the page
 * used hasFeature("import") alone, missing the || karlOrTrial check).
 *
 * @see src/hooks/useIsKarlOrTrial.ts
 * @ref #956
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIsKarlOrTrial } from "@/hooks/useIsKarlOrTrial";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mutable mock state — tests override these per-case
const mockEntitlement = {
  tier: "thrall" as "thrall" | "karl",
  isActive: false,
};

const mockTrialStatus = {
  status: "none" as "none" | "active" | "expired" | "converted",
};

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: () => mockTrialStatus,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function setThrallNoTrial() {
  mockEntitlement.tier = "thrall";
  mockEntitlement.isActive = false;
  mockTrialStatus.status = "none";
}

function setKarlActive() {
  mockEntitlement.tier = "karl";
  mockEntitlement.isActive = true;
  mockTrialStatus.status = "none";
}

function setTrialActive() {
  mockEntitlement.tier = "thrall";
  mockEntitlement.isActive = false;
  mockTrialStatus.status = "active";
}

function setTrialExpired() {
  mockEntitlement.tier = "thrall";
  mockEntitlement.isActive = false;
  mockTrialStatus.status = "expired";
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useIsKarlOrTrial — Thrall with no trial (baseline)", () => {
  it("returns false for a Thrall user with no trial", () => {
    setThrallNoTrial();
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(false);
  });
});

describe("useIsKarlOrTrial — Active Karl subscriber", () => {
  it("returns true for an active Karl subscriber", () => {
    setKarlActive();
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(true);
  });
});

describe("useIsKarlOrTrial — Active trial (Issue #956)", () => {
  it("returns true for a Thrall user with an active trial", () => {
    setTrialActive();
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(true);
  });

  it("canImport is true during trial (simulated ledger/page.tsx logic)", () => {
    setTrialActive();

    // Simulate what ledger/page.tsx does:
    //   const canImport = hasFeature("import") || karlOrTrial;
    // hasFeature("import") is false for Thrall; karlOrTrial must be true.
    const hasFeatureImport = false; // Thrall with no Stripe subscription
    const { result } = renderHook(() => useIsKarlOrTrial());
    const canImport = hasFeatureImport || result.current;

    expect(canImport).toBe(true);
  });
});

describe("useIsKarlOrTrial — Expired trial", () => {
  it("returns false for a user whose trial has expired and has no Karl subscription", () => {
    setTrialExpired();
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(false);
  });

  it("canImport is false after trial expiry (simulated ledger/page.tsx logic)", () => {
    setTrialExpired();

    const hasFeatureImport = false; // no active Stripe subscription
    const { result } = renderHook(() => useIsKarlOrTrial());
    const canImport = hasFeatureImport || result.current;

    expect(canImport).toBe(false);
  });
});

describe("useIsKarlOrTrial — Converted trial (Karl subscriber)", () => {
  it("returns true for a converted trial user who is now an active Karl subscriber", () => {
    // After conversion: Karl is active, trial status is "converted"
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockTrialStatus.status = "converted";
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(true);
  });
});
