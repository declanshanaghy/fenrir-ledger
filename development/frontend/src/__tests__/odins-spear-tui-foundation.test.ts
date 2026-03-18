/**
 * Vitest — Odin's Spear TUI Foundation
 * Issue #1386: Ink-based TUI — tab cycling, keyboard routing, connection status, counts fallback
 *
 * odins-spear.mjs uses top-level await with side-effects and cannot be imported.
 * Tests mirror the logic with injectable dependencies, matching the pattern of
 * existing odins-spear-*.test.ts suites.
 *
 * Suites:
 *   1. Tab cycling logic — `(t + 1) % TUI_TABS.length`
 *   2. Keyboard input routing — q/?/Tab/^R/any-key state transitions
 *   3. Connection status computation — getStripeKey().then(Boolean).catch(false)
 *   4. Initial counts load — graceful fallback on Firestore error
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── 1. Tab cycling logic ─────────────────────────────────────────────────────
//
// Mirrors: setActiveTab((t) => (t + 1) % TUI_TABS.length)
// where TUI_TABS = ["Users", "Households"]

const TUI_TABS_COUNT = 2; // ["Users", "Households"]

function nextTab(current: number): number {
  return (current + 1) % TUI_TABS_COUNT;
}

describe("TUI tab cycling — (t + 1) % TUI_TABS.length (issue #1386)", () => {
  it("advances from tab 0 (Users) to tab 1 (Households)", () => {
    expect(nextTab(0)).toBe(1);
  });

  it("wraps from last tab (Households) back to tab 0 (Users)", () => {
    expect(nextTab(1)).toBe(0);
  });

  it("cycling twice through all tabs returns to origin", () => {
    let t = 0;
    for (let i = 0; i < TUI_TABS_COUNT; i++) t = nextTab(t);
    expect(t).toBe(0);
  });

  it("produces exactly TUI_TABS_COUNT unique values in a full cycle", () => {
    const seen = new Set<number>();
    let t = 0;
    for (let i = 0; i < TUI_TABS_COUNT; i++) {
      seen.add(t);
      t = nextTab(t);
    }
    expect(seen.size).toBe(TUI_TABS_COUNT);
  });

  it("never produces a negative index", () => {
    for (let t = 0; t < TUI_TABS_COUNT; t++) {
      expect(nextTab(t)).toBeGreaterThanOrEqual(0);
    }
  });

  it("never produces an out-of-bounds index", () => {
    for (let t = 0; t < TUI_TABS_COUNT; t++) {
      expect(nextTab(t)).toBeLessThan(TUI_TABS_COUNT);
    }
  });
});

// ─── 2. Keyboard input routing ────────────────────────────────────────────────
//
// Mirrors the useInput handler in SpearApp:
//   q          → call quit (exit + cleanup)
//   ?          → setShowHelp(v => !v)
//   key.tab    → setActiveTab((t) => (t + 1) % TUI_TABS.length)
//   key.ctrl+r → noop (placeholder)
//   any key    → if (showHelp) setShowHelp(false)

interface KeyModifiers {
  tab?: boolean;
  ctrl?: boolean;
}

interface InputHandlerDeps {
  quit: () => void;
  setShowHelp: (updater: (prev: boolean) => boolean) => void;
  setActiveTab: (updater: (prev: number) => number) => void;
  showHelp: boolean;
}

function handleInput(
  input: string,
  key: KeyModifiers,
  deps: InputHandlerDeps
): void {
  if (input === "q") {
    deps.quit();
    return;
  }
  if (input === "?") {
    deps.setShowHelp((v) => !v);
    return;
  }
  if (key.tab) {
    deps.setActiveTab((t) => (t + 1) % TUI_TABS_COUNT);
    return;
  }
  if (key.ctrl && input === "r") {
    // ^R: placeholder noop
    return;
  }
  if (deps.showHelp) {
    deps.setShowHelp(() => false);
  }
}

describe("TUI keyboard input routing (issue #1386)", () => {
  let deps: { [K in keyof InputHandlerDeps]: Mock };

  beforeEach(() => {
    deps = {
      quit: vi.fn(),
      setShowHelp: vi.fn(),
      setActiveTab: vi.fn(),
      showHelp: vi.fn(),
    };
    (deps as unknown as InputHandlerDeps).showHelp = false;
  });

  // ── q → quit ───────────────────────────────────────────────────────────────

  describe("q key", () => {
    it("calls quit handler", () => {
      handleInput("q", {}, deps as unknown as InputHandlerDeps);
      expect(deps.quit).toHaveBeenCalledTimes(1);
    });

    it("does NOT toggle help or switch tab", () => {
      handleInput("q", {}, deps as unknown as InputHandlerDeps);
      expect(deps.setShowHelp).not.toHaveBeenCalled();
      expect(deps.setActiveTab).not.toHaveBeenCalled();
    });
  });

  // ── ? → toggle help ────────────────────────────────────────────────────────

  describe("? key — toggle help overlay", () => {
    it("calls setShowHelp when help is closed", () => {
      (deps as unknown as InputHandlerDeps).showHelp = false;
      handleInput("?", {}, deps as unknown as InputHandlerDeps);
      expect(deps.setShowHelp).toHaveBeenCalledTimes(1);
    });

    it("passes a toggler function that flips false → true", () => {
      handleInput("?", {}, deps as unknown as InputHandlerDeps);
      const updater = (deps.setShowHelp as Mock).mock.calls[0][0] as (v: boolean) => boolean;
      expect(updater(false)).toBe(true);
    });

    it("passes a toggler function that flips true → false", () => {
      handleInput("?", {}, deps as unknown as InputHandlerDeps);
      const updater = (deps.setShowHelp as Mock).mock.calls[0][0] as (v: boolean) => boolean;
      expect(updater(true)).toBe(false);
    });

    it("does NOT quit or switch tab", () => {
      handleInput("?", {}, deps as unknown as InputHandlerDeps);
      expect(deps.quit).not.toHaveBeenCalled();
      expect(deps.setActiveTab).not.toHaveBeenCalled();
    });
  });

  // ── Tab key → advance tab ──────────────────────────────────────────────────

  describe("Tab key", () => {
    it("calls setActiveTab", () => {
      handleInput("", { tab: true }, deps as unknown as InputHandlerDeps);
      expect(deps.setActiveTab).toHaveBeenCalledTimes(1);
    });

    it("passes a cycling updater: advances from tab 0 to tab 1", () => {
      handleInput("", { tab: true }, deps as unknown as InputHandlerDeps);
      const updater = (deps.setActiveTab as Mock).mock.calls[0][0] as (t: number) => number;
      expect(updater(0)).toBe(1);
    });

    it("passes a cycling updater: wraps from last tab back to 0", () => {
      handleInput("", { tab: true }, deps as unknown as InputHandlerDeps);
      const updater = (deps.setActiveTab as Mock).mock.calls[0][0] as (t: number) => number;
      expect(updater(TUI_TABS_COUNT - 1)).toBe(0);
    });

    it("does NOT quit or toggle help", () => {
      handleInput("", { tab: true }, deps as unknown as InputHandlerDeps);
      expect(deps.quit).not.toHaveBeenCalled();
      expect(deps.setShowHelp).not.toHaveBeenCalled();
    });
  });

  // ── ^R → noop ─────────────────────────────────────────────────────────────

  describe("Ctrl+R key", () => {
    it("does not call quit, setShowHelp, or setActiveTab (placeholder stub)", () => {
      handleInput("r", { ctrl: true }, deps as unknown as InputHandlerDeps);
      expect(deps.quit).not.toHaveBeenCalled();
      expect(deps.setShowHelp).not.toHaveBeenCalled();
      expect(deps.setActiveTab).not.toHaveBeenCalled();
    });
  });

  // ── Any unrecognised key while help is open → close help ──────────────────

  describe("unrecognised key while help overlay is open", () => {
    beforeEach(() => {
      (deps as unknown as InputHandlerDeps).showHelp = true;
    });

    it("closes help overlay on unrecognised keypress", () => {
      handleInput("x", {}, deps as unknown as InputHandlerDeps);
      expect(deps.setShowHelp).toHaveBeenCalledTimes(1);
    });

    it("passes a falsy setter (closes help)", () => {
      handleInput("x", {}, deps as unknown as InputHandlerDeps);
      const setter = (deps.setShowHelp as Mock).mock.calls[0][0] as () => boolean;
      expect(setter()).toBe(false);
    });

    it("does not quit or switch tab on any-key dismiss", () => {
      handleInput("x", {}, deps as unknown as InputHandlerDeps);
      expect(deps.quit).not.toHaveBeenCalled();
      expect(deps.setActiveTab).not.toHaveBeenCalled();
    });
  });

  // ── Any unrecognised key while help is closed → noop ─────────────────────

  describe("unrecognised key while help overlay is closed", () => {
    it("does nothing when help is already closed", () => {
      (deps as unknown as InputHandlerDeps).showHelp = false;
      handleInput("z", {}, deps as unknown as InputHandlerDeps);
      expect(deps.quit).not.toHaveBeenCalled();
      expect(deps.setShowHelp).not.toHaveBeenCalled();
      expect(deps.setActiveTab).not.toHaveBeenCalled();
    });
  });
});

// ─── 3. Connection status computation ────────────────────────────────────────
//
// Mirrors:
//   stripe: await getStripeKey().then(Boolean).catch(() => false)

async function computeStripeStatus(
  getStripeKey: () => Promise<string | null>
): Promise<boolean> {
  return getStripeKey().then(Boolean).catch(() => false);
}

describe("TUI connection status — stripe boolean conversion (issue #1386)", () => {
  it("returns true when getStripeKey resolves with a valid key string", async () => {
    const getStripeKey = vi.fn().mockResolvedValue("sk_live_abc123xxxxxxxxxxxxxx");
    expect(await computeStripeStatus(getStripeKey)).toBe(true);
  });

  it("returns false when getStripeKey resolves with null", async () => {
    const getStripeKey = vi.fn().mockResolvedValue(null);
    expect(await computeStripeStatus(getStripeKey)).toBe(false);
  });

  it("returns false when getStripeKey resolves with empty string", async () => {
    const getStripeKey = vi.fn().mockResolvedValue("");
    expect(await computeStripeStatus(getStripeKey)).toBe(false);
  });

  it("returns false when getStripeKey rejects (kubectl not available, etc.)", async () => {
    const getStripeKey = vi.fn().mockRejectedValue(new Error("kubectl: command not found"));
    expect(await computeStripeStatus(getStripeKey)).toBe(false);
  });

  it("does not propagate exceptions — always resolves", async () => {
    const getStripeKey = vi.fn().mockRejectedValue(new Error("network timeout"));
    await expect(computeStripeStatus(getStripeKey)).resolves.toBeDefined();
  });
});

// ─── 4. Initial counts load ───────────────────────────────────────────────────
//
// Mirrors the top-level await block:
//   try {
//     const [uSnap, hSnap] = await Promise.all([userCount, householdCount]);
//     initialCounts = { users: uSnap.data().count, households: hSnap.data().count };
//   } catch { /* counts are informational — ignore on error */ }

