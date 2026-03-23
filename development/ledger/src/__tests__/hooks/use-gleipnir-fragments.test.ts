/**
 * useGleipnirFragments — unit tests
 *
 * Tests localStorage reading, found/unfound state per fragment,
 * and SSR/private-mode safety.
 *
 * Issue: #1806
 * Author: FiremanDecko, Principal Engineer
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useGleipnirFragments } from "@/components/layout/AboutModal";

// ── helpers ──────────────────────────────────────────────────────────────────

function setFragment(n: number) {
  localStorage.setItem(`egg:gleipnir-${n}`, "1");
}

function clearAllFragments() {
  for (let i = 1; i <= 6; i++) {
    localStorage.removeItem(`egg:gleipnir-${i}`);
  }
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("useGleipnirFragments", () => {
  beforeEach(() => {
    clearAllFragments();
  });

  afterEach(() => {
    clearAllFragments();
    vi.restoreAllMocks();
  });

  it("returns 6 booleans all false when no keys set", () => {
    const { result } = renderHook(() => useGleipnirFragments());
    expect(result.current.found).toHaveLength(6);
    expect(result.current.found.every((v) => v === false)).toBe(true);
  });

  it("marks index 0 true when egg:gleipnir-1 is set", () => {
    setFragment(1);
    const { result } = renderHook(() => useGleipnirFragments());
    expect(result.current.found[0]).toBe(true);
  });

  it("marks index 1 true when egg:gleipnir-2 is set", () => {
    setFragment(2);
    const { result } = renderHook(() => useGleipnirFragments());
    expect(result.current.found[1]).toBe(true);
  });

  it("marks only the matching index true when a single fragment is found", () => {
    setFragment(4);
    const { result } = renderHook(() => useGleipnirFragments());
    expect(result.current.found[3]).toBe(true);
    // All others should be false
    const others = result.current.found.filter((_, i) => i !== 3);
    expect(others.every((v) => v === false)).toBe(true);
  });

  it("marks all 6 indices true when all keys are set", () => {
    for (let i = 1; i <= 6; i++) setFragment(i);
    const { result } = renderHook(() => useGleipnirFragments());
    expect(result.current.found.every((v) => v === true)).toBe(true);
  });

  it("returns false for a key set to '0' (only '1' counts as found)", () => {
    localStorage.setItem("egg:gleipnir-3", "0");
    const { result } = renderHook(() => useGleipnirFragments());
    expect(result.current.found[2]).toBe(false);
  });

  it("returns all false when localStorage.getItem throws (private mode)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: localStorage unavailable");
    });
    const { result } = renderHook(() => useGleipnirFragments());
    expect(result.current.found.every((v) => v === false)).toBe(true);
  });

  it("returns exactly 6 elements regardless of how many keys are set", () => {
    setFragment(1);
    setFragment(6);
    const { result } = renderHook(() => useGleipnirFragments());
    expect(result.current.found).toHaveLength(6);
  });
});
