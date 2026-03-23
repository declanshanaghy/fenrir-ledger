/**
 * Issue #1905 — Sign In button and nudge text CTA styling in light theme.
 *
 * Validates that:
 * - Sign In buttons use solid CTA styling (bg-primary text-primary-foreground),
 *   not faint outline/gold variants that were barely visible on parchment bg.
 * - Nudge text uses text-foreground (high contrast), not text-gold/80 or muted.
 *
 * Components tested:
 *   - CompactSignInNudge (inside LedgerTopBar) — stale auth top-bar nudge
 *   - StaleAuthNudge — full-width stale auth banner
 *   - SignInNudge — sign-in sync banner for anon users with cards
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── CompactSignInNudge (LedgerTopBar) mock setup ─────────────────────────────

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

const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
  usePathname: () => "/ledger",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">T</button>,
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
}));

let mockAuthStatus = "anonymous";
let mockSession: { user: { name: string; email: string } } | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    data: mockSession,
    status: mockAuthStatus,
    householdId: "test-household",
    signOut: vi.fn(),
  }),
}));

// Return non-null to trigger stale auth nudge in LedgerTopBar
let mockEntitlementCache: object | null = { plan: "pro" };
vi.mock("@/lib/entitlement/cache", () => ({
  getEntitlementCache: () => mockEntitlementCache,
  clearEntitlementCache: vi.fn(),
}));

vi.mock("@/components/marketing/MarketingNavLinks", () => ({
  MarketingNavLinks: () => null,
  NAV_LINKS: [],
  isNavLinkActive: () => false,
}));

// ── CompactSignInNudge tests (via LedgerTopBar) ──────────────────────────────

describe("Issue #1905 — CompactSignInNudge CTA styling", () => {
  beforeEach(() => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    mockEntitlementCache = { plan: "pro" };
  });

  it("Sign In button uses solid bg-primary CTA class (not outline/border-gold)", async () => {
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
    const { container } = render(<LedgerTopBar />);

    // CompactSignInNudge renders when anonymous + stale cache
    const signInBtn = container.querySelector(
      "button.bg-primary.text-primary-foreground"
    );
    expect(signInBtn).not.toBeNull();
    expect(signInBtn?.textContent).toContain("Sign in");
  });

  it("Sign In button does NOT use faint outline styling (border-gold or text-gold)", async () => {
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
    const { container } = render(<LedgerTopBar />);

    // Ensure no button uses the old washed-out gold border pattern
    const signInBtn = container.querySelector("button[class*='border-gold']");
    expect(signInBtn).toBeNull();
  });

  it("nudge text uses text-foreground class for high contrast", async () => {
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
    const { container } = render(<LedgerTopBar />);

    // The oath text span should have text-foreground (was text-gold/80 before fix)
    const nudgeText = container.querySelector("span.text-foreground");
    expect(nudgeText).not.toBeNull();
    expect(nudgeText?.textContent).toContain("wolf");
  });

  it("nudge text does NOT use washed-out gold color (text-gold/80)", async () => {
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
    const { container } = render(<LedgerTopBar />);

    // Old nudge text class was text-gold/80 — should be gone.
    // Note: the logo rune legitimately uses text-gold (aria-hidden), so we
    // specifically check the nudge container (border-gold/30 bg-gold/5) for
    // any visible span with a gold text colour.
    const nudgeContainer = container.querySelector(
      ".border-gold\\/30.bg-gold\\/5"
    );
    expect(nudgeContainer).not.toBeNull();
    // Within the nudge, no visible span should use text-gold variants
    const goldSpanInNudge = nudgeContainer?.querySelector(
      "span:not([aria-hidden='true'])[class*='text-gold']"
    );
    expect(goldSpanInNudge).toBeNull();
  });

  it("Sign In button has minimum touch target height (32px)", async () => {
    const { LedgerTopBar } = await import("@/components/layout/LedgerTopBar");
    const { container } = render(<LedgerTopBar />);

    const signInBtn = container.querySelector(
      "button.bg-primary.text-primary-foreground"
    ) as HTMLButtonElement | null;
    expect(signInBtn).not.toBeNull();
    expect(signInBtn?.style.minHeight).toBe("32px");
  });
});

// ── StaleAuthNudge tests ─────────────────────────────────────────────────────

describe("Issue #1905 — StaleAuthNudge CTA styling", () => {
  beforeEach(() => {
    mockAuthStatus = "anonymous";
    vi.resetModules();
  });

  async function renderStaleNudge(entitlementCache: object | null) {
    // Patch getEntitlementCache for StaleAuthNudge internals
    vi.doMock("@/lib/entitlement/cache", () => ({
      getEntitlementCache: () => entitlementCache,
      clearEntitlementCache: vi.fn(),
    }));
    vi.doMock("@/hooks/useAuth", () => ({
      useAuth: () => ({ status: "anonymous" }),
    }));
    const { StaleAuthNudge } = await import(
      "@/components/layout/StaleAuthNudge"
    );
    return render(<StaleAuthNudge />);
  }

  it("desktop Sign In button uses bg-primary text-primary-foreground CTA", async () => {
    const { container } = await renderStaleNudge({ plan: "pro" });
    const ctaButtons = container.querySelectorAll(
      "button.bg-primary.text-primary-foreground"
    );
    // At least one CTA button present
    expect(ctaButtons.length).toBeGreaterThan(0);
    const labels = Array.from(ctaButtons).map((b) => b.textContent);
    expect(labels.some((t) => t?.includes("Sign in"))).toBe(true);
  });

  it("nudge text uses text-foreground (desktop — was text-gold/70 before fix)", async () => {
    const { container } = await renderStaleNudge({ plan: "pro" });
    // Check that no paragraph uses the old washed-out gold color
    const goldText = container.querySelector("p[class*='text-gold']");
    expect(goldText).toBeNull();
  });

  it("nudge text paragraphs use text-foreground class", async () => {
    const { container } = await renderStaleNudge({ plan: "pro" });
    const paragraphs = container.querySelectorAll("p.text-foreground");
    expect(paragraphs.length).toBeGreaterThan(0);
  });

  it("Sign In button does NOT use border-gold or text-gold outline variant", async () => {
    const { container } = await renderStaleNudge({ plan: "pro" });
    const outlineBtn = container.querySelector(
      "button[class*='border-gold'], button[class*='text-gold']"
    );
    expect(outlineBtn).toBeNull();
  });
});

// ── SignInNudge tests ─────────────────────────────────────────────────────────

describe("Issue #1905 — SignInNudge CTA styling", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function renderSignInNudge(hasCards: boolean, authStatus = "anonymous") {
    vi.doMock("@/hooks/useAuth", () => ({
      useAuth: () => ({ status: authStatus }),
    }));
    const { SignInNudge } = await import(
      "@/components/layout/SignInNudge"
    );
    return render(<SignInNudge hasCards={hasCards} />);
  }

  it("desktop Sign In button uses bg-primary text-primary-foreground CTA", async () => {
    const { container } = await renderSignInNudge(true);
    const ctaButtons = container.querySelectorAll(
      "button.bg-primary.text-primary-foreground"
    );
    expect(ctaButtons.length).toBeGreaterThan(0);
  });

  it("Sign In button does NOT use border-gold outline (was barely visible in light theme)", async () => {
    const { container } = await renderSignInNudge(true);
    const outlineBtn = container.querySelector("button[class*='border-gold']");
    expect(outlineBtn).toBeNull();
  });

  it("Sign In button does NOT use text-gold (was washed-out in light theme)", async () => {
    const { container } = await renderSignInNudge(true);
    const goldBtn = container.querySelector("button[class*='text-gold']");
    expect(goldBtn).toBeNull();
  });

  it("nudge body text uses text-foreground (high contrast)", async () => {
    const { container } = await renderSignInNudge(true);
    const highContrastPara = container.querySelector("p.text-foreground");
    expect(highContrastPara).not.toBeNull();
  });

  it("renders nothing for authenticated users (dark theme unchanged concern)", async () => {
    const { container } = await renderSignInNudge(true, "authenticated");
    expect(container.firstChild).toBeNull();
  });
});
