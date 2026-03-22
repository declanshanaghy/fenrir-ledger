/**
 * Vitest tests for src/app/admin/layout.tsx
 *
 * Covers: loading state, redirect for anonymous users, forbidden state (403),
 * granted state renders children + nav. Issue #1470
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminLayout from "@/app/admin/layout";

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockAuthStatus: string = "loading";
let mockSession: { id_token?: string } | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    data: mockSession,
    status: mockAuthStatus,
    householdId: null,
  }),
}));

vi.mock("@/lib/auth/sign-in-url", () => ({
  buildSignInUrl: vi.fn((returnTo: string) => `/ledger/sign-in?returnTo=${returnTo}`),
}));

// Capture window.location.href assignments
const originalLocation = window.location;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStatus = "loading";
    mockSession = null;
    // Reset window.location
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("renders loading state ('The ravens scout ahead...')", () => {
    mockAuthStatus = "loading";
    render(<AdminLayout>Content</AdminLayout>);
    expect(screen.getByText(/the ravens scout ahead/i)).toBeInTheDocument();
  });

  it("has aria-label for loading container", () => {
    mockAuthStatus = "loading";
    render(<AdminLayout>Content</AdminLayout>);
    expect(screen.getByLabelText(/admin console loading/i)).toBeInTheDocument();
  });

  it("redirects anonymous users to sign-in", async () => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    render(<AdminLayout>Content</AdminLayout>);
    await waitFor(() => {
      expect(window.location.href).toContain("/ledger/sign-in");
    });
  });

  it("shows redirecting state copy for anonymous users", async () => {
    mockAuthStatus = "anonymous";
    mockSession = null;
    render(<AdminLayout>Content</AdminLayout>);
    await waitFor(() => {
      expect(screen.getByText(/summoning the allfather's gate/i)).toBeInTheDocument();
    });
  });

  it("shows forbidden state when API returns 403", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { id_token: "tok-abc" };
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    render(<AdminLayout>Content</AdminLayout>);

    await waitFor(() => {
      expect(screen.getByLabelText(/admin access denied/i)).toBeInTheDocument();
      expect(screen.getByText(/403/)).toBeInTheDocument();
      expect(
        screen.getByText(/you are not of the allfather's council/i)
      ).toBeInTheDocument();
    });
  });

  it("shows 'Return to the Ledger' button in forbidden state", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { id_token: "tok-abc" };
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    render(<AdminLayout>Content</AdminLayout>);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /return to the ledger/i })
      ).toBeInTheDocument();
    });
  });

  it("shows forbidden state when fetch throws", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { id_token: "tok-abc" };
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network fail"));

    render(<AdminLayout>Content</AdminLayout>);

    await waitFor(() => {
      expect(screen.getByLabelText(/admin access denied/i)).toBeInTheDocument();
    });
  });

  it("renders children and admin nav when granted", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { id_token: "tok-abc" };
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200 });

    render(<AdminLayout><div data-testid="child-content">Dashboard</div></AdminLayout>);

    await waitFor(() => {
      expect(screen.getByLabelText(/admin console$/i)).toBeInTheDocument();
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });
  });

  it("renders admin navigation with 'Pack Status' link when granted", async () => {
    mockAuthStatus = "authenticated";
    mockSession = { id_token: "tok-abc" };
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200 });

    render(<AdminLayout>Content</AdminLayout>);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /pack status/i })).toBeInTheDocument();
    });
  });

  it("shows forbidden when authenticated but no id_token", async () => {
    mockAuthStatus = "authenticated";
    mockSession = {};

    render(<AdminLayout>Content</AdminLayout>);

    await waitFor(() => {
      expect(screen.getByLabelText(/admin access denied/i)).toBeInTheDocument();
    });
  });
});
