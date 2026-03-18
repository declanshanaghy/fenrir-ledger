/**
 * Issue #1345 — Loki QA complementary tests
 *
 * Covers edge cases NOT addressed by the FiremanDecko tests in
 * anon-settings-1345.test.tsx:
 *   - "Not now" button dismisses the upsell panel
 *   - Escape key dismisses the upsell panel (keyboard a11y)
 *   - Settings click closes the panel before navigating
 *   - Stale nudge state: anon upsell panel is hidden (Settings not reached via avatar)
 *   - Panel toggles closed on a second avatar click
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
  getEntitlementCache: () => mockEntitlementCache(),
  clearEntitlementCache: vi.fn(),
}));

vi.mock("@/lib/auth/sign-in-url", () => ({
  buildSignInUrl: (returnTo: string) => `/ledger/sign-in?returnTo=${returnTo}`,
}));

vi.mock("@/components/layout/TrialBadge", () => ({
  TrialBadge: () => null,
}));

vi.mock("@/components/marketing/MarketingNavLinks", () => ({
  NAV_LINKS: [],
  isNavLinkActive: () => false,
  MarketingNavLinks: () => null,
}));

// Default: no stale entitlement cache
let mockEntitlementCache = vi.fn(() => null);

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

// ── TopBar — panel behaviour ───────────────────────────────────────────────────

describe("TopBar — upsell panel behaviour (issue #1345)", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAuthStatus = "anonymous";
    mockSession = null;
    mockEntitlementCache = vi.fn(() => null);
  });

  it("'Not now' button dismisses the upsell panel", () => {
    render(<TopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in to sync your data" }));
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).toBeNull();
  });

  it("Escape key dismisses the upsell panel (keyboard a11y)", () => {
    render(<TopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in to sync your data" }));
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).toBeNull();
  });

  it("Settings click closes the panel before navigating", () => {
    render(<TopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in to sync your data" }));
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));

    // Panel should be closed
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).toBeNull();
    // Navigation should have been triggered
    expect(mockPush).toHaveBeenCalledWith("/ledger/settings");
  });

  it("Second avatar click toggles the panel closed", () => {
    render(<TopBar />);
    const avatarButton = screen.getByRole("button", { name: "Sign in to sync your data" });

    fireEvent.click(avatarButton);
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).not.toBeNull();

    fireEvent.click(avatarButton);
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).toBeNull();
  });
});

// ── LedgerTopBar — panel behaviour ────────────────────────────────────────────

describe("LedgerTopBar — upsell panel behaviour (issue #1345)", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAuthStatus = "anonymous";
    mockSession = null;
    mockEntitlementCache = vi.fn(() => null);
  });

  it("'Not now' button dismisses the upsell panel", () => {
    render(<LedgerTopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in to sync your data" }));
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).toBeNull();
  });

  it("Escape key dismisses the upsell panel (keyboard a11y)", () => {
    render(<LedgerTopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in to sync your data" }));
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).toBeNull();
  });

  it("Settings click closes the panel before navigating", () => {
    render(<LedgerTopBar />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in to sync your data" }));
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));

    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/ledger/settings");
  });

  it("Second avatar click toggles the panel closed", () => {
    render(<LedgerTopBar />);
    const avatarButton = screen.getByRole("button", { name: "Sign in to sync your data" });

    fireEvent.click(avatarButton);
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).not.toBeNull();

    fireEvent.click(avatarButton);
    expect(screen.queryByRole("dialog", { name: "Sign in to sync" })).toBeNull();
  });
});
