/**
 * Admin Layout — token refresh / auth gate regression tests
 *
 * Validates that the admin layout correctly distinguishes between:
 *  - Null/expired token  → redirect to sign-in (not 403 page)
 *  - 401 from API        → redirect to sign-in (not 403 page)
 *  - 403 from API        → show forbidden page (user is not admin)
 *  - 200 from API        → grant access and render children
 *
 * @ref Issue #2059
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockEnsureFreshToken = vi.hoisted(() => vi.fn<[], Promise<string | null>>());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: mockEnsureFreshToken,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuth,
}));

// ── Capture window.location.href assignments ───────────────────────────────────

let hrefCapture = "";
const locationDescriptor = Object.getOwnPropertyDescriptor(window, "location");

// ── Import under test ─────────────────────────────────────────────────────────

import AdminLayout from "@/app/admin/layout";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Authenticated session stub — status only, no data needed */
const authenticatedSession = {
  status: "authenticated" as const,
  data: { user: { email: "odin@fenrir.dev", sub: "u1", name: "Odin", picture: "" } },
  householdId: "hh-odin",
  signOut: vi.fn(),
  ensureHouseholdId: () => "hh-odin",
};

function makeFetchResponse(status: number): Response {
  return { status, ok: status >= 200 && status < 300 } as Response;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  hrefCapture = "";

  // Replace window.location with a writable stub so we can track href assignments
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      ...window.location,
      get href() { return hrefCapture; },
      set href(v: string) { hrefCapture = v; },
    },
  });

  // Default: authenticated session
  mockUseAuth.mockReturnValue(authenticatedSession);

  // Default fetch: 200 OK
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue(makeFetchResponse(200));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdminLayout — token refresh / auth gate (issue #2059)", () => {
  // ─── Null token → redirect ────────────────────────────────────────────────

  it("redirects to sign-in when ensureFreshToken returns null", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    render(
      <AdminLayout>
        <div data-testid="admin-child">Admin Content</div>
      </AdminLayout>
    );

    await waitFor(() => {
      expect(hrefCapture).toContain("/ledger/sign-in");
    });

    // Must NOT show forbidden page
    expect(screen.queryByText(/You are not of the Allfather/i)).toBeNull();
    // Must NOT render children
    expect(screen.queryByTestId("admin-child")).toBeNull();
  });

  it("includes returnTo=/admin in redirect URL when token is null", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    render(<AdminLayout><div /></AdminLayout>);

    await waitFor(() => {
      expect(hrefCapture).toContain("returnTo=%2Fadmin");
    });
  });

  // ─── 401 response → redirect ─────────────────────────────────────────────

  it("redirects to sign-in when API returns 401", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetch.mockResolvedValue(makeFetchResponse(401));

    render(
      <AdminLayout>
        <div data-testid="admin-child">Admin Content</div>
      </AdminLayout>
    );

    await waitFor(() => {
      expect(hrefCapture).toContain("/ledger/sign-in");
    });

    expect(screen.queryByText(/You are not of the Allfather/i)).toBeNull();
    expect(screen.queryByTestId("admin-child")).toBeNull();
  });

  it("includes returnTo=/admin in redirect URL when API returns 401", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetch.mockResolvedValue(makeFetchResponse(401));

    render(<AdminLayout><div /></AdminLayout>);

    await waitFor(() => {
      expect(hrefCapture).toContain("returnTo=%2Fadmin");
    });
  });

  // ─── 403 response → forbidden page ───────────────────────────────────────

  it("shows forbidden page when API returns 403", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetch.mockResolvedValue(makeFetchResponse(403));

    render(
      <AdminLayout>
        <div data-testid="admin-child">Admin Content</div>
      </AdminLayout>
    );

    await waitFor(() => {
      expect(screen.getByText(/You are not of the Allfather/i)).toBeDefined();
    });

    // Must NOT redirect for a genuine non-admin
    expect(hrefCapture).toBe("");
    expect(screen.queryByTestId("admin-child")).toBeNull();
  });

  it("shows 403 heading when API returns 403", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetch.mockResolvedValue(makeFetchResponse(403));

    render(<AdminLayout><div /></AdminLayout>);

    await waitFor(() => {
      expect(screen.getByText(/ᚠ 403 ᚠ/)).toBeDefined();
    });
  });

  // ─── 200 response → grant access ─────────────────────────────────────────

  it("renders children when API returns 200 (admin granted)", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetch.mockResolvedValue(makeFetchResponse(200));

    render(
      <AdminLayout>
        <div data-testid="admin-child">Admin Content</div>
      </AdminLayout>
    );

    await waitFor(() => {
      expect(screen.getByTestId("admin-child")).toBeDefined();
    });

    expect(screen.queryByText(/You are not of the Allfather/i)).toBeNull();
    expect(hrefCapture).toBe("");
  });

  it("renders admin nav when granted", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetch.mockResolvedValue(makeFetchResponse(200));

    render(<AdminLayout><div /></AdminLayout>);

    await waitFor(() => {
      expect(screen.getByLabelText("Admin navigation")).toBeDefined();
    });
  });

  // ─── Anonymous user → redirect (pre-existing behavior) ───────────────────

  it("redirects to sign-in immediately for anonymous users", async () => {
    mockUseAuth.mockReturnValue({
      status: "anonymous" as const,
      data: null,
      householdId: null,
      signOut: vi.fn(),
    });

    render(<AdminLayout><div data-testid="admin-child" /></AdminLayout>);

    await waitFor(() => {
      expect(hrefCapture).toContain("/ledger/sign-in");
    });

    expect(screen.queryByTestId("admin-child")).toBeNull();
  });
});
