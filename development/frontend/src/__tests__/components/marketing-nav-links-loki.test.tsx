/**
 * MarketingNavLinks — Loki QA gap tests (Issue #1034)
 *
 * Targets acceptance criteria NOT covered by FiremanDecko's existing tests:
 *  1. Inactive link has `muted-foreground` class (visual design spec)
 *  2. Active link does NOT have `muted-foreground` class (mutual exclusion)
 *  3. isNavLinkActive edge: empty-string pathname → false
 *  4. LedgerTopBar nav container has `hidden md:flex` responsive classes (mobile hiding)
 *  5. LedgerTopBar nav container has `absolute left-1/2 -translate-x-1/2` centering
 *  6. On `/ledger` path no marketing link has aria-current='page'
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MarketingNavLinks,
  isNavLinkActive,
} from "@/components/marketing/MarketingNavLinks";

// ── Shared mocks ──────────────────────────────────────────────────────────────

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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => mockPathname,
}));

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

// ── isNavLinkActive edge cases ────────────────────────────────────────────────

describe("isNavLinkActive — edge cases", () => {
  it("returns false for empty string pathname", () => {
    expect(isNavLinkActive("", "/features")).toBe(false);
  });
});

// ── MarketingNavLinks — visual CSS classes ────────────────────────────────────

describe("MarketingNavLinks — inactive link CSS (design spec)", () => {
  beforeEach(() => {
    mockPathname = "/about";
  });

  it("inactive link has muted-foreground class", () => {
    render(<div><MarketingNavLinks /></div>);
    // Features is inactive when on /about
    const featuresLink = screen.getByRole("link", { name: "Features" });
    expect(featuresLink.className).toContain("muted-foreground");
  });

  it("active link does NOT have muted-foreground class", () => {
    render(<div><MarketingNavLinks /></div>);
    // About is active when on /about
    const aboutLink = screen.getByRole("link", { name: "About" });
    expect(aboutLink.className).not.toContain("muted-foreground");
  });
});

// ── LedgerTopBar — nav container layout spec ──────────────────────────────────

describe("LedgerTopBar — marketing nav container layout (Issue #1034)", () => {
  beforeEach(() => {
    mockPathname = "/ledger";
  });

  it("nav container has hidden md:flex classes for responsive desktop-only display", async () => {
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
    render(<LedgerTopBar />);
    const marketingNav = screen.getByRole("navigation", {
      name: "Marketing site navigation",
    });
    // hidden md:flex = desktop-only, hidden on mobile (≤767px)
    expect(marketingNav.className).toContain("hidden");
    expect(marketingNav.className).toContain("md:flex");
  });

  it("nav container has absolute centering classes", async () => {
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
    render(<LedgerTopBar />);
    const marketingNav = screen.getByRole("navigation", {
      name: "Marketing site navigation",
    });
    // absolute left-1/2 -translate-x-1/2 = centered between logo and controls
    expect(marketingNav.className).toContain("absolute");
    expect(marketingNav.className).toContain("left-1/2");
    expect(marketingNav.className).toContain("-translate-x-1/2");
  });

  it("no marketing nav link is active on a ledger-only path (/ledger)", async () => {
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
    mockPathname = "/ledger";
    render(<LedgerTopBar />);
    const marketingNav = screen.getByRole("navigation", {
      name: "Marketing site navigation",
    });
    const activeLinks = marketingNav.querySelectorAll('[aria-current="page"]');
    expect(activeLinks).toHaveLength(0);
  });
});
