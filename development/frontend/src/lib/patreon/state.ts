/**
 * OAuth state parameter management for Patreon linking flow.
 *
 * The state parameter carries:
 *   - Google user sub (so the callback knows who initiated the flow),
 *     or "anonymous" for users who have not signed in with Google
 *   - Mode flag ("authenticated" or "anonymous")
 *   - CSRF nonce (prevents cross-site request forgery)
 *   - Creation timestamp (for expiry validation)
 *
 * The state is encrypted with AES-256-GCM using the ENTITLEMENT_ENCRYPTION_KEY
 * to prevent tampering and information leakage.
 *
 * @module patreon/state
 */

import { log } from "@/lib/logger";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";
import type { PatreonOAuthState } from "./types";
import crypto from "crypto";

/** State token validity window: 10 minutes. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Generates an encrypted OAuth state token.
 *
 * When `googleSub` is provided, the state is created in "authenticated" mode.
 * When `googleSub` is omitted or undefined, the state is created in "anonymous" mode
 * with `googleSub` set to `"anonymous"`.
 *
 * @param googleSub - The Google user sub to embed, or undefined for anonymous flow
 * @returns Base64-encoded encrypted state string
 */
export function generateState(googleSub?: string): string {
  const isAnonymous = !googleSub;
  const effectiveSub = googleSub ?? "anonymous";
  const mode = isAnonymous ? "anonymous" : "authenticated";

  log.debug("generateState called", { googleSub: effectiveSub, mode });

  const state: PatreonOAuthState = {
    googleSub: effectiveSub,
    nonce: crypto.randomBytes(16).toString("hex"),
    createdAt: Date.now(),
    mode,
  };

  const stateJson = JSON.stringify(state);
  const encrypted = encrypt(stateJson);

  log.debug("generateState returning", { stateLength: encrypted.length, mode });
  return encrypted;
}

/**
 * Validates and decodes an encrypted OAuth state token.
 *
 * Checks:
 *   1. Decryption succeeds (integrity)
 *   2. JSON structure is valid
 *   3. Token has not expired (10-minute window)
 *   4. Required fields are present
 *   5. Mode field is valid (defaults to "authenticated" for backwards compatibility)
 *
 * @param stateToken - The encrypted state string from the callback URL
 * @returns The decoded state or null if validation fails
 */
export function validateState(stateToken: string): PatreonOAuthState | null {
  log.debug("validateState called", { stateTokenLength: stateToken.length });

  try {
    const decrypted = decrypt(stateToken);
    const parsed = JSON.parse(decrypted) as Record<string, unknown>;

    // Validate required fields
    if (!parsed.googleSub || !parsed.nonce || !parsed.createdAt) {
      log.debug("validateState returning", { valid: false, reason: "missing fields" });
      return null;
    }

    // Backwards compatibility: state tokens created before the mode field
    // was added are treated as "authenticated" (the only mode that existed).
    const mode = parsed.mode === "anonymous" ? "anonymous" : "authenticated";

    const state: PatreonOAuthState = {
      googleSub: parsed.googleSub as string,
      nonce: parsed.nonce as string,
      createdAt: parsed.createdAt as number,
      mode,
    };

    // Check expiry
    const age = Date.now() - state.createdAt;
    if (age > STATE_MAX_AGE_MS) {
      log.debug("validateState returning", {
        valid: false,
        reason: "expired",
        ageMs: age,
        maxAgeMs: STATE_MAX_AGE_MS,
      });
      return null;
    }

    log.debug("validateState returning", {
      valid: true,
      googleSub: state.googleSub,
      mode: state.mode,
      ageMs: age,
    });
    return state;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.debug("validateState returning", { valid: false, reason: "decryption failed", error: message });
    return null;
  }
}