interface CountSnapshot {
  data(): { count: number };
}

interface CountsDeps {
  getUserCount: () => Promise<CountSnapshot>;
  getHouseholdCount: () => Promise<CountSnapshot>;
}

async function loadInitialCounts(
  deps: CountsDeps
): Promise<{ users: number; households: number }> {
  let initialCounts = { users: 0, households: 0 };
  try {
    const [uSnap, hSnap] = await Promise.all([
      deps.getUserCount(),
      deps.getHouseholdCount(),
    ]);
    initialCounts = {
      users: uSnap.data().count,
      households: hSnap.data().count,
    };
  } catch {
    // counts are informational — ignore on error
  }
  return initialCounts;
}

describe("TUI initial counts load — graceful Firestore fallback (issue #1386)", () => {
  it("returns real counts when both collections succeed", async () => {
    const deps: CountsDeps = {
      getUserCount: vi.fn().mockResolvedValue({ data: () => ({ count: 42 }) }),
      getHouseholdCount: vi.fn().mockResolvedValue({ data: () => ({ count: 7 }) }),
    };
    const counts = await loadInitialCounts(deps);
    expect(counts).toEqual({ users: 42, households: 7 });
  });

  it("returns zeroed counts when user collection rejects", async () => {
    const deps: CountsDeps = {
      getUserCount: vi.fn().mockRejectedValue(new Error("PERMISSION_DENIED")),
      getHouseholdCount: vi.fn().mockResolvedValue({ data: () => ({ count: 3 }) }),
    };
    const counts = await loadInitialCounts(deps);
    expect(counts).toEqual({ users: 0, households: 0 });
  });

  it("returns zeroed counts when household collection rejects", async () => {
    const deps: CountsDeps = {
      getUserCount: vi.fn().mockResolvedValue({ data: () => ({ count: 10 }) }),
      getHouseholdCount: vi.fn().mockRejectedValue(new Error("UNAVAILABLE")),
    };
    const counts = await loadInitialCounts(deps);
    expect(counts).toEqual({ users: 0, households: 0 });
  });

  it("returns zeroed counts when both collections fail", async () => {
    const deps: CountsDeps = {
      getUserCount: vi.fn().mockRejectedValue(new Error("timeout")),
      getHouseholdCount: vi.fn().mockRejectedValue(new Error("timeout")),
    };
    const counts = await loadInitialCounts(deps);
    expect(counts).toEqual({ users: 0, households: 0 });
  });

  it("does not propagate the Firestore error — always resolves", async () => {
    const deps: CountsDeps = {
      getUserCount: vi.fn().mockRejectedValue(new Error("network error")),
      getHouseholdCount: vi.fn().mockRejectedValue(new Error("network error")),
    };
    await expect(loadInitialCounts(deps)).resolves.toBeDefined();
  });

  it("returns zero counts when both snapshots return count 0", async () => {
    const deps: CountsDeps = {
      getUserCount: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      getHouseholdCount: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
    };
    const counts = await loadInitialCounts(deps);
    expect(counts).toEqual({ users: 0, households: 0 });
  });
});
