/**
 * AuthContext — Issue #1670 regression tests
 *
 * Validates that AuthContext does NOT eagerly create a householdId for
 * anonymous users. The household UUID must only be created via ensureHouseholdId()
 * when the user explicitly navigates to an interactive page.
 *
 * @ref Issue #1670
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSession = vi.hoisted(() => vi.fn());
const mockIsSessionValid = vi.hoisted(() => vi.fn());
const mockClearSession = vi.hoisted(() => vi.fn());
const mockGetAnonHouseholdId = vi.hoisted(() => vi.fn<() => string | null>());
const mockGetOrCreateAnonHouseholdId = vi.hoisted(() => vi.fn<() => string>());
const mockClearEntitlementCache = vi.hoisted(() => vi.fn());
const mockRefreshSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  getSession: mockGetSession,
  isSessionValid: mockIsSessionValid,
  clearSession: mockClearSession,
}));

vi.mock("@/lib/auth/household", () => ({
  getAnonHouseholdId: mockGetAnonHouseholdId,
  getOrCreateAnonHouseholdId: mockGetOrCreateAnonHouseholdId,
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

describe("AuthContext — Issue #1670: no eager household creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no session, no existing anon UUID (brand-new user)
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);
    mockGetAnonHouseholdId.mockReturnValue(null);
    mockGetOrCreateAnonHouseholdId.mockReturnValue("lazy-anon-uuid");
  });

  // ── Core contract: no eager UUID creation ──────────────────────────────────

  it("does NOT call getOrCreateAnonHouseholdId on mount (brand-new anonymous user)", async () => {
    renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetAnonHouseholdId).toHaveBeenCalled();
    });

    // The critical assertion: eager creation never happens
    expect(mockGetOrCreateAnonHouseholdId).not.toHaveBeenCalled();
  });

  it("sets householdId to empty string for brand-new anonymous user (no existing UUID)", async () => {
    mockGetAnonHouseholdId.mockReturnValue(null);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.householdId).toBe("");
  });

  it("sets householdId to existing UUID for returning anonymous user", async () => {
    mockGetAnonHouseholdId.mockReturnValue("returning-user-uuid");

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.householdId).toBe("returning-user-uuid");
    // Still no eager creation for returning user
    expect(mockGetOrCreateAnonHouseholdId).not.toHaveBeenCalled();
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
    // Anon UUID creation never happens for authenticated users
    expect(mockGetOrCreateAnonHouseholdId).not.toHaveBeenCalled();
  });

  // ── ensureHouseholdId: lazy creation ───────────────────────────────────────

  it("ensureHouseholdId creates UUID lazily when called (not on mount)", async () => {
    mockGetAnonHouseholdId.mockReturnValue(null);
    mockGetOrCreateAnonHouseholdId.mockReturnValue("lazy-created-uuid");

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    // Not yet created
    expect(result.current.householdId).toBe("");
    expect(mockGetOrCreateAnonHouseholdId).not.toHaveBeenCalled();

    // Explicitly call ensureHouseholdId (simulates user navigating to /cards/new)
    let returnedId: string | undefined;
    act(() => {
      returnedId = result.current.ensureHouseholdId();
    });

    // Now the UUID is created and state is updated
    expect(mockGetOrCreateAnonHouseholdId).toHaveBeenCalledOnce();
    expect(returnedId).toBe("lazy-created-uuid");
    expect(result.current.householdId).toBe("lazy-created-uuid");
  });

  it("ensureHouseholdId returns existing householdId without calling create (returning user)", async () => {
    mockGetAnonHouseholdId.mockReturnValue("already-exists-uuid");

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    let returnedId: string | undefined;
    act(() => {
      returnedId = result.current.ensureHouseholdId();
    });

    // No new UUID created — returned existing one
    expect(mockGetOrCreateAnonHouseholdId).not.toHaveBeenCalled();
    expect(returnedId).toBe("already-exists-uuid");
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
    expect(mockGetOrCreateAnonHouseholdId).not.toHaveBeenCalled();
  });

  // ── signOut: read-only anon UUID restoration ───────────────────────────────

  it("signOut restores anon householdId from read-only getAnonHouseholdId (no creation)", async () => {
    const mockSession = {
      user: { sub: "google-sub-def", email: "user@example.com", name: "User", picture: "" },
      access_token: "tok",
      id_token: "idtok",
      expires_at: Date.now() + 3600_000,
    };
    mockGetSession.mockReturnValue(mockSession);
    mockIsSessionValid.mockReturnValue(true);

    // Simulate user had an anon UUID before signing in
    mockGetAnonHouseholdId.mockReturnValue("pre-signin-anon-uuid");

    const mockLocation = { href: "" };
    Object.defineProperty(window, "location", { value: mockLocation, writable: true });

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    act(() => {
      result.current.signOut();
    });

    // Uses read-only anon UUID (does not call getOrCreateAnonHouseholdId)
    expect(mockGetOrCreateAnonHouseholdId).not.toHaveBeenCalled();
    expect(result.current.status).toBe("anonymous");
    expect(result.current.householdId).toBe("pre-signin-anon-uuid");
  });
});
