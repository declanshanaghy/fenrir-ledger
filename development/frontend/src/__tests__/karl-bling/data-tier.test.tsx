/**
 * data-tier attribute — EntitlementContext integration tests
 *
 * Verifies that EntitlementProvider correctly sets the data-tier attribute on
 * document.documentElement based on the user's entitlement tier and trial status.
 *
 * Acceptance criteria (Issue #1086):
 *   - data-tier="karl"   for active Karl subscribers
 *   - data-tier="trial"  for users with an active trial
 *   - data-tier="thrall" for free (thrall) users
 *   - attribute updates immediately when tier changes (no reload)
 *   - Karl takes precedence over trial when both conditions are true
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
  // Return null so the membership API call is skipped — we test DOM state only
  ensureFreshToken: vi.fn().mockResolvedValue(null),
}));


vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: vi.fn(() => mockCachedEntitlement),
  setEntitlementCache: vi.fn(),
  clearEntitlementCache: vi.fn(),
}));

// ── Provider wrapper ───────────────────────────────────────────────────────────

// Lazy import after mocks are set up
async function getProvider() {
  const { EntitlementProvider } = await import(
    "@/contexts/EntitlementContext"
  );
  return EntitlementProvider;
}

function makeKarlEntitlement(): Entitlement {
  return {
    tier: "karl",
    active: true,
    platform: "stripe",
    userId: "cus_test",
    linkedAt: Date.now(),
    checkedAt: Date.now(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("data-tier attribute — Thrall (free) user", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-tier");
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "none";
    mockCachedEntitlement = null;
  });
  afterEach(() => {
    document.documentElement.removeAttribute("data-tier");
  });

  it("sets data-tier=thrall for an unauthenticated user with no trial", async () => {
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

  it("sets data-tier=thrall when trial has expired", async () => {
    mockTrialState.status = "expired";
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

describe("data-tier attribute — Trial user", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-tier");
    mockAuthState.status = "unauthenticated";
    mockCachedEntitlement = null;
  });
  afterEach(() => {
    document.documentElement.removeAttribute("data-tier");
  });

  it("sets data-tier=trial for a user with an active trial", async () => {
    mockTrialState.status = "active";
    mockTrialState.remainingDays = 15;
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

describe("data-tier attribute — Karl subscriber", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-tier");
    mockAuthState.status = "authenticated";
    mockTrialState.status = "none";
  });
  afterEach(() => {
    document.documentElement.removeAttribute("data-tier");
    mockCachedEntitlement = null;
  });

  it("sets data-tier=karl for an active Karl subscriber loaded from cache", async () => {
    mockCachedEntitlement = makeKarlEntitlement();
    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });
    expect(document.documentElement.getAttribute("data-tier")).toBe("karl");
  });

  it("Karl takes precedence over trial when both conditions are active", async () => {
    mockCachedEntitlement = makeKarlEntitlement();
    mockTrialState.status = "active"; // both Karl AND trial active
    const EntitlementProvider = await getProvider();
    await act(async () => {
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });
    // Karl wins — trial is a subset of Karl; active subscription takes precedence
    expect(document.documentElement.getAttribute("data-tier")).toBe("karl");
  });
});

describe("data-tier attribute — tier transitions", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-tier");
    mockCachedEntitlement = null;
  });
  afterEach(() => {
    document.documentElement.removeAttribute("data-tier");
    mockCachedEntitlement = null;
  });

  it("transitions from thrall to trial without page reload", async () => {
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "none";

    const EntitlementProvider = await getProvider();

    const { rerender } = await act(async () =>
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      )
    );
    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");

    // Simulate trial becoming active — mock updates, component rerenders
    mockTrialState.status = "active";
    await act(async () => {
      rerender(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });
    expect(document.documentElement.getAttribute("data-tier")).toBe("trial");
  });

  it("transitions from trial to thrall when trial expires", async () => {
    mockAuthState.status = "unauthenticated";
    mockTrialState.status = "active";
    mockTrialState.remainingDays = 5;

    const EntitlementProvider = await getProvider();

    const { rerender } = await act(async () =>
      render(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      )
    );
    expect(document.documentElement.getAttribute("data-tier")).toBe("trial");

    // Trial expires
    mockTrialState.status = "expired";
    mockTrialState.remainingDays = 0;
    await act(async () => {
      rerender(
        <EntitlementProvider>
          <div />
        </EntitlementProvider>
      );
    });
    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");
  });
});
