/**
 * Mobile nav layout — Issue #1998
 *
 * Validates that:
 *   1. Hamburger button appears before (to the left of) the logo in DOM order
 *      for both MarketingNavbar and LedgerTopBar.
 *   2. The mobile overlay has overflow-hidden to prevent viewport overflow.
 *
 * Regression guard: hamburger must remain left of logo on mobile.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Shared mocks ───────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">T</button>,
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    data: null,
    status: "anonymous",
    householdId: null,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: () => null,
  clearEntitlementCache: vi.fn(),
}));

vi.mock("@/components/layout/TrialBadge", () => ({
  TrialBadge: () => null,
}));

vi.mock("@/components/layout/KarlBadge", () => ({
  KarlBadge: () => null,
}));

// ── MarketingNavbar — Issue #1998 ──────────────────────────────────────────────

import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";

describe("MarketingNavbar — hamburger left of logo (Issue #1998)", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("hamburger button appears before the logo link in DOM order", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    const logoLink = screen.getByRole("link", { name: /Fenrir Ledger.*home/i });

    // compareDocumentPosition: 4 means hamburger precedes logoLink in the DOM
    const position = hamburger.compareDocumentPosition(logoLink);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("overlay has overflow-hidden class to prevent viewport overflow", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(overlay).toHaveClass("overflow-hidden");
  });

  it("overlay uses fixed inset-0 positioning for full-viewport coverage", () => {
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(overlay).toHaveClass("fixed");
    expect(overlay).toHaveClass("inset-0");
  });
});

// ── LedgerTopBar — Issue #1998 ─────────────────────────────────────────────────

import { LedgerTopBar } from "@/components/layout/LedgerTopBar";

describe("LedgerTopBar — hamburger left of logo (Issue #1998)", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("hamburger button appears before the logo link in DOM order", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    const logoLink = screen.getByRole("link", { name: /Fenrir Ledger.*home/i });

    // compareDocumentPosition: hamburger should precede logo link
    const position = hamburger.compareDocumentPosition(logoLink);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("overlay has overflow-hidden class to prevent viewport overflow", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(overlay).toHaveClass("overflow-hidden");
  });

  it("overlay uses fixed inset-0 positioning for full-viewport coverage", () => {
    render(<LedgerTopBar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });

    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(overlay).toHaveClass("fixed");
    expect(overlay).toHaveClass("inset-0");
  });
});
