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

// ── Issue #893 — Free Trial highlight regression tests ───────────────────────

describe("isNavLinkActive — Free Trial", () => {
  it("returns false for /free-trial when on homepage", () => {
    expect(isNavLinkActive("/", "/free-trial")).toBe(false);
  });

  it("returns false for /free-trial when on /features", () => {
    expect(isNavLinkActive("/features", "/free-trial")).toBe(false);
  });

  it("returns false for /free-trial when on /pricing", () => {
    expect(isNavLinkActive("/pricing", "/free-trial")).toBe(false);
  });

  it("returns true for /free-trial when on /free-trial", () => {
    expect(isNavLinkActive("/free-trial", "/free-trial")).toBe(true);
  });
});

describe("MarketingNavbar — Free Trial highlight (Issue #893)", () => {
  it("Free Trial link does NOT have border class on homepage", () => {
    mockPathname = "/";
    render(<MarketingNavbar />);

    const nav = screen.getByLabelText("Marketing site navigation");
    const freeTrialLink = within(nav).getAllByText("Free Trial")[0].closest("a")!;

    expect(freeTrialLink.className).not.toContain("border border-border");
    expect(freeTrialLink.getAttribute("aria-current")).toBeNull();
  });

  it("Free Trial link has border class only when on /free-trial", () => {
    mockPathname = "/free-trial";
    render(<MarketingNavbar />);

    const nav = screen.getByLabelText("Marketing site navigation");
    const freeTrialLink = within(nav).getAllByText("Free Trial")[0].closest("a")!;

    expect(freeTrialLink.className).toContain("border");
    expect(freeTrialLink.getAttribute("aria-current")).toBe("page");
  });

  it("Free Trial and Features are NOT both highlighted on /features", () => {
    mockPathname = "/features";
    render(<MarketingNavbar />);

    const nav = screen.getByLabelText("Marketing site navigation");
    const freeTrialLink = within(nav).getAllByText("Free Trial")[0].closest("a")!;
    const featuresLink = within(nav).getAllByText("Features")[0].closest("a")!;

    expect(featuresLink.getAttribute("aria-current")).toBe("page");
    expect(freeTrialLink.getAttribute("aria-current")).toBeNull();
    expect(freeTrialLink.className).not.toContain("border border-border");
  });

  it("mobile Free Trial does NOT have font-semibold on homepage", () => {
    mockPathname = "/";
    render(<MarketingNavbar />);

    const hamburger = screen.getByLabelText("Open navigation menu");
    fireEvent.click(hamburger);

    const mobileNav = screen.getByLabelText("Mobile navigation");
    const freeTrialLink = within(mobileNav).getByText("Free Trial").closest("a")!;

    expect(freeTrialLink.className).not.toContain("font-semibold");
    expect(freeTrialLink.getAttribute("aria-current")).toBeNull();
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
