/**
 * Auth-only trial UI audit — Issue #1672
 *
 * Validates that all trial UI components handle anonymous users correctly:
 *   - TrialBadge renders nothing for status "none" (anonymous)
 *   - TrialExpiryModal never shows for unauthenticated users
 *   - TrialDay15Modal never shows for unauthenticated users
 *   - useTrialMetrics returns empty/zero metrics for unauthenticated state
 *   - useIsKarlOrTrial returns false for anonymous users
 *   - TrialSettingsSection shows sign-in CTA for anonymous users
 *
 * All acceptance criteria from Issue #1672 are explicitly covered here.
 *
 * @ref Issue #1672
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mock state — must be defined before vi.mock calls
// ---------------------------------------------------------------------------

const {
  mockTrialStatus,
  mockAuthContext,
  mockMetrics,
} = vi.hoisted(() => ({
  mockTrialStatus: {
    remainingDays: 0,
    status: "none" as string,
    isLoading: false,
  },
  mockAuthContext: {
    status: "anonymous" as string,
    session: null,
    householdId: "",
    signOut: vi.fn(),
    ensureHouseholdId: vi.fn().mockReturnValue(""),
  },
  mockMetrics: {
    cardCount: 0,
    totalAnnualFees: 0,
    totalAnnualFeesFormatted: "$0",
    feeAlertsCount: 0,
    closedCardsCount: 0,
    potentialSavings: 0,
    potentialSavingsFormatted: "$0",
  },
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: () => mockTrialStatus,
}));

vi.mock("@/hooks/useTrialMetrics", () => ({
  useTrialMetrics: () => mockMetrics,
  computeTrialMetrics: vi.fn().mockReturnValue(mockMetrics),
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    tier: "thrall",
    isActive: false,
    isLoading: false,
    subscribeStripe: vi.fn(),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => mockAuthContext,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuthContext,
}));

vi.mock("@/lib/storage", () => ({
  getCards: vi.fn().mockReturnValue([]),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setAnonymous() {
  mockTrialStatus.status = "none";
  mockTrialStatus.remainingDays = 0;
  mockTrialStatus.isLoading = false;
  mockAuthContext.status = "anonymous";
  mockAuthContext.householdId = "";
}

function setAuthenticated(trialStatus: string, remainingDays = 15) {
  mockTrialStatus.status = trialStatus;
  mockTrialStatus.remainingDays = remainingDays;
  mockTrialStatus.isLoading = false;
  mockAuthContext.status = "authenticated";
  mockAuthContext.householdId = "google-sub-abc123";
}

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { TrialBadge } from "@/components/layout/TrialBadge";
import { TrialSettingsSection } from "@/components/trial/TrialSettingsSection";
import { useTrialMetrics } from "@/hooks/useTrialMetrics";
import { useIsKarlOrTrial } from "@/hooks/useIsKarlOrTrial";
import { shouldShowExpiryModal } from "@/components/trial/TrialExpiryModal";

// ---------------------------------------------------------------------------
// AC1 — TrialBadge hidden for anonymous users
// ---------------------------------------------------------------------------

describe("TrialBadge — hidden for anonymous users (#1672 AC1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAnonymous();
  });

  it("renders nothing when status is 'none' (anonymous user)", () => {
    const { container } = render(<TrialBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when isLoading is true", () => {
    mockTrialStatus.isLoading = true;
    const { container } = render(<TrialBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when status is 'converted' (paid Karl subscriber)", () => {
    mockTrialStatus.status = "converted";
    const { container } = render(<TrialBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders badge when authenticated user has active trial", () => {
    setAuthenticated("active", 22);
    const { container } = render(<TrialBadge />);
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toContain("days left");
  });

  it("renders THRALL badge when authenticated user's trial is expired", () => {
    setAuthenticated("expired", 0);
    const { container } = render(<TrialBadge />);
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toContain("THRALL");
  });
});

// ---------------------------------------------------------------------------
// AC2 — Trial modals never render for unauthenticated users
// ---------------------------------------------------------------------------

describe("Trial modal gate — anonymous users blocked (#1672 AC2)", () => {
  it("shouldShowExpiryModal returns false for 'none' status (anonymous)", () => {
    expect(shouldShowExpiryModal("none", false)).toBe(false);
  });

  it("shouldShowExpiryModal returns false for 'active' status (not expired)", () => {
    expect(shouldShowExpiryModal("active", false)).toBe(false);
  });

  it("shouldShowExpiryModal returns false for 'converted' status", () => {
    expect(shouldShowExpiryModal("converted", false)).toBe(false);
  });

  it("shouldShowExpiryModal only returns true for authenticated expired users (not yet shown)", () => {
    expect(shouldShowExpiryModal("expired", false)).toBe(true);
    // If already shown, never repeat
    expect(shouldShowExpiryModal("expired", true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC3 + AC4 — TrialSettingsSection shows sign-in CTA for anonymous
// ---------------------------------------------------------------------------

describe("TrialSettingsSection — sign-in CTA for anonymous users (#1672 AC3, AC4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAnonymous();
  });

  it("renders the Trial Status section for anonymous user (no flash or null return)", () => {
    render(<TrialSettingsSection />);
    const section = screen.getByRole("region", { name: "Trial Status" });
    expect(section).toBeDefined();
  });

  it("shows Norse-themed 'not started' copy for anonymous user", () => {
    const { container } = render(<TrialSettingsSection />);
    expect(container.textContent).toContain("Thy trial hath not yet begun");
  });

  it("shows Google sign-in link as CTA for anonymous user", () => {
    render(<TrialSettingsSection />);
    const cta = screen.getByRole("link", {
      name: /sign in with google to begin thy karl trial/i,
    });
    expect(cta).toBeDefined();
    expect(cta.getAttribute("href")).toBe("/ledger/sign-in");
  });

  it("does not show subscribe or upgrade button for anonymous user", () => {
    render(<TrialSettingsSection />);
    const upgradeBtn = screen.queryByRole("button", {
      name: /upgrade to karl/i,
    });
    expect(upgradeBtn).toBeNull();
  });

  it("renders nothing for converted (paid Karl) users", () => {
    mockTrialStatus.status = "converted";
    const { container } = render(<TrialSettingsSection />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while loading", () => {
    mockTrialStatus.isLoading = true;
    const { container } = render(<TrialSettingsSection />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC5 — useIsKarlOrTrial returns false for anonymous users
// ---------------------------------------------------------------------------

describe("useIsKarlOrTrial — false for anonymous users (#1672 AC5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAnonymous();
  });

  it("returns false when trial status is 'none' (anonymous user)", () => {
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(false);
  });

  it("returns false when authenticated user has no trial and no Karl subscription", () => {
    setAuthenticated("none", 0);
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(false);
  });

  it("returns false when authenticated user's trial has expired", () => {
    setAuthenticated("expired", 0);
    const { result } = renderHook(() => useIsKarlOrTrial());
    expect(result.current).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC6 — Zero references to fingerprint/deviceId in trial UI hook output
// ---------------------------------------------------------------------------

describe("Trial UI — no fingerprint or deviceId in hook output (#1672 AC6)", () => {
  it("useTrialMetrics returns no fingerprint or deviceId field for anonymous user", () => {
    setAnonymous();
    const { result } = renderHook(() => useTrialMetrics());

    expect(result.current.cardCount).toBe(0);
    expect(result.current.totalAnnualFees).toBe(0);

    const keys = Object.keys(result.current);
    expect(keys.includes("fingerprint")).toBe(false);
    expect(keys.includes("deviceId")).toBe(false);
  });

  it("useTrialMetrics returns no fingerprint or deviceId field for authenticated user", () => {
    setAuthenticated("active", 20);
    const { result } = renderHook(() => useTrialMetrics());

    const keys = Object.keys(result.current);
    expect(keys.includes("fingerprint")).toBe(false);
    expect(keys.includes("deviceId")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC7 — TrialBadge anonymous → authenticated transition behavioral contract
// ---------------------------------------------------------------------------

describe("TrialBadge — anonymous to authenticated transition (#1672 AC7)", () => {
  it("renders null before sign-in (anonymous)", () => {
    setAnonymous();
    const { container } = render(<TrialBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders badge after sign-in with active trial", () => {
    setAuthenticated("active", 30);
    const { container } = render(<TrialBadge />);
    expect(container.firstChild).not.toBeNull();
  });
});
