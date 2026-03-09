/**
 * sign-in-url — builds /ledger/sign-in?returnTo=<path> and validates returnTo values.
 *
 * Used by every component that navigates to the sign-in page so the user
 * returns to their original page after completing OAuth.
 *
 * Security: only relative paths starting with "/" are accepted. Protocol-relative
 * URLs ("//evil.com"), absolute URLs, and paths containing backslashes or
 * control characters are rejected. The sign-in page defaults to /ledger when
 * returnTo is missing or invalid.
 */

const DEFAULT_DESTINATION = "/ledger";

/**
 * Validates that a returnTo value is a safe relative path.
 *
 * Prevents open-redirect attacks by rejecting:
 *  - Empty/missing values
 *  - Absolute URLs (http://, https://, etc.)
 *  - Protocol-relative URLs (//evil.com)
 *  - Paths with backslashes (\\evil.com — some browsers normalise \ to /)
 *  - Paths with control characters or encoded newlines
 *  - The sign-in page itself (would cause a loop)
 *
 * @returns The validated path, or `/ledger` if invalid.
 */
export function validateReturnTo(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return DEFAULT_DESTINATION;

  const trimmed = value.trim();

  // Must start with exactly one slash — reject "//" (protocol-relative).
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_DESTINATION;
  }

  // Reject backslashes (some browsers normalise \ to / enabling //evil.com).
  if (trimmed.includes("\\")) {
    return DEFAULT_DESTINATION;
  }

  // Reject control characters and encoded newlines (%0a, %0d) which can
  // enable header injection in some environments.
  if (/[\x00-\x1f]/.test(trimmed) || /%0[aAdD]/i.test(trimmed)) {
    return DEFAULT_DESTINATION;
  }

  // Don't allow returnTo to the sign-in page itself (would cause a loop).
  if (trimmed === "/ledger/sign-in" || trimmed.startsWith("/ledger/sign-in?")) {
    return DEFAULT_DESTINATION;
  }

  return trimmed;
}

/**
 * Builds the sign-in URL with an optional returnTo query param.
 *
 * @param currentPath - The current pathname (from `usePathname()`).
 *   If it equals "/ledger/sign-in" or is empty, returnTo is omitted
 *   so the sign-in page falls back to its default ("/ledger").
 */
export function buildSignInUrl(currentPath?: string): string {
  const base = "/ledger/sign-in";

  const validated = validateReturnTo(currentPath);

  // Skip returnTo when it resolves to the default destination.
  if (validated === DEFAULT_DESTINATION || validated === "/ledger/") {
    return base;
  }

  return `${base}?returnTo=${encodeURIComponent(validated)}`;
}
