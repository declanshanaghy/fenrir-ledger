/**
 * Dropdown menu enhancement — nav entries + Karl bling (Issue #1392)
 *
 * Validates ProfileDropdown in LedgerTopBar:
 *   - Account entry: User icon, navigates to /ledger/settings#account
 *   - Household entry: Users icon, navigates to /ledger/settings#household
 *   - Settings entry: Settings icon, navigates to /ledger/settings#settings
 *   - All entries have min 44px touch targets
 *   - karl-bling-dropdown class applied for Karl and Trial users
 *   - No karl-bling-dropdown class for Thrall users
 *   - Existing entries (My Cards, Sign out) preserved
 *
 * @ref #1392
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mutable mock state ────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();
const mockIsKarlOrTrial = { value: false };

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/ledger",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockIsKarlOrTrial.value,
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: ({ variant }: { variant: string }) => (
    <span data-testid={`theme-toggle-${variant}`} />
  ),
  cycleTheme: vi.fn((t: string) => t === "dark" ? "light" : "dark"),
}));

// ── Helper: render ProfileDropdown in isolation ───────────────────────────────
//
// ProfileDropdown is a module-internal component in LedgerTopBar.tsx.
// We test it by rendering a minimal wrapper that calls the same hooks and
// produces the same DOM structure, extracted via pattern-matching the rendered
// LedgerTopBar in authenticated mode.
//
// To avoid full LedgerTopBar ceremony (AuthContext, entitlements, etc.),
// we use a direct import of a thin wrapper that renders just the dropdown.

// Wrap ProfileDropdown via direct render — extract by testing the full
// component with authenticated session injected through mocked useAuth.

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

// ── Tests ─────────────────────────────────────────────────────────────────────

async function renderTopBarDropdown() {
  const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
  const { container } = render(<LedgerTopBar />);

  // Open the dropdown by clicking the avatar button
  const avatarBtn = screen.getByRole("button", { name: /open user menu/i });
  fireEvent.click(avatarBtn);

  return { container };
}

describe("ProfileDropdown — navigation entries (Issue #1392)", () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
    mockIsKarlOrTrial.value = false;
    vi.resetModules();
  });

  it("renders Account entry navigating to /ledger/settings#account", async () => {
    await renderTopBarDropdown();

    const accountBtn = screen.getByRole("menuitem", { name: /^Account$/i });
    expect(accountBtn).toBeTruthy();
    fireEvent.click(accountBtn);
    expect(mockRouterPush).toHaveBeenCalledWith("/ledger/settings#account");
  });

  it("renders Household entry navigating to /ledger/settings#household", async () => {
    await renderTopBarDropdown();

    const householdBtn = screen.getByRole("menuitem", { name: /^Household$/i });
    expect(householdBtn).toBeTruthy();
    fireEvent.click(householdBtn);
    expect(mockRouterPush).toHaveBeenCalledWith("/ledger/settings#household");
  });

  it("renders Settings entry navigating to /ledger/settings#settings", async () => {
    await renderTopBarDropdown();

    const settingsBtn = screen.getByRole("menuitem", { name: /^Settings$/i });
    expect(settingsBtn).toBeTruthy();
    fireEvent.click(settingsBtn);
    expect(mockRouterPush).toHaveBeenCalledWith("/ledger/settings#settings");
  });

  it("Account, Household, Settings entries all exist in the menu", async () => {
    await renderTopBarDropdown();

    const menu = screen.getByRole("menu", { name: /user menu/i });
    expect(menu).toBeTruthy();

    // All three entries present
    expect(screen.getByRole("menuitem", { name: /^Account$/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /^Household$/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /^Settings$/i })).toBeTruthy();
  });

  it("existing My Cards entry is preserved", async () => {
    await renderTopBarDropdown();
    expect(screen.getByRole("menuitem", { name: /my cards/i })).toBeTruthy();
  });

  it("existing Sign out entry is preserved", async () => {
    await renderTopBarDropdown();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeTruthy();
  });
});

describe("ProfileDropdown — touch targets (Issue #1392)", () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
    mockIsKarlOrTrial.value = false;
    vi.resetModules();
  });

  it("Account entry has minHeight style of 44px", async () => {
    await renderTopBarDropdown();
    const btn = screen.getByRole("menuitem", { name: /^Account$/i });
    // minHeight 44 is set inline
    expect(btn.getAttribute("style")).toContain("44");
  });

  it("Household entry has minHeight style of 44px", async () => {
    await renderTopBarDropdown();
    const btn = screen.getByRole("menuitem", { name: /^Household$/i });
    expect(btn.getAttribute("style")).toContain("44");
  });

  it("Settings entry has minHeight style of 44px", async () => {
    await renderTopBarDropdown();
    const btn = screen.getByRole("menuitem", { name: /^Settings$/i });
    expect(btn.getAttribute("style")).toContain("44");
  });
});

describe("ProfileDropdown — Karl bling CSS class (Issue #1392)", () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
    vi.resetModules();
  });

  it("dropdown has karl-bling-dropdown class when user is Karl/Trial", async () => {
    mockIsKarlOrTrial.value = true;
    await renderTopBarDropdown();

    const menu = screen.getByRole("menu", { name: /user menu/i });
    expect(menu.className).toContain("karl-bling-dropdown");
  });

  it("dropdown does NOT have karl-bling-dropdown class for Thrall users", async () => {
    mockIsKarlOrTrial.value = false;
    await renderTopBarDropdown();

    const menu = screen.getByRole("menu", { name: /user menu/i });
    expect(menu.className).not.toContain("karl-bling-dropdown");
  });
});
