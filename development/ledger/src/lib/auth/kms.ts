/**
 * KMS envelope decryption for JWT signing secret — Fenrir Ledger
 *
 * Called ONCE on pod startup (via Next.js instrumentation). Decrypts the
 * FENRIR_JWT_SECRET_CIPHERTEXT env var via Cloud KMS and stores the plaintext
 * key in module memory. The key is NEVER written to disk or logged.
 *
 * Envelope encryption pattern:
 *   - At secret creation: gcloud kms encrypt → base64 ciphertext stored in K8s
 *   - At pod startup: kms.decrypt() → plaintext key held in memory only
 *   - Per request: getJwtSecret() returns the in-memory key (zero KMS calls)
 *
 * Key rotation:
 *   1. Re-encrypt DEK with new KMS key version (sync-secrets.mjs --push)
 *   2. Update K8s secret (FENRIR_JWT_SECRET_CIPHERTEXT)
 *   3. Restart pods — initJwtSecret() decrypts with the new version
 *
 * Local development (NODE_ENV !== 'production'):
 *   Falls back to FENRIR_JWT_SECRET plaintext env var — no KMS call.
 *
 * Required env vars (production):
 *   KMS_KEY_NAME              — full resource name from `terraform output kms_key_name`
 *   FENRIR_JWT_SECRET_CIPHERTEXT — base64-encoded KMS ciphertext
 *
 * Required env vars (development):
 *   FENRIR_JWT_SECRET         — plaintext signing key
 */

import { KeyManagementServiceClient } from "@google-cloud/kms";

/** Module-level cache — set once, never mutated after init */
let _jwtSecret: string | null = null;

/**
 * Initialise the in-memory JWT signing secret.
 *
 * In production: reads FENRIR_JWT_SECRET_CIPHERTEXT and KMS_KEY_NAME, calls
 * Cloud KMS decrypt, and caches the plaintext key in module memory.
 *
 * In development: reads FENRIR_JWT_SECRET directly.
 *
 * Idempotent — safe to call multiple times (no-op after first successful init).
 *
 * @throws {Error} if required env vars are missing or KMS decrypt fails
 */
export async function initJwtSecret(): Promise<void> {
  if (_jwtSecret !== null) return; // Already initialised

  if (process.env.NODE_ENV !== "production") {
    const dev = process.env.FENRIR_JWT_SECRET;
    if (!dev) {
      throw new Error(
        "FENRIR_JWT_SECRET env var must be set for JWT signing in development"
      );
    }
    _jwtSecret = dev;
    return;
  }

  const ciphertext = process.env.FENRIR_JWT_SECRET_CIPHERTEXT;
  if (!ciphertext) {
    throw new Error(
      "FENRIR_JWT_SECRET_CIPHERTEXT env var is required in production — " +
        "run sync-secrets.mjs to encrypt and push the ciphertext"
    );
  }

  const keyName = process.env.KMS_KEY_NAME;
  if (!keyName) {
    throw new Error(
      "KMS_KEY_NAME env var is required in production — " +
        "set to the value of `terraform output kms_key_name`"
    );
  }

  const client = new KeyManagementServiceClient();
  const [result] = await client.decrypt({
    name: keyName,
    ciphertext: Buffer.from(ciphertext, "base64"),
  });

  if (!result.plaintext) {
    throw new Error("KMS decrypt returned empty plaintext — check KMS IAM and ciphertext validity");
  }

  // Trim whitespace in case the plaintext was padded during encryption
  _jwtSecret = Buffer.from(result.plaintext).toString("utf8").trimEnd();
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
