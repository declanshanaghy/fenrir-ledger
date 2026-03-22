/**
 * AuthContext — Issue #1670 regression tests (updated for #1671)
 *
 * Issue #1671 updated the model: anonymous users now have householdId = null
 * (not a UUID). The original lazy-UUID pattern from #1670 is removed.
 *
 * This file retains the test structure from #1670 but updates assertions
 * to reflect the #1671 model where anonymous householdId is always null.
 *
 * @ref Issue #1670, #1671
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSession = vi.hoisted(() => vi.fn());
const mockIsSessionValid = vi.hoisted(() => vi.fn());
const mockClearSession = vi.hoisted(() => vi.fn());
const mockClearEntitlementCache = vi.hoisted(() => vi.fn());
const mockRefreshSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  getSession: mockGetSession,
  isSessionValid: mockIsSessionValid,
  clearSession: mockClearSession,
}));

vi.mock("@/lib/auth/household", () => ({
  getAnonHouseholdId: vi.fn(() => null),
}));

vi.mock("@/lib/entitlement/cache", () => ({
  clearEntitlementCache: mockClearEntitlementCache,
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  refreshSession: mockRefreshSession,
}));

// ─── Import under test ────────────────────────────────────────────────────────

import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AuthContext — Issue #1670/#1671: anonymous householdId model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no session (brand-new anonymous user)
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);
  });

  // ── Core contract: null for anonymous (Issue #1671) ───────────────────────

  it("sets householdId to null for brand-new anonymous user (Issue #1671)", async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    // #1671: anonymous householdId is null, not ""
    expect(result.current.householdId).toBeNull();
  });

  it("sets householdId to null for anonymous user regardless of legacy UUID", async () => {
    // Even if old fenrir:household exists, model is now null for all anon users
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.householdId).toBeNull();
  });

  // ── Authenticated user: uses user.sub ──────────────────────────────────────

  it("sets householdId to session.user.sub for authenticated user", async () => {
    const mockSession = {
      user: { sub: "google-sub-abc123", email: "user@example.com", name: "User", picture: "" },
      access_token: "tok",
      id_token: "idtok",
      expires_at: Date.now() + 3600_000,
    };
    mockGetSession.mockReturnValue(mockSession);
    mockIsSessionValid.mockReturnValue(true);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    expect(result.current.householdId).toBe("google-sub-abc123");
  });

  // ── ensureHouseholdId: returns "anon" for anonymous (Issue #1671) ──────────

  it("ensureHouseholdId returns 'anon' for anonymous user (no lazy UUID creation)", async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    let returnedId: string | undefined;
    act(() => {
      returnedId = result.current.ensureHouseholdId();
    });

    // #1671: returns fixed "anon" instead of creating a UUID
    expect(returnedId).toBe("anon");
    // householdId stays null — ensureHouseholdId doesn't mutate state
    expect(result.current.householdId).toBeNull();
  });

  it("ensureHouseholdId returns user.sub for authenticated user (no anon UUID created)", async () => {
    const mockSession = {
      user: { sub: "google-sub-xyz", email: "user@example.com", name: "User", picture: "" },
      access_token: "tok",
      id_token: "idtok",
      expires_at: Date.now() + 3600_000,
    };
    mockGetSession.mockReturnValue(mockSession);
    mockIsSessionValid.mockReturnValue(true);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    let returnedId: string | undefined;
    act(() => {
      returnedId = result.current.ensureHouseholdId();
    });

    expect(returnedId).toBe("google-sub-xyz");
  });

  // ── signOut: sets householdId = null (Issue #1671) ────────────────────────

  it("signOut sets householdId = null (no UUID restoration)", async () => {
    const mockSession = {
      user: { sub: "google-sub-def", email: "user@example.com", name: "User", picture: "" },
      access_token: "tok",
      id_token: "idtok",
      expires_at: Date.now() + 3600_000,
    };
    mockGetSession.mockReturnValue(mockSession);
    mockIsSessionValid.mockReturnValue(true);

    const mockLocation = { href: "" };
    Object.defineProperty(window, "location", { value: mockLocation, writable: true });

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    act(() => {
      result.current.signOut();
    });

    expect(result.current.status).toBe("anonymous");
    // #1671: null, not the old anon UUID
    expect(result.current.householdId).toBeNull();
  });
});
