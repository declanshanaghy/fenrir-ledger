import { log } from "@fenrir/logger";

export interface PaletteCommand {
  id: string;
  label: string;
  description: string;
  action: () => Promise<void> | void;
}

const PALETTE_COMMANDS: PaletteCommand[] = [];

export function registerCommand(cmd: PaletteCommand): void {
  log.debug("registerCommand called", { id: cmd.id });
  PALETTE_COMMANDS.push(cmd);
  log.debug("registerCommand returning", { totalCommands: PALETTE_COMMANDS.length });
}

export function getCommands(): readonly PaletteCommand[] {
  log.debug("getCommands called", { count: PALETTE_COMMANDS.length });
  return PALETTE_COMMANDS;
}
