/**
 * Shared household test fixtures — issue #1858
 *
 * Centralises makeHousehold so FirestoreHousehold schema changes only need
 * to be applied in one place.
 */

import type { FirestoreHousehold } from "@/lib/firebase/firestore-types";

/**
 * Returns a minimal valid FirestoreHousehold.
 * Defaults: id "hh-test", single owner "user-001", invite code "ABCDEF".
 */
export function makeHousehold(
  overrides: Partial<FirestoreHousehold> = {},
): FirestoreHousehold {
  return {
    id: "hh-test",
    name: "Test Household",
    ownerId: "user-001",
    memberIds: ["user-001"],
    inviteCode: "ABCDEF",
    inviteCodeExpiresAt: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}
