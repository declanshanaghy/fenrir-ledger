/**
 * sanitize-chronicle.mjs — Secret sanitization for published agent chronicles.
 *
 * Applies a sanitization pass to any text before it is written to
 * content/blog/ as a public MDX chronicle.  The rules follow the
 * project-wide masking convention:
 *
 *   first 4 chars + 'x' * (len - 8) + last 4 chars
 *
 * When the value is too short to apply that formula (< 9 chars) the
 * entire value is replaced with [REDACTED].
 *
 * Categories sanitized:
 *  1. Known secret patterns (API keys, tokens, JWTs)  → masked
 *  2. K8s / GCP infrastructure details                → [REDACTED]
 *  3. Git credentials in URLs                         → credentials stripped
 *  4. File-content tool output (Read/Write results)  → truncated + note
 *  5. Env-var name references in task prompts         → env-var name kept,
 *                                                       value masked if present
 *
 * All exported functions are pure — no I/O side effects.
 */

// ---------------------------------------------------------------------------
// Masking helpers
// ---------------------------------------------------------------------------

/**
 * Apply the standard project mask:
 *   first4 + 'x'*(len-8) + last4
 * For values shorter than 9 chars, return [REDACTED].
 *
 * @param {string} value
 * @returns {string}
 */
export function maskSecret(value) {
  if (typeof value !== "string") return "[REDACTED]";
  if (value.length < 9) return "[REDACTED]";
  return (
    value.slice(0, 4) +
    "x".repeat(value.length - 8) +
    value.slice(-4)
  );
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

/**
 * Regex patterns that match known secret formats.
 * Each entry: { pattern: RegExp, label?: string }
 * The regex must capture the secret in group 1 (or the whole match if no group).
 */
const SECRET_PATTERNS = [
  // Anthropic API keys
  { pattern: /\b(sk-ant-api[A-Za-z0-9_-]{10,})/g },
  // OpenAI-style API keys
  { pattern: /\b(sk-[A-Za-z0-9]{20,})/g },
  // Google client secrets
  { pattern: /\b(GOCSPX-[A-Za-z0-9_-]+)/g },
  // Google API keys (AIzaSy...)
  { pattern: /\b(AIzaSy[A-Za-z0-9_-]{30,})/g },
  // Google OAuth access tokens
  { pattern: /\b(ya29\.[A-Za-z0-9_-]+)/g },
  // JWTs (three base64url segments)
  { pattern: /\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g },
  // Long hex-encoded secrets (32+ hex chars that are standalone tokens)
  { pattern: /\b([0-9a-f]{32,})\b/g },
  // GitHub tokens  (ghp_, gho_, ghs_, ghu_ prefixes)
  { pattern: /\b(gh[pousx]_[A-Za-z0-9]{36,})/g },
  // Generic bearer tokens  Authorization: Bearer <token>
  { pattern: /\bBearer\s+([A-Za-z0-9_.\-]{20,})/g },
  // npm auth tokens
  { pattern: /\b(npm_[A-Za-z0-9]{36,})/g },
];

/**
 * Regexes for K8s / GCP infrastructure detail lines that should be redacted.
 * These replace the sensitive part of the match with [REDACTED].
 */
const INFRA_PATTERNS = [
  // K8s namespace references   (e.g. fenrir-app, kube-system, etc.)
  { pattern: /\b(namespace\s*[:=]\s*)([^\s,'";\n]+)/gi, replacement: "$1[REDACTED]" },
  // GKE cluster names
  { pattern: /\b(cluster(?:-name)?\s*[:=]\s*)([^\s,'";\n]+)/gi, replacement: "$1[REDACTED]" },
  // GCP project IDs  (project: xxx or --project xxx)
  { pattern: /(--project\s+)([^\s,'";\n]+)/g, replacement: "$1[REDACTED]" },
  { pattern: /\b(project\s*[:=]\s*)([^\s,'";\n]+)/gi, replacement: "$1[REDACTED]" },
  // GCP regions / zones  (zone: us-central1-a)
  { pattern: /\b(zone\s*[:=]\s*)([^\s,'";\n]+)/gi, replacement: "$1[REDACTED]" },
  { pattern: /\b(region\s*[:=]\s*)([^\s,'";\n]+)/gi, replacement: "$1[REDACTED]" },
  // Internal service DNS (*.svc.cluster.local)
  { pattern: /[a-z0-9._-]+\.svc\.cluster\.local(:\d+)?/gi, replacement: "[REDACTED-SVC]" },
  // Internal GKE endpoint IPs
  { pattern: /\b(endpoint(?:s)?\s*[:=]\s*)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/gi, replacement: "$1[REDACTED]" },
];

/**
 * Strip credentials from git remote URLs.
 *   https://user:token@github.com/...  →  https://github.com/...
 */
const GIT_CREDENTIAL_PATTERN = /https?:\/\/[^@\s]+@(github\.com[^\s"'<>]*)/gi;

// ---------------------------------------------------------------------------
// Sanitization functions
// ---------------------------------------------------------------------------

/**
 * Mask known secret token patterns using the project masking formula.
 *
 * @param {string} text
 * @returns {string}
 */
export function maskSecretPatterns(text) {
  if (typeof text !== "string") return text;
  let out = text;
  for (const { pattern } of SECRET_PATTERNS) {
    // Reset lastIndex in case the regex is reused
    pattern.lastIndex = 0;
    out = out.replace(pattern, (match, captured) => {
      const target = captured !== undefined ? captured : match;
      const masked = maskSecret(target);
      return captured !== undefined ? match.replace(captured, masked) : masked;
    });
  }
  return out;
}

/**
 * Redact K8s / GCP infrastructure details.
 *
 * @param {string} text
 * @returns {string}
 */
export function redactInfraDetails(text) {
  if (typeof text !== "string") return text;
  let out = text;
  for (const { pattern, replacement } of INFRA_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Strip credentials from git remote URLs.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripGitCredentials(text) {
  if (typeof text !== "string") return text;
  return text.replace(GIT_CREDENTIAL_PATTERN, "https://$1");
}

/**
 * Truncate file-content tool output to prevent leaking source code.
 * Applies to tool results whose content exceeds MAX_TOOL_OUTPUT_CHARS.
 *
 * @param {string} text
 * @param {number} [maxChars=800]
 * @returns {string}
 */
export function truncateToolOutput(text, maxChars = 800) {
  if (typeof text !== "string") return text;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n… [truncated ${text.length - maxChars} chars]`;
}

// ---------------------------------------------------------------------------
// Composite sanitize — run all passes in order
// ---------------------------------------------------------------------------

/**
 * Apply the full sanitization pipeline to a string.
 * Order matters: strip git credentials first, then mask secret patterns,
 * then redact infra details.
 *
 * @param {string} text
 * @returns {string}
 */
export function sanitizeText(text) {
  if (typeof text !== "string") return text;
  let out = text;
  out = stripGitCredentials(out);
  out = maskSecretPatterns(out);
  out = redactInfraDetails(out);
  return out;
}

/**
 * Sanitize a tool result string, applying both content sanitization
 * and output truncation.
 *
 * @param {string} text
 * @param {number} [maxChars=800]
 * @returns {string}
 */
export function sanitizeToolOutput(text, maxChars = 800) {
  if (typeof text !== "string") return text;
  return sanitizeText(truncateToolOutput(text, maxChars));
}
