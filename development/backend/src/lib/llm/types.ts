/**
 * LLM provider interface.
 *
 * Abstracts the text-extraction call so callers are provider-agnostic.
 */
export interface LlmProvider {
  /** Human-readable provider name (e.g. "anthropic", "openai"). */
  readonly name: string;

  /** Model identifier used for extraction calls. */
  readonly model: string;

  /**
   * Send a prompt and return the raw text response.
   *
   * Implementations handle their own retry logic (single retry on transient
   * failure, matching the original Anthropic wrapper behaviour).
   */
  extractText(prompt: string): Promise<string>;
}
