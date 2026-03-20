/**
 * Firestore trial store — server-side persistence for trial state.
 *
 * Stores and retrieves trial records in the Firestore `trials/` collection,
 * keyed by browser fingerprint (document ID).
 *
 * Collection:  `trials/{fingerprint}`  → StoredTrial
 * Reverse idx: query `trials` where `userId == userId` limit 1
 *
 * TTL: 60 days via `expiresAt` Firestore Timestamp field.
 * TTL policy is configured on the `trials` collection in firestore.tf.
 *
 * @module kv/trial-store
 */

import { createHash } from "crypto";
import { Timestamp } from "@google-cloud/firestore";
import { getFirestore } from "@/lib/firebase/firestore";
import { log } from "@/lib/logger";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a trial record stored in Firestore (public interface). */
export interface StoredTrial {
  /** ISO timestamp of when the trial started (first card creation). */
  startDate: string;
  /** ISO timestamp of when the user converted to Karl (if they did). */
  convertedDate?: string;
  /** Google OAuth `sub` — set on first authenticated sign-in, absent for anonymous trials. */
  userId?: string;
}

/** Internal Firestore document shape — includes TTL field. */
interface FirestoreTrialDoc extends StoredTrial {
  /** Firestore Timestamp — TTL policy purges docs automatically after 60 days. */
  expiresAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIALS_COLLECTION = "trials";

/** 60 days in milliseconds — covers trial + post-trial data retention. */
const TRIAL_TTL_MS = 60 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trialDocRef(fingerprint: string) {
  return getFirestore().doc(`${TRIALS_COLLECTION}/${fingerprint}`);
}

function makeExpiresAt(): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() + TRIAL_TTL_MS));
}

/** UUID pattern — used to detect new-format fingerprints for migration lookup. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Computes the legacy SHA-256 hex fingerprint from a raw UUID deviceId.
 * Used during migration to look up existing Firestore records keyed by SHA-256.
 */
function legacyFingerprint(deviceId: string): string {
  return createHash("sha256").update(deviceId).digest("hex");
}

/**
 * Resolves a trial record and the Firestore key it was found under.
 *
 * Tries the fingerprint directly first. If not found and the fingerprint looks
 * like a UUID (new format), falls back to the legacy SHA-256 key so that
 * existing trial records created before issue #1624 are still found.
 *
 * @returns { trial, key } or null if not found under either key
 */
