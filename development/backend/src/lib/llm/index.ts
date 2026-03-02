/**
 * LLM module barrel export.
 *
 * Re-exports the provider interface and factory.
 */

export type { LlmProvider } from "./types.js";
export { getLlmProvider } from "./factory.js";
