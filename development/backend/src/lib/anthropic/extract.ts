/**
 * Anthropic Claude Haiku extraction wrapper.
 *
 * Calls the Anthropic API with a single retry on transient failure,
 * matching the existing behaviour of the Next.js import route.
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * Call Claude Haiku to extract card data from CSV.
 *
 * Returns the raw response text. The caller is responsible for
 * JSON parsing and Zod validation.
 *
 * @param apiKey - Anthropic API key
 * @param prompt - Assembled extraction prompt (from buildExtractionPrompt)
 * @returns Raw text response from the model
 * @throws On failure after a single retry
 */
export async function extractCardsFromCsv(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  // Single retry on transient failure (matches the existing Next.js route behaviour)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      console.info(`[fenrir-backend] Anthropic extraction attempt ${attempt + 1}/2, model=claude-haiku-4-5-20251001, prompt_length=${prompt.length}`);
      const start = Date.now();
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const elapsed = Date.now() - start;

      const textBlock = message.content.find((b) => b.type === "text");
      const responseLength = textBlock?.text?.length ?? 0;
      console.info(`[fenrir-backend] Anthropic extraction succeeded in ${elapsed}ms, response_length=${responseLength}, usage=${JSON.stringify(message.usage)}`);
      return textBlock?.text ?? "";
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[fenrir-backend] Anthropic extraction attempt ${attempt + 1} failed:`, { error: errMsg });
      if (attempt === 1) throw err;
      // First attempt failed — retry
    }
  }

  // Unreachable — loop always throws or returns
  throw new Error("Extraction failed after retries.");
}
