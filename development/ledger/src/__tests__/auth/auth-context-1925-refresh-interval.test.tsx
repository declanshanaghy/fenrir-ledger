/**
 * AuthContext — no-timer contract tests (issue #2060 regression)
 *
 * Validates that the 50-minute setInterval was removed in issue #2060:
 *   - NO setInterval is registered for authenticated users
 *   - NO setInterval is registered for anonymous users
 *   - Token refresh is handled server-side via X-Fenrir-Token sliding window
 *   - AuthContext reads Fenrir JWT from localStorage on mount (no background refresh)
 *
 * Original tests verified the interval existed (#1925).
 * After #2060, the requirement is inverted: the interval must NOT exist.
 *
 * @ref Issue #1925 (original), Issue #2060 (removal)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { FenrirSession } from "@/lib/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSession = vi.hoisted(() => vi.fn());
const mockIsSessionValid = vi.hoisted(() => vi.fn());
const mockClearSession = vi.hoisted(() => vi.fn());
const mockClearEntitlementCache = vi.hoisted(() => vi.fn());
const mockClearStoredHouseholdId = vi.hoisted(() => vi.fn());
const mockGetEffectiveHouseholdId = vi.hoisted(() => vi.fn((sub: string) => sub));

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
  refreshSession: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getEffectiveHouseholdId: mockGetEffectiveHouseholdId,
  clearStoredHouseholdId: mockClearStoredHouseholdId,
}));

// ─── Import under test ────────────────────────────────────────────────────────

import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

function makeSession(sub = "google-sub-abc"): FenrirSession {
  return {
    user: { sub, email: "odin@fenrir.dev", name: "Odin", picture: "" },
    fenrir_token: "fenrir-jwt-abc",
    access_token: "ya29.access",
    refresh_token: "1//refresh",
    expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AuthContext — no setInterval after issue #2060", () => {
  let capturedIntervals: Array<{ callback: () => void; delay: number }> = [];
  let originalSetInterval: typeof setInterval;

  beforeEach(() => {
    capturedIntervals = [];
    mockGetSession.mockReset();
    mockIsSessionValid.mockReset();
    mockGetEffectiveHouseholdId.mockImplementation((sub: string) => sub);

    // Spy on setInterval to detect any registrations
    originalSetInterval = globalThis.setInterval;
    globalThis.setInterval = vi.fn((cb: () => void, delay: number) => {
      capturedIntervals.push({ callback: cb, delay });
      return originalSetInterval(cb, delay);
    }) as unknown as typeof setInterval;
  });

  afterEach(() => {
    globalThis.setInterval = originalSetInterval;
    vi.clearAllMocks();
  });

  it("does NOT register any setInterval for authenticated users (issue #2060)", async () => {
    mockGetSession.mockReturnValue(makeSession());
    mockIsSessionValid.mockReturnValue(true);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    // After #2060: NO app-level setInterval should be registered
    // Fenrir JWT sliding window is server-side via X-Fenrir-Token header.
    // Filter out short-delay intervals (< 1s) used by testing library internals.
    const appIntervals = capturedIntervals.filter((i) => i.delay >= 1000);
    expect(appIntervals).toHaveLength(0);
  });

  it("does NOT register any setInterval for anonymous users", async () => {
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    const appIntervals = capturedIntervals.filter((i) => i.delay >= 1000);
    expect(appIntervals).toHaveLength(0);
  });

  it("loads authenticated session synchronously from localStorage on mount", async () => {
    const session = makeSession("user-xyz");
    mockGetSession.mockReturnValue(session);
    mockIsSessionValid.mockReturnValue(true);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    expect(result.current.session).toBe(session);
    expect(result.current.householdId).toBe("user-xyz");
  });

  it("sets anonymous state when session is invalid (expired Fenrir JWT)", async () => {
    mockGetSession.mockReturnValue({ ...makeSession(), expires_at: Date.now() - 1000 });
    mockIsSessionValid.mockReturnValue(false);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.householdId).toBeNull();
    // No app-level timer started — user must re-auth with Google
    const appIntervals = capturedIntervals.filter((i) => i.delay >= 1000);
    expect(appIntervals).toHaveLength(0);
  });

  it("sets anonymous state when no session exists", async () => {
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    expect(result.current.session).toBeNull();
    expect(result.current.householdId).toBeNull();
  });
});
