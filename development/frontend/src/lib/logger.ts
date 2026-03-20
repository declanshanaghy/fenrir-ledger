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
import { appendFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

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

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_LOG_FILES = 5;

/**
 * Rotate log files: foo.jsonl → foo.1.jsonl → foo.2.jsonl … foo.5.jsonl (deleted).
 * Called at startup and when the active file exceeds MAX_LOG_SIZE.
 */
function rotateLogFile(logPath: string): void {
  if (!existsSync(logPath)) return;
  const base = logPath.replace(/\.jsonl$/, "");
  // Delete oldest if at capacity
  const oldest = `${base}.${MAX_LOG_FILES}.jsonl`;
  if (existsSync(oldest)) unlinkSync(oldest);
  // Shift .4→.5, .3→.4, .2→.3, .1→.2
  for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
    const src = `${base}.${i}.jsonl`;
    if (existsSync(src)) renameSync(src, `${base}.${i + 1}.jsonl`);
  }
  // Active → .1
  renameSync(logPath, `${base}.1.jsonl`);
}

/**
 * Create a named logger that writes JSONL to a file instead of stdout.
 * Console output is suppressed — all output goes to the file.
 *
 * The file extension is forced to `.jsonl` regardless of what is passed.
 * Rotates the existing log at startup and when the file exceeds 10 MB.
 * Keeps up to 5 previous log files (foo.1.jsonl … foo.5.jsonl).
 *
 * Usage:
 *   import { createFileLogger } from "@fenrir/logger";
 *   const log = createFileLogger("odins-spear", "tmp/logs/odins-spear");
 */
export function createFileLogger(name: string, filePath: string) {
  const normalised = filePath.replace(/\.(log|jsonl?)$/i, "") + ".jsonl";
  mkdirSync(dirname(normalised), { recursive: true });

  // Rotate on startup so each run gets a fresh file
  rotateLogFile(normalised);

  let bytesWritten = 0;

  const fileLogger = new Logger({
    name,
    type: "hidden",           // suppress console output
    minLevel: 0,              // silly+ (everything)
    maskValuesOfKeys: MASKED_KEYS,
    maskValuesOfKeysCaseInsensitive: true,
    maskValuesRegEx: MASKED_PATTERNS,
    maskPlaceholder: "[***]",
  });
  fileLogger.attachTransport((logObj) => {
    const meta = (logObj as Record<string, unknown>)["_meta"] as Record<string, unknown> | undefined;
    const metaPath = meta?.["path"] as Record<string, unknown> | undefined;

    const args: unknown[] = [];
    for (let i = 0; i in (logObj as Record<string, unknown>); i++) {
      args.push((logObj as Record<string, unknown>)[String(i)]);
    }
    const message = args.length === 1 && typeof args[0] === "string"
      ? args[0]
      : args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");

    const entry: Record<string, unknown> = {
      datetime: meta?.["date"],
      runtimeVersion: meta?.["runtimeVersion"],
      hostname: meta?.["hostname"],
      name: meta?.["name"],
      logLevelId: meta?.["logLevelId"],
      level: meta?.["logLevelName"],
      message,
      codeLocation: metaPath?.["fullFilePath"] ?? undefined,
    };
    if (args.length > 1 && typeof args[args.length - 1] === "object" && args[args.length - 1] !== null) {
      entry["data"] = args[args.length - 1];
    }

    // Size-based rotation
    if (bytesWritten >= MAX_LOG_SIZE) {
      rotateLogFile(normalised);
      bytesWritten = 0;
    }

    const line = JSON.stringify(entry) + "\n";
    appendFileSync(normalised, line);
    bytesWritten += Buffer.byteLength(line);
  });
  return fileLogger;
}
