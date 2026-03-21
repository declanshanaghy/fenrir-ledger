/**
 * usePickerConfig — edge-case tests (Loki QA, issue #1008, updated #1636)
 *
 * X-Trial-Fingerprint and computeFingerprint were removed in #1634/#1636.
 * These tests verify the hook's robustness without fingerprint logic:
 *  1. No X-Trial-Fingerprint header is ever sent
 *  2. Fetch failures return null pickerApiKey gracefully
 *  3. Fetch is called on every authenticated mount (no stale caching)
 *
 * @ref #1008, #1634, #1636
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePickerConfig } from "@/hooks/usePickerConfig";

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockAuthStatus = "authenticated";

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    status: mockAuthStatus,
    session: null,
    householdId: "test-household",
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("mock-token-1008"),
}));

const mockFetch = vi.fn();

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  mockAuthStatus = "authenticated";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Edge case 1: X-Trial-Fingerprint header is always absent ──────────────────

describe("usePickerConfig — no X-Trial-Fingerprint header (#1636)", () => {
  it("does NOT send X-Trial-Fingerprint header on any authenticated request", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ pickerApiKey: "env-key-abc" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.pickerApiKey).toBe("env-key-abc");
    });

    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders["X-Trial-Fingerprint"]).toBeUndefined();
  });
});

// ── Edge case 2: fetch failure returns null key gracefully ─────────────────────

describe("usePickerConfig — fetch failure returns null gracefully", () => {
  it("returns null pickerApiKey when fetch throws a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network unavailable"));

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pickerApiKey).toBeNull();
  });
});

// ── Edge case 3: fetch is called on each authenticated mount ──────────────────

describe("usePickerConfig — fetch called on each authenticated mount (#1634)", () => {
  it("calls fetch each time the hook mounts in authenticated state", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ pickerApiKey: "key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // First mount
    const { unmount } = renderHook(() => usePickerConfig());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    unmount();

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ pickerApiKey: "key2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Second mount — fetch should be called again (no caching)
    renderHook(() => usePickerConfig());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
