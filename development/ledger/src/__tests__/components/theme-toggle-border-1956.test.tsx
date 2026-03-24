/**
 * Issue #1956 — Theme toggle button border removed
 *
 * Loki QA tests validating acceptance criteria:
 *   AC1: `border border-border` removed from the icon variant toggle button
 *   AC2: Toggle looks identical on all tiers (no per-tier conditional styling)
 *   AC3: No per-tier conditional styling on the toggle component
 *
 * @ref #1956
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
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

// ── AC1: border border-border absent from icon variant button ─────────────────

describe("Issue #1956 AC1 — no border on icon variant button", () => {
  it("icon variant button does not have class 'border'", () => {
    render(<ThemeToggle variant="icon" />);
    const btn = screen.getByRole("button");
    expect(btn).not.toHaveClass("border");
  });

  it("icon variant button does not have class 'border-border'", () => {
    render(<ThemeToggle variant="icon" />);
    const btn = screen.getByRole("button");
    expect(btn).not.toHaveClass("border-border");
  });

  it("inline variant button does not have class 'border'", () => {
    render(<ThemeToggle variant="inline" />);
    const btn = screen.getByRole("button");
    expect(btn).not.toHaveClass("border");
  });
});

// ── AC2: toggle identical across tiers ───────────────────────────────────────

describe("Issue #1956 AC2 — toggle identical on all tiers", () => {
  it("anonymous (Thrall): header theme toggle has no border class", async () => {
    mockAuthStatus = "anonymous";
    render(<LedgerTopBar />);
    await act(async () => {});

    const header = screen.getByRole("banner");
    const toggleBtn = header.querySelector("button[aria-label^='Theme:']");
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).not.toHaveClass("border");
    expect(toggleBtn).not.toHaveClass("border-border");
  });

  it("authenticated (Karl): header theme toggle has no border class", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Karl", email: "karl@asgard.com" } };
    render(<LedgerTopBar />);
    await act(async () => {});

    const header = screen.getByRole("banner");
    const toggleBtn = header.querySelector("button[aria-label^='Theme:']");
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).not.toHaveClass("border");
    expect(toggleBtn).not.toHaveClass("border-border");
  });
});

// ── AC3: no tier-conditional props passed to ThemeToggle ─────────────────────

describe("Issue #1956 AC3 — ThemeToggle renders consistently regardless of auth state", () => {
  it("ThemeToggle className is identical in anonymous vs authenticated sessions", async () => {
    // Anonymous
    mockAuthStatus = "anonymous";
    const { container: anonContainer } = render(<LedgerTopBar />);
    await act(async () => {});
    const anonBtn = anonContainer.querySelector("button[aria-label^='Theme:']");
    const anonClass = anonBtn?.className ?? "";

    // Authenticated
    mockAuthStatus = "authenticated";
    mockSession = { user: { name: "Freya", email: "freya@asgard.com" } };
    const { container: authContainer } = render(<LedgerTopBar />);
    await act(async () => {});
    const authBtn = authContainer.querySelector("button[aria-label^='Theme:']");
    const authClass = authBtn?.className ?? "";

    expect(anonClass).toBe(authClass);
  });
});
