/**
 * Unified header token alignment — Issue #1853
 *
 * Validates that MarketingNavbar and LedgerTopBar share the same
 * base layout tokens: h-12, ᛟ rune, text-gold, z-[100], skip nav link.
 * Also validates LedgerTopBar backdrop-blur-sm addition.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Shared mocks ────────────────────────────────────────────────────────────

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
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
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

vi.mock("@/components/marketing/MarketingNavLinks", () => ({
  MarketingNavLinks: () => null,
  NAV_LINKS: [],
  isNavLinkActive: () => false,
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { LedgerTopBar } from "@/components/layout/LedgerTopBar";

// ── MarketingNavbar — Issue #1853 token alignment ────────────────────────────

describe("MarketingNavbar — Issue #1853 unified header tokens", () => {
  it("renders ᛟ rune in logo (not ᚠ)", () => {
    render(<MarketingNavbar />);
    // ᛟ should appear; ᚠ should not
    const runes = document.querySelectorAll('[aria-hidden="true"]');
    const runeTexts = Array.from(runes).map((el) => el.textContent);
    expect(runeTexts.some((t) => t?.includes("ᛟ"))).toBe(true);
    expect(runeTexts.some((t) => t?.includes("ᚠ"))).toBe(false);
  });

  it("logo rune has text-gold class", () => {
    render(<MarketingNavbar />);
    const runes = document.querySelectorAll('[aria-hidden="true"]');
    const goldRune = Array.from(runes).find(
      (el) => el.textContent?.includes("ᛟ") && el.className.includes("text-gold")
    );
    expect(goldRune).not.toBeUndefined();
  });

  it("logo wordmark has text-gold class", () => {
    render(<MarketingNavbar />);
    // Wordmark should contain FENRIR LEDGER in uppercase
    const wordmark = Array.from(document.querySelectorAll("span")).find(
      (el) => el.textContent?.includes("FENRIR LEDGER") && el.className.includes("text-gold")
    );
    expect(wordmark).not.toBeUndefined();
  });

  it("nav element has z-[100] class (not z-50)", () => {
    const { container } = render(<MarketingNavbar />);
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav!.className).toContain("z-[100]");
    expect(nav!.className).not.toContain("z-50");
  });

  it("inner div has h-12 class (not h-16)", () => {
    const { container } = render(<MarketingNavbar />);
    const innerDiv = container.querySelector(".h-12");
    expect(innerDiv).not.toBeNull();
    // Must not have old h-16
    const oldDiv = container.querySelector(".h-16");
    expect(oldDiv).toBeNull();
  });

  it("desktop center nav uses gap-6 (not gap-8)", () => {
    const { container } = render(<MarketingNavbar />);
    // The center nav div should have gap-6
    const gapDiv = container.querySelector(".gap-6");
    expect(gapDiv).not.toBeNull();
    // Must not have gap-8
    const oldGap = container.querySelector(".gap-8");
    expect(oldGap).toBeNull();
  });

  it("renders skip-to-main-content link", () => {
    render(<MarketingNavbar />);
    const skipLink = screen.getByText("Skip to main content");
    expect(skipLink).toBeDefined();
    expect(skipLink.getAttribute("href")).toBe("#main-content");
  });

  it("skip link has sr-only class (screen-reader only by default)", () => {
    render(<MarketingNavbar />);
    const skipLink = screen.getByText("Skip to main content");
    expect(skipLink.className).toContain("sr-only");
  });

  it("CTA button uses py-1.5 (not py-2) to fit 48px rail", () => {
    render(<MarketingNavbar />);
    const cta = Array.from(document.querySelectorAll("a")).find(
      (el) => el.textContent?.includes("Open the Ledger")
    );
    expect(cta).not.toBeUndefined();
    expect(cta!.className).toContain("py-1.5");
    expect(cta!.className).not.toContain("py-2 ");
  });
});

// ── MarketingNavbar — mobile overlay tokens ───────────────────────────────────

describe("MarketingNavbar — mobile overlay logo tokens (Issue #1853)", () => {
  it("mobile overlay logo uses ᛟ rune (not ᚠ)", async () => {
    const { act, fireEvent } = await import("@testing-library/react");
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog");
    const overlayRunes = Array.from(overlay.querySelectorAll('[aria-hidden="true"]'));
    expect(overlayRunes.some((el) => el.textContent?.includes("ᛟ"))).toBe(true);
    expect(overlayRunes.some((el) => el.textContent?.includes("ᚠ"))).toBe(false);
  });

  it("mobile overlay logo rune has text-gold class", async () => {
    const { act, fireEvent } = await import("@testing-library/react");
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog");
    const goldRune = Array.from(overlay.querySelectorAll('[aria-hidden="true"]')).find(
      (el) => el.textContent?.includes("ᛟ") && el.className.includes("text-gold")
    );
    expect(goldRune).not.toBeUndefined();
  });

  it("mobile overlay wordmark has text-gold class", async () => {
    const { act, fireEvent } = await import("@testing-library/react");
    render(<MarketingNavbar />);
    const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
    act(() => { fireEvent.click(hamburger); });

    const overlay = screen.getByRole("dialog");
    const wordmark = Array.from(overlay.querySelectorAll("span")).find(
      (el) => el.textContent?.includes("FENRIR LEDGER") && el.className.includes("text-gold")
    );
    expect(wordmark).not.toBeUndefined();
  });
});

// ── LedgerTopBar — backdrop-blur-sm (Issue #1853) ────────────────────────────

describe("LedgerTopBar — Issue #1853 backdrop-blur-sm", () => {
  it("header has backdrop-blur-sm class", () => {
    const { container } = render(<LedgerTopBar />);
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.className).toContain("backdrop-blur-sm");
  });

  it("header has bg-background/90 class (semi-transparent background)", () => {
    const { container } = render(<LedgerTopBar />);
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.className).toContain("bg-background/90");
  });

  it("header does not have plain bg-background without opacity modifier", () => {
    const { container } = render(<LedgerTopBar />);
    const header = container.querySelector("header");
    // bg-background/90 is present; plain bg-background (without /) should not be
    const classes = header!.className.split(/\s+/);
    expect(classes).not.toContain("bg-background");
    expect(classes.some((c) => c === "bg-background/90")).toBe(true);
  });
});
