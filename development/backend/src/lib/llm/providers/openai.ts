/**
 * OpenAI provider implementation.
 *
 * Uses the OpenAI SDK with the same single-retry pattern as the
 * Anthropic provider.
 */

import OpenAI from "openai";
import type { LlmProvider } from "../types.js";

const MODEL = "gpt-4o-mini";

export class OpenAIProvider implements LlmProvider {
  readonly name = "openai";
  readonly model = MODEL;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async extractText(prompt: string): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.info(
          `[fenrir-backend] OpenAI extraction attempt ${attempt + 1}/2, model=${this.model}, prompt_length=${prompt.length}`,
        );
        const start = Date.now();
        const completion = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });
        const elapsed = Date.now() - start;

        const text = completion.choices[0]?.message?.content ?? "";
        console.info(
          `[fenrir-backend] OpenAI extraction succeeded in ${elapsed}ms, response_length=${text.length}, usage=${JSON.stringify(completion.usage)}`,
        );
        return text;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[fenrir-backend] OpenAI extraction attempt ${attempt + 1} failed:`,
          { error: errMsg },
        );
        if (attempt === 1) throw err;
      }
    }

    throw new Error("Extraction failed after retries.");
  }
}
