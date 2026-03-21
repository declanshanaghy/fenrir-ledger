/**
 * usePickerConfig — Hook integration tests
 *
 * Tests the Picker API key fetch hook: loading state, success,
 * authenticated vs anonymous behavior, and error handling.
 * Fingerprint (X-Trial-Fingerprint) was removed in issue #1634/#1636.
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

const mockFetch = vi.fn();

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
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
  it("fetches picker API key when authenticated", async () => {
    mockAuthStatus = "authenticated";
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

  it("does not send X-Trial-Fingerprint header (#1634/#1636: fingerprint removed)", async () => {
    mockAuthStatus = "authenticated";
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

    const callHeaders = (mockFetch.mock.calls[0][1] as { headers: Record<string, string> }).headers;
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
