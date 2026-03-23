/**
 * SealedRuneModal — anonymous vs Thrall CTA branching (Issue #1699)
 *
 * Validates that SealedRuneModal shows:
 * - Anon: trial sign-in copy + "Sign in with Google" button
 * - Thrall: subscribe copy + "Subscribe" button
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

// ── Next navigation ───────────────────────────────────────────────────────────

const mockRouterPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/ledger",
}));

// ── Auth + Entitlement ────────────────────────────────────────────────────────

let mockAuthStatus = "authenticated";
const mockSubscribeStripe = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: mockAuthStatus }),
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    tier: "thrall",
    isLoading: false,
    isLinked: false,
    isActive: false,
    subscribeStripe: mockSubscribeStripe,
  }),
}));

// ── sign-in-url ───────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/sign-in-url", () => ({
  buildSignInUrl: (path: string) => `/ledger/sign-in?returnTo=${encodeURIComponent(path)}`,
}));

// ── Component ─────────────────────────────────────────────────────────────────

import { SealedRuneModal } from "@/components/entitlement/SealedRuneModal";

const baseProps = {
  feature: "cloud-sync" as const,
  open: true,
  onDismiss: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SealedRuneModal — anonymous user (issue #1699)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStatus = "anonymous";
    mockSubscribeStripe.mockResolvedValue(undefined);
  });

  it("shows trial copy for anonymous users", () => {
    render(<SealedRuneModal {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("30-day trial");
  });

  it("renders sign-in CTA button for anonymous users", () => {
    render(<SealedRuneModal {...baseProps} />);
    const signInBtn = screen.getByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    expect(signInBtn).toBeDefined();
  });

  it("clicking sign-in CTA navigates to sign-in page", () => {
    render(<SealedRuneModal {...baseProps} />);
    const signInBtn = screen.getByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    fireEvent.click(signInBtn);
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining("sign-in")
    );
    expect(mockSubscribeStripe).not.toHaveBeenCalled();
  });

  it("does not show Subscribe CTA for anonymous users", () => {
    render(<SealedRuneModal {...baseProps} />);
    const subscribeBtn = screen.queryByRole("button", { name: "Subscribe" });
    expect(subscribeBtn).toBeNull();
  });

  it("shows no-credit-card copy for anonymous users", () => {
    render(<SealedRuneModal {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("No credit card required");
  });
});

describe("SealedRuneModal — Thrall user (issue #1699 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStatus = "authenticated";
    mockSubscribeStripe.mockResolvedValue(undefined);
  });

  it("shows subscribe CTA for Thrall users", () => {
    render(<SealedRuneModal {...baseProps} />);
    const subscribeBtn = screen.getByRole("button", { name: "Subscribe" });
    expect(subscribeBtn).toBeDefined();
  });

  it("does NOT show sign-in CTA for Thrall users", () => {
    render(<SealedRuneModal {...baseProps} />);
    const signInBtn = screen.queryByRole("button", {
      name: "Sign in with Google to start your free 30-day trial",
    });
    expect(signInBtn).toBeNull();
  });

  it("clicking Subscribe calls subscribeStripe", () => {
    render(<SealedRuneModal {...baseProps} />);
    const subscribeBtn = screen.getByRole("button", { name: "Subscribe" });
    fireEvent.click(subscribeBtn);
    expect(mockSubscribeStripe).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("shows Stripe billing copy for Thrall users", () => {
    render(<SealedRuneModal {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("$3.99/month");
  });
});
