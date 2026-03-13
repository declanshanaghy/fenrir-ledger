/**
 * Trial utilities — Fenrir Ledger
 *
 * Browser fingerprinting, localStorage key constants, and the
 * `isKarlOrTrial()` helper for gating Karl features during an active trial.
 *
 * Fingerprint = SHA-256(userAgent + deviceId), 64-char hex string.
 * The deviceId is a one-time UUID stored in localStorage under `fenrir:device-id`.
 *
 * @module trial-utils
 */

// ---------------------------------------------------------------------------
// localStorage key constants
// ---------------------------------------------------------------------------

/** One-time UUID v4 identifying this device/browser combo. */
export const LS_DEVICE_ID = "fenrir:device-id";

/** Boolean — whether the trial-start celebration toast has been shown. */
export const LS_TRIAL_START_TOAST_SHOWN = "fenrir:trial-start-toast-shown";

/** Boolean — whether the day-15 mid-trial nudge has been shown. */
export const LS_TRIAL_DAY15_NUDGE_SHOWN = "fenrir:trial-day15-nudge-shown";

/** Boolean — whether the day-30 expiry modal has been shown. */
export const LS_TRIAL_EXPIRY_MODAL_SHOWN = "fenrir:trial-expiry-modal-shown";

/** Boolean — whether the post-trial upgrade banner has been dismissed. */
export const LS_POST_TRIAL_BANNER_DISMISSED = "fenrir:post-trial-banner-dismissed";

/** Thrall-tier card visibility limit. Cards beyond this count are locked. */
export const THRALL_CARD_LIMIT = 5;

// ---------------------------------------------------------------------------
// Trial status types
// ---------------------------------------------------------------------------

/** Possible trial statuses returned by /api/trial/status. */
export type TrialStatus = "active" | "expired" | "converted" | "none";

/** Shape of the trial status response from the API. */
export interface TrialStatusResponse {
  remainingDays: number;
  status: TrialStatus;
  convertedDate?: string;
}

/** Trial duration in days. */
export const TRIAL_DURATION_DAYS = 30;

// ---------------------------------------------------------------------------
// Fingerprinting
// ---------------------------------------------------------------------------

/**
 * Generates a v4-style UUID using crypto.randomUUID() or a fallback.
 *
 * @returns A UUID v4 string
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves or creates the persistent device ID from localStorage.
 * The device ID is a UUID v4 stored under `fenrir:device-id`.
 *
 * @returns The device ID string
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const existing = localStorage.getItem(LS_DEVICE_ID);
  if (existing) {
    return existing;
  }
  const newId = generateUUID();
  localStorage.setItem(LS_DEVICE_ID, newId);
  return newId;
}

/**
 * Computes the browser fingerprint as SHA-256(userAgent + deviceId).
 * Returns a 64-character lowercase hex string.
 *
 * Must be called from a browser context (requires `window` and `crypto.subtle`).
 *
 * @returns 64-char hex fingerprint, or empty string if not in browser
 */
export async function computeFingerprint(): Promise<string> {
  if (typeof window === "undefined") {
    return "";
  }

  const deviceId = getOrCreateDeviceId();
  const input = navigator.userAgent + deviceId;

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Validates a fingerprint string: must be exactly 64 lowercase hex chars.
 *
 * @param fingerprint - The fingerprint to validate
 * @returns true if valid
 */
export function isValidFingerprint(fingerprint: string): boolean {
  return /^[0-9a-f]{64}$/.test(fingerprint);
}
