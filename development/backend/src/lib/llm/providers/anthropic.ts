/**
 * Anthropic Claude provider implementation.
 *
 * Wraps the Anthropic SDK with a single-retry pattern matching the
 * original extract.ts behaviour.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider } from "../types.js";

const MODEL = "claude-haiku-4-5-20251001";

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly model = MODEL;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extractText(prompt: string): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.info(
          `[fenrir-backend] Anthropic extraction attempt ${attempt + 1}/2, model=${this.model}, prompt_length=${prompt.length}`,
        );
        const start = Date.now();
        const message = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });
        const elapsed = Date.now() - start;

        const textBlock = message.content.find((b) => b.type === "text");
        const responseLength = textBlock?.text?.length ?? 0;
        console.info(
          `[fenrir-backend] Anthropic extraction succeeded in ${elapsed}ms, response_length=${responseLength}, usage=${JSON.stringify(message.usage)}`,
        );
        return textBlock?.text ?? "";
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[fenrir-backend] Anthropic extraction attempt ${attempt + 1} failed:`,
          { error: errMsg },
        );
        if (attempt === 1) throw err;
      }
    }

    throw new Error("Extraction failed after retries.");
  }
}
