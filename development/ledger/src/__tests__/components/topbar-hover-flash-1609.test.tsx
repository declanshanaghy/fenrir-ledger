/**
 * Issue #1609 — Hover white flash: TopBar.tsx (marketing nav) fix
 *
 * The previous fix (PR #1611) only patched LedgerTopBar.tsx.
 * TopBar.tsx (marketing pages nav) had identical `transition-colors` +
 * `hover:bg-secondary/50` on 4 elements — avatar trigger + 3 dropdown items.
 *
 * `transition-colors` animates ALL color properties including background-color.
 * Moving between dropdown items caused background-color to interpolate through
 * transparent → appeared as white flash on bg-background surfaces.
 *
 * Fix: `transition-[color,border-color]` — background changes are instant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopBar } from "@/components/layout/TopBar";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
  usePathname: () => "/",
}));

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
    setTheme: mockSetTheme,
  }),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">T</button>,
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
}));

vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: () => null,
  clearEntitlementCache: vi.fn(),
}));

vi.mock("@/lib/auth/sign-in-url", () => ({
  buildSignInUrl: (path: string) => `/auth/sign-in?return_to=${path}`,
}));

let mockAuthStatus = "authenticated";
let mockSession: { user: { name: string; email: string; picture?: string } } | null = {
  user: { name: "Odin Allfather", email: "odin@asgard.com" },
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
  mockPush.mockClear();
  mockSetTheme.mockClear();
  mockAuthStatus = "authenticated";
  mockSession = { user: { name: "Odin Allfather", email: "odin@asgard.com" } };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function openDropdown() {
  const btn = screen.getByRole("button", { name: /Open user menu/i });
  fireEvent.click(btn);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Issue #1609 Fix — TopBar dropdown: no transition-colors on hover items", () => {
  it("avatar trigger button uses transition-[color,border-color] not transition-colors", () => {
    render(<TopBar />);
    const avatarBtn = screen.getByRole("button", { name: /Open user menu/i });
    expect(avatarBtn.className).toContain("transition-[color,border-color]");
    expect(avatarBtn.className).not.toMatch(/\btransition-colors\b/);
  });

  it("Theme row uses transition-[color,border-color] not transition-colors", () => {
    render(<TopBar />);
    openDropdown();
    const allMenuItems = screen.getAllByRole("menuitem");
    const themeItem = allMenuItems.find((el) => el.textContent?.includes("Theme"));
    expect(themeItem).toBeDefined();
    if (themeItem) {
      expect(themeItem.className).toContain("transition-[color,border-color]");
      expect(themeItem.className).not.toMatch(/\btransition-colors\b/);
    }
  });

  it("Settings menu item uses transition-[color,border-color] not transition-colors", () => {
    render(<TopBar />);
    openDropdown();
    const settings = screen.getByRole("menuitem", { name: /^Settings$/i });
    expect(settings.className).toContain("transition-[color,border-color]");
    expect(settings.className).not.toMatch(/\btransition-colors\b/);
  });

  it("Sign out menu item uses transition-[color,border-color] not transition-colors", () => {
    render(<TopBar />);
    openDropdown();
    const signOut = screen.getByRole("menuitem", { name: /^Sign out$/i });
    expect(signOut.className).toContain("transition-[color,border-color]");
    expect(signOut.className).not.toMatch(/\btransition-colors\b/);
  });

  it("dropdown renders the expected menu items (structural integrity)", () => {
    render(<TopBar />);
    openDropdown();
    const menuItems = screen.getAllByRole("menuitem");
    // Theme row + Settings + Sign out = 3 items
    expect(menuItems.length).toBeGreaterThanOrEqual(3);
  });
});
