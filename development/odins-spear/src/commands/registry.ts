import { log } from "@fenrir/logger";

// ─── Command schema ───────────────────────────────────────────────────────────

export type Subsystem = "firestore" | "stripe" | "system" | "trial";
export type RequiresContext = "user" | "household" | "trial";
/**
 * Which TUI tab this command is relevant to.
 * "users"      — shown only on the Users tab
 * "households" — shown only on the Households tab
 * "all"        — global system command, always shown (default)
 */
export type CommandTab = "users" | "households" | "all";

export interface PaletteCommand {
  /** Unique slug, e.g. "firestore-ping", "firestore-delete-user" */
  name: string;
  /** One-line description shown in the palette */
  desc: string;
  /** Which backend subsystem this command targets */
  subsystem: Subsystem;
  /** If set, command is greyed out until the named context is selected */
  requiresContext?: RequiresContext;
  /**
   * Which tab this command is relevant to. Defaults to "all" (global).
   * Commands tagged "users" only appear when the Users tab is active;
   * "households" only when the Households tab is active.
   */
  tab?: CommandTab;
  /** If true, routes through ConfirmDialog (type "delete" to confirm) */
  destructive?: boolean;
  /** If true, routes through TrialInputDialog to collect a day-offset input */
  needsInput?: boolean;
  /** Execute the command and return output lines */
  execute: (ctx: CommandContext) => Promise<string[]>;
}

export interface CommandContext {
  selectedUserId: string | null;
  selectedHouseholdId: string | null;
  selectedFp: string | null;
  selectedSubId: string | null;
  /** Optional free-form input collected by TrialInputDialog before execute. */
  input?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const PALETTE_COMMANDS: PaletteCommand[] = [];

export function registerCommand(cmd: PaletteCommand): void {
  log.debug("registerCommand called", { name: cmd.name, subsystem: cmd.subsystem });
  const existing = PALETTE_COMMANDS.findIndex((c) => c.name === cmd.name);
  if (existing >= 0) {
    PALETTE_COMMANDS[existing] = cmd;
  } else {
    PALETTE_COMMANDS.push(cmd);
  }
  log.debug("registerCommand returning", { totalCommands: PALETTE_COMMANDS.length });
}

export function getCommands(): readonly PaletteCommand[] {
  log.debug("getCommands called", { count: PALETTE_COMMANDS.length });
  return PALETTE_COMMANDS;
}

/** Returns true when the command is available given current selection state. */
export function isAvailable(cmd: PaletteCommand, ctx: CommandContext): boolean {
  log.debug("isAvailable called", { name: cmd.name, requiresContext: cmd.requiresContext });
  let result: boolean;
  if (!cmd.requiresContext) {
    result = true;
  } else if (cmd.requiresContext === "user") {
    result = ctx.selectedUserId !== null;
  } else if (cmd.requiresContext === "household") {
    result = ctx.selectedHouseholdId !== null;
  } else {
    // "trial" requiresContext — trials are now keyed by userId (issue #1658)
    result = ctx.selectedUserId !== null;
  }
  log.debug("isAvailable returning", { name: cmd.name, result });
  return result;
}

