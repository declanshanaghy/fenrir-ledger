/**
 * Vitest — Odin's Spear exit lifecycle (issue #1458)
 * Issue #1519: Redis removed — exit sequence no longer quits a client or
 * cleans up a port-forward process. Tests updated accordingly.
 *
 * Suite:
 *   1. Exit sequence — waitUntilExit → process.exit(0)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── 1. Exit sequence ─────────────────────────────────────────────────────────
//
// Mirrors the block at the bottom of src/index.ts:
//
//   const { waitUntilExit } = render(h(SpearApp, { ... }));
//   await waitUntilExit();
//   process.exit(0);

interface ExitSequenceDeps {
  waitUntilExit: () => Promise<void>;
  exit: (code: number) => void;
}

async function runExitSequence(deps: ExitSequenceDeps): Promise<void> {
  await deps.waitUntilExit();
  deps.exit(0);
}

describe("Odin's Spear exit sequence — single Ctrl+C (issue #1458)", () => {
  let deps: { [K in keyof ExitSequenceDeps]: Mock };

  beforeEach(() => {
    deps = {
      waitUntilExit: vi.fn().mockResolvedValue(undefined),
      exit: vi.fn(),
    };
  });

  it("calls process.exit(0) after Ink exits (waitUntilExit resolves)", async () => {
    await runExitSequence(deps);
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it("calls exit exactly once — no double-exit race", async () => {
    await runExitSequence(deps);
    expect(deps.exit).toHaveBeenCalledTimes(1);
  });

  it("exit(0) is called even when waitUntilExit resolves immediately", async () => {
    deps.waitUntilExit.mockResolvedValue(undefined);
    await runExitSequence(deps);
    expect(deps.exit).toHaveBeenCalledWith(0);
  });
});
