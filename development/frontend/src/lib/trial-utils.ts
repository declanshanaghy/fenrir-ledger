/**
 * Trial utilities — Fenrir Ledger
 *
 * Browser fingerprinting, localStorage key constants, and the
 * `isKarlOrTrial()` helper for gating Karl features during an active trial.
 *
 * Fingerprint = raw deviceId (UUID v4), 36 chars with dashes.
 * The deviceId is a one-time UUID stored in localStorage under `fenrir:device-id`.
 * SHA-256(deviceId) was a 1:1 mapping that added no entropy or security value;
 * the raw UUID is used directly instead (see issue #1624).
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
 * Computes the browser fingerprint as the raw deviceId (UUID v4).
 *
 * SHA-256(deviceId) was removed in issue #1624 — it was a 1:1 mapping adding
 * no entropy or security value. Returning the raw UUID simplifies call sites
 * (synchronous, no crypto.subtle dependency).
 *
 * Must be called from a browser context (requires `window`).
 *
 * @returns UUID v4 fingerprint, or empty string if not in browser
 */
export function computeFingerprint(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return getOrCreateDeviceId();
}

/**
 * Validates a fingerprint string.
 *
 * Accepts:
 *   - UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (36 chars) — current format
 *   - 64-char lowercase hex (SHA-256) — legacy format, accepted during migration (#1624)
 *
 * @param fingerprint - The fingerprint to validate
 * @returns true if valid
 */
export function isValidFingerprint(fingerprint: string): boolean {
  // Current format: UUID v4
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(fingerprint)) {
    return true;
  }
  // Legacy format: 64-char lowercase hex (SHA-256), accepted during migration
  return /^[0-9a-f]{64}$/.test(fingerprint);
}
