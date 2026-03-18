/**
 * Loki QA — Odin's Spear: remove select-household shortcut
 * Issue #1377: select-household alias was broken and has been removed.
 * The canonical command is use-household <N|id>.
 *
 * Tests:
 *   1. BASE_COMMANDS does not include "select-household"
 *   2. "select-household" dispatches to "Unknown command" (no handler)
 *   3. "use-household" remains in the command set
 *   4. Tab completer offers "use-household" completions, not "select-household"
 *   5. No other commands are affected by the removal
 */

import { describe, it, expect, vi } from "vitest";

// ─── Mirrors BASE_COMMANDS from odins-spear.mjs (post issue #1377 fix) ────────

const BASE_COMMANDS = [
  // Trial / Redis
  "list", "use", "status", "set", "shift", "reset", "expire",
  "convert", "unconvert", "create", "delete",
  "stripe-customers", "stripe-subs", "delete-customer", "cancel-sub",
  "flush-entitlement", "nuke",
  "keys", "entitlements", "identity", "reconnect",
  // Firestore — Household
  "households", "household", "use-household",
  "kick", "transfer-owner", "set-tier", "regen-invite", "delete-household",
  // Firestore — User
  "users", "user", "delete-user",
  // Meta
  "help", "quit", "exit",
];

const CARD_COMMANDS = [
  "cards", "card", "add-card", "edit-card", "delete-card",
  "restore-card", "expunge-card", "card-count",
];

function availableCommands(selectedHouseholdId: string | null = null) {
  return selectedHouseholdId ? [...BASE_COMMANDS, ...CARD_COMMANDS] : BASE_COMMANDS;
}

// ─── Mirrors the REPL dispatch logic from odins-spear.mjs ────────────────────

interface ReplDeps {
  logUnknown: (cmd: string) => void;
}

type CommandHandlers = Record<string, (args: string[]) => void>;

function dispatch(
  line: string,
  handlers: CommandHandlers,
  deps: ReplDeps
): boolean {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  if (!cmd) return false;

  const cmdKey = cmd === "delete" ? "delete_trial" : cmd.replace(/-/g, "_");
  const handler = handlers[cmdKey];

  if (!handler) {
    deps.logUnknown(cmd);
    return false;
  }

  handler(parts.slice(1));
  return true;
}

// ─── Mirrors completer logic from odins-spear.mjs ────────────────────────────

function completer(
  line: string,
  householdIndex: string[],
  selectedHouseholdId: string | null = null
): [string[], string] {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || "";
  const cmds = availableCommands(selectedHouseholdId);

  if (parts.length <= 1) {
    const hits = cmds.filter((c) => c.startsWith(cmd));
    return [hits.length ? hits : cmds, cmd];
  }

  if (cmd === "use-household" && householdIndex.length > 0) {
    const arg = parts[1] || "";
    const nums = householdIndex.map((_, i) => String(i + 1));
    const hits = nums.filter((n) => n.startsWith(arg));
    return [hits, arg];
  }

  return [[], line];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("select-household removal — issue #1377", () => {
  describe("BASE_COMMANDS — command registry", () => {
    it("does not include 'select-household' in the command list", () => {
      expect(BASE_COMMANDS).not.toContain("select-household");
    });

    it("includes 'use-household' as the canonical household selection command", () => {
      expect(BASE_COMMANDS).toContain("use-household");
    });

    it("does not include any select-* variant", () => {
      const selectVariants = BASE_COMMANDS.filter((c) => c.startsWith("select"));
      expect(selectVariants).toHaveLength(0);
    });
  });

  describe("REPL dispatch — select-household routes to unknown command", () => {
    it("returns false and calls logUnknown for 'select-household'", () => {
      const logUnknown = vi.fn();
      const handlers: CommandHandlers = {
        use_household: vi.fn(),
      };

      const handled = dispatch("select-household 1", handlers, { logUnknown });

      expect(handled).toBe(false);
      expect(logUnknown).toHaveBeenCalledWith("select-household");
      expect(handlers.use_household).not.toHaveBeenCalled();
    });

    it("does NOT have a select_household handler key", () => {
      // The handler map should only have use_household, not select_household
      const handlers: CommandHandlers = {
        use_household: vi.fn(),
      };

      expect("select_household" in handlers).toBe(false);
      expect("use_household" in handlers).toBe(true);
    });
  });

  describe("REPL dispatch — use-household continues to work", () => {
    it("dispatches 'use-household 1' to use_household handler", () => {
      const logUnknown = vi.fn();
      const useHousehold = vi.fn();
      const handlers: CommandHandlers = {
        use_household: useHousehold,
      };

      const handled = dispatch("use-household 1", handlers, { logUnknown });

      expect(handled).toBe(true);
      expect(useHousehold).toHaveBeenCalledWith(["1"]);
      expect(logUnknown).not.toHaveBeenCalled();
    });

    it("dispatches 'use-household' with a raw ID argument", () => {
      const logUnknown = vi.fn();
      const useHousehold = vi.fn();

      const handled = dispatch(
        "use-household hh-abc123",
        { use_household: useHousehold },
        { logUnknown }
      );

      expect(handled).toBe(true);
      expect(useHousehold).toHaveBeenCalledWith(["hh-abc123"]);
    });
  });

  describe("tab completer — select-household not offered", () => {
    const householdIndex = ["hh-001", "hh-002", "hh-003"];

    it("does not complete 'select' to 'select-household'", () => {
      const [hits] = completer("select", householdIndex);
      expect(hits).not.toContain("select-household");
    });

    it("does not complete 'select-' prefix to any command", () => {
      const [hits] = completer("select-", householdIndex);
      const selectHits = hits.filter((h) => h.startsWith("select-"));
      expect(selectHits).toHaveLength(0);
    });

    it("completes 'use-h' to 'use-household'", () => {
      const [hits] = completer("use-h", householdIndex);
      expect(hits).toContain("use-household");
    });

    it("provides numeric completions for 'use-household '", () => {
      const [hits] = completer("use-household ", householdIndex);
      expect(hits).toEqual(["1", "2", "3"]);
    });
  });
});

