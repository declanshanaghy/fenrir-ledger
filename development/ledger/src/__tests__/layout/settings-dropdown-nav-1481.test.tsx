/**
 * Issue #1481 — Settings dropdown: active state + tab navigation
 *
 * Tests:
 *   - Only the active settings tab item is gold (not all three)
 *   - No hash → Account item is gold (DEFAULT_TAB fallback)
 *   - #household hash → Household item is gold
 *   - #settings hash → Settings item is gold
 *   - My Cards gold state is unaffected by fix
 *   - hashchange event on settings page switches active tab
 *   - Clicking Account/Household/Settings pushes the correct route
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LedgerTopBar } from "@/components/layout/LedgerTopBar";
import SettingsPage from "@/app/ledger/settings/page";

// ── Module mocks ──────────────────────────────────────────────────────────────

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

const mockPush = vi.hoisted(() => vi.fn());
let mockPathname = "/ledger/settings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => mockPathname,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => (
    <button type="button" aria-label="Toggle theme">
      T
    </button>
  ),
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
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

// Analytics mock for SettingsPage
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

// Mocks for SettingsPage sub-components
vi.mock("@/components/entitlement/StripeSettings", () => ({
  StripeSettings: () => <div data-testid="stripe-settings" />,
}));
vi.mock("@/components/trial/TrialSettingsSection", () => ({
  TrialSettingsSection: () => <div data-testid="trial-section" />,
}));
vi.mock("@/components/household/HouseholdSettingsSection", () => ({
  HouseholdSettingsSection: () => <div data-testid="household-section" />,
}));
vi.mock("@/components/sync/SyncSettingsSection", () => ({
  SyncSettingsSection: () => <div data-testid="sync-section" />,
}));
vi.mock("@/components/easter-eggs/EasterEggModal", () => ({
  EasterEggModal: () => null,
}));

// Mutable auth state
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Open the ProfileDropdown by clicking the authenticated avatar button. */
function openDropdown() {
  const avatarButton = screen.getByRole("button", {
    name: /Open user menu/i,
  });
  fireEvent.click(avatarButton);
}

/** Returns the gold dot indicator span inside a menu item button, or null. */
function getDotIndicator(button: HTMLElement): Element | null {
  return button.querySelector(".bg-gold");
}

// ── ProfileDropdown active-state tests ────────────────────────────────────────

describe("Issue #1481 — ProfileDropdown active-state per settings tab", () => {
  beforeEach(() => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Odin Allfather", email: "odin@asgard.com" } };
    mockPathname = "/ledger/settings";
    mockPush.mockClear();
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("Account is gold when hash is #account", () => {
    window.location.hash = "#account";
    render(<LedgerTopBar />);
    openDropdown();

    const accountBtn = screen.getByRole("menuitem", { name: /^Account$/i });
    const householdBtn = screen.getByRole("menuitem", { name: /^Household$/i });
    const settingsBtn = screen.getByRole("menuitem", { name: /^Settings$/i });

    expect(accountBtn.className).toContain("text-gold");
    expect(householdBtn.className).not.toContain("text-gold");
    expect(settingsBtn.className).not.toContain("text-gold");
  });

  it("Account is gold when hash is empty (DEFAULT_TAB fallback)", () => {
    window.location.hash = "";
    render(<LedgerTopBar />);
    openDropdown();

    const accountBtn = screen.getByRole("menuitem", { name: /^Account$/i });
    const householdBtn = screen.getByRole("menuitem", { name: /^Household$/i });

    expect(accountBtn.className).toContain("text-gold");
    expect(householdBtn.className).not.toContain("text-gold");
  });

  it("Household is gold when hash is #household", () => {
    window.location.hash = "#household";
    render(<LedgerTopBar />);
    openDropdown();

    const accountBtn = screen.getByRole("menuitem", { name: /^Account$/i });
    const householdBtn = screen.getByRole("menuitem", { name: /^Household$/i });
    const settingsBtn = screen.getByRole("menuitem", { name: /^Settings$/i });

    expect(householdBtn.className).toContain("text-gold");
    expect(accountBtn.className).not.toContain("text-gold");
    expect(settingsBtn.className).not.toContain("text-gold");
  });

  it("Settings is gold when hash is #settings", () => {
    window.location.hash = "#settings";
    render(<LedgerTopBar />);
    openDropdown();

    const accountBtn = screen.getByRole("menuitem", { name: /^Account$/i });
    const householdBtn = screen.getByRole("menuitem", { name: /^Household$/i });
    const settingsBtn = screen.getByRole("menuitem", { name: /^Settings$/i });

    expect(settingsBtn.className).toContain("text-gold");
    expect(accountBtn.className).not.toContain("text-gold");
    expect(householdBtn.className).not.toContain("text-gold");
  });

  it("only one settings item has a gold dot indicator at a time", () => {
    window.location.hash = "#household";
    render(<LedgerTopBar />);
    openDropdown();

    const accountBtn = screen.getByRole("menuitem", { name: /^Account$/i });
    const householdBtn = screen.getByRole("menuitem", { name: /^Household$/i });
    const settingsBtn = screen.getByRole("menuitem", { name: /^Settings$/i });

    expect(getDotIndicator(accountBtn as HTMLElement)).toBeNull();
    expect(getDotIndicator(householdBtn as HTMLElement)).not.toBeNull();
    expect(getDotIndicator(settingsBtn as HTMLElement)).toBeNull();
  });

  it("My Cards is gold when on /ledger, settings items are not", () => {
    mockPathname = "/ledger";
    window.location.hash = "";
    render(<LedgerTopBar />);
    openDropdown();

    const myCardsBtn = screen.getByRole("menuitem", { name: /^My Cards$/i });
    const accountBtn = screen.getByRole("menuitem", { name: /^Account$/i });

    expect(myCardsBtn.className).toContain("text-gold");
    expect(accountBtn.className).not.toContain("text-gold");
  });

  it("no settings item is gold when on /ledger (My Cards page)", () => {
    mockPathname = "/ledger";
    window.location.hash = "";
    render(<LedgerTopBar />);
    openDropdown();

    const householdBtn = screen.getByRole("menuitem", { name: /^Household$/i });
    const settingsBtn = screen.getByRole("menuitem", { name: /^Settings$/i });

    expect(householdBtn.className).not.toContain("text-gold");
    expect(settingsBtn.className).not.toContain("text-gold");
  });
});

// ── ProfileDropdown navigation tests ─────────────────────────────────────────

describe("Issue #1481 — ProfileDropdown nav pushes correct routes", () => {
  beforeEach(() => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Odin Allfather", email: "odin@asgard.com" } };
    mockPathname = "/ledger";
    mockPush.mockClear();
    window.location.hash = "";
  });

  it("clicking Account pushes /ledger/settings#account", () => {
    render(<LedgerTopBar />);
    openDropdown();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Account$/i }));
    expect(mockPush).toHaveBeenCalledWith("/ledger/settings#account");
  });

  it("clicking Household pushes /ledger/settings#household", () => {
    render(<LedgerTopBar />);
    openDropdown();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Household$/i }));
    expect(mockPush).toHaveBeenCalledWith("/ledger/settings#household");
  });

  it("clicking Settings (menu item) pushes /ledger/settings#settings", () => {
    render(<LedgerTopBar />);
    openDropdown();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Settings$/i }));
    expect(mockPush).toHaveBeenCalledWith("/ledger/settings#settings");
  });

  it("clicking My Cards pushes /ledger", () => {
    render(<LedgerTopBar />);
    openDropdown();
    fireEvent.click(screen.getByRole("menuitem", { name: /^My Cards$/i }));
    expect(mockPush).toHaveBeenCalledWith("/ledger");
  });
});

