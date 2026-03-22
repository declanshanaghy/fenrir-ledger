/**
 * AES-256-GCM encryption utilities for sensitive data at rest.
 *
 * Used to encrypt sensitive data before storing in Vercel KV.
 * Requires ENTITLEMENT_ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 *
 * Format: base64(iv:ciphertext:authTag)
 *   - iv: 12 bytes (96-bit, AES-GCM standard)
 *   - authTag: 16 bytes (128-bit, AES-GCM standard)
 *   - ciphertext: variable length
 *
 * @module crypto/encrypt
 */

import { log } from "@/lib/logger";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Returns the 32-byte encryption key derived from the hex env var.
 * Throws if the key is missing or malformed.
 */
function getEncryptionKey(): Buffer {
  log.debug("getEncryptionKey called");
  const hexKey = process.env.ENTITLEMENT_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error("ENTITLEMENT_ENCRYPTION_KEY environment variable is not set.");
  }
  if (hexKey.length !== 64) {
    throw new Error("ENTITLEMENT_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).");
  }
  const key = Buffer.from(hexKey, "hex");
  log.debug("getEncryptionKey returning", { keyLength: key.length });
  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded string containing iv + ciphertext + authTag
 */
export function encrypt(plaintext: string): string {
  log.debug("encrypt called", { plaintextLength: plaintext.length });
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Concatenate iv + encrypted + authTag and base64 encode
  const combined = Buffer.concat([iv, encrypted, authTag]);
  const result = combined.toString("base64");
  log.debug("encrypt returning", { resultLength: result.length });
  return result;
}

/**
 * Decrypts a base64-encoded AES-256-GCM ciphertext.
 *
 * @param encryptedBase64 - Base64-encoded string from encrypt()
 * @returns The original plaintext string
 */
export function decrypt(encryptedBase64: string): string {
  log.debug("decrypt called", { encryptedLength: encryptedBase64.length });
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  // Extract iv (first 12 bytes), authTag (last 16 bytes), ciphertext (middle)
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  const result = decrypted.toString("utf8");
  log.debug("decrypt returning", { resultLength: result.length });
  return result;
}
