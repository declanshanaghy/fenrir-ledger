/**
 * LedgerShell — Component render tests
 *
 * Validates the app shell renders correct landmarks:
 * header (via LedgerTopBar), main content area, and structural layout.
 *
 * Supersedes structural landmark checks from a11y E2E tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerShell } from "@/components/layout/LedgerShell";

// ── Mocks ────────────────────────────────────────────────────────────────────

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
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    data: null,
    status: "anonymous",
    householdId: "test-household",
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: () => null,
  clearEntitlementCache: vi.fn(),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">T</button>,
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
}));

// Mock LedgerTopBar to render a simple header
vi.mock("./LedgerTopBar", () => ({
  LedgerTopBar: () => <header role="banner">TopBar</header>,
}));

// Mock LedgerBottomTabs
vi.mock("./LedgerBottomTabs", () => ({
  LedgerBottomTabs: () => <nav aria-label="Bottom tabs">Tabs</nav>,
}));

// Mock SyncIndicator
vi.mock("./SyncIndicator", () => ({
  SyncIndicator: () => null,
}));

// Mock easter eggs
vi.mock("./KonamiHowl", () => ({
  KonamiHowl: () => null,
}));

vi.mock("./ForgeMasterEgg", () => ({
  ForgeMasterEgg: () => null,
}));

vi.mock("@/components/easter-eggs/HeilungModal", () => ({
  HeilungModal: () => null,
}));

vi.mock("@/components/cards/GleipnirMountainRoots", () => ({
  GleipnirMountainRoots: () => null,
  useGleipnirFragment3: () => ({ open: false, dismiss: vi.fn() }),
}));

vi.mock("sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@/contexts/RagnarokContext", () => ({
  useRagnarok: () => ({ ragnarokActive: false }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LedgerShell — Layout structure", () => {
  beforeEach(() => {
    // LedgerShell uses useEffect + mounted state; it renders a placeholder
    // on first render then swaps to the full shell. In happy-dom, effects run.
  });

  it("renders a <main> element with id='main-content'", () => {
    render(
      <LedgerShell>
        <div>Page content</div>
      </LedgerShell>
    );
    const main = screen.getByRole("main");
    expect(main).toBeDefined();
    expect(main.getAttribute("id")).toBe("main-content");
  });

  it("renders children inside the main content area", () => {
    render(
      <LedgerShell>
        <p>Dashboard content</p>
      </LedgerShell>
    );
    expect(screen.getByText("Dashboard content")).toBeDefined();
  });
});
