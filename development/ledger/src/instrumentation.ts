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
  // Runs on server startup. Skip only if explicitly Edge runtime.
  // NEXT_RUNTIME may not be set in standalone mode at register() time,
  // so we default to running unless we know we're on Edge.
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const { initJwtSecret } = await import("./lib/auth/kms");
    await initJwtSecret();
    console.log("[instrumentation] JWT secret initialised");
  } catch (err) {
    // Log but don't crash the server — fallback to Google tokens still works
    console.error("[instrumentation] Failed to init JWT secret:", err instanceof Error ? err.message : err);
  }
}
