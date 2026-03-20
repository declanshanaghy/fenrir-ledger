/**
 * Trial utilities — Fenrir Ledger
 *
 * Browser fingerprinting, localStorage key constants, and the
 * `isKarlOrTrial()` helper for gating Karl features during an active trial.
 *
 * Fingerprint = SHA-256(deviceId), 64-char hex string.
 * The deviceId is a one-time UUID stored in localStorage under `fenrir:device-id`.
 * Using deviceId alone ensures stability across browser updates (userAgent changes
 * on every browser version bump — see issue #1615).
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

/**
 * Last-seen trial cache version stored in localStorage.
 * When the server returns a higher version, the client busts its module-level
 * cache and re-fetches — preventing phantom trial data after backend migrations.
 */
export const LS_TRIAL_CACHE_VERSION = "fenrir:trial-cache-version";

/**
 * Current server-side trial cache version.
 * Increment this when a backend migration could make cached trial state stale
 * (e.g. the Redis → Firestore migration in #1516 bumped this to 2).
 *
 * Version history:
 *   1 — Redis-backed trial store
 *   2 — Firestore-backed trial store (#1516)
 */
export const TRIAL_CACHE_VERSION = 2;

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
  /**
   * Server-side cache version. When the client sees a version different from
   * its stored value, it busts the module-level cache and re-fetches.
   * See `TRIAL_CACHE_VERSION` and `LS_TRIAL_CACHE_VERSION`.
   */
  cacheVersion?: number;
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
 * Computes the browser fingerprint as SHA-256(deviceId).
 * Returns a 64-character lowercase hex string.
 *
 * Using deviceId alone ensures the fingerprint is stable across browser
 * updates (userAgent changes on every browser version bump).
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
  const input = deviceId;

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
