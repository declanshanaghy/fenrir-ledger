/**
 * Loki QA — AuthContext household ID resolution (Issue #1910)
 *
 * Augments FiremanDecko's regression tests with edge cases:
 *  - ensureHouseholdId() for joined members returns owner's ID
 *  - ensureHouseholdId() for anonymous users returns ANON_HOUSEHOLD_ID
 *  - Anonymous user (no session): householdId is null
 *  - Session refresh failure: householdId remains null (not stale)
 *  - Two sessions on same device: signOut prevents leakage into ensureHouseholdId
 *
 * @ref Issue #1910
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { ANON_HOUSEHOLD_ID } from "@/lib/constants";

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
    user: { sub, email: `${sub}@example.com`, name: "User", picture: "" },
    access_token: "tok",
    id_token: "idtok",
    expires_at: Date.now() + 3600_000,
    refresh_token: "refresh",
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Loki QA — AuthContext household ID edge cases (#1910)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);
    mockRefreshSession.mockResolvedValue(null);
    mockGetEffectiveHouseholdId.mockImplementation((sub: string) => sub);

    const mockLocation = { href: "" };
    Object.defineProperty(window, "location", { value: mockLocation, writable: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── ensureHouseholdId for a joined member ──────────────────────────────────

  it("ensureHouseholdId returns owner household ID for a joined member", async () => {
    const session = makeSession("member-sub");
    mockGetSession.mockReturnValue(session);
    mockIsSessionValid.mockReturnValue(true);
    // member has joined owner's household
    mockGetEffectiveHouseholdId.mockImplementation((_sub: string) => "owner-hh-id");

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    expect(result.current.ensureHouseholdId()).toBe("owner-hh-id");
  });

  // ── ensureHouseholdId for anonymous user returns ANON_HOUSEHOLD_ID ─────────

  it("ensureHouseholdId returns ANON_HOUSEHOLD_ID when no session exists", async () => {
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.householdId).toBeNull();
    expect(result.current.ensureHouseholdId()).toBe(ANON_HOUSEHOLD_ID);
  });

  // ── Anonymous user: householdId null, no localStorage call ────────────────

  it("anonymous user: householdId is null and getEffectiveHouseholdId is not called", async () => {
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.householdId).toBeNull();
    expect(mockGetEffectiveHouseholdId).not.toHaveBeenCalled();
  });

  // ── Session refresh failure: householdId stays null ────────────────────────

  it("session refresh failure: householdId is null, not stale from previous user", async () => {
    const expiredSession = { ...makeSession("stale-sub"), expires_at: Date.now() - 1000 };
    mockGetSession.mockReturnValue(expiredSession);
    mockIsSessionValid.mockReturnValue(false);
    mockRefreshSession.mockResolvedValue(null); // refresh fails

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.householdId).toBeNull();
    // Should NOT fall through to setting householdId from a stale session
    expect(mockGetEffectiveHouseholdId).not.toHaveBeenCalled();
  });

  // ── Session refresh error thrown: householdId stays null ──────────────────

  it("session refresh throws error: householdId falls back to null (anonymous)", async () => {
    const expiredSession = { ...makeSession("errored-sub"), expires_at: Date.now() - 1000 };
    mockGetSession.mockReturnValue(expiredSession);
    mockIsSessionValid.mockReturnValue(false);
    mockRefreshSession.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.householdId).toBeNull();
    expect(result.current.ensureHouseholdId()).toBe(ANON_HOUSEHOLD_ID);
  });

  // ── signOut: ensureHouseholdId returns ANON_HOUSEHOLD_ID after sign-out ───

  it("after signOut, ensureHouseholdId returns ANON_HOUSEHOLD_ID (not stale household)", async () => {
    const session = makeSession("signed-in-sub");
    mockGetSession.mockReturnValue(session);
    mockIsSessionValid.mockReturnValue(true);
    mockGetEffectiveHouseholdId.mockImplementation((_sub: string) => "owner-hh-id");

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    // Confirm joined household active
    expect(result.current.ensureHouseholdId()).toBe("owner-hh-id");

    act(() => {
      result.current.signOut();
    });

    expect(result.current.status).toBe("anonymous");
    expect(result.current.householdId).toBeNull();
    // After signOut, ensureHouseholdId must NOT return the old joined household
    expect(result.current.ensureHouseholdId()).toBe(ANON_HOUSEHOLD_ID);
    expect(mockClearStoredHouseholdId).toHaveBeenCalledOnce();
  });

  // ── ensureHouseholdId for solo user returns own sub ───────────────────────

  it("ensureHouseholdId returns own sub for solo user (no joined household)", async () => {
    const session = makeSession("solo-sub-abc");
    mockGetSession.mockReturnValue(session);
    mockIsSessionValid.mockReturnValue(true);
    // solo user — effective ID equals own sub
    mockGetEffectiveHouseholdId.mockImplementation((sub: string) => sub);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    expect(result.current.ensureHouseholdId()).toBe("solo-sub-abc");
  });
});
