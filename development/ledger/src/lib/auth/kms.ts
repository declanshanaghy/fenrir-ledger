/**
 * JWT signing secret — Fenrir Ledger
 *
 * Called ONCE on pod startup (via Next.js instrumentation). Reads the
 * FENRIR_JWT_SECRET env var and stores it in module memory.
 * The key is NEVER written to disk or logged.
 *
 * Secret lifecycle:
 *   - Source of truth: Google Secret Manager
 *   - Synced to K8s via: node scripts/sync-secrets.mjs --push FENRIR_JWT_SECRET
 *   - Injected into pods via fenrir-app-secrets K8s Secret
 *
 * Required env var:
 *   FENRIR_JWT_SECRET — plaintext signing key (all environments)
 */

/** Module-level cache — set once, never mutated after init */
let _jwtSecret: string | null = null;

/**
 * Initialise the in-memory JWT signing secret.
 *
 * Reads FENRIR_JWT_SECRET from the environment and caches it in module memory.
 *
 * Idempotent — safe to call multiple times (no-op after first successful init).
 *
 * @throws {Error} if FENRIR_JWT_SECRET env var is missing
 */
export async function initJwtSecret(): Promise<void> {
  if (_jwtSecret !== null) return; // Already initialised

  const secret = process.env.FENRIR_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "FENRIR_JWT_SECRET env var must be set for JWT signing — " +
        "run: node scripts/sync-secrets.mjs --push FENRIR_JWT_SECRET"
    );
  }
  _jwtSecret = secret;
}

/**
 * Returns the in-memory JWT signing secret.
 *
 * @throws {Error} if initJwtSecret() has not been successfully called
 */
export function getJwtSecret(): string {
  if (_jwtSecret === null) {
    throw new Error(
      "JWT secret not initialised — ensure initJwtSecret() is awaited at pod startup"
    );
  }
  return _jwtSecret;
}

/**
 * Resets the cached secret. Used in tests only — never call in production.
 * @internal
 */
export function _resetJwtSecretForTesting(): void {
  _jwtSecret = null;
}
