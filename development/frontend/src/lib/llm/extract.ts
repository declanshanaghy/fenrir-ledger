/**
 * LLM provider factory + implementations for serverless import.
 *
 * Server-side only — reads API keys from env vars.
 * Mirrors the backend's lib/llm/ module but colocated in a single file
 * since the interface + factory + two providers are small.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { log } from "@/lib/logger";

/** Structured prompt with system/user separation to prevent prompt injection. */
export interface StructuredPrompt {
  system: string;
  user: string;
}

/** Provider-agnostic interface for text extraction. */
export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  extractText(prompt: string | StructuredPrompt): Promise<string>;
}

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const OPENAI_MODEL = "gpt-4o-mini";

class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly model = ANTHROPIC_MODEL;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extractText(prompt: string | StructuredPrompt): Promise<string> {
    const isStructured = typeof prompt !== "string";
    log.debug("AnthropicProvider.extractText called", { model: this.model, isStructured, promptLength: isStructured ? prompt.user.length : prompt.length });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const message = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          ...(isStructured
            ? { system: prompt.system, messages: [{ role: "user" as const, content: prompt.user }] }
            : { messages: [{ role: "user" as const, content: prompt }] }),
        });
        const textBlock = message.content.find((b) => b.type === "text");
        const result = textBlock?.text ?? "";
        log.debug("AnthropicProvider.extractText returning", { attempt, resultLength: result.length });
        return result;
      } catch (err) {
        log.error("AnthropicProvider.extractText attempt failed", { attempt, error: err instanceof Error ? err.message : String(err) });
        if (attempt === 1) throw err;
      }
    }
    throw new Error("Extraction failed after retries.");
  }
}

class OpenAIProvider implements LlmProvider {
  readonly name = "openai";
  readonly model = OPENAI_MODEL;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async extractText(prompt: string | StructuredPrompt): Promise<string> {
    const isStructured = typeof prompt !== "string";
    log.debug("OpenAIProvider.extractText called", { model: this.model, isStructured, promptLength: isStructured ? prompt.user.length : prompt.length });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 4096,
          messages: isStructured
            ? [
                { role: "system" as const, content: prompt.system },
                { role: "user" as const, content: prompt.user },
              ]
            : [{ role: "user" as const, content: prompt }],
        });
        const result = completion.choices[0]?.message?.content ?? "";
        log.debug("OpenAIProvider.extractText returning", { attempt, resultLength: result.length });
        return result;
      } catch (err) {
        log.error("OpenAIProvider.extractText attempt failed", { attempt, error: err instanceof Error ? err.message : String(err) });
        if (attempt === 1) throw err;
      }
    }
    throw new Error("Extraction failed after retries.");
  }
}

let _instance: LlmProvider | null = null;

/**
 * Get the configured LLM provider (lazy singleton).
 *
 * Reads `LLM_PROVIDER` env var (default: "anthropic").
 * Requires the corresponding API key env var to be set.
 */
export function getLlmProvider(): LlmProvider {
  log.debug("getLlmProvider called", { cached: !!_instance });

  if (_instance) {
    log.debug("getLlmProvider returning", { provider: _instance.name, model: _instance.model, cached: true });
    return _instance;
  }

  const provider = process.env.LLM_PROVIDER || "anthropic";

  switch (provider) {
    case "anthropic": {
      const key = process.env.FENRIR_ANTHROPIC_API_KEY;
      if (!key) throw new Error("FENRIR_ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic.");
      _instance = new AnthropicProvider(key);
      break;
    }
    case "openai": {
      const key = process.env.FENRIR_OPENAI_API_KEY;
      if (!key) throw new Error("FENRIR_OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
      _instance = new OpenAIProvider(key);
      break;
    }
    default:
      throw new Error(`Unknown LLM provider: "${provider}". Expected "anthropic" or "openai".`);
  }

  log.debug("getLlmProvider returning", { provider: _instance.name, model: _instance.model, cached: false });
  return _instance;
}
