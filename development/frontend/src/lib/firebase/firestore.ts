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

// ─── Household query helpers ──────────────────────────────────────────────────

/**
 * Finds a household document by its invite code.
 * Returns null if no household has this code.
 * Used during invite code validation.
 */
export async function findHouseholdByInviteCode(
  code: string
): Promise<FirestoreHousehold | null> {
  const db = getFirestore();
  const snap = await db
    .collection("households")
    .where("inviteCode", "==", code.toUpperCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as FirestoreHousehold;
}

/**
 * Fetches all user documents whose householdId matches the given household.
 * Used to build the members list for settings and join preview.
 */
export async function getUsersByHouseholdId(
  householdId: string
): Promise<FirestoreUser[]> {
  const db = getFirestore();
  const snap = await db
    .collection("users")
    .where("householdId", "==", householdId)
    .get();
  return snap.docs.map((d) => d.data() as FirestoreUser);
}

// ─── Invite code regeneration ─────────────────────────────────────────────────

/**
 * Regenerates the invite code for a household.
 * Only the household owner should call this (enforced by the API route).
 * Returns the updated household document.
 */
export async function regenerateInviteCode(
  householdId: string
): Promise<FirestoreHousehold> {
  const db = getFirestore();
  const now = new Date().toISOString();
  const newCode = generateInviteCode();
  const newExpiry = generateInviteCodeExpiry();

  const ref = db.doc(FIRESTORE_PATHS.household(householdId));
  await ref.update({
    inviteCode: newCode,
    inviteCodeExpiresAt: newExpiry,
    updatedAt: now,
  });

  const snap = await ref.get();
  return snap.data() as FirestoreHousehold;
}

// ─── Join household transaction ───────────────────────────────────────────────

export interface JoinHouseholdResult {
  /** IDs of cards that were moved from the old household */
  movedCardIds: string[];
  /** The household the user has joined */
  newHousehold: FirestoreHousehold;
}

/**
 * Executes the join + merge operation as an atomic Firestore transaction.
 *
 * Steps (all-or-nothing):
 *   1. Re-validate invite code is still valid and not expired
 *   2. Check household still has capacity (≤ 2 members currently, max 3)
 *   3. Fetch all non-deleted cards from the user's old household
 *   4. Copy each card to the new household (update householdId)
 *   5. Delete the old solo household document
 *   6. Add the user to the new household's memberIds
 *   7. Update the user's householdId and role
 *
 * If the transaction fails for any reason, Firestore rolls back automatically —
 * the user's original household remains intact (idempotent).
 *
 * @throws Error with message "household_full" if race condition: household filled up
 * @throws Error with message "invite_invalid" if code no longer valid
 * @throws Error with message "invite_expired" if code is expired
 */
export async function joinHouseholdTransaction(
  userId: string,
  inviteCode: string
): Promise<JoinHouseholdResult> {
  const db = getFirestore();

  return await db.runTransaction(async (tx) => {
    // 1. Look up household by invite code
    const householdsSnap = await db
      .collection("households")
      .where("inviteCode", "==", inviteCode.toUpperCase())
      .limit(1)
      .get();

    if (householdsSnap.empty) {
      throw new Error("invite_invalid");
    }

    const targetHouseholdRef = householdsSnap.docs[0].ref;
    const targetHousehold = householdsSnap.docs[0].data() as FirestoreHousehold;

    // 2. Check invite code not expired
    const { isInviteCodeValid } = await import("./firestore-types");
    if (!isInviteCodeValid(targetHousehold.inviteCodeExpiresAt)) {
      throw new Error("invite_expired");
    }

    // 3. Check household capacity (max 3 members)
    if (targetHousehold.memberIds.length >= 3) {
      throw new Error("household_full");
    }

    // 4. Get current user doc
    const userRef = db.doc(FIRESTORE_PATHS.user(userId));
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new Error("user_not_found");
    }
    const user = userSnap.data() as FirestoreUser;
    const oldHouseholdId = user.householdId;

    // Don't join if already in this household
    if (oldHouseholdId === targetHousehold.id) {
      throw new Error("already_member");
    }

    // 5. Fetch old household's non-deleted cards (outside transaction reads must be done before writes)
    const oldCardsSnap = await db
      .collection(FIRESTORE_PATHS.cards(oldHouseholdId))
      .get();
    const oldCards = oldCardsSnap.docs
      .map((d) => d.data() as FirestoreCard)
      .filter((c) => !c.deletedAt);

    const now = new Date().toISOString();
    const movedCardIds: string[] = [];

    // 6. Copy each card to new household
    for (const card of oldCards) {
      const updatedCard: FirestoreCard = {
        ...card,
        householdId: targetHousehold.id,
        updatedAt: now,
      };
      const newCardRef = db.doc(
        FIRESTORE_PATHS.card(targetHousehold.id, card.id)
      );
      tx.set(newCardRef, updatedCard);
      movedCardIds.push(card.id);
    }

    // 7. Delete old household doc (solo household cleaned up)
    const oldHouseholdRef = db.doc(FIRESTORE_PATHS.household(oldHouseholdId));
    tx.delete(oldHouseholdRef);

    // 8. Add user to new household's memberIds
    const updatedMemberIds = [...targetHousehold.memberIds, userId];
    tx.update(targetHouseholdRef, {
      memberIds: updatedMemberIds,
      updatedAt: now,
    });

    // 9. Update user's householdId and role
    tx.update(userRef, {
      householdId: targetHousehold.id,
      role: "member",
      updatedAt: now,
    });

    const updatedHousehold: FirestoreHousehold = {
      ...targetHousehold,
      memberIds: updatedMemberIds,
      updatedAt: now,
    };

    return { movedCardIds, newHousehold: updatedHousehold };
  });
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
