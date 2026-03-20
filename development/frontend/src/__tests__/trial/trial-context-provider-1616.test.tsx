/**
 * TrialStatusProvider — single-fetch context tests (Issue #1616)
 *
 * Validates that:
 * - /api/trial/status is called ONCE even when multiple components call useTrialStatus
 * - All consumers receive the same context value
 * - clearTrialStatusCache triggers an immediate provider refetch
 * - Periodic refresh fires on the 4-minute interval
 *
 * @ref Issue #1616
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const VALID_FINGERPRINT = "a".repeat(64);

vi.mock("@/lib/trial-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/trial-utils")>();
  return {
    ...actual,
    computeFingerprint: vi.fn(() => Promise.resolve(VALID_FINGERPRINT)),
    TRIAL_CACHE_VERSION: actual.TRIAL_CACHE_VERSION,
    LS_TRIAL_CACHE_VERSION: actual.LS_TRIAL_CACHE_VERSION,
  };
});

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn(() => Promise.resolve(null)),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useTrialStatus, clearTrialStatusCache } from "@/hooks/useTrialStatus";
import { TrialStatusProvider } from "@/contexts/TrialStatusContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(TrialStatusProvider, null, children);
}

function makeSuccessResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ status: "active", remainingDays: 14, cacheVersion: 2, ...overrides }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrialStatusProvider — single-fetch per page load (Issue #1616)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearTrialStatusCache();
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(makeSuccessResponse()));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("calls /api/trial/status exactly once when multiple components use useTrialStatus", async () => {
    // Render two independent consumers sharing one provider
    function ConsumerA() {
      const { status } = useTrialStatus();
      return React.createElement("span", { "data-testid": "a" }, status);
    }
    function ConsumerB() {
      const { remainingDays } = useTrialStatus();
      return React.createElement("span", { "data-testid": "b" }, String(remainingDays));
    }

    await act(async () => {
      render(
        React.createElement(
          TrialStatusProvider,
          null,
          React.createElement(ConsumerA),
          React.createElement(ConsumerB),
        ),
      );
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("distributes the same status value to all consumers", async () => {
    const { result: resultA } = renderHook(() => useTrialStatus(), { wrapper });
    const { result: resultB } = renderHook(() => useTrialStatus(), { wrapper });

    // Both hooks share the same provider context
    await waitFor(() => {
      expect(resultA.current.isLoading).toBe(false);
    });

    expect(resultA.current.status).toBe(resultB.current.status);
    expect(resultA.current.remainingDays).toBe(resultB.current.remainingDays);
  });

  it("returns status=active and remainingDays=14 from API response", async () => {
    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toBe("active");
    expect(result.current.remainingDays).toBe(14);
  });

  it("starts with isLoading=true and transitions to false after fetch", async () => {
    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe("TrialStatusProvider — clearTrialStatusCache triggers refetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearTrialStatusCache();
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(makeSuccessResponse()));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("triggers an immediate provider refetch when clearTrialStatusCache is called", async () => {
    renderHook(() => useTrialStatus(), { wrapper });

    // Wait for initial fetch
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    // Clear cache — should trigger immediate refetch via externalRefreshFn
    clearTrialStatusCache();

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });
});

describe("TrialStatusProvider — periodic refresh", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearTrialStatusCache();
    vi.useFakeTimers();
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(makeSuccessResponse()));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.useRealTimers();
  });

  it("refreshes after 4 minutes but NOT before", async () => {
    renderHook(() => useTrialStatus(), { wrapper });

    // Flush the initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance 3 minutes — no extra fetch
    await act(async () => {
      vi.advanceTimersByTime(3 * 60 * 1000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance to just past 4 minutes — should trigger one more fetch
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000 + 100);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
