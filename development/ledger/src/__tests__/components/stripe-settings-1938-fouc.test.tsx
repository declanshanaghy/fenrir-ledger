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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

let mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
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

const originalFetch = global.fetch;

beforeEach(() => {
  mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
  mockToken = "tok_test";
});

afterEach(() => {
  global.fetch = originalFetch;
});

/** Stub fetch to never resolve — simulates in-flight request. */
function installHangingFetch() {
  global.fetch = vi.fn(() => new Promise<Response>(() => { /* never resolves */ })) as typeof global.fetch;
}

/** Stub fetch to resolve immediately with a given isOwner value. */
function installResolvingFetch(isOwner: boolean | null) {
  global.fetch = vi.fn((url: RequestInfo | URL) => {
    if (String(url).includes("/api/household/members")) {
      return Promise.resolve(
        new Response(JSON.stringify({ isOwner }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    return originalFetch(url as RequestInfo);
  }) as typeof global.fetch;
}

/** Stub fetch to reject with a network error. */
function installFailingFetch() {
  global.fetch = vi.fn((url: RequestInfo | URL) => {
    if (String(url).includes("/api/household/members")) {
      return Promise.reject(new Error("Network error"));
    }
    return originalFetch(url as RequestInfo);
  }) as typeof global.fetch;
}

// ── FOUC: karl-active ─────────────────────────────────────────────────────────

describe("StripeSettings — FOUC prevention — karl-active", () => {
  it("hides Manage Subscription button on initial render (fetch in flight)", async () => {
    installHangingFetch();
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    render(<StripeSettings />);
    // Synchronous + flush microtasks: fetch hasn't settled — button must stay hidden
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });

  it("shows Manage Subscription button once auth resolves as owner (isOwner=true)", async () => {
    installResolvingFetch(true);
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    render(<StripeSettings />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /manage subscription/i })
      ).toBeInTheDocument();
    });
  });

  it("keeps button hidden after auth resolves as non-owner (isOwner=false)", async () => {
    installResolvingFetch(false);
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    render(<StripeSettings />);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });

  it("keeps button hidden when fetch throws a network error (isOwner stays null)", async () => {
    installFailingFetch();
    mockEntitlement = { ...KARL_ACTIVE_ENTITLEMENT };
    render(<StripeSettings />);
    // After error, isOwner stays null — button must remain hidden (no FOUC fallback)
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });
});

// ── FOUC: canceled ────────────────────────────────────────────────────────────

describe("StripeSettings — FOUC prevention — canceled", () => {
  it("hides Manage Subscription button on initial render (fetch in flight)", async () => {
    installHangingFetch();
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    render(<StripeSettings />);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });

  it("shows Manage Subscription button once auth resolves as owner (isOwner=true)", async () => {
    installResolvingFetch(true);
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    render(<StripeSettings />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /manage subscription/i })
      ).toBeInTheDocument();
    });
  });

  it("keeps button hidden after auth resolves as non-owner (isOwner=false)", async () => {
    installResolvingFetch(false);
    mockEntitlement = { ...CANCELED_ENTITLEMENT };
    render(<StripeSettings />);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });
  });
});
