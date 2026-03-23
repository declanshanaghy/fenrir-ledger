/**
 * KarlUpsellDialog — anonymous vs Thrall CTA branching (Issue #1699)
 *
 * Validates that KarlUpsellDialog shows:
 * - Anon: "FREE 30-DAY TRIAL" header + "Sign in with Google" button
 * - Thrall: "KARL · $3.99/month" header + "Upgrade to Karl" button
 *
 * @ref #1699
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Radix Dialog mock ─────────────────────────────────────────────────────────

vi.mock("@radix-ui/react-dialog", async (importOriginal) => {
  const React = await import("react");
  const actual = await importOriginal<typeof import("@radix-ui/react-dialog")>();

  const Overlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => <div ref={ref} className={className} {...props} />
  );
  Overlay.displayName = "Overlay";

  const Content = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
      <div ref={ref} role="dialog" className={className} {...props}>
        {children}
      </div>
    )
  );
  Content.displayName = "Content";

  const Close = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => <button ref={ref} aria-label="Close" {...props}>{children}</button>
  );
  Close.displayName = "Close";

  const Title = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ children, ...props }, ref) => <h2 ref={ref} {...props}>{children}</h2>
  );
  Title.displayName = "Title";

  const Description = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ children, ...props }, ref) => <p ref={ref} {...props}>{children}</p>
  );
  Description.displayName = "Description";

  return {
    ...actual,
    Root: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
      open !== false ? <>{children}</> : null,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay,
    Content,
    Close,
    Title,
    Description,
  };
});

// ── ThemedFeatureImage mock ───────────────────────────────────────────────────

vi.mock("@/components/shared/ThemedFeatureImage", () => ({
  ThemedFeatureImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// ── Next navigation ───────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/ledger",
}));

// ── Auth + Entitlement ────────────────────────────────────────────────────────

let mockAuthStatus = "authenticated";
const mockSubscribeStripe = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: mockAuthStatus }),
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    tier: "thrall",
    isLoading: false,
    subscribeStripe: mockSubscribeStripe,
  }),
}));

// ── sign-in-url ───────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/sign-in-url", () => ({
  buildSignInUrl: (path: string) => `/ledger/sign-in?returnTo=${encodeURIComponent(path)}`,
}));

// ── Component + fixture props ─────────────────────────────────────────────────

import {
  KarlUpsellDialog,
  KARL_UPSELL_VALHALLA,
} from "@/components/entitlement/KarlUpsellDialog";

const baseProps = {
  ...KARL_UPSELL_VALHALLA,
  open: true,
  onDismiss: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("KarlUpsellDialog — anonymous user (issue #1699)", () => {
  beforeEach(() => {
    mockAuthStatus = "anonymous";
    mockSubscribeStripe.mockResolvedValue(undefined);
  });

  it("shows FREE 30-DAY TRIAL header for anonymous users", () => {
    render(<KarlUpsellDialog {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("FREE 30-DAY TRIAL");
  });

  it("does NOT show KARL tier header pricing for anonymous users", () => {
    render(<KarlUpsellDialog {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    // The header subtext shows "FREE 30-DAY TRIAL" for anon (not "KARL · $3.99/month")
    // Note: tier row still shows "30 days free, then $3.99/month" as pricing context
    expect(dialog.textContent).not.toContain("KARL \u00B7 $3.99/month");
  });

  it("renders sign-in CTA button for anonymous users", () => {
    render(<KarlUpsellDialog {...baseProps} />);
    const signInBtn = screen.getByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    expect(signInBtn).toBeDefined();
  });

  it("clicking sign-in CTA navigates to sign-in (not Stripe)", () => {
    render(<KarlUpsellDialog {...baseProps} />);
    const signInBtn = screen.getByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    fireEvent.click(signInBtn);
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining("sign-in")
    );
    expect(mockSubscribeStripe).not.toHaveBeenCalled();
  });

  it("shows no-credit-card copy for anonymous users", () => {
    render(<KarlUpsellDialog {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("no credit card required");
  });
});

describe("KarlUpsellDialog — Thrall user (issue #1699 regression)", () => {
  beforeEach(() => {
    mockAuthStatus = "authenticated";
    mockSubscribeStripe.mockResolvedValue(undefined);
  });

  it("shows KARL · $3.99/month header for Thrall users", () => {
    render(<KarlUpsellDialog {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("$3.99/month");
  });

  it("does NOT show FREE 30-DAY TRIAL header for Thrall users", () => {
    render(<KarlUpsellDialog {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).not.toContain("FREE 30-DAY TRIAL");
  });

  it("renders Upgrade to Karl CTA for Thrall users", () => {
    render(<KarlUpsellDialog {...baseProps} />);
    // The Thrall CTA button text is "Upgrade to Karl — $3.99/month"
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Upgrade to Karl");
  });

  it("clicking Upgrade to Karl calls subscribeStripe (not router.push)", () => {
    render(<KarlUpsellDialog {...baseProps} />);
    // Find the Upgrade button (contains the text)
    const allButtons = screen.getAllByRole("button");
    const upgradeBtn = allButtons.find((b) =>
      b.textContent?.includes("Upgrade to Karl")
    );
    expect(upgradeBtn).toBeDefined();
    fireEvent.click(upgradeBtn!);
    expect(mockSubscribeStripe).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});

describe("KarlUpsellDialog — closed (open=false)", () => {
  it("renders nothing when open is false", () => {
    mockAuthStatus = "authenticated";
    render(<KarlUpsellDialog {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
