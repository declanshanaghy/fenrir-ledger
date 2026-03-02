/**
 * LLM provider factory.
 *
 * Returns a lazy singleton based on the configured provider name.
 * The instance is created on first call and reused thereafter.
 */

import { config } from "../../config.js";
import type { LlmProvider } from "./types.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAIProvider } from "./providers/openai.js";

let _instance: LlmProvider | null = null;

/**
 * Get the configured LLM provider (lazy singleton).
 *
 * Reads `config.llmProvider` to decide which implementation to create.
 * Throws if the required API key is not set.
 */
export function getLlmProvider(): LlmProvider {
  if (_instance) return _instance;

  switch (config.llmProvider) {
    case "anthropic":
      if (!config.anthropicApiKey) {
        throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic.");
      }
      _instance = new AnthropicProvider(config.anthropicApiKey);
      break;

    case "openai":
      if (!config.openaiApiKey) {
        throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
      }
      _instance = new OpenAIProvider(config.openaiApiKey);
      break;

    default:
      throw new Error(`Unknown LLM provider: "${config.llmProvider}". Expected "anthropic" or "openai".`);
  }

  console.info(`[fenrir-backend] LLM provider initialized: ${_instance.name}, model=${_instance.model}`);
  return _instance;
}
