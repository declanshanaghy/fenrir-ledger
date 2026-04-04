/**
 * Fenrir Ledger — Firestore Collection Schema Types
 *
 * Server-side only. These types define the shape of documents stored in
 * Google Cloud Firestore for card cloud sync.
 *
 * ADR-014 documents the Redis-vs-Firestore decision.
 *
 * Collections:
 *   /users/{userId}
 *   /households/{householdId}   (householdId == userId for solo households)
 *   /households/{householdId}/cards/{cardId}
 *   /households/{householdId}/stripe/subscription  (Stripe billing — issue #1648)
 */

import type { Card } from "@/lib/types";

// ─── User document ────────────────────────────────────────────────────────────

/**
 * Stored at /users/{userId}.
 *
 * One document per user. A user belongs to exactly one household.
 * Created on first sign-in via ensureSoloHousehold().
 */
export interface FirestoreUser {
  /** Document ID — Google OAuth sub claim */
  userId: string;
  /** User's email address */
  email: string;
  /** Display name */
  displayName: string;
  /** Foreign key → /households/{householdId} — exactly one per user */
  householdId: string;
  /** Role within the household */
  role: "owner" | "member";
  /**
   * Stripe customer ID (cus_xxx) — set when the user first subscribes.
   * Enables fast reverse lookup: Stripe customer → Google sub via Firestore query.
   * Optional: absent for users who have never subscribed via Stripe.
   */
  stripeCustomerId?: string;
  /** UTC ISO 8601 timestamp when this document was created */
  createdAt: string;
  /** UTC ISO 8601 timestamp when this document was last modified */
  updatedAt: string;
}

// ─── Household document ───────────────────────────────────────────────────────

/**
 * Stored at /households/{householdId}.
 *
 * The root entity for card portfolios. Stripe billing data lives in the
 * stripe subcollection (/households/{id}/stripe/subscription) — not here.
 *
 * memberIds max length: 3 (enforced by Firestore security rules).
 */
export interface FirestoreHousehold {
  /**
   * Document ID — equals the owner's userId (Google sub) for solo households,
   * or the original owner's userId for shared households.
   */
  id: string;
  /** Human-readable household name (e.g. "The Shanaghys") */
  name: string;
  /** userId of the household owner */
  ownerId: string;
  /**
   * userIds of all members, including the owner.
   * Maximum 3 entries — enforced by security rules.
   */
  memberIds: string[];
  /**
   * 6-character alphanumeric invite code (e.g. "X7K2MQ").
   * Rotated on demand. Valid for 1 month from inviteCodeExpiresAt.
   */
  inviteCode: string;
  /** UTC ISO 8601 timestamp — invite code expiry (1 month from generation) */
  inviteCodeExpiresAt: string;
  /** UTC ISO 8601 timestamp when this household was created */
  createdAt: string;
  /** UTC ISO 8601 timestamp when this household was last modified */
  updatedAt: string;
  /**
   * Monotonically increasing sync version counter. Incremented atomically
   * whenever a member pushes changes. Absent on legacy households until first
   * push or sync state access. Used by sync state tracking (issue #2001).
   */
  syncVersion?: number;
}

// ─── Sync state subcollection document ───────────────────────────────────────

/**
 * Stored at /households/{householdId}/syncState/{userId}.
 *
 * One document per household member. Tracks which members need to download
 * new changes after another member pushes. Enables multi-device, multi-user
 * household sync (issue #2001).
 */
export interface FirestoreMemberSyncState {
  /** Document ID — Google OAuth sub claim of the household member */
  userId: string;
  /**
   * The household syncVersion at the time this member last completed a pull.
   * 0 for members who have never synced.
   */
  lastSyncedVersion: number;
  /**
   * True when another member has pushed changes this member has not yet pulled.
   * Cleared by updateSyncStateAfterPull().
   */
  needsDownload: boolean;
  /** UTC ISO 8601 timestamp when this document was last modified */
  updatedAt: string;
}

