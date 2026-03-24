/**
 * StripeSettings — component tests
 *
 * Covers all subscription states rendered by the refactored StripeSettings:
 *   - Loading skeleton (isLoading + !isLinked)
 *   - Thrall: unsubscribed UI with Subscribe CTA
 *   - Karl active: subscription details + Manage Subscription button
 *   - Canceling: canceling badge + Resubscribe button
 *   - Canceled: canceled badge + Resubscribe + Manage buttons
 *   - Subscribe handler invokes subscribeStripe
 *   - Manage handler invokes openPortal
 *
 * Issue #1688
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { StripeSettings } from "@/components/entitlement/StripeSettings";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSubscribeStripe = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockOpenPortal = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const BASE_ENTITLEMENT = {
  tier: "thrall" as string,
  isActive: false,
  isLinked: false,
  isLoading: false,
  platform: null as string | null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null as string | null,
  subscribeStripe: mockSubscribeStripe,
  openPortal: mockOpenPortal,
  hasFeature: vi.fn().mockReturnValue(false),
  refresh: vi.fn(),
};

let mockEntitlement = { ...BASE_ENTITLEMENT };

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: () => Promise.resolve("tok_test"),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stub fetch to resolve as household owner — required for buttons gated on isOwner===true */
const originalFetch = global.fetch;
function installOwnerFetch() {
  global.fetch = vi.fn((url: RequestInfo | URL) => {
    if (String(url).includes("/api/household/members")) {
      return Promise.resolve(
        new Response(JSON.stringify({ isOwner: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    return originalFetch(url as RequestInfo);
  }) as typeof global.fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
});

function renderStripeSettings() {
  return render(<StripeSettings />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StripeSettings", () => {
  beforeEach(() => {
    mockEntitlement = { ...BASE_ENTITLEMENT };
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("renders skeleton while loading and not yet linked", () => {
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      isLoading: true,
      isLinked: false,
    };
    renderStripeSettings();
    expect(
      screen.getByRole("region", { name: /loading subscription settings/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /subscription$/i })).not.toBeInTheDocument();
  });

  it("renders content (not skeleton) when loading but already linked", () => {
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      isLoading: true,
      isLinked: true,
      platform: "stripe",
      tier: "karl",
      isActive: true,
      cancelAtPeriodEnd: false,
    };
    renderStripeSettings();
    expect(screen.getByRole("region", { name: /^subscription$/i })).toBeInTheDocument();
  });

  // ── Thrall state ─────────────────────────────────────────────────────────

  it("renders Thrall state for unsubscribed user", () => {
    renderStripeSettings();
    expect(screen.getByTestId("tier-badge")).toBeInTheDocument();
    expect(screen.getByText("THRALL")).toBeInTheDocument();
    expect(screen.getByText("Free tier")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /subscribe/i })
    ).toBeInTheDocument();
  });

  it("renders all Karl benefits in Thrall state", () => {
    renderStripeSettings();
    expect(screen.getByText("Cloud sync across all your devices")).toBeInTheDocument();
    expect(screen.getByText("Priority Howl notifications")).toBeInTheDocument();
    expect(screen.getByText("Advanced card analytics")).toBeInTheDocument();
    expect(screen.getByText("Unlock all hidden runes")).toBeInTheDocument();
  });

  // ── Karl active state ─────────────────────────────────────────────────────

  it("renders Karl active state", async () => {
    installOwnerFetch();
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      tier: "karl",
      isActive: true,
      isLinked: true,
      platform: "stripe",
      cancelAtPeriodEnd: false,
    };
    renderStripeSettings();
    expect(screen.getByText("KARL")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /manage subscription/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /resubscribe/i })).not.toBeInTheDocument();
  });

  it("shows next billing date when currentPeriodEnd is set in Karl active state", () => {
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      tier: "karl",
      isActive: true,
      isLinked: true,
      platform: "stripe",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-04-21T00:00:00Z",
    };
    renderStripeSettings();
    expect(screen.getByText(/next billing date/i)).toBeInTheDocument();
  });

  // ── Canceling state ───────────────────────────────────────────────────────

  it("renders Canceling state when cancelAtPeriodEnd is true", () => {
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      tier: "karl",
      isActive: true,
      isLinked: true,
      platform: "stripe",
      cancelAtPeriodEnd: true,
    };
    renderStripeSettings();
    expect(screen.getByText("CANCELING")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resubscribe/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /manage subscription/i })
    ).not.toBeInTheDocument();
  });

  it("shows cancel date in Canceling state when currentPeriodEnd is set", () => {
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      tier: "karl",
      isActive: true,
      isLinked: true,
      platform: "stripe",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-04-21T00:00:00Z",
    };
    renderStripeSettings();
    expect(screen.getByText(/set to cancel on/i)).toBeInTheDocument();
  });

  it("shows generic cancel message in Canceling state without currentPeriodEnd", () => {
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      tier: "karl",
      isActive: true,
      isLinked: true,
      platform: "stripe",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: null,
    };
    renderStripeSettings();
    expect(
      screen.getByText(/cancel at the end of your billing period/i)
    ).toBeInTheDocument();
  });

  // ── Canceled state ────────────────────────────────────────────────────────

  it("renders Canceled state when isActive is false for karl-linked user", async () => {
    installOwnerFetch();
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      tier: "karl",
      isActive: false,
      isLinked: true,
      platform: "stripe",
      cancelAtPeriodEnd: false,
    };
    renderStripeSettings();
    expect(screen.getByText("CANCELED")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /resubscribe/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /manage subscription/i })
      ).toBeInTheDocument();
    });
  });

  it("shows access-until date in Canceled state when currentPeriodEnd is set", () => {
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      tier: "karl",
      isActive: false,
      isLinked: true,
      platform: "stripe",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-04-21T00:00:00Z",
    };
    renderStripeSettings();
    expect(screen.getByText(/karl access continues until/i)).toBeInTheDocument();
  });

  // ── Non-Stripe platform falls back to Thrall ──────────────────────────────

  it("renders Thrall state for Apple-linked user (non-Stripe platform)", () => {
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      tier: "karl",
      isActive: true,
      isLinked: true,
      platform: "apple",
      cancelAtPeriodEnd: false,
    };
    renderStripeSettings();
    expect(screen.getByText("THRALL")).toBeInTheDocument();
  });

  // ── Button interactions ───────────────────────────────────────────────────

  it("calls subscribeStripe when Subscribe button is clicked", async () => {
    renderStripeSettings();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    });
    expect(mockSubscribeStripe).toHaveBeenCalledTimes(1);
  });

  it("calls openPortal when Manage Subscription button is clicked", async () => {
    installOwnerFetch();
    mockEntitlement = {
      ...BASE_ENTITLEMENT,
      tier: "karl",
      isActive: true,
      isLinked: true,
      platform: "stripe",
      cancelAtPeriodEnd: false,
    };
    renderStripeSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /manage subscription/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /manage subscription/i })
      );
    });
    expect(mockOpenPortal).toHaveBeenCalledTimes(1);
  });
});
