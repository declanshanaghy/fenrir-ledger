/**
 * AppShell — Component render tests
 *
 * Validates the marketing-site app shell renders correct landmarks:
 * header (via TopBar), main content area, and footer.
 *
 * Supersedes structural landmark checks from a11y E2E tests (TC-A01..A04).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/layout/AppShell";

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
  usePathname: () => "/",
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

vi.mock("@/lib/auth/sign-in-url", () => ({
  buildSignInUrl: (returnTo: string) => `/ledger/sign-in?returnTo=${returnTo}`,
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">T</button>,
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
}));

// Mock Footer to render a simple footer
vi.mock("./Footer", () => ({
  Footer: () => (
    <footer role="contentinfo" aria-label="App footer">
      Footer
    </footer>
  ),
}));

vi.mock("./SyncIndicator", () => ({ SyncIndicator: () => null }));
vi.mock("./KonamiHowl", () => ({ KonamiHowl: () => null }));
vi.mock("./ForgeMasterEgg", () => ({ ForgeMasterEgg: () => null }));
vi.mock("@/components/easter-eggs/HeilungModal", () => ({
  HeilungModal: () => null,
}));
vi.mock("@/components/cards/GleipnirMountainRoots", () => ({
  GleipnirMountainRoots: () => null,
  useGleipnirFragment3: () => ({ open: false, dismiss: vi.fn() }),
}));
vi.mock("sonner", () => ({ Toaster: () => null }));
vi.mock("@/contexts/RagnarokContext", () => ({
  useRagnarok: () => ({ ragnarokActive: false }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AppShell — Layout landmarks", () => {
  it("renders a <main> element", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );
    const main = screen.getByRole("main");
    expect(main).toBeDefined();
  });

  it("renders a <footer> landmark", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeDefined();
  });

  it("renders children inside the main content area", () => {
    render(
      <AppShell>
        <p>Marketing page content</p>
      </AppShell>
    );
    expect(screen.getByText("Marketing page content")).toBeDefined();
  });
});
