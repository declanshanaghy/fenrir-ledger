/**
 * StripeSettings — issue #1938: FOUC prevention for "Manage Subscription" button
 *
 * Verifies that:
 *   - The button is hidden on initial render (isOwner starts as null)
 *   - The button appears only after auth resolves and confirms isOwner=true
 *   - Non-owners (isOwner=false) never see the button
 *   - Network errors keep the button hidden (isOwner stays null)
 *
 * Covers karl-active and canceled subscription states.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { StripeSettings } from "@/components/entitlement/StripeSettings";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSubscribeStripe = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockOpenPortal = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

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

type MockToken = string | null;

let mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
let resolveHouseholdFetch: ((isOwner: boolean | null) => void) | null = null;
let mockToken: MockToken = "tok_test";
let rejectHouseholdFetch: (() => void) | null = null;

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: () => Promise.resolve(mockToken),
}));

const originalFetch = global.fetch;

beforeEach(() => {
  mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
  mockToken = "tok_test";
  resolveHouseholdFetch = null;
  rejectHouseholdFetch = null;
});

afterEach(() => {
  global.fetch = originalFetch;
});

/** Installs a controllable fetch stub. Call resolveHouseholdFetch(val) to settle it. */
function installControllableFetch() {
  global.fetch = vi.fn((url: RequestInfo | URL) => {
    if (String(url).includes("/api/household/members")) {
      return new Promise<Response>((resolve, reject) => {
        resolveHouseholdFetch = (isOwner) => {
          resolve(
            new Response(JSON.stringify({ isOwner }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        };
        rejectHouseholdFetch = () => reject(new Error("Network error"));
      });
    }
    return originalFetch(url as RequestInfo);
  }) as typeof global.fetch;
}

// ── FOUC: initial render ───────────────────────────────────────────────────────

describe("StripeSettings — FOUC prevention — karl-active", () => {
  it("hides Manage Subscription button on initial render before auth resolves", () => {
    installControllableFetch();
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    render(<StripeSettings />);
    // Synchronous check: fetch hasn't settled yet — button must NOT be present
    expect(
      screen.queryByRole("button", { name: /manage subscription/i })
    ).not.toBeInTheDocument();
  });

  it("shows Manage Subscription button after auth resolves as owner", async () => {
    installControllableFetch();
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    render(<StripeSettings />);

    // Button is hidden before resolve
    expect(
      screen.queryByRole("button", { name: /manage subscription/i })
    ).not.toBeInTheDocument();

    // Settle the fetch as owner
    await act(async () => {
      resolveHouseholdFetch!(true);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /manage subscription/i })
      ).toBeInTheDocument();
    });
  });

  it("keeps button hidden after auth resolves as non-owner", async () => {
    installControllableFetch();
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    render(<StripeSettings />);

    await act(async () => {
      resolveHouseholdFetch!(false);
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });

  it("keeps button hidden when fetch throws a network error", async () => {
    installControllableFetch();
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    render(<StripeSettings />);

    await act(async () => {
      rejectHouseholdFetch!();
    });

    // After error, isOwner stays null — button must remain hidden
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });
});

describe("StripeSettings — FOUC prevention — canceled", () => {
  it("hides Manage Subscription button on initial render before auth resolves", () => {
    installControllableFetch();
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    render(<StripeSettings />);
    expect(
      screen.queryByRole("button", { name: /manage subscription/i })
    ).not.toBeInTheDocument();
  });

  it("shows Manage Subscription button after auth resolves as owner", async () => {
    installControllableFetch();
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    render(<StripeSettings />);

    await act(async () => {
      resolveHouseholdFetch!(true);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /manage subscription/i })
      ).toBeInTheDocument();
    });
  });

  it("keeps button hidden after auth resolves as non-owner", async () => {
    installControllableFetch();
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    render(<StripeSettings />);

    await act(async () => {
      resolveHouseholdFetch!(false);
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });
});
