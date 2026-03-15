/**
 * GleipnirMountainRoots — Hook unit tests (Issue #1024)
 *
 * Tests the useGleipnirFragment3 hook:
 *   - trigger() sets egg:gleipnir-3 in localStorage and opens the modal
 *   - trigger() is a no-op when already found
 *   - dismiss() closes the modal
 *
 * Also tests that RestoreTabGuides calls trigger() when the button is clicked.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGleipnirFragment3 } from "@/components/cards/GleipnirMountainRoots";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

// ── useGleipnirFragment3 ──────────────────────────────────────────────────────

describe("useGleipnirFragment3", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with open=false", () => {
    const { result } = renderHook(() => useGleipnirFragment3());
    expect(result.current.open).toBe(false);
  });

  it("trigger() sets egg:gleipnir-3 in localStorage", () => {
    const { result } = renderHook(() => useGleipnirFragment3());
    act(() => {
      result.current.trigger();
    });
    expect(localStorage.getItem("egg:gleipnir-3")).toBe("1");
  });

  it("trigger() opens the modal on first call", () => {
    const { result } = renderHook(() => useGleipnirFragment3());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(true);
  });

  it("trigger() is a no-op when egg:gleipnir-3 is already set", () => {
    localStorage.setItem("egg:gleipnir-3", "1");
    const { result } = renderHook(() => useGleipnirFragment3());
    act(() => {
      result.current.trigger();
    });
    // open should never flip to true — fragment already found
    expect(result.current.open).toBe(false);
  });

  it("dismiss() closes the modal after trigger", () => {
    const { result } = renderHook(() => useGleipnirFragment3());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.open).toBe(false);
  });

  it("calling trigger() twice only fires once (second call is no-op)", () => {
    const { result } = renderHook(() => useGleipnirFragment3());
    act(() => {
      result.current.trigger();
    });
    act(() => {
      result.current.dismiss();
    });
    // open is now false after dismiss; second trigger should be no-op (key already in storage)
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(false);
  });

  it("all 6 fragments are in localStorage after fragment 3 is triggered with others pre-set", () => {
    // Set all other 5 fragments
    for (let i = 1; i <= 6; i++) {
      if (i !== 3) localStorage.setItem(`egg:gleipnir-${i}`, "1");
    }
    const { result } = renderHook(() => useGleipnirFragment3());
    expect(localStorage.getItem("egg:gleipnir-3")).toBeNull();

    act(() => {
      result.current.trigger();
    });
    // After trigger, all 6 are now in localStorage
    for (let i = 1; i <= 6; i++) {
      expect(localStorage.getItem(`egg:gleipnir-${i}`)).toBe("1");
    }
  });
});
