/**
 * sign-in-url — builds /ledger/sign-in?returnTo=<path>
 *
 * Used by every component that navigates to the sign-in page so the user
 * returns to their original page after completing OAuth.
 *
 * Security: only relative paths are accepted. Absolute URLs are ignored
 * (the sign-in page defaults to /ledger when returnTo is missing or invalid).
 */

/**
 * Builds the sign-in URL with an optional returnTo query param.
 *
 * @param currentPath - The current pathname (from `usePathname()`).
 *   If it equals "/ledger/sign-in" or is empty, returnTo is omitted
 *   so the sign-in page falls back to its default ("/ledger").
 */
export function buildSignInUrl(currentPath?: string): string {
  const base = "/ledger/sign-in";

  // Skip returnTo when already on the sign-in page or at the default destination.
  if (
    !currentPath ||
    currentPath === base ||
    currentPath === "/ledger" ||
    currentPath === "/ledger/"
  ) {
    return base;
  }

  // Only allow relative paths (must start with "/"). Reject anything else.
  if (!currentPath.startsWith("/")) {
    return base;
  }

  return `${base}?returnTo=${encodeURIComponent(currentPath)}`;
}
