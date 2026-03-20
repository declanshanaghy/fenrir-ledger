/**
 * Issue #1609 — Hover white flash elimination
 *
 * Validates the three fixes applied to prevent white flash on hover:
 *
 * 1. ThemeToggle icon variant: no native browser `title` attribute
 *    (title attr triggers OS-level tooltip popups that flash on hover)
 *
 * 2. LedgerTopBar ProfileDropdown: all menu items use
 *    `transition-[color,border-color]` instead of `transition-colors`,
 *    so background-color is NOT animated and cannot interpolate through
 *    transparent (which appeared white on bg-background surfaces).
 *
 * monitor-ui JobCard fix is not tested here — no Vitest infrastructure for monitor-ui.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LedgerTopBar } from "@/components/layout/LedgerTopBar";

// ── Shared mocks ─────────────────────────────────────────────────────────────

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

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => "/ledger",
}));

const mockSetTheme = vi.fn();
const mockThemeState = {
  theme: "dark" as string | undefined,
  resolvedTheme: "dark" as string | undefined,
};

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockThemeState.theme,
    resolvedTheme: mockThemeState.resolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

vi.mock("@/components/layout/TrialBadge", () => ({
  TrialBadge: () => null,
}));

vi.mock("@/components/marketing/MarketingNavLinks", () => ({
  MarketingNavLinks: () => null,
  NAV_LINKS: [],
  isNavLinkActive: () => false,
}));

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => false,
}));

vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: () => null,
  clearEntitlementCache: vi.fn(),
}));

let mockAuthStatus = "authenticated";
let mockSession: { user: { name: string; email: string; picture?: string } } | null = {
  user: { name: "Loki Trickster", email: "loki@asgard.com" },
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    data: mockSession,
    status: mockAuthStatus,
    householdId: "test-household",
    signOut: vi.fn(),
  }),
}));

beforeEach(() => {
  mockSetTheme.mockClear();
  mockPush.mockClear();
  mockThemeState.theme = "dark";
  mockThemeState.resolvedTheme = "dark";
  mockAuthStatus = "authenticated";
  mockSession = { user: { name: "Loki Trickster", email: "loki@asgard.com" } };
  window.location.hash = "";
});

// ── Fix 1: ThemeToggle icon variant has no title attribute ────────────────────
//
// A native browser `title` attribute causes the OS to show a light-themed
// tooltip for ~100ms when hovering — the exact white flash reported in #1609.
// The icon variant already has `aria-label`, so `title` was redundant.

describe("Issue #1609 Fix 1 — ThemeToggle icon variant: no title attribute", () => {
  it("icon variant button has no title attribute after mount", async () => {
    const { container } = render(<ThemeToggle variant="icon" />);
    // Wait for mounted effect to run
    await act(async () => {});
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button!.hasAttribute("title")).toBe(false);
    expect(button!.getAttribute("title")).toBeNull();
  });

  it("icon variant button has aria-label (accessibility is not regressed)", async () => {
    render(<ThemeToggle variant="icon" />);
    await act(async () => {});
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toMatch(/Theme:/i);
  });

  it("inline variant buttons have no title attribute", async () => {
    const { container } = render(<ThemeToggle variant="inline" />);
    await act(async () => {});
    const buttons = container.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn.hasAttribute("title")).toBe(false);
    });
  });
});

// ── Fix 2: ProfileDropdown menu items use transition-[color,border-color] ────
//
// `transition-colors` animates ALL color properties including background-color.
// On menu items with `hover:bg-secondary/50`, moving between items caused
// background-color to interpolate through transparent → looked white flash.
// Fix: `transition-[color,border-color]` — background changes are instant.

describe("Issue #1609 Fix 2 — ProfileDropdown: no transition-colors on menu items", () => {
  function openDropdown() {
    const btn = screen.getByRole("button", { name: /Open user menu/i });
    fireEvent.click(btn);
  }

  it("My Cards menu item uses transition-[color,border-color] not transition-colors", () => {
    render(<LedgerTopBar />);
    openDropdown();
    const myCards = screen.getByRole("menuitem", { name: /^My Cards$/i });
    expect(myCards.className).toContain("transition-[color,border-color]");
    expect(myCards.className).not.toMatch(/\btransition-colors\b/);
  });

  it("Account menu item uses transition-[color,border-color] not transition-colors", () => {
    render(<LedgerTopBar />);
    openDropdown();
    const account = screen.getByRole("menuitem", { name: /^Account$/i });
    expect(account.className).toContain("transition-[color,border-color]");
    expect(account.className).not.toMatch(/\btransition-colors\b/);
  });

  it("Household menu item uses transition-[color,border-color] not transition-colors", () => {
    render(<LedgerTopBar />);
    openDropdown();
    const household = screen.getByRole("menuitem", { name: /^Household$/i });
    expect(household.className).toContain("transition-[color,border-color]");
    expect(household.className).not.toMatch(/\btransition-colors\b/);
  });

  it("Settings menu item uses transition-[color,border-color] not transition-colors", () => {
    render(<LedgerTopBar />);
    openDropdown();
    const settings = screen.getByRole("menuitem", { name: /^Settings$/i });
    expect(settings.className).toContain("transition-[color,border-color]");
    expect(settings.className).not.toMatch(/\btransition-colors\b/);
  });

  it("Sign out menu item uses transition-[color,border-color] not transition-colors", () => {
    render(<LedgerTopBar />);
    openDropdown();
    const signOut = screen.getByRole("menuitem", { name: /^Sign out$/i });
    expect(signOut.className).toContain("transition-[color,border-color]");
    expect(signOut.className).not.toMatch(/\btransition-colors\b/);
  });

  it("Theme menu row uses transition-[color,border-color] not transition-colors", () => {
    render(<LedgerTopBar />);
    openDropdown();
    // The Theme row button has text content "Theme" — find by that text
    const allMenuItems = screen.getAllByRole("menuitem");
    const themeItem = allMenuItems.find((el) => el.textContent?.includes("Theme"));
    expect(themeItem).toBeDefined();
    if (themeItem) {
      expect(themeItem.className).toContain("transition-[color,border-color]");
      expect(themeItem.className).not.toMatch(/\btransition-colors\b/);
    }
  });

  it("dropdown menu renders all 6 menu items", () => {
    render(<LedgerTopBar />);
    openDropdown();
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.length).toBe(6);
  });
});
