/**
 * Issue #1345 — Settings option in nav dropdown for anonymous users
 *
 * Verifies that the Settings link is visible in the UpsellPromptPanel
 * (anonymous dropdown) for both TopBar and LedgerTopBar, and that
 * authenticated users continue to see Settings in their profile dropdown.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopBar } from "@/components/layout/TopBar";
import { LedgerTopBar } from "@/components/layout/LedgerTopBar";

// ── Shared mocks ──────────────────────────────────────────────────────────────

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
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
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
  buildSignInUrl: (returnTo: string) => `/ledger/sign-in?returnTo=${returnTo}`,
}));

// LedgerTopBar extras
vi.mock("@/components/layout/TrialBadge", () => ({
  TrialBadge: () => null,
}));

vi.mock("@/components/marketing/MarketingNavLinks", () => ({
  NAV_LINKS: [],
  isNavLinkActive: () => false,
  MarketingNavLinks: () => null,
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

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

// ── TopBar tests ──────────────────────────────────────────────────────────────

describe("TopBar — Settings visibility (issue #1345)", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("Settings button is present in the anonymous upsell panel after opening", () => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    render(<TopBar />);

    // Open the anonymous panel
    const avatarButton = screen.getByRole("button", { name: "Sign in to sync your data" });
    fireEvent.click(avatarButton);

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    expect(settingsButton).toBeDefined();
  });

  it("Settings button navigates to /ledger/settings when clicked by anonymous user", () => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    render(<TopBar />);

    const avatarButton = screen.getByRole("button", { name: "Sign in to sync your data" });
    fireEvent.click(avatarButton);

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    fireEvent.click(settingsButton);

    expect(mockPush).toHaveBeenCalledWith("/ledger/settings");
  });

  it("Settings button is present in authenticated profile dropdown", () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Odin", email: "odin@asgard.com" } };
    render(<TopBar />);

    // Open the authenticated dropdown
    const avatarButton = screen.getByRole("button", {
      name: "Open user menu, signed in as odin@asgard.com",
    });
    fireEvent.click(avatarButton);

    const settingsButton = screen.getByRole("menuitem", { name: /settings/i });
    expect(settingsButton).toBeDefined();
  });
});

// ── LedgerTopBar tests ────────────────────────────────────────────────────────

describe("LedgerTopBar — Settings visibility (issue #1345)", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("Settings button is present in the anonymous upsell panel after opening", () => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    render(<LedgerTopBar />);

    // Open the anonymous panel
    const avatarButton = screen.getByRole("button", { name: "Sign in to sync your data" });
    fireEvent.click(avatarButton);

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    expect(settingsButton).toBeDefined();
  });

  it("Settings button navigates to /ledger/settings when clicked by anonymous user", () => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    render(<LedgerTopBar />);

    const avatarButton = screen.getByRole("button", { name: "Sign in to sync your data" });
    fireEvent.click(avatarButton);

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    fireEvent.click(settingsButton);

    expect(mockPush).toHaveBeenCalledWith("/ledger/settings");
  });

  it("Settings menuitem is present in the authenticated profile dropdown", () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Odin", email: "odin@asgard.com" } };
    render(<LedgerTopBar />);

    const avatarButton = screen.getByRole("button", {
      name: "Open user menu, signed in as odin@asgard.com",
    });
    fireEvent.click(avatarButton);

    const settingsItem = screen.getByRole("menuitem", { name: /settings/i });
    expect(settingsItem).toBeDefined();
  });
});
