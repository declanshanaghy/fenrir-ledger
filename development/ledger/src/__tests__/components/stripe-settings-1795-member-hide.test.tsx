/**
 * StripeSettings — issue #1795: hide Manage Subscription for household members
 *
 * Verifies that:
 *   - Household members (isOwner=false) do NOT see "Manage Subscription" button
 *   - Household members see "Contact your household owner..." message instead
 *   - Owners (isOwner=true) still see "Manage Subscription"
 *   - Solo/loading state (isOwner=null) still sees "Manage Subscription" (safe default)
 *
 * Covers karl-active and canceled subscription states.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StripeSettings } from "@/components/entitlement/StripeSettings";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSubscribeStripe = vi.fn().mockResolvedValue(undefined);
const mockOpenPortal = vi.fn().mockResolvedValue(undefined);

const KARL_ACTIVE_ENTITLEMENT = {
  tier: "karl" as string,
  isActive: true,
  isLinked: true,
  isLoading: false,
  platform: "stripe" as string | null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2026-05-01T00:00:00Z",
  subscribeStripe: mockSubscribeStripe,
  openPortal: mockOpenPortal,
  hasFeature: vi.fn().mockReturnValue(true),
  refresh: vi.fn(),
};

const CANCELED_ENTITLEMENT = {
  ...KARL_ACTIVE_ENTITLEMENT,
  isActive: false,
  cancelAtPeriodEnd: false,
};

let mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
let mockIsOwner: boolean | null = null;
let mockToken: string | null = "tok_test";

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: () => Promise.resolve(mockToken),
}));

// Stub fetch so useHouseholdRole resolves with the current mockIsOwner
const originalFetch = global.fetch;
beforeEach(() => {
  mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
  mockIsOwner = null;
  mockToken = "tok_test";
  global.fetch = vi.fn((url: RequestInfo | URL) => {
    if (String(url).includes("/api/household/members")) {
      if (mockToken === null) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ isOwner: mockIsOwner }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    return originalFetch(url as RequestInfo);
  }) as typeof global.fetch;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderStripeSettings() {
  return render(<StripeSettings />);
}

// ── Karl-active state ─────────────────────────────────────────────────────────

describe("StripeSettings — karl-active — household member (isOwner=false)", () => {
  it("hides Manage Subscription button for members", async () => {
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    mockIsOwner = false;
    renderStripeSettings();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });

  it("shows contact owner message for members", async () => {
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    mockIsOwner = false;
    renderStripeSettings();
    await waitFor(() => {
      expect(
        screen.getByText(/contact your household owner to manage the subscription/i)
      ).toBeInTheDocument();
    });
  });
});

describe("StripeSettings — karl-active — owner (isOwner=true)", () => {
  it("shows Manage Subscription button for owners", async () => {
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    mockIsOwner = true;
    renderStripeSettings();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /manage subscription/i })
      ).toBeInTheDocument();
    });
  });

  it("does not show contact owner message for owners", async () => {
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    mockIsOwner = true;
    renderStripeSettings();
    await waitFor(() => {
      expect(
        screen.queryByText(/contact your household owner/i)
      ).not.toBeInTheDocument();
    });
  });
});

describe("StripeSettings — karl-active — isOwner null (loading/solo)", () => {
  it("shows Manage Subscription button when isOwner is null (safe default)", async () => {
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    mockIsOwner = null;
    renderStripeSettings();
    // isOwner=null means the fetch hasn't resolved or user is solo
    // The component renders with null initially — button should be visible
    // (null is not false, so isMember=false)
    expect(
      screen.getByRole("button", { name: /manage subscription/i })
    ).toBeInTheDocument();
  });
});

// ── Canceled state ────────────────────────────────────────────────────────────

describe("StripeSettings — canceled — household member (isOwner=false)", () => {
  it("hides Manage Subscription button for members", async () => {
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    mockIsOwner = false;
    renderStripeSettings();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });

  it("shows contact owner message for members", async () => {
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    mockIsOwner = false;
    renderStripeSettings();
    await waitFor(() => {
      expect(
        screen.getByText(/contact your household owner to manage the subscription/i)
      ).toBeInTheDocument();
    });
  });

  it("hides Resubscribe button for members in canceled state", async () => {
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    mockIsOwner = false;
    renderStripeSettings();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /resubscribe/i })
      ).not.toBeInTheDocument();
    });
  });
});

describe("StripeSettings — canceled — owner (isOwner=true)", () => {
  it("shows both Resubscribe and Manage Subscription for owners", async () => {
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    mockIsOwner = true;
    renderStripeSettings();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /resubscribe/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /manage subscription/i })
      ).toBeInTheDocument();
    });
  });
});
