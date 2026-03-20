/**
 * Registers the @fenrir/* path alias loader hook.
 * Usage: tsx --import ./register.mjs src/index.ts
 */
import { register } from "node:module";
register("./loader.mjs", import.meta.url);
