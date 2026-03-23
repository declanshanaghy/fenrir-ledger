/**
 * Loki QA — Issue #1853 supplemental tests
 *
 * Augments unified-header-1853.test.tsx with gap coverage:
 * - CTA button navigates to /ledger (AC3)
 * - ThemeToggle renders in desktop right slot (AC3)
 * - MarketingNavbar has backdrop-blur-sm (parity with LedgerTopBar)
 * - Mobile overlay CTA navigates to /ledger (AC3)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";

// ── Mocks ────────────────────────────────────────────────────────────────────

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
  usePathname: () => "/about",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">T</button>,
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
}));

vi.mock("@/components/marketing/MarketingNavLinks", () => ({
  MarketingNavLinks: () => null,
  NAV_LINKS: [
    { href: "/features", label: "Features" },
    { href: "/about", label: "About" },
  ],
  isNavLinkActive: (_pathname: string, href: string) => href === "/about",
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("MarketingNavbar — AC3: CTA navigates to /ledger (Issue #1853)", () => {
  it("desktop CTA link href is /ledger", () => {
    render(<MarketingNavbar />);
    const ctaLinks = Array.from(document.querySelectorAll("a")).filter(
      (el) => el.textContent?.includes("Open the Ledger")
    );
    // At least one CTA link should exist in desktop state
    expect(ctaLinks.length).toBeGreaterThan(0);
    expect(ctaLinks[0].getAttribute("href")).toBe("/ledger");
  });
});

describe("MarketingNavbar — AC3: ThemeToggle in desktop header (Issue #1853)", () => {
  it("renders ThemeToggle button in the navbar", () => {
    render(<MarketingNavbar />);
    const toggleBtn = screen.getByRole("button", { name: "Toggle theme" });
    expect(toggleBtn).toBeDefined();
  });
});

describe("MarketingNavbar — backdrop-blur-sm parity (Issue #1853)", () => {
  it("nav has backdrop-blur-sm to match LedgerTopBar visual parity", () => {
    const { container } = render(<MarketingNavbar />);
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav!.className).toContain("backdrop-blur-sm");
  });

  it("nav has bg-background/90 semi-transparent background", () => {
    const { container } = render(<MarketingNavbar />);
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav!.className).toContain("bg-background/90");
  });
});

describe("MarketingNavbar — AC3: mobile overlay CTA (Issue #1853)", () => {
  it("mobile overlay CTA link href is /ledger", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog");
    const overlayCta = Array.from(overlay.querySelectorAll("a")).find(
      (el) => el.textContent?.includes("Open the Ledger")
    );
    expect(overlayCta).not.toBeUndefined();
    expect(overlayCta!.getAttribute("href")).toBe("/ledger");
  });
});
