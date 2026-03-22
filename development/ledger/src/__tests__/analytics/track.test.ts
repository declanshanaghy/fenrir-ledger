/**
 * track.test.ts
 *
 * Vitest suite for lib/analytics/track.ts — Issue #783.
 * Verifies no-op behavior when Umami is absent and correct delegation when present.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { track } from "@/lib/analytics/track";

// ── Helpers ───────────────────────────────────────────────────────────────────

function withUmami(fn: () => void) {
  const mockTrack = vi.fn();
  Object.defineProperty(window, "umami", {
    value: { track: mockTrack },
    writable: true,
    configurable: true,
  });
  fn();
  return mockTrack;
}

function withoutUmami(fn: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(window, "umami");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).umami;
  fn();
  if (descriptor) {
    Object.defineProperty(window, "umami", descriptor);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("track()", () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).umami;
  });

  // ── No-op when Umami is absent ──────────────────────────────────────────────

  it("does not throw when window.umami is undefined", () => {
    withoutUmami(() => {
      expect(() => track("auth-login")).not.toThrow();
    });
  });

  it("does not throw when window.umami is undefined for events with props", () => {
    withoutUmami(() => {
      expect(() => track("card-save", { method: "manual" })).not.toThrow();
    });
  });

  // ── Delegates to window.umami.track() when present ──────────────────────────

  it("calls window.umami.track with the event name", () => {
    const mockTrack = withUmami(() => {
      track("auth-login");
    });
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("auth-login", undefined);
  });

  it("passes card-save props correctly", () => {
    const mockTrack = withUmami(() => {
      track("card-save", { method: "manual" });
    });
    expect(mockTrack).toHaveBeenCalledWith("card-save", { method: "manual" });
  });

  it("passes card-save import method", () => {
    const mockTrack = withUmami(() => {
      track("card-save", { method: "import" });
    });
    expect(mockTrack).toHaveBeenCalledWith("card-save", { method: "import" });
  });

  it("passes sheet-import url method", () => {
    const mockTrack = withUmami(() => {
      track("sheet-import", { method: "url" });
    });
    expect(mockTrack).toHaveBeenCalledWith("sheet-import", { method: "url" });
  });

  it("passes sheet-import csv method", () => {
    const mockTrack = withUmami(() => {
      track("sheet-import", { method: "csv" });
    });
    expect(mockTrack).toHaveBeenCalledWith("sheet-import", { method: "csv" });
  });

  it("passes sheet-import picker method", () => {
    const mockTrack = withUmami(() => {
      track("sheet-import", { method: "picker" });
    });
    expect(mockTrack).toHaveBeenCalledWith("sheet-import", { method: "picker" });
  });

  it("passes subscription-convert props", () => {
    const mockTrack = withUmami(() => {
      track("subscription-convert", { tier: "karl" });
    });
    expect(mockTrack).toHaveBeenCalledWith("subscription-convert", { tier: "karl" });
  });

  it("passes easter-egg props with fragment number and name", () => {
    const mockTrack = withUmami(() => {
      track("easter-egg", { fragment: 1, name: "cats-footfall" });
    });
    expect(mockTrack).toHaveBeenCalledWith("easter-egg", {
      fragment: 1,
      name: "cats-footfall",
    });
  });

  it("passes easter-egg props for all 6 fragments", () => {
    const fragments = [
      { fragment: 1, name: "cats-footfall" },
      { fragment: 2, name: "womans-beard" },
      { fragment: 3, name: "mountain-roots" },
      { fragment: 4, name: "bear-sinews" },
      { fragment: 5, name: "fish-breath" },
      { fragment: 6, name: "bird-spittle" },
    ] as const;

    const mockTrack = vi.fn();
    Object.defineProperty(window, "umami", {
      value: { track: mockTrack },
      writable: true,
      configurable: true,
    });

    for (const props of fragments) {
      track("easter-egg", props);
    }

    expect(mockTrack).toHaveBeenCalledTimes(6);
    for (const props of fragments) {
      expect(mockTrack).toHaveBeenCalledWith("easter-egg", props);
    }
  });

  it("fires auth-signup with no props", () => {
    const mockTrack = withUmami(() => {
      track("auth-signup");
    });
    expect(mockTrack).toHaveBeenCalledWith("auth-signup", undefined);
  });

  it("fires valhalla-visit with no props", () => {
    const mockTrack = withUmami(() => {
      track("valhalla-visit");
    });
    expect(mockTrack).toHaveBeenCalledWith("valhalla-visit", undefined);
  });

  it("fires settings-visit with no props", () => {
    const mockTrack = withUmami(() => {
      track("settings-visit");
    });
    expect(mockTrack).toHaveBeenCalledWith("settings-visit", undefined);
  });

  it("calls umami.track exactly once per track() call", () => {
    const mockTrack = withUmami(() => {
      track("card-save", { method: "manual" });
    });
    expect(mockTrack).toHaveBeenCalledOnce();
  });
});