// ─── Stripe subcollection document ────────────────────────────────────────────

/**
 * Stored at /households/{householdId}/stripe/subscription.
 *
 * Separates Stripe billing concerns from household metadata (issue #1648).
 * Written by Stripe webhook handlers; read by entitlement/tier checks.
 * Absent when the household has never subscribed via Stripe.
 */
export interface FirestoreStripeSubscription {
  /** Stripe customer ID (cus_xxx) */
  stripeCustomerId: string;
  /** Stripe subscription ID (sub_xxx) */
  stripeSubscriptionId: string;
  /** Raw Stripe subscription status (e.g. "active", "canceled") */
  stripeStatus: string;
  /** Karl subscription tier for this household */
  tier: "free" | "karl";
  /** Whether the subscription is currently active */
  active: boolean;
  /** Whether the subscription is set to cancel at period end */
  cancelAtPeriodEnd: boolean;
  /** ISO 8601 timestamp of current billing period end */
  currentPeriodEnd?: string;
  /** ISO 8601 timestamp when Stripe was first linked to this household */
  linkedAt: string;
  /** ISO 8601 timestamp of last Stripe status write */
  checkedAt: string;
}

// ─── Card document ────────────────────────────────────────────────────────────

/**
 * Stored at /households/{householdId}/cards/{cardId}.
 *
 * Mirrors the Card interface from src/lib/types.ts exactly — no schema
 * divergence. The same Card object is serialised to Firestore and deserialised
 * back with no transformation.
 */
export type FirestoreCard = Card;

// ─── Collection path helpers ──────────────────────────────────────────────────

/** Canonical Firestore collection/document paths */
export const FIRESTORE_PATHS = {
  /** /users/{userId} */
  user: (userId: string) => `users/${userId}` as const,
  /** /households/{householdId} */
  household: (householdId: string) => `households/${householdId}` as const,
  /** /households/{householdId}/cards */
  cards: (householdId: string) => `households/${householdId}/cards` as const,
  /** /households/{householdId}/cards/{cardId} */
  card: (householdId: string, cardId: string) =>
    `households/${householdId}/cards/${cardId}` as const,
  /** /households/{householdId}/stripe/subscription — Stripe billing subcollection (issue #1648) */
  stripeSubscription: (householdId: string) =>
    `households/${householdId}/stripe/subscription` as const,
  /** /households/{userId}/trial/status — permanent trial record (never auto-deleted) */
  trial: (userId: string) => `households/${userId}/trial/status` as const,
  /** /households/{householdId}/syncState — sync state subcollection (issue #2001) */
  syncStates: (householdId: string) =>
    `households/${householdId}/syncState` as const,
  /** /households/{householdId}/syncState/{userId} — per-member sync state doc (issue #2001) */
  syncState: (householdId: string, userId: string) =>
    `households/${householdId}/syncState/${userId}` as const,
} as const;

// ─── Invite code helpers ──────────────────────────────────────────────────────

const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 6;
/** 1 month in milliseconds */
const INVITE_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Generate a cryptographically random 6-character alphanumeric invite code.
 * Uses unambiguous characters (no O/0/1/I).
 */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  // Works in both Node.js and Edge runtime
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Node.js fallback
    const { randomFillSync } = require("crypto") as typeof import("crypto");
    randomFillSync(bytes);
  }
  return Array.from(bytes)
    .map((b) => INVITE_CODE_CHARS[b % INVITE_CODE_CHARS.length])
    .join("");
}

/**
 * Returns the UTC ISO 8601 expiry timestamp for a newly generated invite code
 * (now + 1 month).
 */
export function generateInviteCodeExpiry(): string {
  return new Date(Date.now() + INVITE_CODE_TTL_MS).toISOString();
}

/**
 * Returns true if the given invite code has not yet expired.
 */
export function isInviteCodeValid(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() > Date.now();
}
