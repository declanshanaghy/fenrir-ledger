/**
 * Shared user test fixtures — issue #1858
 *
 * Centralises makeUser so FirestoreUser schema changes only need to be
 * applied in one place.
 */

import type { FirestoreUser } from "@/lib/firebase/firestore-types";

/**
 * Returns a minimal valid FirestoreUser.
 * Defaults: owner role, hh-test household, stable ISO timestamps.
 */
export function makeUser(overrides: Partial<FirestoreUser> = {}): FirestoreUser {
  return {
    userId: "user-001",
    email: "test@example.com",
    displayName: "Test User",
    householdId: "hh-test",
    role: "owner",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}
