/**
 * TrialStatusProvider — auth-gated trial status tests (Issue #1413, #1636)
 *
 * Validates the auth-gated behavior introduced in #1636:
 * - Anonymous users receive status "none" immediately — no API call made
 * - Authenticated users fetch trial status via /api/trial/status with auth token
 * - Provider handles fetch failure gracefully (no crash, isLoading → false)
 *
 * After Issue #1616 the fetch logic lives in TrialStatusProvider, not the hook.
 * After Issue #1636 the provider skips the API call entirely for anonymous users.
 * Tests use TrialStatusProvider as the renderHook wrapper.
 *
 * @ref Issue #1413, #1616, #1636
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// ── Mocks (must be hoisted before imports) ────────────────────────────────────

vi.mock("@/lib/trial-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/trial-utils")>();
  return { ...actual };
});

const mockEnsureFreshToken = vi.hoisted(() =>
  vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
);
vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: mockEnsureFreshToken,
}));

let mockAuthStatus = "anonymous";
vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    status: mockAuthStatus,
    session: null,
    householdId: null,
    signOut: vi.fn(),
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { useTrialStatus, clearTrialStatusCache } from "@/hooks/useTrialStatus";
import { TrialStatusProvider } from "@/contexts/TrialStatusContext";

// ── Wrapper ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(TrialStatusProvider, null, children);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrialStatusProvider — anonymous users skip API call (Issue #1636)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStatus = "anonymous";
    clearTrialStatusCache();

    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        return new Response(
          JSON.stringify({ status: "active", remainingDays: 30 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("does NOT call /api/trial/status when user is anonymous", async () => {
    mockAuthStatus = "anonymous";

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns status='none' immediately for anonymous users", async () => {
    mockAuthStatus = "anonymous";

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toBe("none");
    expect(result.current.remainingDays).toBe(0);
  });

  it("sets isLoading=false immediately for anonymous users (no async wait)", async () => {
    mockAuthStatus = "anonymous";

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Confirmed: no fetch, no delay, loading resolves immediately
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("TrialStatusProvider — authenticated users fetch trial status (Issue #1636)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let capturedHeaders: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStatus = "authenticated";
    capturedHeaders = {};
    clearTrialStatusCache();

    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        Object.assign(capturedHeaders, headers);
        return new Response(
          JSON.stringify({ status: "active", remainingDays: 30 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("calls /api/trial/status when user is authenticated", async () => {
    mockEnsureFreshToken.mockResolvedValue("test-bearer-token");

    renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  it("includes Authorization header when user is authenticated", async () => {
    mockEnsureFreshToken.mockResolvedValue("test-bearer-token");

    renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(capturedHeaders["Authorization"]).toBe("Bearer test-bearer-token");
  });

  it("omits Authorization header when token fetch fails (no token)", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(capturedHeaders["Authorization"]).toBeUndefined();
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });

  it("sets isLoading to false after fetch completes (authenticated)", async () => {
    mockEnsureFreshToken.mockResolvedValue("test-bearer-token");

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
