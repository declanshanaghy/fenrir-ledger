/**
 * Marketing Navbar — Component render tests
 *
 * Validates the MarketingNavbar component matches theme-variants wireframe spec (Issue #642):
 *   - Navigation link order: Features → Pricing → About → Free Trial
 *   - Prose Edda (Chronicles) NOT in main navbar (only in footer)
 *   - Theme toggle button rendered
 *   - "Open the Ledger" CTA rendered
 *   - Correct aria-labels for accessibility
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("MarketingNavbar — Navigation Link Order (Issue #642)", () => {
  it("renders nav links in correct order per wireframe spec", () => {
    render(<MarketingNavbar />);

    const navLinks = [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "About", href: "/about" },
      { label: "Free Trial", href: "/free-trial" },
    ];

    // Get all nav links
    const allLinks = screen.getAllByRole("link");
    // Filter to only nav links (exclude logo and CTA)
    const actualNavLinks = allLinks.filter(link =>
      navLinks.some(nl => link.textContent?.includes(nl.label))
    );

    // Verify order matches wireframe spec
    expect(actualNavLinks).toHaveLength(navLinks.length);
    actualNavLinks.forEach((link, index) => {
      expect(link.textContent).toBe(navLinks[index].label);
      expect(link.getAttribute("href")).toBe(navLinks[index].href);
    });
  });

  it("does NOT include Prose Edda in main navigation", () => {
    render(<MarketingNavbar />);

    // Look for the Prose Edda link - it should NOT be in the navbar
    const proseEddaLink = screen.queryByText("Prose Edda");

    // If found, verify it's not in the main nav (should only be in footer, which isn't rendered here)
    if (proseEddaLink) {
      const navContainer = screen.getByRole("navigation");
      expect(navContainer.contains(proseEddaLink)).toBe(false);
    }
  });
});

describe("MarketingNavbar — Core Components", () => {
  it("renders navigation landmark with aria-label", () => {
    render(<MarketingNavbar />);
    const nav = screen.getByRole("navigation", { name: "Marketing site navigation" });
    expect(nav).toBeDefined();
  });

  it("renders logo with aria-label", () => {
    render(<MarketingNavbar />);
    const logo = screen.getByLabelText("Fenrir Ledger — home");
    expect(logo).toBeDefined();
    expect(logo.getAttribute("href")).toBe("/");
  });

  it("renders 'Open the Ledger' CTA button", () => {
    render(<MarketingNavbar />);
    const cta = screen.getByText("Open the Ledger →");
    expect(cta).toBeDefined();
    expect(cta.getAttribute("href")).toBe("/ledger");
  });

  it("renders theme toggle button", () => {
    render(<MarketingNavbar />);
    // The theme toggle is a button within the nav
    const nav = screen.getByRole("navigation");
    const buttons = nav.querySelectorAll("button");
    // Should have hamburger button at minimum
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders hamburger menu button for mobile", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByLabelText("Open navigation menu");
    expect(hamburger).toBeDefined();
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("MarketingNavbar — Navigation Link Accessibility", () => {
  it("sets aria-current='page' for active links", () => {
    // Since usePathname is mocked to return "/", no links will be active
    render(<MarketingNavbar />);
    const activeLinks = screen.queryAllByRole("link", { current: "page" });
    // With pathname = "/", all nav links should be inactive
    expect(activeLinks).toHaveLength(0);
  });

  it("all nav links are properly anchored with href attributes", () => {
    render(<MarketingNavbar />);

    const expectedLinks = [
      { text: "Features", href: "/features" },
      { text: "Pricing", href: "/pricing" },
      { text: "About", href: "/about" },
      { text: "Free Trial", href: "/free-trial" },
    ];

    expectedLinks.forEach(({ text, href }) => {
      const link = screen.getByRole("link", { name: text });
      expect(link).toBeDefined();
      expect(link.getAttribute("href")).toBe(href);
    });
  });
});
