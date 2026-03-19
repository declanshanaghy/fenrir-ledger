/**
 * Issue #1409 — Anonymous users missing 'My Cards' in dropdown
 *
 * Verifies that the My Cards link is present in the UpsellPromptPanel
 * (anonymous dropdown) for LedgerTopBar, highlights gold on /ledger,
 * meets 44×44px touch target, and that signed-in dropdown is unchanged.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LedgerTopBar } from "@/components/layout/LedgerTopBar";

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
let mockPathname = "/ledger";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => mockPathname,
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

vi.mock("@/components/layout/TrialBadge", () => ({
  TrialBadge: () => null,
}));

vi.mock("@/components/marketing/MarketingNavLinks", () => ({
  NAV_LINKS: [],
  isNavLinkActive: () => false,
  MarketingNavLinks: () => null,
}));

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function openAnonPanel() {
  const avatarButton = screen.getByRole("button", { name: "Sign in to sync your data" });
  fireEvent.click(avatarButton);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LedgerTopBar — My Cards in anonymous dropdown (issue #1409)", () => {
  beforeEach(() => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    mockPathname = "/ledger";
    mockPush.mockReset();
  });

  it("My Cards button is present in the anonymous upsell panel after opening", () => {
    render(<LedgerTopBar />);
    openAnonPanel();

    const myCardsButton = screen.getByRole("button", { name: "My Cards" });
    expect(myCardsButton).toBeDefined();
  });

  it("My Cards button navigates to /ledger when clicked", () => {
    render(<LedgerTopBar />);
    openAnonPanel();

    const myCardsButton = screen.getByRole("button", { name: "My Cards" });
    fireEvent.click(myCardsButton);

    expect(mockPush).toHaveBeenCalledWith("/ledger");
  });

  it("My Cards button has gold class when pathname is /ledger (active route)", () => {
    mockPathname = "/ledger";
    render(<LedgerTopBar />);
    openAnonPanel();

    const myCardsButton = screen.getByRole("button", { name: "My Cards" });
    expect(myCardsButton.className).toContain("text-gold");
  });

  it("My Cards button does not have gold class when on a different route", () => {
    mockPathname = "/ledger/settings";
    render(<LedgerTopBar />);
    openAnonPanel();

    const myCardsButton = screen.getByRole("button", { name: "My Cards" });
    expect(myCardsButton.className).not.toContain("text-gold");
  });

  it("My Cards button meets 44px minimum touch target height", () => {
    render(<LedgerTopBar />);
    openAnonPanel();

    const myCardsButton = screen.getByRole("button", { name: "My Cards" });
    expect(myCardsButton.style.minHeight).toBe("44px");
  });

  it("Settings button is still present alongside My Cards in anonymous panel", () => {
    render(<LedgerTopBar />);
    openAnonPanel();

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    expect(settingsButton).toBeDefined();
  });

  it("My Cards button appears before Settings button in panel DOM order", () => {
    render(<LedgerTopBar />);
    openAnonPanel();

    const myCardsButton = screen.getByRole("button", { name: "My Cards" });
    const settingsButton = screen.getByRole("button", { name: /settings/i });

    // My Cards should appear earlier in the document than Settings
    const position = myCardsButton.compareDocumentPosition(settingsButton);
    // DOCUMENT_POSITION_FOLLOWING = 4 means settingsButton follows myCardsButton
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("LedgerTopBar — Signed-in My Cards unchanged (issue #1409)", () => {
  beforeEach(() => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Odin Allfather", email: "odin@asgard.com" } };
    mockPathname = "/ledger";
    mockPush.mockReset();
  });

  it("My Cards menuitem is present in signed-in profile dropdown", () => {
    render(<LedgerTopBar />);

    const avatarButton = screen.getByRole("button", {
      name: "Open user menu, signed in as odin@asgard.com",
    });
    fireEvent.click(avatarButton);

    const myCardsItem = screen.getByRole("menuitem", { name: /my cards/i });
    expect(myCardsItem).toBeDefined();
  });
});
