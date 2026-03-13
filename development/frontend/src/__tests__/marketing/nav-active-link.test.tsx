/**
 * MarketingNavbar — active link highlighting tests
 *
 * Validates that the nav highlights the link matching the current route,
 * not always "Free Trial".
 *
 * Issue: #662
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

import {
  MarketingNavbar,
  isNavLinkActive,
} from "@/components/marketing/MarketingNavbar";

// ── isNavLinkActive unit tests ───────────────────────────────────────────────

describe("isNavLinkActive", () => {
  it("returns true for exact match", () => {
    expect(isNavLinkActive("/pricing", "/pricing")).toBe(true);
  });

  it("returns true for sub-path match", () => {
    expect(isNavLinkActive("/pricing/details", "/pricing")).toBe(true);
  });

  it("returns false for non-matching path", () => {
    expect(isNavLinkActive("/about", "/pricing")).toBe(false);
  });

  it("returns false for partial prefix that is not a sub-path", () => {
    // /pricingXYZ should NOT match /pricing
    expect(isNavLinkActive("/pricingXYZ", "/pricing")).toBe(false);
  });

  it("returns false for root path against a nav link", () => {
    expect(isNavLinkActive("/", "/features")).toBe(false);
  });
});

// ── Desktop nav highlight tests ──────────────────────────────────────────────

describe("MarketingNavbar — desktop active link", () => {
  it("highlights Pricing when on /pricing", () => {
    mockPathname = "/pricing";
    render(<MarketingNavbar />);

    const nav = screen.getByLabelText("Marketing site navigation");
    const pricingLink = within(nav).getAllByText("Pricing")[0].closest("a")!;
    const freeTrialLink = within(nav)
      .getAllByText("Free Trial")[0]
      .closest("a")!;

    expect(pricingLink.getAttribute("aria-current")).toBe("page");
    expect(freeTrialLink.getAttribute("aria-current")).toBeNull();
  });

  it("highlights Free Trial only when on /free-trial", () => {
    mockPathname = "/free-trial";
    render(<MarketingNavbar />);

    const nav = screen.getByLabelText("Marketing site navigation");
    const freeTrialLink = within(nav)
      .getAllByText("Free Trial")[0]
      .closest("a")!;
    const featuresLink = within(nav).getAllByText("Features")[0].closest("a")!;

    expect(freeTrialLink.getAttribute("aria-current")).toBe("page");
    expect(featuresLink.getAttribute("aria-current")).toBeNull();
  });

  it("highlights Features when on /features", () => {
    mockPathname = "/features";
    render(<MarketingNavbar />);

    const nav = screen.getByLabelText("Marketing site navigation");
    const featuresLink = within(nav).getAllByText("Features")[0].closest("a")!;

    expect(featuresLink.getAttribute("aria-current")).toBe("page");
  });

  it("no nav link is highlighted on the home page", () => {
    mockPathname = "/";
    render(<MarketingNavbar />);

    const nav = screen.getByLabelText("Marketing site navigation");
    const links = within(nav).getAllByRole("link");
    const activeLinks = links.filter(
      (l) => l.getAttribute("aria-current") === "page",
    );

    expect(activeLinks).toHaveLength(0);
  });

  it("active link receives font-semibold class", () => {
    mockPathname = "/about";
    render(<MarketingNavbar />);

    const nav = screen.getByLabelText("Marketing site navigation");
    const aboutLink = within(nav).getAllByText("About")[0].closest("a")!;

    expect(aboutLink.className).toContain("font-semibold");
  });

  it("inactive link does not receive font-semibold class", () => {
    mockPathname = "/about";
    render(<MarketingNavbar />);

    const nav = screen.getByLabelText("Marketing site navigation");
    const pricingLink = within(nav).getAllByText("Pricing")[0].closest("a")!;

    expect(pricingLink.className).not.toContain("font-semibold");
  });
});

// ── Mobile nav highlight tests ───────────────────────────────────────────────

describe("MarketingNavbar — mobile active link", () => {
  it("highlights the active link in mobile overlay", async () => {
    mockPathname = "/chronicles";
    render(<MarketingNavbar />);

    // Open mobile menu via fireEvent (React state update)
    const hamburger = screen.getByLabelText("Open navigation menu");
    fireEvent.click(hamburger);

    const mobileNav = screen.getByLabelText("Mobile navigation");
    const proseEddaLink = within(mobileNav)
      .getByText("Prose Edda")
      .closest("a")!;
    const pricingLink = within(mobileNav)
      .getByText("Pricing")
      .closest("a")!;

    expect(proseEddaLink.getAttribute("aria-current")).toBe("page");
    expect(pricingLink.getAttribute("aria-current")).toBeNull();
  });
});
