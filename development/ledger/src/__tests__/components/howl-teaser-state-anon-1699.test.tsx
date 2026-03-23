/**
 * HowlTeaserState — anonymous vs Thrall CTA branching (Issue #1699)
 *
 * Validates that HowlTeaserState shows:
 * - Anon: sign-in button (not a Link to /pricing)
 * - Thrall: "Upgrade to Karl — $3.99/month" link to /pricing
 *
 * @ref #1699
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Next navigation ───────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/ledger",
}));

// ── next/link — render as anchor so href is testable ─────────────────────────

vi.mock("next/link", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ── Auth ──────────────────────────────────────────────────────────────────────

let mockAuthStatus = "authenticated";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: mockAuthStatus }),
}));

// ── sign-in-url ───────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/sign-in-url", () => ({
  buildSignInUrl: (path: string) => `/ledger/sign-in?returnTo=${encodeURIComponent(path)}`,
}));

// ── Component ─────────────────────────────────────────────────────────────────

import { HowlTeaserState } from "@/components/dashboard/HowlTeaserState";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("HowlTeaserState — anonymous user (issue #1699)", () => {
  beforeEach(() => {
    mockAuthStatus = "anonymous";
  });

  it("renders the teaser container", () => {
    render(<HowlTeaserState />);
    expect(screen.getByTestId("howl-teaser-state")).toBeDefined();
  });

  it("shows sign-in button (not pricing link) for anonymous users", () => {
    render(<HowlTeaserState />);
    const signInBtn = screen.getByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    expect(signInBtn).toBeDefined();
  });

  it("clicking sign-in button navigates to sign-in page", () => {
    render(<HowlTeaserState />);
    const signInBtn = screen.getByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    fireEvent.click(signInBtn);
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining("sign-in")
    );
  });

  it("does NOT show Upgrade to Karl link for anonymous users", () => {
    render(<HowlTeaserState />);
    // The Thrall CTA is a Link with "Upgrade to Karl — $3.99/month" text
    const links = screen.queryAllByRole("link");
    const upgradeLink = links.find((l) =>
      l.textContent?.includes("Upgrade to Karl")
    );
    expect(upgradeLink).toBeUndefined();
  });

  it("shows trial subtext for anonymous users", () => {
    render(<HowlTeaserState />);
    const container = screen.getByTestId("howl-teaser-state");
    expect(container.textContent).toContain("30 days free");
  });
});

describe("HowlTeaserState — Thrall user (issue #1699 regression)", () => {
  beforeEach(() => {
    mockAuthStatus = "authenticated";
  });

  it("shows Upgrade to Karl link for Thrall users", () => {
    render(<HowlTeaserState />);
    const links = screen.getAllByRole("link");
    const upgradeLink = links.find((l) =>
      l.textContent?.includes("Upgrade to Karl")
    );
    expect(upgradeLink).toBeDefined();
    expect(upgradeLink!.getAttribute("href")).toBe("/pricing");
  });

  it("does NOT show sign-in button for Thrall users", () => {
    render(<HowlTeaserState />);
    const signInBtn = screen.queryByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    expect(signInBtn).toBeNull();
  });

  it("shows pricing secondary link for Thrall users", () => {
    render(<HowlTeaserState />);
    const links = screen.getAllByRole("link");
    const pricingLink = links.find(
      (l) => l.getAttribute("href") === "/pricing"
    );
    expect(pricingLink).toBeDefined();
  });
});
