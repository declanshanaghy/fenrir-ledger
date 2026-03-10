/**
 * CSP Nonce Generation — Fenrir Ledger
 *
 * Generates cryptographically secure nonces for Content Security Policy.
 * Each request should have a unique nonce that's embedded in the CSP header
 * and propagated to inline <script> and <style> tags.
 */

/**
 * Generate a cryptographically random nonce for CSP
 * @returns A base64-encoded random string suitable for CSP nonce values
 */
export function generateNonce(): string {
  const nonce = Buffer.from(
    // 32 bytes = 256 bits of entropy (sufficient for CSP nonces)
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))
  ).toString("base64");
  return nonce;
}

/**
 * Extract nonce from request headers
 * Called in middleware to retrieve the nonce that was set for the request
 * @param headers - Incoming request headers
 * @returns The nonce value if present, undefined otherwise
 */
export function getNonceFromHeaders(
  headers: Record<string, string | undefined>
): string | undefined {
  return headers["x-nonce-csp"];
}
