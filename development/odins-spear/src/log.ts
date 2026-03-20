/**
 * Odin's Spear logger — writes to tmp/logs/odins-spear.log instead of stdout.
 * All files import { log } from "@fenrir/logger" which resolves here via tsconfig paths + loader.
 */
import { createFileLogger } from "@fenrir/logger-base";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../../..");
const logPath = resolve(repoRoot, "tmp/logs/odins-spear.log");

export const log = createFileLogger("odins-spear", logPath);