// ── Issue #1617 — Same-page navigation: direct hash update when already on settings ──

describe("Issue #1617 — ProfileDropdown same-page tab navigation", () => {
  beforeEach(() => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Odin Allfather", email: "odin@asgard.com" } };
    mockPathname = "/ledger/settings";
    mockPush.mockClear();
    window.location.hash = "";
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("clicking Account on settings page sets window.location.hash to #account (not router.push)", () => {
    render(<LedgerTopBar />);
    openDropdown();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Account$/i }));
    expect(window.location.hash).toBe("#account");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("clicking Household on settings page sets window.location.hash to #household (not router.push)", () => {
    render(<LedgerTopBar />);
    openDropdown();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Household$/i }));
    expect(window.location.hash).toBe("#household");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("clicking Settings on settings page sets window.location.hash to #settings (not router.push)", () => {
    render(<LedgerTopBar />);
    openDropdown();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Settings$/i }));
    expect(window.location.hash).toBe("#settings");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("clicking Account from other pages still uses router.push", () => {
    mockPathname = "/ledger";
    render(<LedgerTopBar />);
    openDropdown();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Account$/i }));
    expect(mockPush).toHaveBeenCalledWith("/ledger/settings#account");
  });
});

// ── SettingsPage hashchange listener ─────────────────────────────────────────

describe("Issue #1481 — SettingsPage responds to hashchange events", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.location.hash = "";
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("fires Account tab as default without hash", () => {
    render(<SettingsPage />);
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("true");
  });

  it("switches to Household tab on hashchange event to #household", () => {
    render(<SettingsPage />);

    // Simulate hash change (as if router.push caused it)
    window.location.hash = "#household";
    fireEvent(window, new HashChangeEvent("hashchange"));

    const householdTab = screen.getByRole("tab", { name: /^Household$/i });
    expect(householdTab.getAttribute("aria-selected")).toBe("true");
  });

  it("switches to Settings tab on hashchange event to #settings", () => {
    render(<SettingsPage />);

    window.location.hash = "#settings";
    fireEvent(window, new HashChangeEvent("hashchange"));

    const settingsTab = screen.getByRole("tab", { name: /^Settings$/i });
    expect(settingsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("switches back to Account tab on hashchange event to #account", () => {
    render(<SettingsPage />);

    // First switch to household
    window.location.hash = "#household";
    fireEvent(window, new HashChangeEvent("hashchange"));

    // Then switch back to account
    window.location.hash = "#account";
    fireEvent(window, new HashChangeEvent("hashchange"));

    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("true");
  });

  it("ignores hashchange to unrecognised hash", () => {
    render(<SettingsPage />);

    window.location.hash = "#unknown";
    fireEvent(window, new HashChangeEvent("hashchange"));

    // Should remain on Account (default)
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("true");
  });
});
