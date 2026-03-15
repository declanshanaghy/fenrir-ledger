/**
 * usePickerConfig — Hook integration tests
 *
 * Tests the Picker API key fetch hook: loading state, success,
 * authenticated vs anonymous behavior, error handling, and
 * X-Trial-Fingerprint header for trial users (issue #1008).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePickerConfig } from "@/hooks/usePickerConfig";

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockAuthStatus = "anonymous";

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    status: mockAuthStatus,
    session: null,
    householdId: "test",
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("mock-token"),
}));

const { mockComputeFingerprint } = vi.hoisted(() => ({
  mockComputeFingerprint: vi.fn(),
}));

vi.mock("@/lib/trial-utils", () => ({
  computeFingerprint: mockComputeFingerprint,
}));

const mockFetch = vi.fn();

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  mockComputeFingerprint.mockReset();
  mockComputeFingerprint.mockResolvedValue(null);
  mockAuthStatus = "anonymous";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("usePickerConfig — Anonymous state", () => {
  it("returns null pickerApiKey when not authenticated", () => {
    mockAuthStatus = "anonymous";
    const { result } = renderHook(() => usePickerConfig());
    expect(result.current.pickerApiKey).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("is not loading when not authenticated", () => {
    mockAuthStatus = "anonymous";
    const { result } = renderHook(() => usePickerConfig());
    expect(result.current.isLoading).toBe(false);
  });
});

describe("usePickerConfig — Authenticated state", () => {
  it("fetches picker API key when authenticated (no fingerprint)", async () => {
    mockAuthStatus = "authenticated";
    mockComputeFingerprint.mockResolvedValue(null);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ pickerApiKey: "test-picker-key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.pickerApiKey).toBe("test-picker-key");
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith("/api/config/picker", {
      headers: { Authorization: "Bearer mock-token" },
    });
  });

  it("sends X-Trial-Fingerprint header when fingerprint is available", async () => {
    mockAuthStatus = "authenticated";
    mockComputeFingerprint.mockResolvedValue("abc123fingerprint");
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ pickerApiKey: "trial-picker-key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.pickerApiKey).toBe("trial-picker-key");
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/config/picker", {
      headers: {
        Authorization: "Bearer mock-token",
        "X-Trial-Fingerprint": "abc123fingerprint",
      },
    });
  });

  it("does not include X-Trial-Fingerprint when fingerprint is null", async () => {
    mockAuthStatus = "authenticated";
    mockComputeFingerprint.mockResolvedValue(null);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ pickerApiKey: "karl-key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.pickerApiKey).toBe("karl-key");
    });

    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders["X-Trial-Fingerprint"]).toBeUndefined();
  });

  it("remains null when fetch fails", async () => {
    mockAuthStatus = "authenticated";
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pickerApiKey).toBeNull();
  });

  it("remains null when response is not ok", async () => {
    mockAuthStatus = "authenticated";
    mockFetch.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pickerApiKey).toBeNull();
  });
});
