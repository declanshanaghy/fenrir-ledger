/**
 * useSheetImport — Hook integration tests
 *
 * Tests the import state machine: initial state, URL validation,
 * success/error transitions, cancel, and reset.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSheetImport } from "@/hooks/useSheetImport";
import type { ImportStep } from "@/hooks/useSheetImport";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock the auth refresh module
vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("mock-token"),
}));

// Mock trial-utils — keeps constants available to any transitive import
vi.mock("@/lib/trial-utils", () => ({
  LS_TRIAL_START_TOAST_SHOWN: "fenrir:trial-start-toast-shown",
  LS_TRIAL_DAY15_NUDGE_SHOWN: "fenrir:trial-day15-nudge-shown",
  LS_TRIAL_EXPIRY_MODAL_SHOWN: "fenrir:trial-expiry-modal-shown",
  LS_POST_TRIAL_BANNER_DISMISSED: "fenrir:post-trial-banner-dismissed",
  THRALL_CARD_LIMIT: 5,
  TRIAL_DURATION_DAYS: 30,
}));

// Mock global fetch
const mockFetch = vi.hoisted(() => vi.fn());

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useSheetImport — Initial state", () => {
  it("starts at the 'method' step", () => {
    const { result } = renderHook(() => useSheetImport());
    expect(result.current.step).toBe("method" satisfies ImportStep);
  });

  it("has empty URL", () => {
    const { result } = renderHook(() => useSheetImport());
    expect(result.current.url).toBe("");
  });

  it("has empty cards array", () => {
    const { result } = renderHook(() => useSheetImport());
    expect(result.current.cards).toEqual([]);
  });

  it("has no error state", () => {
    const { result } = renderHook(() => useSheetImport());
    expect(result.current.errorCode).toBeNull();
    expect(result.current.errorMessage).toBe("");
  });
});

describe("useSheetImport — URL validation", () => {
  it("rejects non-Google Sheets URL without making a fetch", async () => {
    const { result } = renderHook(() => useSheetImport());

    act(() => {
      result.current.setUrl("https://example.com/sheet");
    });

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.errorCode).toBe("INVALID_URL");
    expect(result.current.errorMessage).toContain("valid Google Sheets URL");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useSheetImport — Success flow", () => {
  it("transitions to preview on successful import", async () => {
    const mockCards = [
      { cardName: "Test Card", annualFee: 95, openDate: "2024-01-01" },
    ];

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ cards: mockCards }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => useSheetImport());

    act(() => {
      result.current.setUrl("https://docs.google.com/spreadsheets/d/abc123");
    });

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.step).toBe("preview");
    expect(result.current.cards).toEqual(mockCards);
  });
});

describe("useSheetImport — Error flow", () => {
  it("transitions to error on 401 response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => useSheetImport());

    act(() => {
      result.current.setUrl("https://docs.google.com/spreadsheets/d/abc");
    });

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.errorCode).toBe("FETCH_ERROR");
    expect(result.current.errorMessage).toContain("session has expired");
  });

  it("transitions to error on 402 (Karl tier required)", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "SUBSCRIPTION_REQUIRED", message: "Karl needed" } }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      )
    );

    const { result } = renderHook(() => useSheetImport());

    act(() => {
      result.current.setUrl("https://docs.google.com/spreadsheets/d/abc");
    });

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.errorCode).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("handles network failure gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useSheetImport());

    act(() => {
      result.current.setUrl("https://docs.google.com/spreadsheets/d/abc");
    });

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.errorCode).toBe("FETCH_ERROR");
  });
});

describe("useSheetImport — CSV submit", () => {
  it("sends CSV data to the import endpoint", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ cards: [{ cardName: "CSV Card" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => useSheetImport());

    await act(async () => {
      result.current.submitCsv("name,fee\nTest,100");
    });

    expect(result.current.step).toBe("preview");
    expect(mockFetch).toHaveBeenCalledOnce();
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.csv).toBe("name,fee\nTest,100");
  });
});

describe("useSheetImport — Cancel & Reset", () => {
  it("cancel returns to method step", () => {
    const { result } = renderHook(() => useSheetImport());

    act(() => {
      result.current.setStep("loading");
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.step).toBe("method");
  });

  it("reset clears error state and returns to method", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useSheetImport());

    act(() => {
      result.current.setUrl("https://docs.google.com/spreadsheets/d/abc");
    });

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.step).toBe("error");

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe("method");
    expect(result.current.errorCode).toBeNull();
    expect(result.current.errorMessage).toBe("");
  });
});
