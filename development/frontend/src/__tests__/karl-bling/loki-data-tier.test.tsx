/**
 * Loki QA — data-tier attribute edge-case tests
 *
 * Extends the FiremanDecko unit tests with QA-specific edge cases:
 *   - Inactive Karl subscription falls back to thrall
 *   - thrall → karl transition (user upgrades)
 *   - karl → thrall transition (subscription cancelled/inactive)
 *   - Attribute is always a known value (never absent, never null)
 *   - Trial converted state → thrall (not trial)
 *
 * @ref #1086
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import type { Entitlement } from "@/lib/entitlement/types";

// ── Mutable mock state ────────────────────────────────────────────────────────

const mockTrialState = {
  status: "none" as "none" | "active" | "expired" | "converted",
  remainingDays: 0,
  isLoading: false,
};

const mockAuthState = {
  status: "unauthenticated" as "authenticated" | "unauthenticated" | "loading",
};

let mockCachedEntitlement: Entitlement | null = null;

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => mockAuthState,
}));

vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({
    status: mockTrialState.status,
    remainingDays: mockTrialState.remainingDays,
    isLoading: mockTrialState.isLoading,
    refresh: vi.fn(),
  }),
  clearTrialStatusCache: vi.fn(),
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

// ── Provider wrapper ──────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetMocks() {
  document.documentElement.removeAttribute("data-tier");
  mockAuthState.status = "unauthenticated";
  mockTrialState.status = "none";
  mockTrialState.remainingDays = 0;
  mockCachedEntitlement = null;
}

// ── Tests: inactive Karl ──────────────────────────────────────────────────────

describe("data-tier — inactive Karl subscription", () => {
  beforeEach(resetMocks);
  afterEach(() => document.documentElement.removeAttribute("data-tier"));

  it("sets data-tier=thrall when Karl entitlement is inactive (not active)", async () => {
    // tier=karl but active=false — subscription lapsed
    mockCachedEntitlement = makeKarlEntitlement(false);
    mockAuthState.status = "authenticated";

    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });

    // inactive subscription must NOT grant karl bling
    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");
  });

  it("sets data-tier=trial when Karl entitlement is inactive but trial is active", async () => {
    // Lapsed subscription + active trial → trial wins (not thrall)
    mockCachedEntitlement = makeKarlEntitlement(false);
    mockAuthState.status = "authenticated";
    mockTrialState.status = "active";
    mockTrialState.remainingDays = 7;

    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("trial");
  });
});

// ── Tests: trial converted ────────────────────────────────────────────────────

describe("data-tier — trial converted state", () => {
  beforeEach(resetMocks);
  afterEach(() => document.documentElement.removeAttribute("data-tier"));

  it("sets data-tier=thrall when trial status is converted and no Karl subscription", async () => {
    // converted = trial ended via upgrade; without an active Karl subscription
    // the attribute should be thrall (converted ≠ active)
    mockTrialState.status = "converted";
    mockCachedEntitlement = null;

    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");
  });
});

// ── Tests: upgrade / downgrade transitions ────────────────────────────────────

describe("data-tier — upgrade and downgrade transitions", () => {
  beforeEach(resetMocks);
  afterEach(() => {
    document.documentElement.removeAttribute("data-tier");
    mockCachedEntitlement = null;
  });

  it("transitions from thrall to karl when subscription activates", async () => {
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "none";
    mockCachedEntitlement = null;

    const EntitlementProvider = await getProvider();

    const { rerender } = await act(async () =>
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      )
    );
    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");

    // User upgrades — active Karl entitlement appears in cache
    mockAuthState.status = "authenticated";
    mockCachedEntitlement = makeKarlEntitlement(true);
    await act(async () => {
      rerender(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });

    expect(document.documentElement.getAttribute("data-tier")).toBe("karl");
  });

  it("initial render with inactive Karl shows thrall (subscription deactivated before mount)", async () => {
    // tier=karl but active=false is the post-cancellation state.
    // This tests the initial render after a subscription has been deactivated;
    // the component reads tier+isActive from entitlement state and the effect fires.
    // Note: rerender-based transitions for tier/isActive are not testable here
    // because those values come from internal component state (API-driven), unlike
    // trialStatus which is a reactive hook. The inactive Karl → thrall initial
    // state is already covered in the "inactive Karl subscription" describe block.
    mockAuthState.status = "authenticated";
    mockCachedEntitlement = makeKarlEntitlement(false); // inactive

    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });

    // inactive Karl subscription → no karl bling
    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");
  });
});

// ── Tests: attribute integrity ────────────────────────────────────────────────

describe("data-tier — attribute integrity", () => {
  beforeEach(resetMocks);
  afterEach(() => document.documentElement.removeAttribute("data-tier"));

  it("attribute is always present (never null) after provider mounts", async () => {
    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });

    const val = document.documentElement.getAttribute("data-tier");
    expect(val).not.toBeNull();
    expect(["karl", "trial", "thrall"]).toContain(val);
  });

  it("attribute value is exactly one of the three known tiers", async () => {
    const scenarios: Array<{ label: string; setup: () => void }> = [
      {
        label: "thrall",
        setup: () => {
          mockCachedEntitlement = null;
          mockTrialState.status = "none";
        },
      },
      {
        label: "trial",
        setup: () => {
          mockCachedEntitlement = null;
          mockTrialState.status = "active";
        },
      },
      {
        label: "karl",
        setup: () => {
          mockCachedEntitlement = makeKarlEntitlement(true);
          mockAuthState.status = "authenticated";
          mockTrialState.status = "none";
        },
      },
    ];

    const EntitlementProvider = await getProvider();

    for (const scenario of scenarios) {
      document.documentElement.removeAttribute("data-tier");
      mockCachedEntitlement = null;
      mockAuthState.status = "unauthenticated";
      mockTrialState.status = "none";
      scenario.setup();

      await act(async () => {
        render(
          <EntitlementProvider>
            <div />
          </EntitlementProvider>
        );
      });

      const val = document.documentElement.getAttribute("data-tier");
      expect(val, `scenario: ${scenario.label}`).toBe(scenario.label);
    }
  });
});
