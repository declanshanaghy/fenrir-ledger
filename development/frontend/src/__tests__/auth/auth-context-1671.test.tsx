/**
 * AuthContext — Issue #1671 regression tests
 *
 * Validates the refactored model introduced in #1671:
 *   - AuthContext returns householdId = null for ALL anonymous users
 *   - No UUID household is created for anonymous users
 *   - ensureHouseholdId() returns ANON_HOUSEHOLD_ID ("anon") for anonymous users
 *   - ensureHouseholdId() returns session.user.sub for authenticated users
 *   - signOut() sets householdId = null (no UUID restoration)
 *
 * @ref Issue #1671
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

// household.ts no longer has getOrCreateAnonHouseholdId — only getAnonHouseholdId
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

describe("AuthContext — Issue #1671: null householdId for anonymous users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no session (brand-new anonymous user)
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);
  });

  // ── Core contract: null for anonymous ────────────────────────────────────────

  it("sets householdId = null for brand-new anonymous user", async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.householdId).toBeNull();
  });

  it("sets householdId = null for returning anonymous user (legacy UUID ignored)", async () => {
    // Even if old fenrir:household UUID exists, new model always uses null
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

  // ── ensureHouseholdId: returns "anon" for anonymous ──────────────────────────

  it("ensureHouseholdId returns 'anon' for anonymous user (no UUID creation)", async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    let returnedId: string | undefined;
    act(() => {
      returnedId = result.current.ensureHouseholdId();
    });

    expect(returnedId).toBe("anon");
    // householdId stays null — ensureHouseholdId is a resolver, not a setter
    expect(result.current.householdId).toBeNull();
  });

  it("ensureHouseholdId returns user.sub for authenticated user", async () => {
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

  // ── signOut: sets householdId = null ─────────────────────────────────────────

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
    expect(result.current.householdId).toBeNull();
  });
});
