/**
 * LLM provider factory + implementations for serverless import.
 *
 * Server-side only — reads API keys from env vars.
 * Mirrors the backend's lib/llm/ module but colocated in a single file
 * since the interface + factory + two providers are small.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/** Provider-agnostic interface for text extraction. */
export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  extractText(prompt: string): Promise<string>;
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

  async extractText(prompt: string): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const message = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });
        const textBlock = message.content.find((b) => b.type === "text");
        return textBlock?.text ?? "";
      } catch (err) {
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

  async extractText(prompt: string): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });
        return completion.choices[0]?.message?.content ?? "";
      } catch (err) {
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
  if (_instance) return _instance;

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

  return _instance;
}
