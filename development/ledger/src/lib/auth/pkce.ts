/**
 * PKCE Utilities — Fenrir Ledger
 *
 * Authorization Code + PKCE helpers for the browser-native OAuth flow.
 * Uses only the Web Crypto API — no external dependencies.
 *
 * - generateCodeVerifier()  — 96-byte cryptographically random verifier (base64url)
 * - generateCodeChallenge() — S256: base64url(SHA-256(verifier))
 * - generateState()         — 16-byte random hex string for CSRF protection
 *
 * References:
 *   RFC 7636 — Proof Key for Code Exchange by OAuth Public Clients
 *   https://tools.ietf.org/html/rfc7636
 */

/**
 * Encodes a Uint8Array as a base64url string (RFC 4648 §5).
 * Replaces + with -, / with _, and strips trailing = padding.
 */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generates a cryptographically random code_verifier.
 * 96 bytes → 128-char base64url string (within RFC 7636's 43–128 char range).
 */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(96);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

/**
 * Computes code_challenge = base64url(SHA-256(ASCII(code_verifier))).
 * This is the S256 method required by RFC 7636.
 *
 * @param verifier — the code_verifier string from generateCodeVerifier()
 * @returns Promise<string> — base64url-encoded SHA-256 digest
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(new Uint8Array(hashBuffer));
}

/**
 * Generates a random state parameter for CSRF protection.
 * 16 bytes → 32-char lowercase hex string.
 */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
