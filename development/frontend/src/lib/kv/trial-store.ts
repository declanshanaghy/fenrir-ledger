/**
 * Redis trial store — server-side persistence for trial state.
 *
 * Stores and retrieves trial records keyed by browser fingerprint.
 *
 * Key format: `trial:{fingerprint}` → StoredTrial
 *
 * TTL: 60 days (covers the 30-day trial + 30 days of post-trial data retention).
 *
 * @module kv/trial-store
 */

import { getRedisClient } from "@/lib/kv/redis-client";
import { log } from "@/lib/logger";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a trial record stored in Redis. */
export interface StoredTrial {
  /** ISO timestamp of when the trial started (first card creation). */
  startDate: string;
  /** ISO timestamp of when the user converted to Karl (if they did). */
  convertedDate?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 60 days in seconds — covers trial + post-trial data retention. */
const TRIAL_TTL_SECONDS = 60 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

/**
 * Builds the KV key for a trial record.
 *
 * @param fingerprint - 64-char SHA-256 hex fingerprint
 * @returns KV key string
 */
function trialKey(fingerprint: string): string {
  return `trial:${fingerprint}`;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Retrieves a trial record by fingerprint.
 *
 * @param fingerprint - 64-char SHA-256 hex fingerprint
 * @returns The stored trial record or null if not found / expired
 */
export async function getTrial(fingerprint: string): Promise<StoredTrial | null> {
  log.debug("getTrial called", { fingerprint });
  try {
    const redis = getRedisClient();
    const raw = await redis.get(trialKey(fingerprint));
    const result: StoredTrial | null = raw ? JSON.parse(raw) : null;
    log.debug("getTrial returning", {
      fingerprint,
      found: result !== null,
      startDate: result?.startDate,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getTrial failed", { fingerprint, error: message });
    return null;
  }
}

/**
 * Creates a new trial record in KV. If a record already exists for this
 * fingerprint, this is a no-op — the original start date is preserved.
 *
 * @param fingerprint - 64-char SHA-256 hex fingerprint
 * @returns The stored trial record (existing or newly created)
 */
export async function initTrial(fingerprint: string): Promise<StoredTrial> {
  log.debug("initTrial called", { fingerprint });

  // Check for existing trial first (idempotent)
  const existing = await getTrial(fingerprint);
  if (existing) {
    log.debug("initTrial returning", { fingerprint, reason: "already_exists", startDate: existing.startDate });
    return existing;
  }

  const trial: StoredTrial = {
    startDate: new Date().toISOString(),
  };

  try {
    const redis = getRedisClient();
    await redis.set(trialKey(fingerprint), JSON.stringify(trial), "EX", TRIAL_TTL_SECONDS);
    log.debug("initTrial returning", { fingerprint, startDate: trial.startDate });
    return trial;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("initTrial failed", { fingerprint, error: message });
    throw err;
  }
}

/**
 * Marks a trial as converted by setting the convertedDate field.
 * Called after a successful Stripe subscription from a trial user.
 *
 * @param fingerprint - 64-char SHA-256 hex fingerprint
 * @returns true if the trial was found and updated, false otherwise
 */
export async function markTrialConverted(fingerprint: string): Promise<boolean> {
  log.debug("markTrialConverted called", { fingerprint });

  const existing = await getTrial(fingerprint);
  if (!existing) {
    log.debug("markTrialConverted: no trial found", { fingerprint });
    return false;
  }

  if (existing.convertedDate) {
    log.debug("markTrialConverted: already converted", { fingerprint });
    return true;
  }

  const updated: StoredTrial = {
    ...existing,
    convertedDate: new Date().toISOString(),
  };

  try {
    const redis = getRedisClient();
    await redis.set(trialKey(fingerprint), JSON.stringify(updated), "EX", TRIAL_TTL_SECONDS);
    log.debug("markTrialConverted success", {
      fingerprint,
      convertedDate: updated.convertedDate,
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("markTrialConverted failed", { fingerprint, error: message });
    return false;
  }
}

/**
 * Computes the trial status for a given trial record.
 *
 * @param trial - The stored trial record (or null if none exists)
 * @returns Object with remaining days and status
 */
export function computeTrialStatus(trial: StoredTrial | null): {
  remainingDays: number;
  status: "active" | "expired" | "converted" | "none";
  convertedDate?: string;
} {
  if (!trial) {
    return { remainingDays: 0, status: "none" };
  }

  if (trial.convertedDate) {
    return { remainingDays: 0, status: "converted", convertedDate: trial.convertedDate };
  }

  const startDate = new Date(trial.startDate);
  const now = new Date();
  const elapsedMs = now.getTime() - startDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  const remainingDays = Math.max(0, TRIAL_DURATION_DAYS - elapsedDays);

  if (remainingDays <= 0) {
    return { remainingDays: 0, status: "expired" };
  }

  return { remainingDays, status: "active" };
}
