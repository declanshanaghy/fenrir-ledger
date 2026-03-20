/**
 * Fenrir Ledger — In-Memory Mock Firestore Backend
 *
 * A zero-dependency, in-memory implementation of the Firestore client API
 * surface used by the sync engine. Designed for E2E test environments where
 * real Firestore credentials are unavailable.
 *
 * Implements the same public function signatures as `firestore.ts` so it can
 * be used as a drop-in test double. Returns empty or deterministic data — no
 * gRPC connections, no network calls.
 *
 * Usage:
 *   - Vitest: import directly in tests — no mocking needed.
 *   - E2E (Playwright): the Playwright fixture intercepts `/api/sync/**` HTTP
 *     calls at the network boundary so this module is never called in E2E tests.
 *     This module exists to validate the mock data shapes with Vitest.
 *
 * IMPORTANT: This module is test-only. Production code always uses `firestore.ts`.
 * Do NOT import this file from production code paths.
 *
 * Issue #1189
 */

import type { Card } from "@/lib/types";
import type {
  FirestoreUser,
  FirestoreHousehold,
  FirestoreCard,
} from "./firestore-types";

// ─── In-memory store ──────────────────────────────────────────────────────────

/** Per-household card storage (household ID → card ID → card). */
const _cards = new Map<string, Map<string, FirestoreCard>>();

/** User document storage (userId → user). */
const _users = new Map<string, FirestoreUser>();

/** Household document storage (householdId → household). */
const _households = new Map<string, FirestoreHousehold>();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Resets all in-memory stores. Call between tests to ensure a clean slate.
 * @internal — test utility only.
 */
export function resetMockFirestore(): void {
  _cards.clear();
  _users.clear();
  _households.clear();
}

// ─── Card operations ──────────────────────────────────────────────────────────

/**
 * Returns all non-deleted cards for a household.
 * Mirrors `getCards()` in firestore.ts.
 */
export async function mockGetCards(householdId: string): Promise<FirestoreCard[]> {
  const store = _cards.get(householdId);
  if (!store) return [];
  return Array.from(store.values()).filter((c) => !c.deletedAt);
}

/**
 * Returns ALL cards for a household including tombstones.
 * Mirrors `getAllFirestoreCards()` in firestore.ts.
 */
export async function mockGetAllFirestoreCards(
  householdId: string
): Promise<FirestoreCard[]> {
  const store = _cards.get(householdId);
  if (!store) return [];
  return Array.from(store.values());
}

/**
 * Writes a single card. Mirrors `setCard()` in firestore.ts.
 */
export async function mockSetCard(card: Card): Promise<void> {
  let store = _cards.get(card.householdId);
  if (!store) {
    store = new Map();
    _cards.set(card.householdId, store);
  }
  store.set(card.id, card as FirestoreCard);
}

/**
 * Batch-writes multiple cards. Mirrors `setCards()` in firestore.ts.
 */
export async function mockSetCards(cards: Card[]): Promise<void> {
  for (const card of cards) {
    await mockSetCard(card);
  }
}

// ─── User operations ──────────────────────────────────────────────────────────

/**
 * Returns a user by user ID, or null if not found.
 * Mirrors `getUser()` in firestore.ts.
 */
export async function mockGetUser(
  userId: string
): Promise<FirestoreUser | null> {
  return _users.get(userId) ?? null;
}

/**
 * Creates or overwrites a user document.
 * Mirrors `setUser()` in firestore.ts.
 */
export async function mockSetUser(user: FirestoreUser): Promise<void> {
  _users.set(user.userId, user);
}

// ─── Household operations ─────────────────────────────────────────────────────

/**
 * Returns a household by ID, or null if not found.
 * Mirrors `getHousehold()` in firestore.ts.
 */
export async function mockGetHousehold(
  householdId: string
): Promise<FirestoreHousehold | null> {
  return _households.get(householdId) ?? null;
}

/**
 * Creates or overwrites a household document.
 * Mirrors `setHousehold()` in firestore.ts.
 */
export async function mockSetHousehold(
  household: FirestoreHousehold
): Promise<void> {
  _households.set(household.id, household);
}

// ─── Mock sync API response shapes ───────────────────────────────────────────

/**
 * The shape returned by POST /api/sync/push.
 * Matches the real route's success response contract.
 */
export interface SyncPushResponse {
  cards: Card[];
  syncedCount: number;
}

/**
 * Returns a valid empty sync push response.
 * Used by Playwright fixtures to mock /api/sync/push in E2E tests.
 */
export function mockSyncPushResponse(
  cards: Card[] = []
): SyncPushResponse {
  const syncedCount = cards.filter((c) => !c.deletedAt).length;
  return { cards, syncedCount };
}

/**
 * The shape returned by POST /api/sync/pull (if used).
 * Mirrors the pull route response contract.
 */
export interface SyncPullResponse {
  cards: Card[];
}

/**
 * Returns a valid empty sync pull response.
 * Used by Playwright fixtures to mock /api/sync/pull in E2E tests.
 */
export function mockSyncPullResponse(cards: Card[] = []): SyncPullResponse {
  return { cards };
}
