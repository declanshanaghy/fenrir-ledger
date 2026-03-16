/**
 * Karl bling — tier context hooks and usage (Issue #1090)
 *
 * Integration tests for the tier context hooks used by the Karl bling system:
 *   - EntitlementContext sets the correct data-tier attribute per tier
 *   - useIsKarlOrTrial() returns correct values for all tier states
 *   - Tier transitions update data-tier without a page reload
 *   - Trial users get data-tier="trial", NOT "karl"
 *
 * Tests are organised by acceptance criterion from issue #1090.
 * Where data-tier attribute and useIsKarlOrTrial tests already exist in
 * data-tier.test.tsx and src/__tests__/hooks/use-is-karl-or-trial.test.ts,
 * this file adds only the missing scenarios and acts as the canonical
 * integration test for #1090.
 *
 * @ref #1090
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { Entitlement } from "@/lib/entitlement/types";

// ── Shared mutable mock state ─────────────────────────────────────────────────
// One unified state object shared between component tests (EntitlementProvider)
// and hook unit tests (useIsKarlOrTrial). Both vi.mock factories reference this.

const mockTrialState = {
  status: "none" as "none" | "active" | "expired" | "converted",
  remainingDays: 0,
  isLoading: false,
};

const mockAuthState = {
  status: "unauthenticated" as "authenticated" | "unauthenticated" | "loading",
};

let mockCachedEntitlement: Entitlement | null = null;

// Entitlement state used by useEntitlement hook (for useIsKarlOrTrial tests)
const mockEntitlementHook = {
  tier: "thrall" as "thrall" | "karl",
  isActive: false,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => mockAuthState,
}));

// Single useTrialStatus mock — reads from mockTrialState
vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({
    status: mockTrialState.status,
    remainingDays: mockTrialState.remainingDays,
    isLoading: mockTrialState.isLoading,
    refresh: vi.fn(),
  }),
  clearTrialStatusCache: vi.fn(),
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlementHook,
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/trial-utils", () => ({
  computeFingerprint: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: vi.fn(() => mockCachedEntitlement),
  setEntitlementCache: vi.fn(),
  clearEntitlementCache: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetMocks() {
  document.documentElement.removeAttribute("data-tier");
  mockAuthState.status = "unauthenticated";
  mockTrialState.status = "none";
  mockTrialState.remainingDays = 0;
  mockCachedEntitlement = null;
  mockEntitlementHook.tier = "thrall";
  mockEntitlementHook.isActive = false;
}

async function getProvider() {
  const { EntitlementProvider } = await import("@/contexts/EntitlementContext");
  return EntitlementProvider;
}

function makeKarlEntitlement(active = true): Entitlement {
  return {
    tier: "karl",
    active,
    platform: "stripe",
    userId: "cus_test",
    linkedAt: Date.now(),
    checkedAt: Date.now(),
  };
}

// ── AC1: EntitlementContext data-tier attribute setting ───────────────────────
// Verifies each tier value results in the correct attribute on document.documentElement

describe("AC1: data-tier attribute — one test per tier value", () => {
  beforeEach(resetMocks);
  afterEach(() => document.documentElement.removeAttribute("data-tier"));

  it("sets data-tier=thrall for a free user with no trial", async () => {
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "none";
    mockCachedEntitlement = null;

    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(<EntitlementProvider><div /></EntitlementProvider>);
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");
  });

  it("sets data-tier=trial for a user with an active trial", async () => {
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "active";
    mockTrialState.remainingDays = 14;
    mockCachedEntitlement = null;

    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(<EntitlementProvider><div /></EntitlementProvider>);
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("trial");
  });

  it("sets data-tier=karl for an active Karl subscriber", async () => {
    mockAuthState.status = "authenticated";
    mockTrialState.status = "none";
    mockCachedEntitlement = makeKarlEntitlement(true);

    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(<EntitlementProvider><div /></EntitlementProvider>);
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("karl");
  });
});

// ── AC2: Trial users get data-tier="trial", NOT "karl" ───────────────────────
// Critical: trial is NOT a Karl subscription — must be clearly differentiated

describe("AC2: trial users get data-tier=trial, never karl", () => {
  beforeEach(resetMocks);
  afterEach(() => document.documentElement.removeAttribute("data-tier"));

  it("active trial with no Karl subscription sets trial, not karl", async () => {
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "active";
    mockTrialState.remainingDays = 30;
    mockCachedEntitlement = null; // no Karl subscription

    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(<EntitlementProvider><div /></EntitlementProvider>);
    });

    const val = document.documentElement.getAttribute("data-tier");
    expect(val).toBe("trial");
    expect(val).not.toBe("karl");
  });

  it("active trial with inactive Karl sets trial, not karl or thrall", async () => {
    // Lapsed subscription + active trial → trial wins
    mockAuthState.status = "authenticated";
    mockTrialState.status = "active";
    mockTrialState.remainingDays = 7;
    mockCachedEntitlement = makeKarlEntitlement(false); // inactive subscription

    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(<EntitlementProvider><div /></EntitlementProvider>);
    });

    const val = document.documentElement.getAttribute("data-tier");
    expect(val).toBe("trial");
    expect(val).not.toBe("karl");
  });
});

// ── AC3: useIsKarlOrTrial hook — all tier states ──────────────────────────────
// Tests each tier/trial combination using mockEntitlementHook + mockTrialState

describe("AC3: useIsKarlOrTrial() hook — tier state coverage", () => {
  beforeEach(resetMocks);

  it("returns false for thrall (no trial)", async () => {
    mockEntitlementHook.tier = "thrall";
    mockEntitlementHook.isActive = false;
    mockTrialState.status = "none";

    const { useIsKarlOrTrial } = await import("@/hooks/useIsKarlOrTrial");
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(false);
  });

  it("returns true for active Karl subscriber", async () => {
    mockEntitlementHook.tier = "karl";
    mockEntitlementHook.isActive = true;
    mockTrialState.status = "none";

    const { useIsKarlOrTrial } = await import("@/hooks/useIsKarlOrTrial");
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(true);
  });

  it("returns true for active trial user", async () => {
    mockEntitlementHook.tier = "thrall";
    mockEntitlementHook.isActive = false;
    mockTrialState.status = "active";

    const { useIsKarlOrTrial } = await import("@/hooks/useIsKarlOrTrial");
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(true);
  });

  it("returns false for expired trial with no Karl", async () => {
    mockEntitlementHook.tier = "thrall";
    mockEntitlementHook.isActive = false;
    mockTrialState.status = "expired";

    const { useIsKarlOrTrial } = await import("@/hooks/useIsKarlOrTrial");
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(false);
  });

  it("returns false for inactive Karl with no trial (lapsed subscription)", async () => {
    // inactive Karl (tier=karl, isActive=false) — subscription lapsed, no trial
    mockEntitlementHook.tier = "karl";
    mockEntitlementHook.isActive = false;
    mockTrialState.status = "none";

    const { useIsKarlOrTrial } = await import("@/hooks/useIsKarlOrTrial");
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(false);
  });

  it("returns true for converted trial who upgraded to Karl", async () => {
    // After conversion: Karl is active, trial status is "converted"
    mockEntitlementHook.tier = "karl";
    mockEntitlementHook.isActive = true;
    mockTrialState.status = "converted";

    const { useIsKarlOrTrial } = await import("@/hooks/useIsKarlOrTrial");
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(true);
  });
});

// ── AC4: Tier transitions update data-tier attribute ─────────────────────────
// Verifies live updates without page reload.
//
// Transition test strategy notes:
//   - trialStatus comes from useTrialStatus hook → reactive via rerender
//   - Karl tier/isActive come from internal component state (API-driven)
//     → karl→thrall requires auth status change (unauthenticated clears state)
//     → thrall→karl requires auth status change (triggers cache load)

describe("AC4: tier transitions updating data-tier attribute", () => {
  beforeEach(resetMocks);
  afterEach(() => {
    document.documentElement.removeAttribute("data-tier");
    mockCachedEntitlement = null;
  });

  it("thrall → trial: trial start updates data-tier immediately", async () => {
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "none";

    const EntitlementProvider = await getProvider();
    const { rerender } = await act(async () =>
      render(<EntitlementProvider><div /></EntitlementProvider>)
    );
    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");

    // Trial becomes active (reactive hook change)
    mockTrialState.status = "active";
    mockTrialState.remainingDays = 30;
    await act(async () => {
      rerender(<EntitlementProvider><div /></EntitlementProvider>);
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("trial");
  });

  it("thrall → karl: subscription upgrade updates data-tier when auth activates", async () => {
    // Start unauthenticated (thrall), then authenticate with active Karl in cache.
    // Auth status change triggers the cache-loading useEffect.
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "none";
    mockCachedEntitlement = null;

    const EntitlementProvider = await getProvider();
    const { rerender } = await act(async () =>
      render(<EntitlementProvider><div /></EntitlementProvider>)
    );
    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");

    // Authenticate with active Karl subscription in cache
    mockAuthState.status = "authenticated";
    mockCachedEntitlement = makeKarlEntitlement(true);
    await act(async () => {
      rerender(<EntitlementProvider><div /></EntitlementProvider>);
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("karl");
  });

  it("trial → thrall: trial expiry removes trial bling", async () => {
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "active";
    mockTrialState.remainingDays = 5;

    const EntitlementProvider = await getProvider();
    const { rerender } = await act(async () =>
      render(<EntitlementProvider><div /></EntitlementProvider>)
    );
    expect(document.documentElement.getAttribute("data-tier")).toBe("trial");

    // Trial expires (reactive hook change)
    mockTrialState.status = "expired";
    mockTrialState.remainingDays = 0;
    await act(async () => {
      rerender(<EntitlementProvider><div /></EntitlementProvider>);
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");
  });

  it("karl → thrall: signing out clears karl bling (entitlement nulled)", async () => {
    // Start authenticated with Karl, then sign out.
    // Unauthenticated state sets entitlement=null → tier=thrall.
    mockAuthState.status = "authenticated";
    mockCachedEntitlement = makeKarlEntitlement(true);
    mockTrialState.status = "none";

    const EntitlementProvider = await getProvider();
    const { rerender } = await act(async () =>
      render(<EntitlementProvider><div /></EntitlementProvider>)
    );
    expect(document.documentElement.getAttribute("data-tier")).toBe("karl");

    // User signs out → unauthenticated
    mockAuthState.status = "unauthenticated";
    mockCachedEntitlement = null;
    await act(async () => {
      rerender(<EntitlementProvider><div /></EntitlementProvider>);
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");
  });
});
