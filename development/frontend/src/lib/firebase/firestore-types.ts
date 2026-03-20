/**
 * Fenrir Ledger — Firestore Collection Schema Types
 *
 * Server-side only. These types define the shape of documents stored in
 * Google Cloud Firestore for card cloud sync.
 *
 * ADR-014 documents the Redis-vs-Firestore decision.
 *
 * Collections:
 *   /users/{clerkUserId}
 *   /households/{householdId}
 *   /households/{householdId}/cards/{cardId}
 *   /entitlements/{googleSub}  (or /entitlements/stripe:{customerId} for anonymous)
 */

import type { Card } from "@/lib/types";
import type { StripeTier } from "@/lib/stripe/types";

// ─── User document ────────────────────────────────────────────────────────────

/**
 * Stored at /users/{clerkUserId}.
 *
 * One document per Clerk user. A user belongs to exactly one household.
 * Created on first sign-in via ensureSoloHousehold().
 */
export interface FirestoreUser {
  /** Document ID — Clerk's immutable user ID (e.g. "user_2abc...") */
  clerkUserId: string;
  /** User's email address from Clerk */
  email: string;
  /** Display name from Clerk (firstName + lastName, or username) */
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

// ─── Entitlement document ─────────────────────────────────────────────────────

/**
 * Stored at /entitlements/{googleSub} for authenticated users.
 * Stored at /entitlements/stripe:{stripeCustomerId} for anonymous users
 * (i.e., users who subscribed before signing in with Google).
 *
 * Authoritative billing source — written by Stripe webhook handlers.
 * No TTL: subscription records are persistent (unlike trials).
 *
 * On first sign-in after an anonymous purchase, migrateStripeEntitlement()
 * moves the document from stripe:{customerId} to {googleSub}.
 */
export interface FirestoreEntitlement {
  /** Current subscription tier */
  tier: StripeTier;
  /** Whether the subscription is currently active */
  active: boolean;
  /** Stripe customer ID (cus_xxx) */
  stripeCustomerId: string;
  /** Stripe subscription ID (sub_xxx) */
  stripeSubscriptionId: string;
  /** Raw Stripe subscription status string */
  stripeStatus: string;
  /** Whether the subscription is set to cancel at period end */
  cancelAtPeriodEnd?: boolean;
  /** ISO 8601 timestamp of current billing period end */
  currentPeriodEnd?: string;
  /** ISO 8601 timestamp when Stripe was first linked */
  linkedAt: string;
  /** ISO 8601 timestamp of last status check / write */
  checkedAt: string;
}

// ─── Household document ───────────────────────────────────────────────────────

/**
 * Stored at /households/{householdId}.
 *
 * The root entity for card portfolios. Karl tier lives here (not on user doc)
 * so that all members of a household share the same tier.
 *
 * memberIds max length: 3 (enforced by Firestore security rules).
 */
export interface FirestoreHousehold {
  /** Document ID — UUID generated at creation */
  id: string;
  /** Human-readable household name (e.g. "The Shanaghys") */
  name: string;
  /** clerkUserId of the household owner */
  ownerId: string;
  /**
   * clerkUserIds of all members, including the owner.
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
  /**
   * Karl subscription tier. Lives on household, not user, so all members
   * share the same tier automatically.
   */
  tier: "free" | "karl";
  /** UTC ISO 8601 timestamp when this household was created */
  createdAt: string;
  /** UTC ISO 8601 timestamp when this household was last modified */
  updatedAt: string;
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
  /** /users/{clerkUserId} */
  user: (clerkUserId: string) => `users/${clerkUserId}` as const,
  /** /households/{householdId} */
  household: (householdId: string) => `households/${householdId}` as const,
  /** /households/{householdId}/cards */
  cards: (householdId: string) => `households/${householdId}/cards` as const,
  /** /households/{householdId}/cards/{cardId} */
  card: (householdId: string, cardId: string) =>
    `households/${householdId}/cards/${cardId}` as const,
  /**
   * /entitlements/{docId}
   * docId is either:
   *   - the Google sub for authenticated users
   *   - `stripe:{stripeCustomerId}` for anonymous users
   */
  entitlement: (docId: string) => `entitlements/${docId}` as const,
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