async function getTrialWithKey(
  fingerprint: string,
): Promise<{ trial: StoredTrial; key: string } | null> {
  let snap = await trialDocRef(fingerprint).get();
  let effectiveKey = fingerprint;

  if (!snap.exists && UUID_RE.test(fingerprint)) {
    effectiveKey = legacyFingerprint(fingerprint);
    snap = await trialDocRef(effectiveKey).get();
  }

  if (!snap.exists) return null;

  const doc = snap.data() as FirestoreTrialDoc;
  return {
    key: effectiveKey,
    trial: {
      startDate: doc.startDate,
      ...(doc.convertedDate ? { convertedDate: doc.convertedDate } : {}),
      ...(doc.userId ? { userId: doc.userId } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Retrieves a trial record by fingerprint.
 *
 * Accepts both UUID v4 fingerprints (current format) and 64-char SHA-256 hex
 * fingerprints (legacy format — see issue #1624 migration).
 *
 * @param fingerprint - UUID v4 or legacy 64-char hex fingerprint
 * @returns The stored trial record or null if not found / expired
 */
export async function getTrial(fingerprint: string): Promise<StoredTrial | null> {
  log.debug("getTrial called", { fingerprint });
  try {
    const result = await getTrialWithKey(fingerprint);
    if (!result) {
      log.debug("getTrial returning", { fingerprint, found: false });
      return null;
    }
    log.debug("getTrial returning", { fingerprint, found: true, startDate: result.trial.startDate });
    return result.trial;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getTrial failed", { fingerprint, error: message });
    return null;
  }
}

/**
 * Creates a new trial record in Firestore. If a record already exists for this
 * fingerprint, this is a no-op — the original start date is preserved.
 * If `userId` is provided, it is stored on the trial and allows reverse-lookup
 * via a Firestore query on the `userId` field.
 *
 * @param fingerprint - UUID v4 or legacy 64-char hex fingerprint
 * @param userId - Google OAuth `sub` (optional; present when user is signed in)
 * @returns The stored trial record (existing or newly created)
 */
export async function initTrial(fingerprint: string, userId?: string): Promise<StoredTrial> {
  log.debug("initTrial called", { fingerprint, hasUserId: !!userId });

  // Check for existing trial first (idempotent)
  const existing = await getTrial(fingerprint);
  if (existing) {
    // If we now have a userId and the trial doesn't yet, link them.
    if (userId && !existing.userId) {
      await linkTrialToUser(fingerprint, userId);
    }
    log.debug("initTrial returning", { fingerprint, reason: "already_exists", startDate: existing.startDate });
    return existing;
  }

  const trial: StoredTrial = {
    startDate: new Date().toISOString(),
    ...(userId ? { userId } : {}),
  };

  const doc: FirestoreTrialDoc = {
    ...trial,
    expiresAt: makeExpiresAt(),
  };

  try {
    await trialDocRef(fingerprint).set(doc);
    log.debug("initTrial returning", { fingerprint, startDate: trial.startDate });
    return trial;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("initTrial failed", { fingerprint, error: message });
    throw err;
  }
}

/**
 * Links an existing anonymous trial to a Google user ID.
 * Patches the trial record with `userId`. No-op if already linked to this user.
 *
 * @param fingerprint - UUID v4 or legacy 64-char hex fingerprint
 * @param userId - Google OAuth `sub`
 */
export async function linkTrialToUser(fingerprint: string, userId: string): Promise<void> {
  log.debug("linkTrialToUser called", { fingerprint, userId });
  try {
    const result = await getTrialWithKey(fingerprint);
    if (!result) return;
    if (result.trial.userId === userId) return;

    await trialDocRef(result.key).update({ userId });
    log.debug("linkTrialToUser success", { fingerprint, userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("linkTrialToUser failed", { fingerprint, userId, error: message });
  }
}

/**
 * Looks up the trial fingerprint for a given Google user ID via a Firestore query.
 *
 * @param userId - Google OAuth `sub`
 * @returns fingerprint string or null if not found
 */
export async function getFingerprintByUserId(userId: string): Promise<string | null> {
  log.debug("getFingerprintByUserId called", { userId });
  try {
    const db = getFirestore();
    const snap = await db
      .collection(TRIALS_COLLECTION)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snap.empty || !snap.docs[0]) {
      log.debug("getFingerprintByUserId returning", { userId, found: false });
      return null;
    }
    const fingerprint = snap.docs[0].id;
    log.debug("getFingerprintByUserId returning", { userId, found: true });
    return fingerprint;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getFingerprintByUserId failed", { userId, error: message });
    return null;
  }
}

/**
 * Marks a trial as converted by setting the convertedDate field.
 * Called after a successful Stripe subscription from a trial user.
 *
 * @param fingerprint - UUID v4 or legacy 64-char hex fingerprint
 * @returns true if the trial was found and updated, false otherwise
 */
export async function markTrialConverted(fingerprint: string): Promise<boolean> {
  log.debug("markTrialConverted called", { fingerprint });

  const result = await getTrialWithKey(fingerprint);
  if (!result) {
    log.debug("markTrialConverted: no trial found", { fingerprint });
    return false;
  }

  if (result.trial.convertedDate) {
    log.debug("markTrialConverted: already converted", { fingerprint });
    return true;
  }

  try {
    const convertedDate = new Date().toISOString();
    await trialDocRef(result.key).update({ convertedDate });
    log.debug("markTrialConverted success", { fingerprint, convertedDate });
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
