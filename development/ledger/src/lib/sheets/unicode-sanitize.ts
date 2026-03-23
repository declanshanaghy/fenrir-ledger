/**
 * Unicode sanitization for CSV input.
 *
 * Strips control characters and invisible Unicode that could be used to bypass
 * input validation or cause unexpected parsing behavior (MEDIUM-003, issue #1892).
 *
 * Keeps: tab (U+0009), LF (U+000A), CR (U+000D) — valid CSV structural chars.
 * Strips:
 *   - C0 controls (except tab/LF/CR): U+0000–U+0008, U+000B, U+000C, U+000E–U+001F
 *   - DEL and C1 controls: U+007F–U+009F
 *   - Zero-width / invisible: U+200B–U+200F
 *   - Bidirectional overrides: U+202A–U+202E
 *   - Invisible operators: U+2060–U+2064
 *   - Deprecated formatting: U+206A–U+206F
 *   - BOM / zero-width no-break space: U+FEFF
 *   - Interlinear annotation: U+FFF9–U+FFFB
 *
 * Normalizes to NFC to defeat combining-char / homoglyph bypass attacks.
 */

/** Pattern matching all Unicode characters that must be stripped from CSV input. */
const STRIP_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u206A-\u206F\uFEFF\uFFF9-\uFFFB]/g;

/**
 * Sanitize CSV text to remove Unicode control characters and invisible
 * characters that could bypass validation or cause unexpected LLM behavior.
 *
 * @param csv - Raw CSV string from user input
 * @returns Sanitized CSV string, NFC-normalized with dangerous characters removed
 */
export function sanitizeCsvUnicode(csv: string): string {
  // NFC normalization defeats combining-char bypass attacks
  const normalized = csv.normalize("NFC");
  // Strip control characters and invisible Unicode
  return normalized.replace(STRIP_PATTERN, "");
}
