/**
 * Next.js Instrumentation — Fenrir Ledger
 *
 * Runs once per server process on startup (not per-request).
 * Used to initialise the KMS-decrypted JWT signing key into memory
 * before any request handlers run.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register(): Promise<void> {
  // Only runs on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initJwtSecret } = await import("./lib/auth/kms");
    await initJwtSecret();
  }
}
