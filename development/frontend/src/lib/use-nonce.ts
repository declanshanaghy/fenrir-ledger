/**
 * Hook to access CSP nonce from headers
 *
 * In Next.js 15+ with server components, nonces are typically passed via
 * context or extracted from the request in middleware. This hook provides
 * access to the nonce for inline scripts/styles.
 */

import { headers } from "next/headers";

/**
 * Get the CSP nonce for the current request
 * Must be called in a server component or server action
 * @returns The nonce value, or undefined if not set
 */
export async function getNonce(): Promise<string | undefined> {
  const headersList = await headers();
  return headersList.get("x-nonce-csp") || undefined;
}
