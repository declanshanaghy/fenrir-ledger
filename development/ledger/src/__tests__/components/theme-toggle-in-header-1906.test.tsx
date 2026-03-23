/**
 * Issue #1906 — Theme toggle moved from dropdown to header bar
 *
 * Loki QA tests validating acceptance criteria:
 *   AC1: "Theme" entry removed from user dropdown menu
 *   AC2: Sun/moon ThemeToggle added to ledger header bar
 *   AC3: Toggle works correctly (switches between light and dark)
 *   AC4: Toggle visible in both authenticated and anonymous states
 *   AC5: ThemeToggle appears before the user avatar in DOM order
 *
 * @ref #1906
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/ledger",
}));

const mockSetTheme = vi.hoisted(() => vi.fn());
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

vi.mock("@/components/layout/KarlBadge", () => ({
  KarlBadge: () => null,
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

beforeEach(() => {
  mockSetTheme.mockClear();
  mockThemeState.theme = "dark";
  mockThemeState.resolvedTheme = "dark";
  mockAuthStatus = "anonymous";
  mockSession = null;
});

// ── AC1: Theme entry removed from dropdown ────────────────────────────────────

describe("Issue #1906 AC1 — Theme entry removed from dropdown", () => {
  it("no menu item with text 'Theme' exists in the dropdown when signed in", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Loki", email: "loki@asgard.com" } };
    render(<LedgerTopBar />);
    await act(async () => {});

    const avatarBtn = screen.getByRole("button", { name: /open user menu/i });
    fireEvent.click(avatarBtn);

    const menuItems = screen.getAllByRole("menuitem");
    const themeItem = menuItems.find((el) => el.textContent?.trim() === "Theme");
    expect(themeItem).toBeUndefined();
  });

  it("dropdown has exactly 5 items (My Cards, Account, Household, Settings, Sign out)", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Loki", email: "loki@asgard.com" } };
    render(<LedgerTopBar />);
    await act(async () => {});

    const avatarBtn = screen.getByRole("button", { name: /open user menu/i });
    fireEvent.click(avatarBtn);

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.length).toBe(5);
  });
});

// ── AC2: ThemeToggle present in header bar ────────────────────────────────────

describe("Issue #1906 AC2 — ThemeToggle in header bar", () => {
  it("renders the theme toggle button in the header when anonymous", async () => {
    render(<LedgerTopBar />);
    await act(async () => {});

    const header = screen.getByRole("banner");
    // The toggle button has an aria-label starting with "Theme:"
    const toggleBtn = header.querySelector("button[aria-label^='Theme:']");
    expect(toggleBtn).not.toBeNull();
  });

  it("renders the theme toggle button in the header when authenticated", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Odin", email: "odin@asgard.com" } };
    render(<LedgerTopBar />);
    await act(async () => {});

    const header = screen.getByRole("banner");
    const toggleBtn = header.querySelector("button[aria-label^='Theme:']");
    expect(toggleBtn).not.toBeNull();
  });

  it("theme toggle uses the icon variant (single button, not a radiogroup)", async () => {
    render(<LedgerTopBar />);
    await act(async () => {});

    // icon variant renders a single button, inline renders a radiogroup
    const radiogroup = screen.queryByRole("radiogroup");
    expect(radiogroup).toBeNull();

    // There should be a button with Theme: in the label
    const themeBtn = screen.getByRole("button", { name: /^Theme:/i });
    expect(themeBtn).toBeDefined();
  });
});

// ── AC3: Toggle works correctly ───────────────────────────────────────────────

describe("Issue #1906 AC3 — Toggle switches theme", () => {
  it("clicking the theme toggle when dark calls setTheme('light')", async () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    render(<LedgerTopBar />);
    await act(async () => {});

    const themeBtn = screen.getByRole("button", { name: /^Theme:/i });
    fireEvent.click(themeBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("clicking the theme toggle when light calls setTheme('dark')", async () => {
    mockThemeState.theme = "light";
    mockThemeState.resolvedTheme = "light";

    render(<LedgerTopBar />);
    await act(async () => {});

    const themeBtn = screen.getByRole("button", { name: /^Theme:/i });
    fireEvent.click(themeBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("aria-label on the toggle reflects current dark theme state", async () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    render(<LedgerTopBar />);
    await act(async () => {});

    const themeBtn = screen.getByRole("button", { name: /^Theme: Dark/i });
    expect(themeBtn).toBeDefined();
  });

  it("aria-label on the toggle reflects current light theme state", async () => {
    mockThemeState.theme = "light";
    mockThemeState.resolvedTheme = "light";

    render(<LedgerTopBar />);
    await act(async () => {});

    const themeBtn = screen.getByRole("button", { name: /^Theme: Light/i });
    expect(themeBtn).toBeDefined();
  });
});

// ── AC4: Toggle accessible in both auth states ────────────────────────────────

describe("Issue #1906 AC4 — Toggle visible in both auth states", () => {
  it("anonymous: theme toggle is in the header and has min touch-target size", async () => {
    render(<LedgerTopBar />);
    await act(async () => {});

    const themeBtn = screen.getByRole("button", { name: /^Theme:/i });
    expect(themeBtn.style.minWidth).toBe("44px");
    expect(themeBtn.style.minHeight).toBe("44px");
  });

  it("authenticated: theme toggle is in the header and has min touch-target size", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Thor", email: "thor@asgard.com" } };
    render(<LedgerTopBar />);
    await act(async () => {});

    const themeBtn = screen.getByRole("button", { name: /^Theme:/i });
    expect(themeBtn.style.minWidth).toBe("44px");
    expect(themeBtn.style.minHeight).toBe("44px");
  });
});

// ── AC5: ThemeToggle appears before avatar in DOM order ───────────────────────

describe("Issue #1906 AC5 — ThemeToggle before avatar in DOM order", () => {
  it("anonymous: theme toggle appears before the sign-in avatar button in DOM", async () => {
    render(<LedgerTopBar />);
    await act(async () => {});

    const header = screen.getByRole("banner");
    const allButtons = Array.from(header.querySelectorAll("button"));
    const toggleIdx = allButtons.findIndex((btn) =>
      btn.getAttribute("aria-label")?.startsWith("Theme:")
    );
    const avatarIdx = allButtons.findIndex((btn) =>
      btn.getAttribute("aria-label") === "Sign in to sync your data"
    );
    expect(toggleIdx).toBeGreaterThanOrEqual(0);
    expect(avatarIdx).toBeGreaterThanOrEqual(0);
    expect(toggleIdx).toBeLessThan(avatarIdx);
  });

  it("authenticated: theme toggle appears before the user avatar menu button in DOM", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Freya", email: "freya@asgard.com" } };
    render(<LedgerTopBar />);
    await act(async () => {});

    const header = screen.getByRole("banner");
    const allButtons = Array.from(header.querySelectorAll("button"));
    const toggleIdx = allButtons.findIndex((btn) =>
      btn.getAttribute("aria-label")?.startsWith("Theme:")
    );
    const avatarIdx = allButtons.findIndex((btn) =>
      btn.getAttribute("aria-label")?.startsWith("Open user menu")
    );
    expect(toggleIdx).toBeGreaterThanOrEqual(0);
    expect(avatarIdx).toBeGreaterThanOrEqual(0);
    expect(toggleIdx).toBeLessThan(avatarIdx);
  });
});
