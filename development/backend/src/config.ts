/**
 * Central configuration resolved from environment variables at startup.
 *
 * Port and node environment are resolved immediately.
 * The Anthropic API key is read from the environment but only validated
 * when an import route is actually invoked (via assertConfig()).
 * This allows the server to start in health-only mode without requiring
 * the API key to be set.
 */
export const config = {
  /** Port the backend listens on. Default: 9753. Override via FENRIR_BACKEND_PORT. */
  port: parseInt(process.env.FENRIR_BACKEND_PORT || "9753", 10),

  /** Anthropic API key for Claude Haiku calls during sheet import. */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",

  /** Node environment. "development" | "production" | "test". */
  nodeEnv: process.env.NODE_ENV || "development",
} as const;

/**
 * Throw early if required secrets are missing.
 * Only call this when import routes are hit, not at startup.
 * This allows the server to run in health-only mode without ANTHROPIC_API_KEY.
 */
export function assertConfig(): void {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required but not set.");
  }
}
