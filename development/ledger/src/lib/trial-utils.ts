/**
 * Trial utilities — Fenrir Ledger
 *
 * localStorage key constants for trial UI state flags and cache versioning.
 * Trial state itself is stored server-side in /households/{userId}/trial.
 *
 * @module trial-utils
 */

// ---------------------------------------------------------------------------
// localStorage key constants
// ---------------------------------------------------------------------------

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
 * Increment this when a backend migration could make cached trial state stale.
 *
 * Version history:
 *   1 — Redis-backed trial store
 *   2 — Firestore-backed trial store (#1516)
 *   3 — Household subcollection trial store (#1634)
 */
export const TRIAL_CACHE_VERSION = 3;

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
  /** ISO timestamp of when the trial expires — canonical source of truth. */
  expiresAt?: string;
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
