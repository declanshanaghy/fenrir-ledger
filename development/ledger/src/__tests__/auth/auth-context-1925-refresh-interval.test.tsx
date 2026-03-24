/**
 * AuthContext — periodic refresh interval tests
 *
 * Validates the 50-minute proactive token refresh behavior added in issue #1925:
 *   - setInterval is registered when status becomes "authenticated"
 *   - interval callback calls refreshSession
 *   - session state is updated when refresh succeeds
 *   - interval is NOT registered for anonymous users
 *   - session remains unchanged when interval refresh returns null
 *
 * Uses direct setInterval spy rather than fake timers to avoid conflicts with
 * waitFor's internal setTimeout polling.
 *
 * @ref Issue #1925
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { FenrirSession } from "@/lib/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSession = vi.hoisted(() => vi.fn());
const mockIsSessionValid = vi.hoisted(() => vi.fn());
const mockClearSession = vi.hoisted(() => vi.fn());
const mockClearEntitlementCache = vi.hoisted(() => vi.fn());
const mockRefreshSession = vi.hoisted(() => vi.fn());
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
  refreshSession: mockRefreshSession,
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
    access_token: "ya29.access",
    id_token: "id.token.abc",
    refresh_token: "1//refresh",
    expires_at: Date.now() + 3600_000,
  };
}

const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AuthContext periodic refresh interval — issue #1925", () => {
  // Capture setInterval registrations for inspection
  let capturedIntervals: Array<{ callback: () => void; delay: number }> = [];
  let originalSetInterval: typeof setInterval;

  beforeEach(() => {
    capturedIntervals = [];
    mockGetSession.mockReset();
    mockIsSessionValid.mockReset();
    mockRefreshSession.mockReset();
    mockGetEffectiveHouseholdId.mockImplementation((sub: string) => sub);
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    // Spy on setInterval to capture registered callbacks
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

  it("registers a 50-minute setInterval when status becomes authenticated", async () => {
    mockGetSession.mockReturnValue(makeSession());
    mockIsSessionValid.mockReturnValue(true);
    mockRefreshSession.mockResolvedValue(null);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    // An interval with 50-minute delay should have been registered
    const refreshInterval = capturedIntervals.find(
      (i) => i.delay === REFRESH_INTERVAL_MS,
    );
    expect(refreshInterval).toBeDefined();
  });

  it("interval callback calls refreshSession", async () => {
    mockGetSession.mockReturnValue(makeSession());
    mockIsSessionValid.mockReturnValue(true);
    mockRefreshSession.mockResolvedValue(null);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    const refreshInterval = capturedIntervals.find(
      (i) => i.delay === REFRESH_INTERVAL_MS,
    );
    expect(refreshInterval).toBeDefined();

    // Manually invoke the interval callback (simulates 50 minutes passing)
    await act(async () => {
      await refreshInterval!.callback();
    });

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  it("updates session state when interval refresh returns new tokens", async () => {
    const originalSession = makeSession("user-abc");
    mockGetSession.mockReturnValue(originalSession);
    mockIsSessionValid.mockReturnValue(true);

    const renewedSession: FenrirSession = {
      ...makeSession("user-abc"),
      id_token: "new.id.token.after.interval.refresh",
    };
    mockRefreshSession.mockResolvedValue(renewedSession);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    const refreshInterval = capturedIntervals.find(
      (i) => i.delay === REFRESH_INTERVAL_MS,
    );
    expect(refreshInterval).toBeDefined();

    // Trigger interval
    await act(async () => {
      await refreshInterval!.callback();
    });

    expect(result.current.session?.id_token).toBe(
      "new.id.token.after.interval.refresh",
    );
  });

  it("does NOT register a 50-minute interval for anonymous users", async () => {
    mockGetSession.mockReturnValue(null);
    mockIsSessionValid.mockReturnValue(false);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("anonymous");
    });

    const refreshInterval = capturedIntervals.find(
      (i) => i.delay === REFRESH_INTERVAL_MS,
    );
    expect(refreshInterval).toBeUndefined();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it("leaves session unchanged when interval refresh returns null (revoked token)", async () => {
    const session = makeSession();
    mockGetSession.mockReturnValue(session);
    mockIsSessionValid.mockReturnValue(true);

    // Refresh returns null — simulates revoked refresh token
    mockRefreshSession.mockResolvedValue(null);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    const sessionBeforeInterval = result.current.session;

    const refreshInterval = capturedIntervals.find(
      (i) => i.delay === REFRESH_INTERVAL_MS,
    );
    expect(refreshInterval).toBeDefined();

    await act(async () => {
      await refreshInterval!.callback();
    });

    // Session unchanged — authFetch will handle the next 401 via signOutOnFailure
    expect(result.current.session).toBe(sessionBeforeInterval);
    expect(result.current.status).toBe("authenticated");
  });
});
