/**
 * useEntitlement — Hook integration tests
 *
 * Tests the entitlement hook's tier/feature gating logic.
 * The hook is a thin wrapper over EntitlementContext, so we mock
 * the context to test the hook's API surface.
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEntitlement } from "@/hooks/useEntitlement";
import type { EntitlementContextValue } from "@/contexts/EntitlementContext";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockContextValue: EntitlementContextValue = {
  tier: "thrall",
  active: false,
  isLinked: false,
  isLoading: false,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  hasFeature: vi.fn((feature: string) => feature === "local-storage"),
  subscribeStripe: vi.fn(),
  unlinkStripe: vi.fn(),
  refreshEntitlement: vi.fn(),
};

vi.mock("@/contexts/EntitlementContext", () => ({
  useEntitlementContext: () => mockContextValue,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useEntitlement — Thrall tier", () => {
  it("returns the current tier", () => {
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.tier).toBe("thrall");
  });

  it("returns isLinked=false for unlinked users", () => {
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.isLinked).toBe(false);
  });

  it("returns active=false for free tier", () => {
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.active).toBe(false);
  });

  it("hasFeature returns true for local-storage (free feature)", () => {
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.hasFeature("local-storage")).toBe(true);
  });

  it("hasFeature returns false for premium features", () => {
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.hasFeature("cloud-sync")).toBe(false);
  });

  it("exposes subscribeStripe action", () => {
    const { result } = renderHook(() => useEntitlement());
    expect(typeof result.current.subscribeStripe).toBe("function");
  });

  it("exposes refreshEntitlement action", () => {
    const { result } = renderHook(() => useEntitlement());
    expect(typeof result.current.refreshEntitlement).toBe("function");
  });
});
