/**
 * Hamburger menu toggle — Issue #1113
 *
 * Validates that the mobile hamburger menu opens, closes, and meets
 * accessibility requirements for both MarketingNavbar and LedgerTopBar.
 *
 * Covers:
 *   - Hamburger renders with correct aria attributes (aria-expanded=false initially)
 *   - Click on hamburger opens the overlay (aria-expanded=true, dialog visible)
 *   - Nav links render in the overlay when open
 *   - Close button closes the overlay
 *   - Clicking a nav link closes the overlay
 *   - ESC key closes the overlay
 *   - Touch target meets 44×44px minimum (WCAG 2.5.5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Shared mocks ───────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">T</button>,
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
}));

// ── MarketingNavbar tests ──────────────────────────────────────────────────────

import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";

describe("MarketingNavbar — hamburger menu toggle (Issue #1113)", () => {
  afterEach(() => {
    // Restore body overflow in case a test left it set
    document.body.style.overflow = "";
  });

  it("renders hamburger button with aria-expanded=false initially", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    expect(hamburger).toBeDefined();
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
    expect(hamburger.getAttribute("aria-controls")).toBe("mobile-nav-overlay");
  });

  it("hamburger touch target meets 44×44px minimum (WCAG 2.5.5)", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    expect(hamburger.style.minWidth).toBe("44px");
    expect(hamburger.style.minHeight).toBe("44px");
  });

  it("clicking hamburger opens the mobile overlay", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(overlay).toBeDefined();
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");
  });

  it("overlay renders all nav links when open", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    // All 5 nav links should be present in the overlay
    const expectedLinks = ["/features", "/chronicles", "/about", "/free-trial", "/pricing"];
    expectedLinks.forEach((href) => {
      const link = document.querySelector(`a[href="${href}"]`);
      expect(link).not.toBeNull();
    });
  });

  it("close button closes the overlay", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });
    expect(screen.getByRole("dialog")).toBeDefined();

    const closeButton = screen.getByRole("button", { name: "Close navigation menu" });
    act(() => { fireEvent.click(closeButton); });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking a nav link closes the overlay", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });
    expect(screen.getByRole("dialog")).toBeDefined();

    // Click the Features link inside the mobile overlay
    const featuresLinks = document.querySelectorAll('a[href="/features"]');
    // The last one is inside the overlay
    const overlayFeaturesLink = featuresLinks[featuresLinks.length - 1];
    act(() => { fireEvent.click(overlayFeaturesLink); });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ESC key closes the overlay", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });
    expect(screen.getByRole("dialog")).toBeDefined();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ESC key does nothing when overlay is closed", () => {
    render(<MarketingNavbar />);
    // Overlay is not open — ESC should not throw
    expect(() => {
      act(() => { fireEvent.keyDown(document, { key: "Escape" }); });
    }).not.toThrow();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("overlay has role=dialog and aria-modal=true", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog");
    expect(overlay.getAttribute("aria-modal")).toBe("true");
    expect(overlay.id).toBe("mobile-nav-overlay");
  });

  it("prevents body scroll when overlay is open", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll when overlay is closed", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const closeButton = screen.getByRole("button", { name: "Close navigation menu" });
    act(() => { fireEvent.click(closeButton); });

    expect(document.body.style.overflow).toBe("");
  });
});

// ── Loki gap coverage — MarketingNavbar ────────────────────────────────────────

describe("MarketingNavbar — backdrop tap and rapid toggle (Loki gap coverage)", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("tapping the backdrop (overlay bg, not children) closes the overlay", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    // Simulate backdrop tap: click on the overlay itself, not a child
    act(() => { fireEvent.click(overlay, { target: overlay }); });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("rapid open-close-open does not desync aria-expanded state", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    // Open
    act(() => { fireEvent.click(hamburger); });
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");

    // Close via ESC
    act(() => { fireEvent.keyDown(document, { key: "Escape" }); });
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");

    // Open again — must still work (no state desync)
    act(() => { fireEvent.click(hamburger); });
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});

// ── Loki gap coverage — LedgerTopBar ──────────────────────────────────────────

describe("LedgerTopBar — backdrop tap and nav link close (Loki gap coverage)", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("tapping the backdrop (overlay bg, not children) closes the overlay", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    // Simulate backdrop tap: click on the overlay itself, not a child
    act(() => { fireEvent.click(overlay, { target: overlay }); });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking a nav link inside the overlay closes the overlay", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });
    expect(screen.getByRole("dialog")).toBeDefined();

    // Click the Features link inside the mobile overlay
    const featuresLinks = document.querySelectorAll('a[href="/features"]');
    const overlayFeaturesLink = featuresLinks[featuresLinks.length - 1];
    act(() => { fireEvent.click(overlayFeaturesLink); });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ── LedgerTopBar hamburger tests ───────────────────────────────────────────────

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    data: null,
    status: "anonymous",
    householdId: null,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: () => null,
  clearEntitlementCache: vi.fn(),
}));

vi.mock("@/components/layout/TrialBadge", () => ({
  TrialBadge: () => null,
}));

import { LedgerTopBar } from "@/components/layout/LedgerTopBar";

describe("LedgerTopBar — hamburger menu toggle (Issue #1113)", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders hamburger button with aria-expanded=false initially", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    expect(hamburger).toBeDefined();
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
    expect(hamburger.getAttribute("aria-controls")).toBe("ledger-mobile-nav-overlay");
  });

  it("hamburger touch target meets 44×44px minimum (WCAG 2.5.5)", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    expect(hamburger.style.minWidth).toBe("44px");
    expect(hamburger.style.minHeight).toBe("44px");
  });

  it("clicking hamburger opens the mobile overlay", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(overlay).toBeDefined();
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");
  });

  it("overlay renders nav links when open", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    // Marketing nav links should appear in the overlay
    const expectedLinks = ["/features", "/chronicles", "/about", "/free-trial", "/pricing"];
    expectedLinks.forEach((href) => {
      const link = document.querySelector(`a[href="${href}"]`);
      expect(link).not.toBeNull();
    });

    // Also includes a "My Cards" link back to /ledger
    const myCardsLink = document.querySelector('a[href="/ledger"]');
    expect(myCardsLink).not.toBeNull();
  });

  it("close button closes the overlay", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });
    expect(screen.getByRole("dialog")).toBeDefined();

    const closeButton = screen.getByRole("button", { name: "Close navigation menu" });
    act(() => { fireEvent.click(closeButton); });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ESC key closes the overlay", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });
    expect(screen.getByRole("dialog")).toBeDefined();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("overlay has role=dialog and aria-modal=true", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(overlay.getAttribute("aria-modal")).toBe("true");
    expect(overlay.id).toBe("ledger-mobile-nav-overlay");
  });

  it("overlay contains a mobile navigation landmark", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const mobileNav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(mobileNav).toBeDefined();
  });

  it("prevents body scroll when overlay is open", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll when overlay is closed", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const closeButton = screen.getByRole("button", { name: "Close navigation menu" });
    act(() => { fireEvent.click(closeButton); });

    expect(document.body.style.overflow).toBe("");
  });
});
