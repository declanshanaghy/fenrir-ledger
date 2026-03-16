/**
 * MarketingNavLinks — unit tests
 *
 * Validates the shared nav links component used in both MarketingNavbar
 * and LedgerTopBar (Issue #1034).
 *
 * - Correct links rendered with right hrefs
 * - Active state (aria-current + border class) applied correctly
 * - onLinkClick callback fires on link click
 * - isNavLinkActive pure helper coverage
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  MarketingNavLinks,
  isNavLinkActive,
  NAV_LINKS,
} from "@/components/marketing/MarketingNavLinks";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// ── NAV_LINKS constant ─────────────────────────────────────────────────────────

describe("NAV_LINKS constant", () => {
  it("contains exactly 5 links in the correct order", () => {
    expect(NAV_LINKS).toHaveLength(5);
    expect(NAV_LINKS[0]).toEqual({ href: "/features", label: "Features" });
    expect(NAV_LINKS[1]).toEqual({ href: "/chronicles", label: "Prose Edda" });
    expect(NAV_LINKS[2]).toEqual({ href: "/about", label: "About" });
    expect(NAV_LINKS[3]).toEqual({ href: "/free-trial", label: "Free Trial" });
    expect(NAV_LINKS[4]).toEqual({ href: "/pricing", label: "Pricing" });
  });
});

// ── isNavLinkActive ────────────────────────────────────────────────────────────

describe("isNavLinkActive", () => {
  it("returns false when pathname is null", () => {
    expect(isNavLinkActive(null, "/features")).toBe(false);
  });

  it("returns true for exact pathname match", () => {
    expect(isNavLinkActive("/pricing", "/pricing")).toBe(true);
  });

  it("returns true for a sub-path match", () => {
    expect(isNavLinkActive("/features/details", "/features")).toBe(true);
  });

  it("returns false when pathname starts with href string but lacks trailing slash boundary", () => {
    expect(isNavLinkActive("/features-extra", "/features")).toBe(false);
  });

  it("returns false when pathname does not match", () => {
    expect(isNavLinkActive("/about", "/features")).toBe(false);
  });
});

// ── MarketingNavLinks render ───────────────────────────────────────────────────

describe("MarketingNavLinks — renders all links", () => {
  it("renders all 5 nav links", () => {
    mockPathname = "/";
    render(
      <div>
        <MarketingNavLinks />
      </div>
    );

    const allLinks = screen.getAllByRole("link");
    const navLabels = NAV_LINKS.map((l) => l.label);
    const navLinks = allLinks.filter((l) =>
      navLabels.some((label) => l.textContent === label)
    );
    expect(navLinks).toHaveLength(5);
  });

  it("each link has the correct href", () => {
    mockPathname = "/";
    render(
      <div>
        <MarketingNavLinks />
      </div>
    );

    NAV_LINKS.forEach(({ href, label }) => {
      const link = screen.getByRole("link", { name: label });
      expect(link.getAttribute("href")).toBe(href);
    });
  });

  it("all links carry font-heading class", () => {
    mockPathname = "/";
    render(
      <div>
        <MarketingNavLinks />
      </div>
    );

    NAV_LINKS.forEach(({ label }) => {
      const link = screen.getByRole("link", { name: label });
      expect(link.className).toContain("font-heading");
    });
  });
});

// ── Active state ──────────────────────────────────────────────────────────────

describe("MarketingNavLinks — active state", () => {
  it("sets aria-current='page' on the active link", () => {
    mockPathname = "/pricing";
    render(
      <div>
        <MarketingNavLinks />
      </div>
    );

    const pricingLink = screen.getByRole("link", { name: "Pricing" });
    expect(pricingLink.getAttribute("aria-current")).toBe("page");
  });

  it("active link has border class (visual active indicator)", () => {
    mockPathname = "/features";
    render(
      <div>
        <MarketingNavLinks />
      </div>
    );

    const featuresLink = screen.getByRole("link", { name: "Features" });
    expect(featuresLink.className).toContain("border");
    expect(featuresLink.className).toContain("font-semibold");
  });

  it("inactive links do not have aria-current", () => {
    mockPathname = "/features";
    render(
      <div>
        <MarketingNavLinks />
      </div>
    );

    const pricingLink = screen.getByRole("link", { name: "Pricing" });
    expect(pricingLink.getAttribute("aria-current")).toBeNull();
  });

  it("no links are active when pathname is '/'", () => {
    mockPathname = "/";
    render(
      <div>
        <MarketingNavLinks />
      </div>
    );

    const activeLinks = screen.queryAllByRole("link", { current: "page" });
    expect(activeLinks).toHaveLength(0);
  });
});

// ── onLinkClick callback ──────────────────────────────────────────────────────

describe("MarketingNavLinks — onLinkClick", () => {
  it("calls onLinkClick when a link is clicked", () => {
    mockPathname = "/";
    const onLinkClick = vi.fn();
    render(
      <div>
        <MarketingNavLinks onLinkClick={onLinkClick} />
      </div>
    );

    const featuresLink = screen.getByRole("link", { name: "Features" });
    fireEvent.click(featuresLink);
    expect(onLinkClick).toHaveBeenCalledTimes(1);
  });

  it("does not throw when onLinkClick is undefined and link is clicked", () => {
    mockPathname = "/";
    render(
      <div>
        <MarketingNavLinks />
      </div>
    );

    const aboutLink = screen.getByRole("link", { name: "About" });
    expect(() => fireEvent.click(aboutLink)).not.toThrow();
  });
});

// ── LedgerTopBar integration: nav links in ledger header ─────────────────────

describe("LedgerTopBar — marketing nav links (Issue #1034)", () => {
  // Re-use the same mocks pattern from ledger-topbar.test.tsx
  it("LedgerTopBar renders a nav with aria-label 'Marketing site navigation'", async () => {
    // Inline import to use the mocks already defined above
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");

    vi.mock("next-themes", () => ({
      useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
    }));
    vi.mock("@/hooks/useAuth", () => ({
      useAuth: () => ({
        data: null,
        status: "anonymous",
        householdId: null,
        signOut: vi.fn(),
      }),
    }));
    vi.mock("@/components/layout/ThemeToggle", () => ({
      ThemeToggle: () => <button type="button" aria-label="Toggle theme">T</button>,
      cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
    }));
    vi.mock("@/components/layout/TrialBadge", () => ({
      TrialBadge: () => null,
    }));
    vi.mock("@/lib/entitlement/cache", () => ({
      getEntitlementCache: () => null,
      clearEntitlementCache: vi.fn(),
    }));

    mockPathname = "/ledger";
    render(<LedgerTopBar />);

    const marketingNav = screen.getByRole("navigation", {
      name: "Marketing site navigation",
    });
    expect(marketingNav).toBeDefined();
  });

  it("LedgerTopBar nav contains all 5 marketing links", async () => {
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");

    mockPathname = "/ledger";
    render(<LedgerTopBar />);

    const marketingNav = screen.getByRole("navigation", {
      name: "Marketing site navigation",
    });

    NAV_LINKS.forEach(({ label, href }) => {
      const link = marketingNav.querySelector(`a[href="${href}"]`);
      expect(link).not.toBeNull();
      expect(link?.textContent).toBe(label);
    });
  });
});
