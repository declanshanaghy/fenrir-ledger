/**
 * Vitest — Odin's Spear exit lifecycle + port-forward cleanup
 * Issue #1458: single Ctrl+C must exit cleanly
 *
 * odins-spear.mjs uses top-level await with side-effects and cannot be imported.
 * Tests mirror the logic with injectable dependencies, matching the pattern of
 * existing odins-spear-*.test.ts suites.
 *
 * Suites:
 *   1. Exit sequence — waitUntilExit → cleanup → redis.quit → process.exit(0)
 *   2. cleanupPortForward — kills proc, nulls ref, no-op when already clean
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── 1. Exit sequence ─────────────────────────────────────────────────────────
//
// Mirrors the 4-line block at the bottom of odins-spear.mjs (lines 3095-3099):
//
//   const { waitUntilExit } = render(h(SpearApp, { ... }));
//   await waitUntilExit();
//   cleanupPortForward();
//   await redis.quit().catch(() => {});
//   process.exit(0);

interface ExitSequenceDeps {
  waitUntilExit: () => Promise<void>;
  cleanupPortForward: () => void;
  redisQuit: () => Promise<void>;
  exit: (code: number) => void;
}

async function runExitSequence(deps: ExitSequenceDeps): Promise<void> {
  await deps.waitUntilExit();
  deps.cleanupPortForward();
  await deps.redisQuit().catch(() => {});
  deps.exit(0);
}

describe("Odin's Spear exit sequence — single Ctrl+C (issue #1458)", () => {
  let deps: { [K in keyof ExitSequenceDeps]: Mock };

  beforeEach(() => {
    deps = {
      waitUntilExit: vi.fn().mockResolvedValue(undefined),
      cleanupPortForward: vi.fn(),
      redisQuit: vi.fn().mockResolvedValue(undefined),
      exit: vi.fn(),
    };
  });

  it("calls cleanupPortForward after Ink exits (waitUntilExit resolves)", async () => {
    await runExitSequence(deps);
    expect(deps.cleanupPortForward).toHaveBeenCalledOnce();
  });

  it("calls process.exit(0) after cleanup — not exit(1) or exit(2)", async () => {
    await runExitSequence(deps);
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it("swallows redis.quit() errors — does not propagate to caller", async () => {
    deps.redisQuit.mockRejectedValue(new Error("Redis connection closed"));
    await expect(runExitSequence(deps)).resolves.toBeUndefined();
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it("calls exit exactly once — no double-exit race", async () => {
    await runExitSequence(deps);
    expect(deps.exit).toHaveBeenCalledTimes(1);
  });
});

// ─── 2. cleanupPortForward ────────────────────────────────────────────────────
//
// Mirrors cleanupPortForward() at lines 226-232 of odins-spear.mjs:
//
//   function cleanupPortForward() {
//     pfManagedByUs = false;   // prevent reconnect during shutdown
//     if (portForwardProc) {
//       portForwardProc.kill();
//       portForwardProc = null;
//     }
//   }

interface PortForwardState {
  proc: { kill: () => void } | null;
  pfManagedByUs: boolean;
}

function makeCleanupPortForward(state: PortForwardState) {
  return function cleanupPortForward() {
    state.pfManagedByUs = false;
    if (state.proc) {
      state.proc.kill();
      state.proc = null;
    }
  };
}

describe("cleanupPortForward — no orphaned processes (issue #1458)", () => {
  it("kills the port-forward process when one is running", () => {
    const kill = vi.fn();
    const state: PortForwardState = { proc: { kill }, pfManagedByUs: true };
    makeCleanupPortForward(state)();
    expect(kill).toHaveBeenCalledOnce();
  });

  it("nulls the proc reference after kill — prevents double-kill on re-entry", () => {
    const kill = vi.fn();
    const state: PortForwardState = { proc: { kill }, pfManagedByUs: true };
    makeCleanupPortForward(state)();
    expect(state.proc).toBeNull();
  });

  it("is a no-op when no port-forward is running — does not throw", () => {
    const state: PortForwardState = { proc: null, pfManagedByUs: false };
    expect(() => makeCleanupPortForward(state)()).not.toThrow();
  });

  it("sets pfManagedByUs to false to stop reconnect attempts during shutdown", () => {
    const state: PortForwardState = { proc: null, pfManagedByUs: true };
    makeCleanupPortForward(state)();
    expect(state.pfManagedByUs).toBe(false);
  });
});
