/**
 * Toast Dismiss Button — Issue #1168
 *
 * Verifies that both AppShell and LedgerShell pass closeButton={true}
 * to the sonner <Toaster>, enabling the runic dismiss affordance on
 * every toast notification.
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AppShell } from "@/components/layout/AppShell";
import { LedgerShell } from "@/components/layout/LedgerShell";

// ── Capture props passed to Toaster ──────────────────────────────────────────

const capturedToasterProps: Record<string, unknown>[] = [];

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    capturedToasterProps.push(props);
    return null;
  },
}));

// ── Standard mocks shared by both shells ──────────────────────────────────────

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

vi.mock("@/components/layout/SyncIndicator", () => ({ SyncIndicator: () => null }));
vi.mock("./SyncIndicator", () => ({ SyncIndicator: () => null }));
vi.mock("./KonamiHowl", () => ({ KonamiHowl: () => null }));
vi.mock("./ForgeMasterEgg", () => ({ ForgeMasterEgg: () => null }));
vi.mock("@/components/easter-eggs/HeilungModal", () => ({ HeilungModal: () => null }));
vi.mock("@/components/cards/GleipnirMountainRoots", () => ({
  GleipnirMountainRoots: () => null,
  useGleipnirFragment3: () => ({ open: false, dismiss: vi.fn() }),
}));
vi.mock("@/contexts/RagnarokContext", () => ({
  useRagnarok: () => ({ ragnarokActive: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    status: "anonymous",
    session: null,
    householdId: "",
    signOut: vi.fn(),
  }),
}));

// LedgerShell-specific mocks
vi.mock("@/components/layout/LedgerTopBar", () => ({
  LedgerTopBar: () => <header role="banner">TopBar</header>,
}));
vi.mock("@/components/layout/LedgerBottomTabs", () => ({
  LedgerBottomTabs: () => null,
}));
vi.mock("@/components/trial/TrialDay15Modal", () => ({ TrialDay15Modal: () => null }));
vi.mock("@/components/trial/TrialExpiryModal", () => ({ TrialExpiryModal: () => null }));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Toast dismiss button — issue #1168", () => {
  it("AppShell renders Toaster with closeButton enabled", () => {
    capturedToasterProps.length = 0;
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );
    const toasterProps = capturedToasterProps.find((p) => p.position === "bottom-right");
    expect(toasterProps).toBeDefined();
    expect(toasterProps?.closeButton).toBe(true);
  });

  it("LedgerShell renders Toaster with closeButton enabled", () => {
    capturedToasterProps.length = 0;
    render(
      <LedgerShell>
        <div>Content</div>
      </LedgerShell>
    );
    const toasterProps = capturedToasterProps.find((p) => p.position === "bottom-right");
    expect(toasterProps).toBeDefined();
    expect(toasterProps?.closeButton).toBe(true);
  });

  it("sonner Toaster default closeButtonAriaLabel is accessible (Close toast)", () => {
    // Sonner's built-in default aria-label for the close button is 'Close toast'.
    // This test documents the expected accessible label for keyboard users.
    // Overriding via toastOptions.closeButtonAriaLabel would change this.
    capturedToasterProps.length = 0;
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );
    const toasterProps = capturedToasterProps.find((p) => p.position === "bottom-right");
    // No custom closeButtonAriaLabel override — sonner defaults to 'Close toast'
    expect(toasterProps?.closeButtonAriaLabel).toBeUndefined();
  });

  it("AppShell and LedgerShell both render Toaster at position bottom-right", () => {
    // Toasts must appear at bottom-right to avoid covering primary content.
    // This is an explicit assertion — not just a lookup filter.
    capturedToasterProps.length = 0;
    render(<AppShell><div /></AppShell>);
    render(<LedgerShell><div /></LedgerShell>);
    const positions = capturedToasterProps.map((p) => p.position);
    expect(positions).toContain("bottom-right");
    expect(positions.filter((pos) => pos === "bottom-right")).toHaveLength(2);
  });

  it("toastOptions className is font-body on both shells (preserves Norse font styling)", () => {
    // font-body class applies the Cinzel/runic typography to toast text.
    // Stripping it would break the Norse war-room aesthetic for the dismiss button.
    capturedToasterProps.length = 0;
    render(<AppShell><div /></AppShell>);
    render(<LedgerShell><div /></LedgerShell>);
    const classNames = capturedToasterProps.map(
      (p) => (p.toastOptions as { className?: string } | undefined)?.className
    );
    expect(classNames.every((cn) => cn === "font-body")).toBe(true);
  });
});
