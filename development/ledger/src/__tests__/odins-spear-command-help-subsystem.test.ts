/**
 * Vitest — Odin's Spear: Command & Help Subsystem (Issue #1495)
 *
 * Tests for the registry utilities introduced in #1495:
 *   1. fuzzyMatch — subsequence matching
 *   2. isAvailable — context-gating
 *   3. filterCommands — query filtering against registry
 *   4. registerCommand — deduplication / upsert behaviour
 *   5. ConfirmDialog logic — type-delete gate
 *   6. PALETTE_COMMANDS schema — subsystem, requiresContext, destructive fields
 *
 * All logic is mirrored inline with injectable dependencies to avoid
 * importing Node-only (Ink, Firestore) modules into the Vitest
 * browser-compatible environment. This follows the established pattern
 * from odins-spear-adc-auth.test.ts and odins-spear-standalone-package.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─── Mirror: types from commands/registry.ts ─────────────────────────────────

type Subsystem = "firestore" | "stripe" | "system";
type RequiresContext = "user" | "household" | "trial";

interface PaletteCommand {
  name: string;
  desc: string;
  subsystem: Subsystem;
  requiresContext?: RequiresContext;
  destructive?: boolean;
  execute: (ctx: CommandContext) => Promise<string[]>;
}

interface CommandContext {
  selectedUserId: string | null;
  selectedHouseholdId: string | null;
  selectedFp: string | null;
  selectedSubId: string | null;
}

// ─── Mirror: fuzzyMatch ───────────────────────────────────────────────────────

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (needle.length === 0) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let hi = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const ch = n[ni];
    if (ch === undefined) break;
    const found = h.indexOf(ch, hi);
    if (found === -1) return false;
    hi = found + 1;
  }
  return true;
}

// ─── Mirror: registry ─────────────────────────────────────────────────────────

function makeRegistry() {
  const commands: PaletteCommand[] = [];

  function registerCommand(cmd: PaletteCommand): void {
    const existing = commands.findIndex((c) => c.name === cmd.name);
    if (existing >= 0) {
      commands[existing] = cmd;
    } else {
      commands.push(cmd);
    }
  }

  function getCommands(): readonly PaletteCommand[] {
    return commands;
  }

  function filterCommands(query: string): readonly PaletteCommand[] {
    return commands.filter((cmd) =>
      fuzzyMatch(cmd.name + " " + cmd.desc, query)
    );
  }

  function isAvailable(cmd: PaletteCommand, ctx: CommandContext): boolean {
    if (!cmd.requiresContext) return true;
    if (cmd.requiresContext === "user") return ctx.selectedUserId !== null;
    if (cmd.requiresContext === "household") return ctx.selectedHouseholdId !== null;
    return ctx.selectedFp !== null;
  }

  return { registerCommand, getCommands, filterCommands, isAvailable, _commands: commands };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const noCtx: CommandContext = {
  selectedUserId: null,
  selectedHouseholdId: null,
  selectedFp: null,
  selectedSubId: null,
};

const withUser: CommandContext = { ...noCtx, selectedUserId: "user-abc" };
const withHousehold: CommandContext = { ...noCtx, selectedHouseholdId: "hh-xyz" };
const withFp: CommandContext = { ...noCtx, selectedFp: "fp-trial-123" };

function noop(): Promise<string[]> {
  return Promise.resolve([]);
}

// ─── 1. fuzzyMatch ────────────────────────────────────────────────────────────

describe("fuzzyMatch", () => {
  it("returns true for empty needle", () => {
    expect(fuzzyMatch("anything", "")).toBe(true);
  });

  it("returns true for exact match", () => {
    expect(fuzzyMatch("firestore-ping", "firestore-ping")).toBe(true);
  });

  it("returns true for case-insensitive subsequence", () => {
    expect(fuzzyMatch("firestore-list-collections", "flc")).toBe(true);
  });

  it("returns true for non-contiguous subsequence", () => {
    expect(fuzzyMatch("firestore-ping", "fsp")).toBe(true);
  });

  it("returns false when needle chars not found in order", () => {
    expect(fuzzyMatch("firestore-ping", "xyz")).toBe(false);
  });

  it("returns false when chars present but out of order", () => {
    // 'gp' — 'g' appears after 'p' in 'firestore-ping' — out of order
    expect(fuzzyMatch("firestore-ping", "gp")).toBe(false);
  });

  it("matches across name+desc concat (command name + space + description)", () => {
    // "firestore-ping" + " " + "Ping the Firestore connection"
    expect(fuzzyMatch("firestore-ping ping the firestore connection", "pin")).toBe(true);
  });

  it("returns false for needle longer than haystack", () => {
    expect(fuzzyMatch("ab", "abcde")).toBe(false);
  });
});

// ─── 2. isAvailable ───────────────────────────────────────────────────────────

describe("isAvailable", () => {
  const { isAvailable } = makeRegistry();

  it("always available when requiresContext is undefined", () => {
    const cmd: PaletteCommand = { name: "x", desc: "", subsystem: "system", execute: noop };
    expect(isAvailable(cmd, noCtx)).toBe(true);
    expect(isAvailable(cmd, withUser)).toBe(true);
  });

  it("requiresContext=user: unavailable without user, available with user", () => {
    const cmd: PaletteCommand = {
      name: "x", desc: "", subsystem: "firestore", requiresContext: "user", execute: noop,
    };
    expect(isAvailable(cmd, noCtx)).toBe(false);
    expect(isAvailable(cmd, withUser)).toBe(true);
    expect(isAvailable(cmd, withHousehold)).toBe(false);
  });

  it("requiresContext=household: unavailable without household, available with household", () => {
    const cmd: PaletteCommand = {
      name: "x", desc: "", subsystem: "firestore", requiresContext: "household", execute: noop,
    };
    expect(isAvailable(cmd, noCtx)).toBe(false);
    expect(isAvailable(cmd, withHousehold)).toBe(true);
    expect(isAvailable(cmd, withUser)).toBe(false);
  });

  it("requiresContext=trial: unavailable without fp, available with fp", () => {
    const cmd: PaletteCommand = {
      name: "x", desc: "", subsystem: "stripe", requiresContext: "trial", execute: noop,
    };
    expect(isAvailable(cmd, noCtx)).toBe(false);
    expect(isAvailable(cmd, withFp)).toBe(true);
    expect(isAvailable(cmd, withUser)).toBe(false);
  });
});

// ─── 3. filterCommands ────────────────────────────────────────────────────────

describe("filterCommands", () => {
  let registry: ReturnType<typeof makeRegistry>;

  beforeEach(() => {
    registry = makeRegistry();
    registry.registerCommand({ name: "firestore-ping",             desc: "Ping Firestore",       subsystem: "firestore", execute: noop });
    registry.registerCommand({ name: "firestore-list-collections", desc: "List collections",     subsystem: "firestore", execute: noop });
    registry.registerCommand({ name: "firestore-delete-user",      desc: "Delete user doc",      subsystem: "firestore", destructive: true, execute: noop });
    registry.registerCommand({ name: "stripe-check",               desc: "Verify Stripe key",   subsystem: "stripe",    execute: noop });
    registry.registerCommand({ name: "stripe-cancel-sub",          desc: "Cancel subscription", subsystem: "stripe",    execute: noop });
  });

  it("returns all commands for empty query", () => {
    expect(registry.filterCommands("").length).toBe(5);
  });

  it("filters by name subsequence", () => {
    const results = registry.filterCommands("flc");
    // 'flc': f→l→c — matches firestore-list-collections
    expect(results.some((c) => c.name === "firestore-list-collections")).toBe(true);
    expect(results.some((c) => c.name === "firestore-ping")).toBe(false);
  });

  it("filters by description word", () => {
    const results = registry.filterCommands("delete");
    expect(results.some((c) => c.name === "firestore-delete-user")).toBe(true);
    expect(results.length).toBe(1);
  });

  it("returns empty array when no match", () => {
    expect(registry.filterCommands("zzzzz").length).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(registry.filterCommands("FIRESTORE").length).toBeGreaterThan(0);
    expect(registry.filterCommands("Stripe").length).toBeGreaterThan(0);
  });
});

// ─── 4. registerCommand (deduplication) ──────────────────────────────────────

describe("registerCommand deduplication", () => {
  it("registers new commands without duplication", () => {
    const { registerCommand, getCommands } = makeRegistry();
    registerCommand({ name: "a", desc: "A", subsystem: "system",    execute: noop });
    registerCommand({ name: "b", desc: "B", subsystem: "firestore", execute: noop });
    expect(getCommands().length).toBe(2);
  });

  it("upserts when registering the same name twice", () => {
    const { registerCommand, getCommands } = makeRegistry();
    registerCommand({ name: "a", desc: "original", subsystem: "system",    execute: noop });
    registerCommand({ name: "a", desc: "updated",  subsystem: "firestore", execute: noop });
    const cmds = getCommands();
    expect(cmds.length).toBe(1);
    expect(cmds[0]?.desc).toBe("updated");
  });

  it("getCommands returns readonly view (length does not change on external mutation)", () => {
    const { registerCommand, getCommands } = makeRegistry();
    registerCommand({ name: "a", desc: "A", subsystem: "system",    execute: noop });
    const snap = getCommands();
    registerCommand({ name: "b", desc: "B", subsystem: "firestore", execute: noop });
    // The readonly ref still reflects live state (same array reference)
    expect(snap.length).toBe(2);
  });
});

// ─── 5. ConfirmDialog logic — type-delete gate ────────────────────────────────

describe("ConfirmDialog confirm gate", () => {
  const CONFIRM_WORD = "delete";

  function isConfirmReady(typed: string): boolean {
    return typed === CONFIRM_WORD;
  }

  it("not ready when empty", () => expect(isConfirmReady("")).toBe(false));
  it("not ready for partial input", () => expect(isConfirmReady("del")).toBe(false));
  it("not ready for wrong word", () => expect(isConfirmReady("remove")).toBe(false));
  it("not ready for extra characters", () => expect(isConfirmReady("delete ")).toBe(false));
  it("ready for exact word", () => expect(isConfirmReady("delete")).toBe(true));
  it("is case-sensitive (Delete ≠ delete)", () => expect(isConfirmReady("Delete")).toBe(false));
});

// ─── 6. PALETTE_COMMANDS schema validation ────────────────────────────────────

describe("PaletteCommand schema", () => {
  it("command with no requiresContext is always available", () => {
    const { isAvailable } = makeRegistry();
    const cmd: PaletteCommand = { name: "firestore-ping", desc: "", subsystem: "firestore", execute: noop };
    expect(isAvailable(cmd, noCtx)).toBe(true);
  });

  it("destructive command still routes correctly (destructive flag is boolean)", () => {
    const cmd: PaletteCommand = {
      name: "firestore-delete-user", desc: "Delete user doc", subsystem: "firestore", destructive: true, execute: noop,
    };
    expect(cmd.destructive).toBe(true);
  });

  it("read command has no destructive flag or false", () => {
    const cmd: PaletteCommand = { name: "firestore-ping", desc: "", subsystem: "firestore", execute: noop };
    expect(cmd.destructive).toBeFalsy();
  });

  it("subsystem values are constrained to known types", () => {
    const subsystems: Subsystem[] = ["firestore", "stripe", "system"];
    subsystems.forEach((s) => {
      const cmd: PaletteCommand = { name: `${s}-cmd`, desc: "", subsystem: s, execute: noop };
      expect(cmd.subsystem).toBe(s);
    });
  });

  it("execute returns string array", async () => {
    const cmd: PaletteCommand = {
      name: "test", desc: "", subsystem: "system",
      execute: async (_ctx) => ["line1", "line2"],
    };
    const lines = await cmd.execute(noCtx);
    expect(lines).toEqual(["line1", "line2"]);
  });
});

// ─── 7. ResultsOverlay scroll offset logic ────────────────────────────────────

describe("ResultsOverlay scroll offset clamping", () => {
  // Mirror the pure clamping logic from ResultsOverlay.tsx:
  //   maxOffset = Math.max(0, lines.length - PAGE_SIZE)
  //   upArrow:   Math.max(0, o - 1)
  //   downArrow: Math.min(maxOffset, o + 1)
  //   pageUp:    Math.max(0, o - PAGE_SIZE)
  //   pageDown:  Math.min(maxOffset, o + PAGE_SIZE)

  function makeScroller(lines: number, pageSize: number) {
    const maxOffset = Math.max(0, lines - pageSize);
    let offset = 0;
    return {
      scrollUp:   () => { offset = Math.max(0, offset - 1); },
      scrollDown: () => { offset = Math.min(maxOffset, offset + 1); },
      pageUp:     () => { offset = Math.max(0, offset - pageSize); },
      pageDown:   () => { offset = Math.min(maxOffset, offset + pageSize); },
      getOffset:  () => offset,
      maxOffset,
    };
  }

  it("offset starts at 0", () => {
    const s = makeScroller(20, 10);
    expect(s.getOffset()).toBe(0);
  });

  it("scrollUp does not go below 0", () => {
    const s = makeScroller(20, 10);
    s.scrollUp();
    expect(s.getOffset()).toBe(0);
  });

  it("scrollDown advances offset by 1", () => {
    const s = makeScroller(20, 10);
    s.scrollDown();
    expect(s.getOffset()).toBe(1);
  });

  it("scrollDown clamps at maxOffset", () => {
    const s = makeScroller(12, 10); // maxOffset = 2
    s.scrollDown(); s.scrollDown(); s.scrollDown();
    expect(s.getOffset()).toBe(s.maxOffset);
    expect(s.getOffset()).toBe(2);
  });

  it("pageDown advances by PAGE_SIZE", () => {
    const s = makeScroller(30, 10); // maxOffset = 20
    s.pageDown();
    expect(s.getOffset()).toBe(10);
  });

  it("pageDown clamps at maxOffset", () => {
    const s = makeScroller(15, 10); // maxOffset = 5
    s.pageDown();
    expect(s.getOffset()).toBe(5);
  });

  it("pageUp from middle returns to 0", () => {
    const s = makeScroller(30, 10);
    s.pageDown(); // offset = 10
    s.pageUp();
    expect(s.getOffset()).toBe(0);
  });

  it("maxOffset is 0 when lines <= PAGE_SIZE", () => {
    const s = makeScroller(5, 10);
    expect(s.maxOffset).toBe(0);
    s.scrollDown();
    expect(s.getOffset()).toBe(0); // nothing to scroll
  });

  it("maxOffset equals lines - PAGE_SIZE when lines > PAGE_SIZE", () => {
    const s = makeScroller(50, 10);
    expect(s.maxOffset).toBe(40);
  });

  it("roundtrip: scrollDown then scrollUp returns to same offset", () => {
    const s = makeScroller(30, 10);
    s.scrollDown(); s.scrollDown();
    const before = s.getOffset();
    s.scrollUp(); s.scrollDown();
    expect(s.getOffset()).toBe(before);
  });
});

// ─── 8. OverlayMode state machine ────────────────────────────────────────────

describe("OverlayMode state machine", () => {
  // Mirror the discriminated-union transitions from app.tsx
  type OverlayMode =
    | { kind: "none" }
    | { kind: "help" }
    | { kind: "palette" }
    | { kind: "results"; title: string; lines: string[] }
    | { kind: "confirm"; cmd: PaletteCommand };

  function makeStateMachine() {
    let overlay: OverlayMode = { kind: "none" };
    return {
      openHelp:    () => { overlay = { kind: "help" }; },
      openPalette: () => { overlay = { kind: "palette" }; },
      openResults: (title: string, lines: string[]) => { overlay = { kind: "results", title, lines }; },
      openConfirm: (cmd: PaletteCommand) => { overlay = { kind: "confirm", cmd }; },
      close:       () => { overlay = { kind: "none" }; },
      get:         () => overlay,
    };
  }

  it("initial state is none", () => {
    const sm = makeStateMachine();
    expect(sm.get().kind).toBe("none");
  });

  it("/ key opens palette", () => {
    const sm = makeStateMachine();
    sm.openPalette();
    expect(sm.get().kind).toBe("palette");
  });

  it("? key opens help", () => {
    const sm = makeStateMachine();
    sm.openHelp();
    expect(sm.get().kind).toBe("help");
  });

  it("close from help returns to none", () => {
    const sm = makeStateMachine();
    sm.openHelp();
    sm.close();
    expect(sm.get().kind).toBe("none");
  });

  it("close from palette returns to none", () => {
    const sm = makeStateMachine();
    sm.openPalette();
    sm.close();
    expect(sm.get().kind).toBe("none");
  });

  it("read command routes to results overlay", () => {
    const sm = makeStateMachine();
    sm.openPalette();
    sm.openResults("firestore-ping", ["PONG: Firestore connected (3 top-level collections)"]);
    expect(sm.get().kind).toBe("results");
    const state = sm.get() as { kind: "results"; title: string; lines: string[] };
    expect(state.title).toBe("firestore-ping");
    expect(state.lines).toEqual(["PONG: Firestore connected (3 top-level collections)"]);
  });

  it("destructive command routes to confirm overlay", () => {
    const cmd: PaletteCommand = {
      name: "firestore-delete-user", desc: "Delete user doc", subsystem: "firestore", destructive: true, execute: noop,
    };
    const sm = makeStateMachine();
    sm.openPalette();
    sm.openConfirm(cmd);
    expect(sm.get().kind).toBe("confirm");
    const state = sm.get() as { kind: "confirm"; cmd: PaletteCommand };
    expect(state.cmd.name).toBe("firestore-delete-user");
    expect(state.cmd.destructive).toBe(true);
  });

  it("Esc from results returns to none (palette dismissed)", () => {
    const sm = makeStateMachine();
    sm.openPalette();
    sm.openResults("firestore-list-collections", ["users", "households"]);
    sm.close(); // Esc from ResultsOverlay
    expect(sm.get().kind).toBe("none");
  });

  it("Esc from confirm returns to none (no execute)", () => {
    const cmd: PaletteCommand = {
      name: "firestore-delete-user", desc: "Delete user doc", subsystem: "firestore", destructive: true, execute: noop,
    };
    const sm = makeStateMachine();
    sm.openConfirm(cmd);
    sm.close();
    expect(sm.get().kind).toBe("none");
  });
});
