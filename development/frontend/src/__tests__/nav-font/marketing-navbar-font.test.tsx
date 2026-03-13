/**
 * MarketingNavbar — Nav font & link order tests
 *
 * Validates:
 *   - Nav links use font-heading (Cinzel) class
 *   - Link order: Features, Prose Edda, About, Free Trial, Pricing
 *   - Free Trial desktop link has CTA-adjacent styling (font-semibold, border)
 *   - Free Trial mobile link has font-semibold
 *   - Mobile overlay links also use font-heading
 *
 * Issue: #648
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

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
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";

// ── Expected link order ─────────────────────────────────────────────────────

const EXPECTED_ORDER = [
  "Features",
  "Prose Edda",
  "About",
  "Free Trial",
  "Pricing",
];

// ── Desktop nav tests ───────────────────────────────────────────────────────

describe("MarketingNavbar — Desktop font & order (issue #648)", () => {
  beforeEach(() => {
    render(<MarketingNavbar />);
  });

  it("desktop nav links use font-heading class", () => {
    const nav = screen.getByLabelText("Marketing site navigation");
    const desktopContainer = nav.querySelector(".hidden.md\\:flex.items-center.gap-8");
    expect(desktopContainer).not.toBeNull();

    const links = desktopContainer!.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).toContain("font-heading");
    });
  });

  it("desktop nav links do NOT use font-body class", () => {
    const nav = screen.getByLabelText("Marketing site navigation");
    const desktopContainer = nav.querySelector(".hidden.md\\:flex.items-center.gap-8");
    const links = desktopContainer!.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).not.toContain("font-body");
    });
  });

  it("desktop nav link order matches spec: Features, Prose Edda, About, Free Trial, Pricing", () => {
    const nav = screen.getByLabelText("Marketing site navigation");
    const desktopContainer = nav.querySelector(".hidden.md\\:flex.items-center.gap-8");
    const links = desktopContainer!.querySelectorAll("a");
    const labels = Array.from(links).map((l) => l.textContent?.trim());

    expect(labels).toEqual(EXPECTED_ORDER);
  });

  it("desktop Free Trial link has font-semibold class", () => {
    const nav = screen.getByLabelText("Marketing site navigation");
    const desktopContainer = nav.querySelector(".hidden.md\\:flex.items-center.gap-8");
    const links = Array.from(desktopContainer!.querySelectorAll("a"));
    const freeTrialLink = links.find((l) => l.textContent?.trim() === "Free Trial");

    expect(freeTrialLink).toBeDefined();
    expect(freeTrialLink!.className).toContain("font-semibold");
  });

  it("desktop Free Trial link has border styling", () => {
    const nav = screen.getByLabelText("Marketing site navigation");
    const desktopContainer = nav.querySelector(".hidden.md\\:flex.items-center.gap-8");
    const links = Array.from(desktopContainer!.querySelectorAll("a"));
    const freeTrialLink = links.find((l) => l.textContent?.trim() === "Free Trial");

    expect(freeTrialLink!.className).toContain("border");
    expect(freeTrialLink!.className).toContain("border-border");
    expect(freeTrialLink!.className).toContain("px-2.5");
    expect(freeTrialLink!.className).toContain("py-1");
  });

  it("desktop non-Free-Trial links do NOT have font-semibold", () => {
    const nav = screen.getByLabelText("Marketing site navigation");
    const desktopContainer = nav.querySelector(".hidden.md\\:flex.items-center.gap-8");
    const links = Array.from(desktopContainer!.querySelectorAll("a"));
    const regularLinks = links.filter((l) => l.textContent?.trim() !== "Free Trial");

    regularLinks.forEach((link) => {
      expect(link.className).not.toContain("font-semibold");
    });
  });
});

// ── Mobile overlay tests ────────────────────────────────────────────────────

describe("MarketingNavbar — Mobile overlay font & order (issue #648)", () => {
  beforeEach(() => {
    render(<MarketingNavbar />);
    // Open mobile overlay
    const hamburger = screen.getByLabelText("Open navigation menu");
    fireEvent.click(hamburger);
  });

  it("mobile overlay nav links use font-heading class", () => {
    const mobileNav = screen.getByLabelText("Mobile navigation");
    const links = within(mobileNav).getAllByRole("link");
    links.forEach((link) => {
      expect(link.className).toContain("font-heading");
    });
  });

  it("mobile overlay nav links do NOT use font-body class", () => {
    const mobileNav = screen.getByLabelText("Mobile navigation");
    const links = within(mobileNav).getAllByRole("link");
    links.forEach((link) => {
      expect(link.className).not.toContain("font-body");
    });
  });

  it("mobile overlay link order matches spec: Features, Prose Edda, About, Free Trial, Pricing", () => {
    const mobileNav = screen.getByLabelText("Mobile navigation");
    const links = within(mobileNav).getAllByRole("link");
    const labels = links.map((l) => l.textContent?.trim());

    expect(labels).toEqual(EXPECTED_ORDER);
  });

  it("mobile Free Trial link has font-semibold class", () => {
    const mobileNav = screen.getByLabelText("Mobile navigation");
    const links = within(mobileNav).getAllByRole("link");
    const freeTrialLink = links.find((l) => l.textContent?.trim() === "Free Trial");

    expect(freeTrialLink).toBeDefined();
    expect(freeTrialLink!.className).toContain("font-semibold");
  });

  it("mobile non-Free-Trial links do NOT have font-semibold", () => {
    const mobileNav = screen.getByLabelText("Mobile navigation");
    const links = within(mobileNav).getAllByRole("link");
    const regularLinks = links.filter((l) => l.textContent?.trim() !== "Free Trial");

    regularLinks.forEach((link) => {
      expect(link.className).not.toContain("font-semibold");
    });
  });
});
