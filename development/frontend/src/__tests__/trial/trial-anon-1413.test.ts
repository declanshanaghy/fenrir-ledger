/**
 * useTrialStatus — anonymous access tests (Issue #1413)
 *
 * Validates the dual-path behavior introduced in #1413:
 * - Anonymous users (no token) can fetch trial status without an Authorization header
 * - Authenticated users still send the Authorization header
 * - Hook handles fetch failure gracefully (no crash, isLoading → false)
 * - Hook returns default status when fingerprint computation fails
 *
 * @ref Issue #1413
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// ── Mocks (must be hoisted before imports) ────────────────────────────────────

const VALID_FINGERPRINT = "a".repeat(64);

const mockComputeFingerprint = vi.hoisted(() =>
  vi.fn(() => Promise.resolve(VALID_FINGERPRINT)),
);
vi.mock("@/lib/trial-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/trial-utils")>();
  return {
    ...actual,
    computeFingerprint: mockComputeFingerprint,
  };
});

const mockEnsureFreshToken = vi.hoisted(() =>
  vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
);
vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: mockEnsureFreshToken,
}));

// ── Import hook after mocks ───────────────────────────────────────────────────

import { useTrialStatus, clearTrialStatusCache } from "@/hooks/useTrialStatus";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useTrialStatus — anonymous access (Issue #1413)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let capturedHeaders: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedHeaders = {};
    clearTrialStatusCache(); // clear module-level cache between tests

    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        Object.assign(capturedHeaders, headers);
        return new Response(
          JSON.stringify({ status: "active", remainingDays: 30 }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("omits Authorization header when user is anonymous (no token)", async () => {
    mockEnsureFreshToken.mockResolvedValue(null); // anonymous

    renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(capturedHeaders["Authorization"]).toBeUndefined();
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });

  it("includes Authorization header when user is authenticated", async () => {
    mockEnsureFreshToken.mockResolvedValue("test-bearer-token");

    renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(capturedHeaders["Authorization"]).toBe("Bearer test-bearer-token");
  });

  it("sets isLoading to false after fetch completes (anon)", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("returns default status when fingerprint computation returns null", async () => {
    mockComputeFingerprint.mockResolvedValueOnce(null as unknown as string);

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Fetch should NOT be called — hook bails when fingerprint is null
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.status).toBe("none");
    expect(result.current.remainingDays).toBe(0);
  });
});
