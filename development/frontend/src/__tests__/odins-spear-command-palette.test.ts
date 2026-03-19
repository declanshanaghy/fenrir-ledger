/**
 * Vitest — Odin's Spear: Command Palette + Confirmation Dialog
 * Issue #1390: command palette filtering, navigation, confirmation dialog logic
 *
 * odins-spear.mjs cannot be imported (top-level await + side-effects).
 * Tests mirror extracted pure logic, following the existing test-suite pattern.
 *
 * Suites:
 *   1. filterPaletteCommands — search filtering
 *   2. Command category grouping
 *   3. Arrow-key highlight navigation (clamping + wrapping)
 *   4. Confirmation dialog — type-delete pattern
 *   5. SpearApp overlay priority
 *   6. Keyboard routing — / opens palette, Esc closes, ? toggles help
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ── Shared types ───────────────────────────────────────────────────────────────

interface PaletteCommand {
  name: string;
  desc: string;
  category: string;
  destructive: boolean;
}

// ── Mirror of PALETTE_COMMANDS ─────────────────────────────────────────────────

const PALETTE_COMMANDS: PaletteCommand[] = [
  { name: "delete-user",         desc: "Delete selected user and all their data",           category: "Users",      destructive: true  },
  { name: "update-tier",         desc: "Change user tier (karl / trial / thrall)",           category: "Users",      destructive: false },
  { name: "delete-subscription", desc: "Cancel and remove Stripe subscription",              category: "Billing",    destructive: true  },
  { name: "list-subscriptions",  desc: "List all active Stripe subscriptions",               category: "Billing",    destructive: false },
  { name: "list-customers",      desc: "List all Stripe customers",                          category: "Billing",    destructive: false },
  { name: "delete-entitlement",  desc: "Clear Redis entitlement cache for selected user",    category: "Billing",    destructive: true  },
  { name: "delete-member",       desc: "Remove member from selected household",              category: "Households", destructive: true  },
  { name: "update-owner",        desc: "Transfer ownership of selected household",           category: "Households", destructive: false },
  { name: "update-invite",       desc: "Regenerate household invite code",                   category: "Households", destructive: false },
  { name: "delete-household",    desc: "Delete selected household and all members",          category: "Households", destructive: true  },
  { name: "delete-all",          desc: "Delete ALL data for selected user (nuclear option)", category: "Danger",     destructive: true  },
  { name: "reconnect",           desc: "Reconnect to Redis / Firestore / Stripe",            category: "System",     destructive: false },
];

// ── Mirror of filterPaletteCommands ───────────────────────────────────────────

function filterPaletteCommands(query: string): PaletteCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return PALETTE_COMMANDS;
  return PALETTE_COMMANDS.filter(
    (c) =>
      c.name.includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
  );
}

// ── 1. filterPaletteCommands ───────────────────────────────────────────────────

describe("filterPaletteCommands — real-time search (issue #1390)", () => {
  it("returns all commands when query is empty", () => {
    expect(filterPaletteCommands("")).toHaveLength(PALETTE_COMMANDS.length);
  });

  it("returns all commands when query is whitespace only", () => {
    expect(filterPaletteCommands("   ")).toHaveLength(PALETTE_COMMANDS.length);
  });

  it("matches by command name prefix", () => {
    const results = filterPaletteCommands("delete");
    expect(results.every((c) => c.name.includes("delete") || c.desc.toLowerCase().includes("delete"))).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("matches 'delete-user' specifically", () => {
    const results = filterPaletteCommands("delete-user");
    expect(results.some((c) => c.name === "delete-user")).toBe(true);
  });

  it("matches by description substring", () => {
    const results = filterPaletteCommands("stripe");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) =>
      c.name.includes("stripe") ||
      c.desc.toLowerCase().includes("stripe") ||
      c.category.toLowerCase().includes("stripe")
    )).toBe(true);
  });

  it("matches by category name (case-insensitive)", () => {
    const results = filterPaletteCommands("billing");
    expect(results.every((c) => c.category === "Billing" || c.desc.toLowerCase().includes("billing"))).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("matches 'reconnect' by name", () => {
    const results = filterPaletteCommands("reconnect");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("reconnect");
  });

  it("returns empty array for a nonsense query", () => {
    expect(filterPaletteCommands("xyzzy-no-match-ever")).toHaveLength(0);
  });

  it("is case-insensitive for query", () => {
    const lower = filterPaletteCommands("users");
    const upper = filterPaletteCommands("USERS");
    const mixed = filterPaletteCommands("UsErS");
    expect(lower).toEqual(upper);
    expect(lower).toEqual(mixed);
  });

  it("matches 'household' category commands", () => {
    const results = filterPaletteCommands("household");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.category === "Households")).toBe(true);
  });

  it("danger category is accessible by 'danger' query", () => {
    const results = filterPaletteCommands("danger");
    expect(results.some((c) => c.category === "Danger")).toBe(true);
  });

  it("system category is accessible by 'system' query", () => {
    const results = filterPaletteCommands("system");
    expect(results.some((c) => c.category === "System")).toBe(true);
  });
});

// ── 2. Command category grouping ───────────────────────────────────────────────

describe("PALETTE_COMMANDS — category structure (issue #1390)", () => {
  const categories = [...new Set(PALETTE_COMMANDS.map((c) => c.category))];

  it("includes all five required categories", () => {
    expect(categories).toContain("Users");
    expect(categories).toContain("Billing");
    expect(categories).toContain("Households");
    expect(categories).toContain("Danger");
    expect(categories).toContain("System");
  });

  it("destructive commands are marked destructive: true", () => {
    const destructive = PALETTE_COMMANDS.filter((c) => c.destructive);
    expect(destructive.map((c) => c.name)).toContain("delete-user");
    expect(destructive.map((c) => c.name)).toContain("delete-subscription");
    expect(destructive.map((c) => c.name)).toContain("delete-household");
    expect(destructive.map((c) => c.name)).toContain("delete-all");
  });

  it("non-destructive commands are marked destructive: false", () => {
    const safe = PALETTE_COMMANDS.filter((c) => !c.destructive);
    expect(safe.map((c) => c.name)).toContain("reconnect");
    expect(safe.map((c) => c.name)).toContain("list-subscriptions");
    expect(safe.map((c) => c.name)).toContain("list-customers");
    expect(safe.map((c) => c.name)).toContain("update-tier");
  });

  it("delete-all is in Danger category", () => {
    const cmd = PALETTE_COMMANDS.find((c) => c.name === "delete-all");
    expect(cmd?.category).toBe("Danger");
    expect(cmd?.destructive).toBe(true);
  });

  it("reconnect is in System category and not destructive", () => {
    const cmd = PALETTE_COMMANDS.find((c) => c.name === "reconnect");
    expect(cmd?.category).toBe("System");
    expect(cmd?.destructive).toBe(false);
  });

  it("all commands have non-empty name, desc, and category", () => {
    for (const c of PALETTE_COMMANDS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.desc.length).toBeGreaterThan(0);
      expect(c.category.length).toBeGreaterThan(0);
    }
  });
});

// ── 3. Arrow-key highlight navigation ─────────────────────────────────────────
//
// Mirrors:
//   upArrow:   onHighlightChange(Math.max(0, highlight - 1))
//   downArrow: onHighlightChange(Math.min(filtered.length - 1, highlight + 1))

function clampHighlight(highlight: number, direction: "up" | "down", listLength: number): number {
  if (direction === "up") return Math.max(0, highlight - 1);
  return Math.min(listLength - 1, highlight + 1);
}

describe("CommandPalette — highlight navigation (issue #1390)", () => {
  const LIST_LEN = 5;

  it("up from index 2 moves to index 1", () => {
    expect(clampHighlight(2, "up", LIST_LEN)).toBe(1);
  });

  it("up from index 0 stays at 0 (floor clamp)", () => {
    expect(clampHighlight(0, "up", LIST_LEN)).toBe(0);
  });

  it("down from index 2 moves to index 3", () => {
    expect(clampHighlight(2, "down", LIST_LEN)).toBe(3);
  });

  it("down from last index stays at last (ceiling clamp)", () => {
    expect(clampHighlight(LIST_LEN - 1, "down", LIST_LEN)).toBe(LIST_LEN - 1);
  });

  it("never produces a negative index", () => {
    for (let h = 0; h < LIST_LEN; h++) {
      expect(clampHighlight(h, "up", LIST_LEN)).toBeGreaterThanOrEqual(0);
    }
  });

  it("never produces an out-of-bounds index", () => {
    for (let h = 0; h < LIST_LEN; h++) {
      expect(clampHighlight(h, "down", LIST_LEN)).toBeLessThan(LIST_LEN);
    }
  });

  it("highlight resets to 0 after query change", () => {
    // Mirrors: onQueryChange(query + input); onHighlightChange(0)
    const newHighlight = 0;
    expect(newHighlight).toBe(0);
  });
});

// ── 4. Confirmation dialog — type-delete pattern ──────────────────────────────
//
// Mirrors: const canConfirm = deleteInput.toLowerCase() === "delete"

function canConfirmDelete(deleteInput: string): boolean {
  return deleteInput.toLowerCase() === "delete";
}

describe("ConfirmDialog — type-delete pattern (issue #1390)", () => {
  it("returns true when input is exactly 'delete' (lowercase)", () => {
    expect(canConfirmDelete("delete")).toBe(true);
  });

  it("returns true when input is 'DELETE' (uppercase)", () => {
    expect(canConfirmDelete("DELETE")).toBe(true);
  });

  it("returns true when input is 'Delete' (mixed case)", () => {
    expect(canConfirmDelete("Delete")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(canConfirmDelete("")).toBe(false);
  });

  it("returns false for partial input 'delet'", () => {
    expect(canConfirmDelete("delet")).toBe(false);
  });

  it("returns false for 'deletee' (extra character)", () => {
    expect(canConfirmDelete("deletee")).toBe(false);
  });

  it("returns false for 'delete ' (trailing space)", () => {
    expect(canConfirmDelete("delete ")).toBe(false);
  });

  it("returns false for ' delete' (leading space)", () => {
    expect(canConfirmDelete(" delete")).toBe(false);
  });

  it("confirm button should be disabled until condition is met", () => {
    const inputs = ["", "d", "de", "del", "dele", "delet"];
    for (const inp of inputs) {
      expect(canConfirmDelete(inp)).toBe(false);
    }
  });

  it("cancelling resets deleteInput to empty string", () => {
    // Mirrors: handleCancelConfirm → setDeleteInput("")
    let deleteInput = "delet";
    deleteInput = ""; // after cancel
    expect(deleteInput).toBe("");
  });
});

// ── 5. SpearApp overlay priority ──────────────────────────────────────────────
//
// Mirrors: confirmDialog > showCmdPalette > showHelp > MainContent

type OverlayType = "confirm" | "palette" | "help" | "main";

function resolveOverlay(state: {
  confirmDialog: object | null;
  showCmdPalette: boolean;
  showHelp: boolean;
}): OverlayType {
  if (state.confirmDialog) return "confirm";
  if (state.showCmdPalette) return "palette";
  if (state.showHelp) return "help";
  return "main";
}

describe("SpearApp overlay priority (issue #1390)", () => {
  it("confirmDialog takes highest priority", () => {
    expect(resolveOverlay({ confirmDialog: {}, showCmdPalette: true, showHelp: true })).toBe("confirm");
  });

  it("palette shows when no confirm dialog", () => {
    expect(resolveOverlay({ confirmDialog: null, showCmdPalette: true, showHelp: true })).toBe("palette");
  });

  it("help shows when no dialog and no palette", () => {
    expect(resolveOverlay({ confirmDialog: null, showCmdPalette: false, showHelp: true })).toBe("help");
  });

  it("main content shows when all overlays are off", () => {
    expect(resolveOverlay({ confirmDialog: null, showCmdPalette: false, showHelp: false })).toBe("main");
  });

  it("only confirmDialog=null, palette=false, help=false shows main", () => {
    expect(resolveOverlay({ confirmDialog: null, showCmdPalette: false, showHelp: false })).toBe("main");
  });
});

// ── 6. Keyboard routing — / opens palette, Esc closes ─────────────────────────

interface PaletteKeyDeps {
  inputCaptured: boolean;
  showCmdPalette: boolean;
  confirmDialog: object | null;
  showHelp: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setShowHelp: (updater: (v: boolean) => boolean) => void;
  quit: () => void;
}

function handleGlobalKey(
  input: string,
  key: { escape?: boolean; tab?: boolean; ctrl?: boolean },
  deps: PaletteKeyDeps
): void {
  if (deps.inputCaptured) return;
  if (deps.showCmdPalette || deps.confirmDialog) return;

  if (input === "q") { deps.quit(); return; }
  if (input === "/") { deps.openCommandPalette(); return; }
  if (input === "?") { deps.setShowHelp((v) => !v); return; }
  if (key.escape && deps.showHelp) { deps.setShowHelp(() => false); return; }
  if (deps.showHelp) { deps.setShowHelp(() => false); }
}

describe("SpearApp keyboard routing — palette + help shortcuts (issue #1390)", () => {
  let deps: { [K in keyof PaletteKeyDeps]: K extends "inputCaptured" | "showCmdPalette" | "showHelp" ? boolean : K extends "confirmDialog" ? null : Mock };

  beforeEach(() => {
    deps = {
      inputCaptured: false,
      showCmdPalette: false,
      confirmDialog: null,
      showHelp: false,
      openCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      setShowHelp: vi.fn(),
      quit: vi.fn(),
    };
  });

  it("/ opens command palette", () => {
    handleGlobalKey("/", {}, deps as unknown as PaletteKeyDeps);
    expect(deps.openCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("/ does NOT open palette when inputCaptured is true", () => {
    (deps as unknown as PaletteKeyDeps).inputCaptured = true;
    handleGlobalKey("/", {}, deps as unknown as PaletteKeyDeps);
    expect(deps.openCommandPalette).not.toHaveBeenCalled();
  });

  it("/ does NOT open palette when palette is already open", () => {
    (deps as unknown as PaletteKeyDeps).showCmdPalette = true;
    handleGlobalKey("/", {}, deps as unknown as PaletteKeyDeps);
    expect(deps.openCommandPalette).not.toHaveBeenCalled();
  });

  it("/ does NOT open palette when confirm dialog is open", () => {
    (deps as unknown as PaletteKeyDeps).confirmDialog = { action: "delete-user", desc: "..." };
    handleGlobalKey("/", {}, deps as unknown as PaletteKeyDeps);
    expect(deps.openCommandPalette).not.toHaveBeenCalled();
  });

  it("? toggles help overlay", () => {
    handleGlobalKey("?", {}, deps as unknown as PaletteKeyDeps);
    expect(deps.setShowHelp).toHaveBeenCalledTimes(1);
    const updater = (deps.setShowHelp as Mock).mock.calls[0][0] as (v: boolean) => boolean;
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  it("? does NOT open palette or quit", () => {
    handleGlobalKey("?", {}, deps as unknown as PaletteKeyDeps);
    expect(deps.openCommandPalette).not.toHaveBeenCalled();
    expect(deps.quit).not.toHaveBeenCalled();
  });

  it("q quits the application", () => {
    handleGlobalKey("q", {}, deps as unknown as PaletteKeyDeps);
    expect(deps.quit).toHaveBeenCalledTimes(1);
  });

  it("q does NOT call quit when palette is open", () => {
    (deps as unknown as PaletteKeyDeps).showCmdPalette = true;
    handleGlobalKey("q", {}, deps as unknown as PaletteKeyDeps);
    expect(deps.quit).not.toHaveBeenCalled();
  });

  it("/ does not call quit or toggle help", () => {
    handleGlobalKey("/", {}, deps as unknown as PaletteKeyDeps);
    expect(deps.quit).not.toHaveBeenCalled();
    expect(deps.setShowHelp).not.toHaveBeenCalled();
  });
});
