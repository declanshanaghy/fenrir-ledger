/**
 * JWT signing secret — Fenrir Ledger
 *
 * Reads FENRIR_JWT_SECRET directly from process.env on every call.
 * No init step needed — the env var is available in all worker processes.
 *
 * Secret lifecycle:
 *   - Source of truth: Google Secret Manager
 *   - Synced to K8s via: node scripts/sync-secrets.mjs --push FENRIR_JWT_SECRET
 *   - Injected into pods via fenrir-app-secrets K8s Secret
 *
 * Required env var:
 *   FENRIR_JWT_SECRET — plaintext signing key (all environments)
 */

/**
 * Returns the JWT signing secret from process.env.
 *
 * Reads directly from the environment on every call — no module-level
 * caching needed because process.env is shared across all workers.
 *
 * @throws {Error} if FENRIR_JWT_SECRET env var is missing
 */
export function getJwtSecret(): string {
  const secret = process.env.FENRIR_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "FENRIR_JWT_SECRET env var must be set for JWT signing — " +
        "run: node scripts/sync-secrets.mjs --push FENRIR_JWT_SECRET"
    );
  }
  return secret;
}

/**
 * No-op — kept for backwards compatibility with instrumentation.ts.
 * The secret is now read directly from process.env, no init needed.
 */
export async function initJwtSecret(): Promise<void> {
  // Validate the env var is present at startup, but don't cache it
  getJwtSecret();
}

/**
 * Resets nothing — kept for test compatibility.
 * @internal
 */
export function _resetJwtSecretForTesting(): void {
  // No-op: secret is read from process.env directly
}
