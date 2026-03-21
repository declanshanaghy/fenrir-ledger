/**
 * Firestore trial store — server-side persistence for trial state.
 *
 * Stores and retrieves trial records in the household subcollection:
 *   /households/{userId}/trial
 *
 * The trial document is permanent (never auto-deleted) so we can always
 * detect restart attempts after expiry.
 *
 * @module kv/trial-store
 */

import { getFirestore } from "@/lib/firebase/firestore";
import { log } from "@/lib/logger";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";
import { FIRESTORE_PATHS } from "@/lib/firebase/firestore-types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a trial record stored in Firestore (public interface). */
export interface StoredTrial {
  /** ISO timestamp of when the trial started (first card creation). */
  startDate: string;
  /** ISO timestamp of when the trial ends (startDate + 30 days). */
  expiresAt: string;
  /** ISO timestamp of when the user converted to Karl (if they did). */
  convertedDate?: string;
}

/** Error thrown when attempting to restart an already-expired trial. */
export class TrialRestartError extends Error {
  constructor(userId: string) {
    super(`Trial restart blocked for user ${userId}: trial has already expired.`);
    this.name = "TrialRestartError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trialDocRef(userId: string) {
  return getFirestore().doc(FIRESTORE_PATHS.trial(userId));
}

function makeExpiresAt(startDate: Date): string {
  const d = new Date(startDate.getTime() + TRIAL_DURATION_DAYS * MS_PER_DAY);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Retrieves a trial record by userId.
 *
 * @param userId - Google OAuth `sub`
 * @returns The stored trial record or null if not found
 */
export async function getTrial(userId: string): Promise<StoredTrial | null> {
  log.debug("getTrial called", { userId });
  try {
    const snap = await trialDocRef(userId).get();
    if (!snap.exists) {
      log.debug("getTrial returning", { userId, found: false });
      return null;
    }
    const doc = snap.data() as StoredTrial;
    const trial: StoredTrial = {
      startDate: doc.startDate,
      expiresAt: doc.expiresAt,
      ...(doc.convertedDate ? { convertedDate: doc.convertedDate } : {}),
    };
    log.debug("getTrial returning", { userId, found: true, startDate: trial.startDate });
    return trial;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getTrial failed", { userId, error: message });
    return null;
  }
}

/**
 * Creates a new trial record in Firestore at /households/{userId}/trial.
 *
 * - If a trial record already exists and is active or converted: returns it (isNew: false).
 * - If a trial record already exists and is expired: throws TrialRestartError.
 * - If no record exists: creates a new trial (isNew: true).
 *
 * @param userId - Google OAuth `sub`
 * @returns { trial, isNew } — the trial record and whether it was newly created
 * @throws TrialRestartError if the trial is expired and a restart is attempted
 */
export async function initTrial(userId: string): Promise<{ trial: StoredTrial; isNew: boolean }> {
  log.debug("initTrial called", { userId });

  const existing = await getTrial(userId);
  if (existing) {
    const { status } = computeTrialStatus(existing);
    if (status === "expired") {
      log.warn("initTrial: restart blocked — trial already expired", { userId });
      throw new TrialRestartError(userId);
    }
    log.debug("initTrial returning", { userId, reason: "already_exists", startDate: existing.startDate });
    return { trial: existing, isNew: false };
  }

  const startDate = new Date();
  const trial: StoredTrial = {
    startDate: startDate.toISOString(),
    expiresAt: makeExpiresAt(startDate),
  };

  try {
    await trialDocRef(userId).set(trial);
    log.debug("initTrial returning", { userId, startDate: trial.startDate });
    return { trial, isNew: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("initTrial failed", { userId, error: message });
    throw err;
  }
}

/**
 * Marks a trial as converted by setting the convertedDate field.
 * Called after a successful Stripe subscription.
 *
 * @param userId - Google OAuth `sub`
 * @returns true if the trial was found and updated, false otherwise
 */
export async function markTrialConverted(userId: string): Promise<boolean> {
  log.debug("markTrialConverted called", { userId });

  const trial = await getTrial(userId);
  if (!trial) {
    log.debug("markTrialConverted: no trial found", { userId });
    return false;
  }

  if (trial.convertedDate) {
    log.debug("markTrialConverted: already converted", { userId });
    return true;
  }

  try {
    const convertedDate = new Date().toISOString();
    await trialDocRef(userId).update({ convertedDate });
    log.debug("markTrialConverted success", { userId, convertedDate });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("markTrialConverted failed", { userId, error: message });
    return false;
  }
}

/**
 * Computes the trial status for a given trial record.
 *
 * Uses `expiresAt` as the single source of truth — never recalculates
 * from `startDate + duration`.
 *
 * @param trial - The stored trial record (or null if none exists)
 * @returns Object with remaining days, status, and expiresAt
 */
export function computeTrialStatus(trial: StoredTrial | null): {
  remainingDays: number;
  status: "active" | "expired" | "converted" | "none";
  expiresAt?: string;
  convertedDate?: string;
} {
  if (!trial) {
    return { remainingDays: 0, status: "none" };
  }

  if (trial.convertedDate) {
    return {
      remainingDays: 0,
      status: "converted",
      expiresAt: trial.expiresAt,
      convertedDate: trial.convertedDate,
    };
  }

  const now = new Date();
  const remainingMs = new Date(trial.expiresAt).getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / MS_PER_DAY));

  if (remainingDays <= 0) {
    return { remainingDays: 0, status: "expired", expiresAt: trial.expiresAt };
  }

  return { remainingDays, status: "active", expiresAt: trial.expiresAt };
}
