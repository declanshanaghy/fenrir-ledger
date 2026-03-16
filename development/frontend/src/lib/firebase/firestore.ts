/**
 * Fenrir Ledger — Firestore Admin Client
 *
 * Server-side only. Initializes the Google Cloud Firestore Admin SDK with a
 * module-level singleton to avoid re-initialization on every request.
 *
 * Authentication strategy:
 * - Production (GKE): Workload Identity provides ambient credentials via the
 *   GKE metadata server — no credentials file or env vars needed.
 * - Local development: Set GOOGLE_APPLICATION_CREDENTIALS to a service account
 *   JSON key, or start the Firebase emulator and set FIRESTORE_EMULATOR_HOST.
 *
 * See ADR-014 for the Firestore architecture decision.
 */

import { Firestore } from "@google-cloud/firestore";
import type {
  FirestoreUser,
  FirestoreHousehold,
  FirestoreCard,
} from "./firestore-types";
import {
  FIRESTORE_PATHS,
  generateInviteCode,
  generateInviteCodeExpiry,
} from "./firestore-types";
import type { Card } from "@/lib/types";

// ─── Singleton initialization ─────────────────────────────────────────────────

let _firestore: Firestore | null = null;

/**
 * Returns the singleton Firestore Admin client.
 * Initializes on first call using Application Default Credentials (ADC).
 *
 * In production on GKE, ADC is provided automatically via Workload Identity.
 * Locally, set GOOGLE_APPLICATION_CREDENTIALS or FIRESTORE_EMULATOR_HOST.
 */
export function getFirestore(): Firestore {
  if (_firestore) return _firestore;

  const projectId = process.env.FIRESTORE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "FIRESTORE_PROJECT_ID environment variable is not set. " +
        "Set it to your GCP project ID (e.g., 'fenrir-ledger-prod')."
    );
  }

  _firestore = new Firestore({ projectId });
  return _firestore;
}

/**
 * Resets the singleton (test utility only — never call in production code).
 * @internal
 */
export function _resetFirestoreForTests(): void {
  _firestore = null;
}

// ─── User operations ──────────────────────────────────────────────────────────

/**
 * Fetches a user document by Clerk user ID.
 * Returns null if the user document does not exist.
 */
export async function getUser(
  clerkUserId: string
): Promise<FirestoreUser | null> {
  const db = getFirestore();
  const snap = await db.doc(FIRESTORE_PATHS.user(clerkUserId)).get();
  if (!snap.exists) return null;
  return snap.data() as FirestoreUser;
}

/**
 * Creates or overwrites a user document.
 * Use this for upsert semantics (e.g., updating displayName after profile change).
 */
export async function setUser(user: FirestoreUser): Promise<void> {
  const db = getFirestore();
  await db.doc(FIRESTORE_PATHS.user(user.clerkUserId)).set(user);
}

// ─── Household operations ─────────────────────────────────────────────────────

/**
 * Fetches a household document by ID.
 * Returns null if the household does not exist.
 */
export async function getHousehold(
  householdId: string
): Promise<FirestoreHousehold | null> {
  const db = getFirestore();
  const snap = await db.doc(FIRESTORE_PATHS.household(householdId)).get();
  if (!snap.exists) return null;
  return snap.data() as FirestoreHousehold;
}

/**
 * Creates or overwrites a household document.
 */
export async function setHousehold(
  household: FirestoreHousehold
): Promise<void> {
  const db = getFirestore();
  await db.doc(FIRESTORE_PATHS.household(household.id)).set(household);
}

// ─── Card operations ──────────────────────────────────────────────────────────

/**
 * Fetches all non-deleted cards for a household, ordered by createdAt ascending.
 */
export async function getCards(householdId: string): Promise<FirestoreCard[]> {
  const db = getFirestore();
  const snap = await db
    .collection(FIRESTORE_PATHS.cards(householdId))
    .orderBy("createdAt", "asc")
    .get();

  return snap.docs
    .map((d) => d.data() as FirestoreCard)
    .filter((c) => !c.deletedAt);
}

/**
 * Writes a single card document (create or update).
 */
export async function setCard(card: Card): Promise<void> {
  const db = getFirestore();
  await db
    .doc(FIRESTORE_PATHS.card(card.householdId, card.id))
    .set(card);
}

/**
 * Soft-deletes a card by setting deletedAt to now.
 * The document is retained for audit purposes.
 */
export async function softDeleteCard(
  householdId: string,
  cardId: string
): Promise<void> {
  const db = getFirestore();
  await db
    .doc(FIRESTORE_PATHS.card(householdId, cardId))
    .update({ deletedAt: new Date().toISOString() });
}

/**
 * Batch-writes multiple cards. Firestore batches are limited to 500 operations.
 * This helper chunks automatically for larger sets.
 */
export async function setCards(cards: Card[]): Promise<void> {
  if (cards.length === 0) return;
  const db = getFirestore();

  const BATCH_LIMIT = 500;
  for (let i = 0; i < cards.length; i += BATCH_LIMIT) {
    const chunk = cards.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const card of chunk) {
      const ref = db.doc(FIRESTORE_PATHS.card(card.householdId, card.id));
      batch.set(ref, card);
    }
    await batch.commit();
  }
}

// ─── Auto-create solo household ───────────────────────────────────────────────

export interface EnsureSoloHouseholdInput {
  clerkUserId: string;
  email: string;
  displayName: string;
}

export interface EnsureSoloHouseholdResult {
  user: FirestoreUser;
  household: FirestoreHousehold;
  /** true if this was the first sign-in (documents were just created) */
  created: boolean;
}

/**
 * Idempotent bootstrap for a new Karl user's first sign-in.
 *
 * - If the user doc already exists, returns existing user + household.
 * - If the user doc does not exist, creates a solo household + user doc atomically.
 *
 * The household name defaults to "{displayName}'s Household" and can be renamed
 * by the user later. The household starts on the "free" tier — Karl subscription
 * upgrade is a separate flow.
 *
 * This function is idempotent: calling it multiple times for the same user is safe.
 */
export async function ensureSoloHousehold(
  input: EnsureSoloHouseholdInput
): Promise<EnsureSoloHouseholdResult> {
  const db = getFirestore();
  const { clerkUserId, email, displayName } = input;

  // Check if user already exists
  const existingUser = await getUser(clerkUserId);
  if (existingUser) {
    const household = await getHousehold(existingUser.householdId);
    if (!household) {
      throw new Error(
        `User ${clerkUserId} references household ${existingUser.householdId} which does not exist. ` +
          "Data integrity error."
      );
    }
    return { user: existingUser, household, created: false };
  }

  // First sign-in — create household + user atomically
  const now = new Date().toISOString();
  const householdId = crypto.randomUUID();

  const household: FirestoreHousehold = {
    id: householdId,
    name: `${displayName}'s Household`,
    ownerId: clerkUserId,
    memberIds: [clerkUserId],
    inviteCode: generateInviteCode(),
    inviteCodeExpiresAt: generateInviteCodeExpiry(),
    tier: "free",
    createdAt: now,
    updatedAt: now,
  };

  const user: FirestoreUser = {
    clerkUserId,
    email,
    displayName,
    householdId,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  };

  // Atomic write — both docs succeed or both fail
  const batch = db.batch();
  batch.set(db.doc(FIRESTORE_PATHS.household(householdId)), household);
  batch.set(db.doc(FIRESTORE_PATHS.user(clerkUserId)), user);
  await batch.commit();

  return { user, household, created: true };
}
