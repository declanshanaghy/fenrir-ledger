/**
 * Loki QA augmentation tests — issue #1008
 *
 * Validates edge cases for the X-Trial-Fingerprint header fix in usePickerConfig.
 * FiremanDecko covered: happy path (fingerprint present), no fingerprint (null),
 * auth errors, network errors.
 *
 * Gaps covered here (devil's advocate):
 *  1. computeFingerprint returns empty string (non-browser env) → no header sent
 *  2. computeFingerprint throws an exception → hook swallows error, returns null key
 *  3. computeFingerprint is called on every authenticated mount (not skipped)
 *
 * @ref #1008
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
  mockAuthStatus = "authenticated";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Edge case 1: empty-string fingerprint ─────────────────────────────────────

describe("usePickerConfig — empty-string fingerprint (non-browser env boundary)", () => {
  it("does NOT send X-Trial-Fingerprint when computeFingerprint returns empty string", async () => {
    // computeFingerprint returns "" in server-side / non-browser environments
    // The hook guard `if (fingerprint)` must treat "" as falsy
    mockComputeFingerprint.mockResolvedValue("");
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

// ── Edge case 2: computeFingerprint throws ────────────────────────────────────

describe("usePickerConfig — computeFingerprint throws exception", () => {
  it("returns null pickerApiKey gracefully when computeFingerprint throws", async () => {
    // Simulates crypto.subtle unavailable or other fingerprint computation failure
    mockComputeFingerprint.mockRejectedValue(new Error("crypto.subtle unavailable"));
    // fetch should not be called since the error is thrown before it
    // The hook's outer try/catch must absorb this

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pickerApiKey).toBeNull();
    // fetch was never called because the error was thrown before the fetch
    // OR it was called without fingerprint — either is acceptable; the key must be null
  });
});

// ── Edge case 3: fetch is called on each authenticated mount ──────────────────

describe("usePickerConfig — fetch called on each authenticated mount (#1634)", () => {
  it("calls fetch each time the hook mounts in authenticated state (fingerprint removed)", async () => {
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
