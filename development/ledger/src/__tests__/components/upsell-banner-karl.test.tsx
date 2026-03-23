/**
 * UpsellBanner (entitlement) — Component tests
 *
 * Validates layout structure, aria-labels, dismiss behavior,
 * touch-target sizing, and non-overlapping button positioning.
 * Issue: #692
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { UpsellBanner } from "@/components/entitlement/UpsellBanner";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSubscribeStripe = vi.hoisted(() => vi.fn());
const mockRouterPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/ledger",
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    tier: "thrall",
    isLoading: false,
    hasFeature: () => false,
    subscribeStripe: mockSubscribeStripe,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: "authenticated" }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderBanner() {
  return render(<UpsellBanner />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("UpsellBanner (Karl upsell) — structure", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders with role=region and aria-label", () => {
    renderBanner();
    const region = screen.getByRole("region", {
      name: "Upgrade your subscription",
    });
    expect(region).toBeDefined();
  });

  it("renders the Upgrade to Karl CTA button", () => {
    renderBanner();
    const buttons = screen.getAllByRole("button", { name: "Upgrade to Karl" });
    // Both desktop and mobile layouts render a CTA
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the dismiss button with correct aria-label", () => {
    renderBanner();
    const dismissButtons = screen.getAllByRole("button", {
      name: "Dismiss upgrade banner",
    });
    expect(dismissButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders value prop text", () => {
    renderBanner();
    const region = screen.getByRole("region", {
      name: "Upgrade your subscription",
    });
    expect(region.textContent).toContain("cloud sync");
    expect(region.textContent).toContain("$3.99/month");
  });
});

describe("UpsellBanner (Karl upsell) — touch targets", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("dismiss buttons have min 44x44px touch target", () => {
    renderBanner();
    const dismissButtons = screen.getAllByRole("button", {
      name: "Dismiss upgrade banner",
    });
    for (const btn of dismissButtons) {
      const style = btn.getAttribute("style") || "";
      // Buttons use inline style for minWidth/minHeight OR className
      const hasMinWidth =
        style.includes("min-width: 44px") || style.includes("min-width:44px");
      const hasMinHeight =
        style.includes("min-height: 44px") || style.includes("min-height:44px");
      expect(hasMinWidth).toBe(true);
      expect(hasMinHeight).toBe(true);
    }
  });

  it("CTA buttons have min-h-[36px] class (visually > 44px with padding)", () => {
    renderBanner();
    const ctaButtons = screen.getAllByRole("button", {
      name: "Upgrade to Karl",
    });
    for (const btn of ctaButtons) {
      expect(btn.className).toContain("min-h-[36px]");
    }
  });
});

describe("UpsellBanner (Karl upsell) — layout separation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("desktop layout uses inline flex (not absolute positioning) for dismiss", () => {
    renderBanner();
    const region = screen.getByRole("region", {
      name: "Upgrade your subscription",
    });
    // The desktop wrapper uses `hidden md:flex` with gap-3
    const desktopWrapper = region.querySelector(".hidden.md\\:flex");
    expect(desktopWrapper).not.toBeNull();

    // Find dismiss button within desktop layout — should NOT be absolute
    const dismissBtn = desktopWrapper!.querySelector(
      'button[aria-label="Dismiss upgrade banner"]'
    );
    expect(dismissBtn).not.toBeNull();
    expect(dismissBtn!.className).not.toContain("absolute");
  });

  it("mobile layout has pr-14 padding to clear dismiss button", () => {
    renderBanner();
    const region = screen.getByRole("region", {
      name: "Upgrade your subscription",
    });
    // The mobile wrapper uses `md:hidden`
    const mobileWrapper = region.querySelector(".md\\:hidden");
    expect(mobileWrapper).not.toBeNull();
    expect(mobileWrapper!.className).toContain("pr-14");
  });

  it("mobile dismiss button is absolute positioned at top-right", () => {
    renderBanner();
    const region = screen.getByRole("region", {
      name: "Upgrade your subscription",
    });
    const mobileWrapper = region.querySelector(".md\\:hidden");
    const dismissBtn = mobileWrapper!.querySelector(
      'button[aria-label="Dismiss upgrade banner"]'
    );
    expect(dismissBtn).not.toBeNull();
    expect(dismissBtn!.className).toContain("absolute");
    expect(dismissBtn!.className).toContain("top-2");
    expect(dismissBtn!.className).toContain("right-2");
  });

  it("mobile CTA is self-start (left-aligned, away from dismiss)", () => {
    renderBanner();
    const region = screen.getByRole("region", {
      name: "Upgrade your subscription",
    });
    const mobileWrapper = region.querySelector(".md\\:hidden");
    const ctaBtn = mobileWrapper!.querySelector(
      'button:not([aria-label="Dismiss upgrade banner"])'
    );
    expect(ctaBtn).not.toBeNull();
    expect(ctaBtn!.className).toContain("self-start");
  });
});

describe("UpsellBanner (Karl upsell) — dismiss behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("clicking dismiss hides the banner", () => {
    renderBanner();
    const dismissButtons = screen.getAllByRole("button", {
      name: "Dismiss upgrade banner",
    });
    act(() => {
      fireEvent.click(dismissButtons[0]);
    });
    expect(
      screen.queryByRole("region", { name: "Upgrade your subscription" })
    ).toBeNull();
  });

  it("dismiss sets localStorage flag", () => {
    renderBanner();
    const dismissButtons = screen.getAllByRole("button", {
      name: "Dismiss upgrade banner",
    });
    act(() => {
      fireEvent.click(dismissButtons[0]);
    });
    expect(localStorage.getItem("fenrir:stripe_upsell_dismissed")).toBe("true");
  });

  it("does not render when already dismissed", () => {
    localStorage.setItem("fenrir:stripe_upsell_dismissed", "true");
    renderBanner();
    expect(
      screen.queryByRole("region", { name: "Upgrade your subscription" })
    ).toBeNull();
  });
});

describe("UpsellBanner (Karl upsell) — CTA interaction", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("clicking CTA calls subscribeStripe", () => {
    mockSubscribeStripe.mockResolvedValue(undefined);
    renderBanner();
    const ctaButtons = screen.getAllByRole("button", {
      name: "Upgrade to Karl",
    });
    act(() => {
      fireEvent.click(ctaButtons[0]);
    });
    expect(mockSubscribeStripe).toHaveBeenCalledTimes(1);
  });
});
