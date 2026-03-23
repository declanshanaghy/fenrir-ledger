/**
 * User menu item order — Issue #1483
 *
 * Validates that ProfileDropdown in LedgerTopBar renders menu items in the
 * correct order:
 *   1. My Cards
 *   2. Account
 *   3. Household
 *   4. Settings
 *   5. Sign out
 *
 * Note: Theme was moved to the header bar (Issue #1906) and is no longer in
 * the dropdown.
 *
 * @ref #1483
 * @ref #1906
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/ledger",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => false,
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: ({ variant }: { variant: string }) => (
    <span data-testid={`theme-toggle-${variant}`} />
  ),
  cycleTheme: vi.fn((t: string) => (t === "dark" ? "light" : "dark")),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    data: {
      user: {
        email: "test@example.com",
        name: "Test User",
        picture: undefined,
      },
    },
    status: "authenticated",
    signOut: vi.fn(),
  }),
}));

vi.mock("@/components/layout/TrialBadge", () => ({
  TrialBadge: () => null,
}));

vi.mock("@/components/marketing/MarketingNavLinks", () => ({
  MarketingNavLinks: () => null,
  NAV_LINKS: [],
  isNavLinkActive: vi.fn(() => false),
}));

vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: vi.fn(() => null),
  clearEntitlementCache: vi.fn(),
}));

// ── Helper ────────────────────────────────────────────────────────────────────

async function openDropdown() {
  const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
  render(<LedgerTopBar />);
  const avatarBtn = screen.getByRole("button", { name: /open user menu/i });
  fireEvent.click(avatarBtn);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ProfileDropdown — menu item order (Issue #1483)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders all five menu items in the correct DOM order", async () => {
    await openDropdown();

    const items = screen.getAllByRole("menuitem");
    const labels = items.map((el) => el.textContent?.trim() ?? "");

    expect(labels[0]).toContain("My Cards");
    expect(labels[1]).toContain("Account");
    expect(labels[2]).toContain("Household");
    expect(labels[3]).toContain("Settings");
    expect(labels[4]).toContain("Sign out");
  });

  it("Sign out is the last menu item (index 4)", async () => {
    await openDropdown();

    const items = screen.getAllByRole("menuitem");
    expect(items.length).toBe(5);
    expect(items[4].textContent).toContain("Sign out");
  });

  it("My Cards is the first menu item (index 0)", async () => {
    await openDropdown();

    const items = screen.getAllByRole("menuitem");
    expect(items[0].textContent).toContain("My Cards");
  });

  it("Account appears before Household in DOM order", async () => {
    await openDropdown();

    const items = screen.getAllByRole("menuitem");
    const accountIdx = items.findIndex((el) => el.textContent?.includes("Account"));
    const householdIdx = items.findIndex((el) => el.textContent?.includes("Household"));
    expect(accountIdx).toBeLessThan(householdIdx);
  });

  it("Settings appears before Sign out in DOM order", async () => {
    await openDropdown();

    const items = screen.getAllByRole("menuitem");
    const settingsIdx = items.findIndex((el) => el.textContent?.includes("Settings"));
    const signOutIdx = items.findIndex((el) => el.textContent?.includes("Sign out"));
    expect(settingsIdx).toBeLessThan(signOutIdx);
  });

  it("Theme entry is not present in the dropdown (moved to header bar — Issue #1906)", async () => {
    await openDropdown();

    const items = screen.getAllByRole("menuitem");
    const themeIdx = items.findIndex((el) => el.textContent?.includes("Theme"));
    expect(themeIdx).toBe(-1);
  });
});
