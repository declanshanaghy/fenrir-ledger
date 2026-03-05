/**
 * Fenrir Logger — structured logging with automatic secret masking.
 *
 * Wraps tslog with project-specific configuration:
 *   - JSON output in production, pretty output in development
 *   - Automatic masking of keys that commonly hold secrets
 *   - Regex masking for secret patterns (API keys, JWTs, Google tokens)
 *   - `[fenrir-backend]` prefix on all log entries
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.debug("myFunction called", { url, csvLength: csv.length });
 *   log.error("myFunction failed", err);  // log full error — masking handles secrets
 *
 * Masking is applied automatically — you can safely pass objects containing
 * secret keys and they will be replaced with the mask placeholder before
 * output. Regex patterns catch common secret formats even when the key
 * name is not in the mask list.
 *
 * @module logger
 */

import { Logger } from "tslog";

/**
 * Keys whose values are automatically masked in log output.
 * Case-insensitive matching is enabled via maskValuesOfKeysCaseInsensitive.
 */
const MASKED_KEYS = [
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "credential",
  "client_secret",
  "clientSecret",
  "refresh_token",
  "refreshToken",
  "access_token",
  "accessToken",
  "id_token",
  "idToken",
  "code_verifier",
  "codeVerifier",
  "code",
  "pickerApiKey",
  "bearer",
  "nonce",
  "state",
  "signature",
  "webhook_secret",
  "webhookSecret",
  "encryption_key",
  "encryptionKey",
  "session_token",
  "sessionToken",
  "csrf",
  "csrfToken",
  "csrf_token",
];

/**
 * Regex patterns that catch common secret formats in string values,
 * regardless of the key name.
 */
const MASKED_PATTERNS = [
  /sk-ant-api\S+/gi,                                        // Anthropic API keys
  /sk-[a-zA-Z0-9]{20,}/gi,                                  // OpenAI API keys
  /GOCSPX-\S+/gi,                                           // Google client secrets
  /AIzaSy[a-zA-Z0-9_-]{30,}/gi,                             // Google API keys
  /ya29\.[a-zA-Z0-9_-]+/gi,                                 // Google access tokens
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/gi, // JWTs
  /[0-9a-f]{32,}/gi,                                        // Hex-encoded secrets (HMAC, encryption keys)
];

const isProd = process.env.NODE_ENV === "production";

/**
 * Singleton logger instance for all server-side code.
 *
 * - Production: JSON output (one structured object per line, Vercel-friendly)
 * - Development: Pretty output (human-readable, coloured)
 */
export const log = new Logger({
  name: "fenrir-backend",
  type: isProd ? "json" : "pretty",
  minLevel: isProd ? 2 : 0,        // prod: debug+  dev: silly+
  maskValuesOfKeys: MASKED_KEYS,
  maskValuesOfKeysCaseInsensitive: true,
  maskValuesRegEx: MASKED_PATTERNS,
  maskPlaceholder: "[***]",
  hideLogPositionForProduction: isProd,
});
