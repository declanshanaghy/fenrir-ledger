/**
 * Odin's Throne — Firestore Admin Client
 *
 * Read-only access to households and cards for the monitoring dashboard.
 * Uses Application Default Credentials (Workload Identity in GKE).
 * Mirrors the pattern from development/ledger/src/lib/firebase/firestore.ts.
 */

import { Firestore } from "@google-cloud/firestore";

// Module-level singleton — avoids re-initialization on every request
let _db: Firestore | null = null;

function getDb(): Firestore {
  if (!_db) {
    _db = new Firestore();
  }
  return _db;
}

// ─── Types (mirrors firestore-types.ts in ledger) ─────────────────────────────

export interface OdinHousehold {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  inviteCode: string;
  inviteCodeExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  syncVersion?: number;
}

export type CardStatus =
  | "active"
  | "fee_approaching"
  | "promo_expiring"
  | "closed"
  | "bonus_open"
  | "overdue"
  | "graduated";

export interface SignUpBonus {
  description: string;
  rewardAmount: number;
  minimumSpend: number;
  minimumSpendDeadline: string;
}

export interface OdinCard {
  id: string;
  householdId: string;
  issuerId: string;
  cardName: string;
  openDate: string;
  creditLimit: number;
  annualFee: number;
  annualFeeDate: string;
  promoPeriodMonths: number;
  signUpBonus: SignUpBonus | null;
  amountSpent?: number;
  status: CardStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  closedAt?: string;
}

// ─── Data access ──────────────────────────────────────────────────────────────

/**
 * Lists all household documents, ordered by createdAt descending.
 * Returns at most 200 to avoid unbounded reads.
 */
export async function listHouseholds(): Promise<OdinHousehold[]> {
  const db = getDb();
  const snap = await db
    .collection("households")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();
  return snap.docs.map((d) => d.data() as OdinHousehold);
}

/**
 * Fetches all non-deleted cards for a household, ordered by createdAt ascending.
 * Filters out soft-deleted cards (deletedAt set) client-side to avoid
 * compound index requirements.
 */
export async function getCardsForHousehold(householdId: string): Promise<OdinCard[]> {
  const db = getDb();
  const snap = await db
    .collection(`households/${householdId}/cards`)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs
    .map((d) => d.data() as OdinCard)
    .filter((c) => !c.deletedAt);
}
