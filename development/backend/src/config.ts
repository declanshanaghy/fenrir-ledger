/**
 * Central configuration resolved from environment variables at startup.
 *
 * Port and node environment are resolved immediately.
 * API keys are read from the environment but only validated when an
 * import route is actually invoked (via assertConfig()). This allows
 * the server to start in health-only mode without requiring keys.
 */
export const config = {
  /** Port the backend listens on. Default: 9753. Override via FENRIR_BACKEND_PORT. */
  port: parseInt(process.env.FENRIR_BACKEND_PORT || "9753", 10),

  /** Which LLM provider to use: "openai" | "anthropic". Default: "openai". */
  llmProvider: (process.env.LLM_PROVIDER || "openai") as "openai" | "anthropic",

  /** Anthropic API key for Claude Haiku calls during sheet import. */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",

  /** OpenAI API key for GPT calls during sheet import. */
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",

  /** Node environment. "development" | "production" | "test". */
  nodeEnv: process.env.NODE_ENV || "development",
} as const;

/**
 * Throw early if the required API key for the active provider is missing.
 * Only call this when import routes are hit, not at startup.
 * This allows the server to run in health-only mode without any API key.
 */
const VALID_PROVIDERS = ["anthropic", "openai"] as const;

export function assertConfig(): void {
  if (!VALID_PROVIDERS.includes(config.llmProvider)) {
    throw new Error(
      `Unknown LLM_PROVIDER "${config.llmProvider}". Expected one of: ${VALID_PROVIDERS.join(", ")}.`,
    );
  }
  if (config.llmProvider === "anthropic" && !config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic.");
  }
  if (config.llmProvider === "openai" && !config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
  }
}
