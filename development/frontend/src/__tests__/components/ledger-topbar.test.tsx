/**
 * LedgerTopBar — Component render tests
 *
 * Validates the ledger app header renders correct landmarks,
 * aria-labels, skip-nav link, and anonymous/authenticated states.
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

  it("does not render the standalone theme toggle when authenticated", () => {
    render(<LedgerTopBar />);
    // The theme toggle should not be separately visible; it lives in the dropdown
    const toggles = screen.queryAllByRole("button", { name: "Toggle theme" });
    expect(toggles.length).toBe(0);
  });
});
