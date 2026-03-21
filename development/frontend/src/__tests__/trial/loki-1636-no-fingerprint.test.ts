/**
 * Loki QA — Issue #1636: auth-gated trial status, no fingerprint headers
 *
 * Verifies the acceptance criteria not already covered by FiremanDecko's tests:
 *  1. useSheetImport does NOT send X-Trial-Fingerprint in any request
 *  2. TrialStatusContext interval refresh only runs for authenticated users
 *  3. TrialStatusContext anonymous path never calls ensureFreshToken
 *
 * @ref Issue #1636
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("mock-fresh-token"),
}));

vi.mock("@/lib/trial-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/trial-utils")>();
  return { ...actual };
});

let mockAuthStatus = "anonymous";
vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    status: mockAuthStatus,
    session: null,
    householdId: null,
    signOut: vi.fn(),
  }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useSheetImport } from "@/hooks/useSheetImport";
import { useTrialStatus, clearTrialStatusCache } from "@/hooks/useTrialStatus";
import { TrialStatusProvider } from "@/contexts/TrialStatusContext";
import { ensureFreshToken } from "@/lib/auth/refresh-session";

const mockEnsureFreshToken = ensureFreshToken as ReturnType<typeof vi.fn>;

// ── Wrapper ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(TrialStatusProvider, null, children);
}

// ── useSheetImport header tests ───────────────────────────────────────────────

describe("useSheetImport — no X-Trial-Fingerprint header (#1636)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does NOT send X-Trial-Fingerprint header on URL import request", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ cards: [{ cardName: "Test" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useSheetImport());

    act(() => {
      result.current.setUrl("https://docs.google.com/spreadsheets/d/abc123");
    });

    await act(async () => {
      result.current.submit();
    });

    expect(mockFetch).toHaveBeenCalled();
    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders["X-Trial-Fingerprint"]).toBeUndefined();
  });

  it("does NOT send X-Trial-Fingerprint header on CSV import request", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ cards: [{ cardName: "CSV Card" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useSheetImport());

    await act(async () => {
      result.current.submitCsv("name,fee\nTest Card,95");
    });

    expect(mockFetch).toHaveBeenCalled();
    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders["X-Trial-Fingerprint"]).toBeUndefined();
  });

  it("sends Authorization Bearer token on URL import (auth-only header)", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ cards: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useSheetImport());

    act(() => {
      result.current.setUrl("https://docs.google.com/spreadsheets/d/abc123");
    });

    await act(async () => {
      result.current.submit();
    });

    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders["Authorization"]).toBe("Bearer mock-fresh-token");
  });
});

// ── TrialStatusProvider — anonymous never calls ensureFreshToken ──────────────

describe("TrialStatusProvider — anonymous users never call ensureFreshToken (#1636)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStatus = "anonymous";
    clearTrialStatusCache();

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(
        JSON.stringify({ status: "active", remainingDays: 30 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("does not call ensureFreshToken for anonymous users", async () => {
    mockAuthStatus = "anonymous";
    mockEnsureFreshToken.mockClear();

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockEnsureFreshToken).not.toHaveBeenCalled();
  });
});

// ── TrialStatusProvider — authenticated path uses token, no fingerprint ────────

describe("TrialStatusProvider — authenticated fetch has no X-Trial-Fingerprint (#1636)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let capturedHeaders: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStatus = "authenticated";
    capturedHeaders = {};
    clearTrialStatusCache();
    mockEnsureFreshToken.mockResolvedValue("auth-token-abc");

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      Object.assign(capturedHeaders, (init?.headers ?? {}) as Record<string, string>);
      return new Response(
        JSON.stringify({ status: "active", remainingDays: 14 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("never sends X-Trial-Fingerprint in the trial status request", async () => {
    renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(capturedHeaders["X-Trial-Fingerprint"]).toBeUndefined();
  });

  it("sends only Authorization and Content-Type headers for trial status", async () => {
    renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(capturedHeaders["Authorization"]).toBe("Bearer auth-token-abc");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(capturedHeaders["X-Trial-Fingerprint"]).toBeUndefined();
  });
});
