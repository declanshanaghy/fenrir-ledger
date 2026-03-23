/**
 * UpsellBanner — anonymous user trial messaging tests (Issue #1699)
 *
 * Validates that UpsellBanner shows trial sign-in copy for anonymous users
 * and the existing Karl upgrade copy for signed-in Thrall users.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpsellBanner } from "@/components/entitlement/UpsellBanner";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRouterPush = vi.hoisted(() => vi.fn());
let mockAuthStatus = "authenticated";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/ledger",
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    tier: "thrall",
    isLoading: false,
    hasFeature: () => false,
    subscribeStripe: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: mockAuthStatus }),
}));

// ── Anonymous user tests ───────────────────────────────────────────────────

describe("UpsellBanner — anonymous user (issue #1699)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthStatus = "anonymous";
  });

  it("renders banner for anonymous users", () => {
    render(<UpsellBanner />);
    const region = screen.getByRole("region", { name: "Upgrade your subscription" });
    expect(region).toBeDefined();
  });

  it("shows trial copy for anonymous users", () => {
    render(<UpsellBanner />);
    const region = screen.getByRole("region", { name: "Upgrade your subscription" });
    expect(region.textContent).toContain("30-day trial");
  });

  it("does not show Karl subscription price for anonymous users", () => {
    render(<UpsellBanner />);
    const region = screen.getByRole("region", { name: "Upgrade your subscription" });
    expect(region.textContent).not.toContain("$3.99/month");
  });

  it("CTA buttons are labelled for sign-in action", () => {
    render(<UpsellBanner />);
    // Sign-in CTA buttons should have aria-label indicating trial sign-in
    const ctaButtons = screen.getAllByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    expect(ctaButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("clicking CTA navigates to sign-in instead of Stripe", () => {
    render(<UpsellBanner />);
    const ctaButtons = screen.getAllByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    ctaButtons[0]!.click();
    expect(mockRouterPush).toHaveBeenCalledWith("/ledger/sign-in");
  });
});

// ── Signed-in Thrall user tests ───────────────────────────────────────────

describe("UpsellBanner — signed-in Thrall user (issue #1699 regression)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthStatus = "authenticated";
  });

  it("shows Karl upgrade copy for Thrall users", () => {
    render(<UpsellBanner />);
    const region = screen.getByRole("region", { name: "Upgrade your subscription" });
    expect(region.textContent).toContain("$3.99/month");
  });

  it("does not show trial copy for Thrall users", () => {
    render(<UpsellBanner />);
    const region = screen.getByRole("region", { name: "Upgrade your subscription" });
    expect(region.textContent).not.toContain("30-day trial");
  });

  it("renders Upgrade to Karl CTA for Thrall users", () => {
    render(<UpsellBanner />);
    const ctaButtons = screen.getAllByRole("button", { name: "Upgrade to Karl" });
    expect(ctaButtons.length).toBeGreaterThanOrEqual(1);
  });
});
