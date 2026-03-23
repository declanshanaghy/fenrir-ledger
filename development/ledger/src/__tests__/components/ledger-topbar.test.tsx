/**
 * LedgerTopBar — Component render tests
 *
 * Validates the ledger app header renders correct landmarks,
 * aria-labels, skip-nav link, anonymous/authenticated states,
 * and spacing between trial badge and profile section (Issue #994).
 *
 * Supersedes structural checks from layout/topbar.spec.ts E2E tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerTopBar } from "@/components/layout/LedgerTopBar";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock next/link
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

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/ledger",
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

// Mock ThemeToggle component
vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">T</button>,
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
}));

// Track auth mock state
let mockAuthStatus = "anonymous";
let mockSession: { user: { name: string; email: string; picture?: string } } | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    data: mockSession,
    status: mockAuthStatus,
    householdId: "test-household",
    signOut: vi.fn(),
  }),
}));

// Mock entitlement cache
vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: () => null,
  clearEntitlementCache: vi.fn(),
}));

// Mock MarketingNavLinks — isolate LedgerTopBar from marketing nav transitive deps
vi.mock("@/components/marketing/MarketingNavLinks", () => ({
  MarketingNavLinks: () => null,
  NAV_LINKS: [],
  isNavLinkActive: () => false,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LedgerTopBar — Anonymous state", () => {
  beforeEach(() => {
    mockAuthStatus = "anonymous";
    mockSession = null;
  });

  it("renders a <header> element with role='banner'", () => {
    render(<LedgerTopBar />);
    const header = screen.getByRole("banner");
    expect(header).toBeDefined();
    expect(header.tagName.toLowerCase()).toBe("header");
  });

  it("renders the skip-to-main-content link", () => {
    render(<LedgerTopBar />);
    const skipLink = screen.getByText("Skip to main content");
    expect(skipLink).toBeDefined();
    expect(skipLink.getAttribute("href")).toBe("#main-content");
  });

  it("renders the logo link pointing to '/'", () => {
    render(<LedgerTopBar />);
    const logoLink = screen.getByLabelText("Fenrir Ledger — go to home");
    expect(logoLink).toBeDefined();
    expect(logoLink.getAttribute("href")).toBe("/");
  });

  it("renders the anonymous avatar button with correct aria-label", () => {
    render(<LedgerTopBar />);
    const avatarButton = screen.getByRole("button", {
      name: "Sign in to sync your data",
    });
    expect(avatarButton).toBeDefined();
    expect(avatarButton.getAttribute("aria-haspopup")).toBe("true");
    expect(avatarButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders the theme toggle for anonymous users", () => {
    render(<LedgerTopBar />);
    const themeToggle = screen.getByRole("button", { name: "Toggle theme" });
    expect(themeToggle).toBeDefined();
  });

  it("renders the rune symbol in the anonymous avatar", () => {
    render(<LedgerTopBar />);
    const anonymousLabel = screen.getByLabelText("Anonymous user");
    expect(anonymousLabel).toBeDefined();
  });
});

describe("LedgerTopBar — Authenticated state", () => {
  beforeEach(() => {
    mockAuthStatus = "authenticated";
    mockSession = {
      user: {
        name: "Odin Allfather",
        email: "odin@asgard.com",
        picture: undefined,
      },
    };
  });

  it("renders the signed-in avatar button with user email in aria-label", () => {
    render(<LedgerTopBar />);
    const avatarButton = screen.getByRole("button", {
      name: "Open user menu, signed in as odin@asgard.com",
    });
    expect(avatarButton).toBeDefined();
    expect(avatarButton.getAttribute("aria-haspopup")).toBe("true");
  });

  it("does not render the anonymous avatar button when authenticated", () => {
    render(<LedgerTopBar />);
    const anonButton = screen.queryByRole("button", {
      name: "Sign in to sync your data",
    });
    expect(anonButton).toBeNull();
  });

  it("renders the theme toggle in the header bar when authenticated (Issue #1906)", () => {
    render(<LedgerTopBar />);
    // Theme toggle is always in the header bar (moved from dropdown — Issue #1906)
    const toggle = screen.queryByRole("button", { name: "Toggle theme" });
    expect(toggle).not.toBeNull();
  });
});

// ── Issue #994: Spacing between trial badge and profile section ───────────────

describe("LedgerTopBar — Issue #994: trial badge / profile spacing", () => {
  it("anonymous avatar button has ml-4 left-margin class (16px gap from trial badge)", () => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    render(<LedgerTopBar />);
    const avatarButton = screen.getByRole("button", {
      name: "Sign in to sync your data",
    });
    expect(avatarButton.className).toContain("ml-4");
  });

  it("authenticated identity-cluster button has ml-4 left-margin class (16px gap from trial badge)", () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Odin Allfather", email: "odin@asgard.com" } };
    render(<LedgerTopBar />);
    const avatarButton = screen.getByRole("button", {
      name: "Open user menu, signed in as odin@asgard.com",
    });
    expect(avatarButton.className).toContain("ml-4");
  });

  it("controls cluster uses gap-1 (was gap-0.5 before fix) for consistent item spacing", () => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    const { container } = render(<LedgerTopBar />);
    // The right-side controls cluster is the only flex container with gap-1 and relative positioning
    const cluster = container.querySelector(".relative.flex.items-center.gap-1");
    expect(cluster).not.toBeNull();
  });

  it("anonymous avatar button retains min touch-target size after spacing change (AC2: mobile layout)", () => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    render(<LedgerTopBar />);
    const avatarButton = screen.getByRole("button", {
      name: "Sign in to sync your data",
    });
    // Touch target maintained at 44×44px — ensures layout doesn't break on 375px mobile
    expect(avatarButton.style.minWidth).toBe("44px");
    expect(avatarButton.style.minHeight).toBe("44px");
  });

  it("authenticated button retains min touch-target height after spacing change (AC2: mobile layout)", () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Thor", email: "thor@asgard.com" } };
    render(<LedgerTopBar />);
    const avatarButton = screen.getByRole("button", {
      name: "Open user menu, signed in as thor@asgard.com",
    });
    expect(avatarButton.style.minHeight).toBe("44px");
  });
});
