/**
 * AuthContext — household ID resolution regression tests (Issue #1910)
 *
 * Verifies that AuthContext resolves householdId through getEffectiveHouseholdId()
 * so household members see the owner's cards instead of an empty dashboard.
 *
 * @ref Issue #1910
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSession = vi.hoisted(() => vi.fn());
const mockIsSessionValid = vi.hoisted(() => vi.fn());
const mockClearSession = vi.hoisted(() => vi.fn());
const mockClearEntitlementCache = vi.hoisted(() => vi.fn());
const mockRefreshSession = vi.hoisted(() => vi.fn());
const mockGetEffectiveHouseholdId = vi.hoisted(() => vi.fn());
const mockClearStoredHouseholdId = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/storage", () => ({
  getEffectiveHouseholdId: mockGetEffectiveHouseholdId,
  clearStoredHouseholdId: mockClearStoredHouseholdId,
}));

// ─── Import under test ────────────────────────────────────────────────────────

import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

function makeSession(sub: string) {
  return {
    user: { sub, email: "user@example.com", name: "User", picture: "" },
    access_token: "tok",
    id_token: "idtok",
    expires_at: Date.now() + 3600_000,
    refresh_token: "refresh",
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AuthContext — household ID resolution via getEffectiveHouseholdId (#1910)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);
    mockRefreshSession.mockResolvedValue(null);
    // Default: solo user — effective ID equals user.sub
    mockGetEffectiveHouseholdId.mockImplementation((sub: string) => sub);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Solo user: householdId falls back to own sub ───────────────────────────

  it("solo user: householdId equals session.user.sub when no joined household stored", async () => {
    const session = makeSession("solo-user-sub");
    mockGetSession.mockReturnValue(session);
    mockIsSessionValid.mockReturnValue(true);
    // No joined household stored — getEffectiveHouseholdId returns fallback
    mockGetEffectiveHouseholdId.mockImplementation((sub: string) => sub);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    expect(result.current.householdId).toBe("solo-user-sub");
    expect(mockGetEffectiveHouseholdId).toHaveBeenCalledWith("solo-user-sub");
  });

  // ── Household member: householdId resolves to owner's ID ──────────────────

  it("household member: householdId resolves to owner ID from getEffectiveHouseholdId", async () => {
    const session = makeSession("member-sub");
    mockGetSession.mockReturnValue(session);
    mockIsSessionValid.mockReturnValue(true);
    // Joined household stored — getEffectiveHouseholdId returns owner's ID
    mockGetEffectiveHouseholdId.mockImplementation((_sub: string) => "owner-household-id");

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    expect(result.current.householdId).toBe("owner-household-id");
    expect(mockGetEffectiveHouseholdId).toHaveBeenCalledWith("member-sub");
  });

  // ── Session refresh path also uses getEffectiveHouseholdId ────────────────

  it("session refresh path: householdId resolved through getEffectiveHouseholdId", async () => {
    const expiredSession = { ...makeSession("member-sub"), expires_at: Date.now() - 1000 };
    const refreshedSession = makeSession("member-sub");
    mockGetSession.mockReturnValue(expiredSession);
    mockIsSessionValid.mockReturnValue(false);
    mockRefreshSession.mockResolvedValue(refreshedSession);
    mockGetEffectiveHouseholdId.mockImplementation((_sub: string) => "owner-household-id");

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    expect(result.current.householdId).toBe("owner-household-id");
    expect(mockGetEffectiveHouseholdId).toHaveBeenCalledWith("member-sub");
  });

  // ── signOut: clears stored household ID ───────────────────────────────────

  it("signOut calls clearStoredHouseholdId to prevent cross-user leakage", async () => {
    const session = makeSession("owner-sub");
    mockGetSession.mockReturnValue(session);
    mockIsSessionValid.mockReturnValue(true);
    mockGetEffectiveHouseholdId.mockImplementation((sub: string) => sub);

    const mockLocation = { href: "" };
    Object.defineProperty(window, "location", { value: mockLocation, writable: true });

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    act(() => {
      result.current.signOut();
    });

    expect(mockClearStoredHouseholdId).toHaveBeenCalledOnce();
    expect(result.current.householdId).toBeNull();
    expect(result.current.status).toBe("anonymous");
  });

  // ── getEffectiveHouseholdId called with correct sub as fallback ───────────

  it("passes session.user.sub as fallback to getEffectiveHouseholdId", async () => {
    const session = makeSession("google-sub-xyz");
    mockGetSession.mockReturnValue(session);
    mockIsSessionValid.mockReturnValue(true);
    mockGetEffectiveHouseholdId.mockImplementation((sub: string) => sub);

    renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(mockGetEffectiveHouseholdId).toHaveBeenCalled();
    });

    expect(mockGetEffectiveHouseholdId).toHaveBeenCalledWith("google-sub-xyz");
  });
});
