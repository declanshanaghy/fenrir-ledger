/**
 * useCloudSync — Issue #1189: Graceful Firestore degradation
 *
 * Tests that connection-level errors (Firestore "Connection closed.", browser
 * "Failed to fetch", gRPC drops) are handled gracefully:
 *   - Status transitions to "offline" (not "error")
 *   - No error toast is shown
 *   - No uncaught promise rejections are thrown
 *   - isConnectionError() correctly classifies error messages
 *   - Real errors (403, 500 JSON, etc.) still go to "error" state
 *
 * Issue #1189
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useCloudSync,
  isConnectionError,
  CONNECTION_ERROR_SUBSTRINGS,
} from "@/hooks/useCloudSync";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEntitlement = { tier: "karl" as string, isActive: true };

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

const mockAuthContext = { status: "authenticated" as string };

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => mockAuthContext,
}));

const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("@/lib/storage", () => ({
  getRawAllCards: vi.fn().mockReturnValue([]),
  setAllCards: vi.fn(),
}));

vi.mock("@/lib/sync/migration", () => ({
  hasMigrated: vi.fn().mockReturnValue(true),
  runMigration: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_SESSION = { id_token: "tok-test", user: { sub: "hh-test" } };

function setSession() {
  localStorage.setItem("fenrir:auth", JSON.stringify(FAKE_SESSION));
}

function clearSession() {
  localStorage.removeItem("fenrir:auth");
}

// ── Unit tests: isConnectionError ──────────────────────────────────────────────

describe("isConnectionError", () => {
  it("returns true for 'Connection closed.'", () => {
    expect(isConnectionError("Connection closed.")).toBe(true);
  });

  it("returns true for 'connection closed' (lowercase)", () => {
    expect(isConnectionError("connection closed unexpectedly")).toBe(true);
  });

  it("returns true for 'Failed to fetch'", () => {
    expect(isConnectionError("Failed to fetch")).toBe(true);
  });

  it("returns true for 'NetworkError'", () => {
    expect(isConnectionError("NetworkError when attempting to fetch resource.")).toBe(true);
  });

  it("returns true for 'Network request failed'", () => {
    expect(isConnectionError("Network request failed")).toBe(true);
  });

  it("returns true for 'ECONNREFUSED'", () => {
    expect(isConnectionError("connect ECONNREFUSED 127.0.0.1:8080")).toBe(true);
  });

  it("returns true for 'ECONNRESET'", () => {
    expect(isConnectionError("read ECONNRESET")).toBe(true);
  });

  it("returns true for 'fetch failed'", () => {
    expect(isConnectionError("fetch failed")).toBe(true);
  });

  it("returns false for a 403 permission error", () => {
    expect(isConnectionError("Cloud sync is a Karl-tier feature.")).toBe(false);
  });

  it("returns false for a generic server error", () => {
    expect(isConnectionError("Sync failed due to a server error.")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isConnectionError("")).toBe(false);
  });

  it("covers all entries in CONNECTION_ERROR_SUBSTRINGS", () => {
    for (const substr of CONNECTION_ERROR_SUBSTRINGS) {
      expect(isConnectionError(`prefix ${substr} suffix`)).toBe(true);
    }
  });
});

// ── Integration tests: useCloudSync connection error handling ─────────────────

describe("useCloudSync — connection error graceful degradation (Issue #1189)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setSession();
    mockToast.error.mockClear();
    mockToast.success.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearSession();
    vi.restoreAllMocks();
  });

  it("transitions to 'offline' (not 'error') when fetch throws 'Connection closed.'", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Connection closed."));

    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("offline");
  });

  it("does NOT show an error toast for connection errors", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch"));

    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("transitions to 'offline' for 'NetworkError'", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(
      new Error("NetworkError when attempting to fetch resource.")
    );

    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("offline");
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("transitions to 'offline' for 'fetch failed' (Node.js fetch error)", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("fetch failed"));

    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("offline");
  });

  it("leaves errorMessage null when connection error occurs", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Connection closed."));

    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorCode).toBeNull();
  });

  it("does NOT schedule auto-retry for connection errors", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Connection closed."));

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await result.current.syncNow();
    });

    // Advance timers — no retry should fire
    await act(async () => {
      vi.advanceTimersByTime(35_000);
    });

    // setTimeout may be called for other reasons (synced → idle, retryIn countdown)
    // but fetch should only have been called ONCE (not twice from a retry).
    expect(global.fetch).toHaveBeenCalledTimes(1);

    setTimeoutSpy.mockRestore();
  });

  it("still shows 'error' state and toast for non-connection errors (403)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "forbidden",
        error_description: "Cloud sync is a Karl-tier feature.",
      }),
      status: 403,
    } as Response);

    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toContain("Karl-tier");
    expect(mockToast.error).toHaveBeenCalledTimes(1);
  });

  it("still shows 'error' state and toast for generic server errors (500)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "internal_error",
        error_description: "Sync failed due to a server error.",
      }),
      status: 500,
    } as Response);

    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("error");
    expect(mockToast.error).toHaveBeenCalledTimes(1);
  });
});
