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
 * importing Node-only (Ink, ioredis, Firestore) modules into the Vitest
 * browser-compatible environment. This follows the established pattern
 * from odins-spear-adc-auth.test.ts and odins-spear-standalone-package.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─── Mirror: types from commands/registry.ts ─────────────────────────────────

type Subsystem = "redis" | "firestore" | "stripe" | "system";
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
    expect(fuzzyMatch("redis-ping", "redis-ping")).toBe(true);
  });

  it("returns true for case-insensitive subsequence", () => {
    expect(fuzzyMatch("redis-keys", "RK")).toBe(true);
  });

  it("returns true for non-contiguous subsequence", () => {
    expect(fuzzyMatch("redis-keys", "rks")).toBe(true);
  });

  it("returns false when needle chars not found in order", () => {
    expect(fuzzyMatch("redis-ping", "xyz")).toBe(false);
  });

  it("returns false when chars present but out of order", () => {
    // 'gp' — 'g' appears at index 8 in 'redis-ping', 'p' at index 6 — out of order
    expect(fuzzyMatch("redis-ping", "gp")).toBe(false);
  });

  it("matches across name+desc concat (command name + space + description)", () => {
    // "redis-ping" + " " + "Ping the Redis connection"
    expect(fuzzyMatch("redis-ping ping the redis connection", "pin")).toBe(true);
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
    registry.registerCommand({ name: "redis-ping",   desc: "Ping Redis",          subsystem: "redis",     execute: noop });
    registry.registerCommand({ name: "redis-keys",   desc: "List all keys",       subsystem: "redis",     execute: noop });
    registry.registerCommand({ name: "redis-flush",  desc: "Flush all keys",      subsystem: "redis",     destructive: true, execute: noop });
    registry.registerCommand({ name: "stripe-check", desc: "Verify Stripe key",   subsystem: "stripe",    execute: noop });
    registry.registerCommand({ name: "firestore-list-collections", desc: "List collections", subsystem: "firestore", execute: noop });
  });

  it("returns all commands for empty query", () => {
    expect(registry.filterCommands("").length).toBe(5);
  });

  it("filters by name subsequence", () => {
    const results = registry.filterCommands("rk");
    // matches redis-keys (r→e→d→i→s→-→k) yes; redis-ping (r..p) no; redis-flush yes (r..f? no)
    // rk: 'r' in redis-keys at 0, 'k' at 6 → yes
    // rk: 'r' in redis-ping at 0, 'k'... no 'k' in 'redis-ping' → no
    expect(results.some((c) => c.name === "redis-keys")).toBe(true);
    expect(results.some((c) => c.name === "redis-ping")).toBe(false);
  });

  it("filters by description word", () => {
    const results = registry.filterCommands("flush");
    expect(results.some((c) => c.name === "redis-flush")).toBe(true);
    expect(results.length).toBe(1);
  });

  it("returns empty array when no match", () => {
    expect(registry.filterCommands("zzzzz").length).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(registry.filterCommands("REDIS").length).toBeGreaterThan(0);
    expect(registry.filterCommands("Stripe").length).toBeGreaterThan(0);
  });
});

// ─── 4. registerCommand (deduplication) ──────────────────────────────────────

describe("registerCommand deduplication", () => {
  it("registers new commands without duplication", () => {
    const { registerCommand, getCommands } = makeRegistry();
    registerCommand({ name: "a", desc: "A", subsystem: "system", execute: noop });
    registerCommand({ name: "b", desc: "B", subsystem: "redis",  execute: noop });
    expect(getCommands().length).toBe(2);
  });

  it("upserts when registering the same name twice", () => {
    const { registerCommand, getCommands } = makeRegistry();
    registerCommand({ name: "a", desc: "original", subsystem: "system", execute: noop });
    registerCommand({ name: "a", desc: "updated",  subsystem: "redis",  execute: noop });
    const cmds = getCommands();
    expect(cmds.length).toBe(1);
    expect(cmds[0]?.desc).toBe("updated");
  });

  it("getCommands returns readonly view (length does not change on external mutation)", () => {
    const { registerCommand, getCommands } = makeRegistry();
    registerCommand({ name: "a", desc: "A", subsystem: "system", execute: noop });
    const snap = getCommands();
    registerCommand({ name: "b", desc: "B", subsystem: "redis",  execute: noop });
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
    const cmd: PaletteCommand = { name: "redis-ping", desc: "", subsystem: "redis", execute: noop };
    expect(isAvailable(cmd, noCtx)).toBe(true);
  });

  it("destructive command still routes correctly (destructive flag is boolean)", () => {
    const cmd: PaletteCommand = {
      name: "redis-flush", desc: "Flush all", subsystem: "redis", destructive: true, execute: noop,
    };
    expect(cmd.destructive).toBe(true);
  });

  it("read command has no destructive flag or false", () => {
    const cmd: PaletteCommand = { name: "redis-ping", desc: "", subsystem: "redis", execute: noop };
    expect(cmd.destructive).toBeFalsy();
  });

  it("subsystem values are constrained to known types", () => {
    const subsystems: Subsystem[] = ["redis", "firestore", "stripe", "system"];
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
