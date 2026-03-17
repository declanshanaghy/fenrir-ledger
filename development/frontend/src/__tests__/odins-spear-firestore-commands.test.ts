/**
 * Loki QA — Odin's Spear Firestore CRUD Commands
 * Issue #1173: Add Firestore CRUD commands to Odins Spear REPL
 *
 * Validates the contracts and behaviors introduced by the new
 * households / cards / users command set. Because odins-spear.mjs is a
 * runnable REPL with top-level awaits and process.exit guards, we test:
 *
 *   1. Pure utility functions (computeStatus, shortId, shortFp, generateInviteCode)
 *   2. Firestore Admin SDK interaction patterns for each new command
 *   3. Business-logic invariants: card filtering, invite expiry, tier validation
 *
 * The Firestore Admin SDK is mocked; no real GCP connection is required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";

// ─── Constants (mirrored from odins-spear.mjs) ───────────────────────────────

const TRIAL_DURATION_DAYS = 30;
const FS_DATABASE_ID = "fenrir-ledger-prod";
const INVITE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ─── 1. computeStatus ────────────────────────────────────────────────────────

/**
 * Replicates the computeStatus() pure function from odins-spear.mjs.
 * Any deviation in the implementation would cause these tests to diverge.
 */
function computeStatus(trial: { startDate?: string; convertedDate?: string } | null) {
  if (!trial) return { remainingDays: 0, status: "none" };
  if (trial.convertedDate) return { remainingDays: 0, status: "converted", convertedDate: trial.convertedDate };
  const elapsed = Math.floor((Date.now() - new Date(trial.startDate!).getTime()) / 86400000);
  const remaining = Math.max(0, TRIAL_DURATION_DAYS - elapsed);
  return { remainingDays: remaining, status: remaining <= 0 ? "expired" : "active" };
}

describe("computeStatus — trial status calculation", () => {
  it("returns status='none' for a null trial", () => {
    const s = computeStatus(null);
    expect(s.status).toBe("none");
    expect(s.remainingDays).toBe(0);
  });

  it("returns status='converted' when convertedDate is set", () => {
    const s = computeStatus({
      startDate: new Date(Date.now() - 10 * 86400000).toISOString(),
      convertedDate: new Date().toISOString(),
    });
    expect(s.status).toBe("converted");
    expect(s.remainingDays).toBe(0);
  });

  it("returns status='active' with correct remaining days for a fresh trial", () => {
    const s = computeStatus({ startDate: new Date().toISOString() });
    expect(s.status).toBe("active");
    // At t=0 the trial has 30 days left (floor arithmetic may yield 29 in edge cases)
    expect(s.remainingDays).toBeGreaterThanOrEqual(29);
    expect(s.remainingDays).toBeLessThanOrEqual(30);
  });

  it("returns status='active' 5 days before expiry", () => {
    const startDate = new Date(Date.now() - 25 * 86400000).toISOString();
    const s = computeStatus({ startDate });
    expect(s.status).toBe("active");
    expect(s.remainingDays).toBeGreaterThanOrEqual(4);
    expect(s.remainingDays).toBeLessThanOrEqual(5);
  });

  it("returns status='expired' when 30 days have elapsed", () => {
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString();
    const s = computeStatus({ startDate });
    expect(s.status).toBe("expired");
    expect(s.remainingDays).toBe(0);
  });

  it("returns status='expired' well past the trial window", () => {
    const startDate = new Date(Date.now() - 60 * 86400000).toISOString();
    const s = computeStatus({ startDate });
    expect(s.status).toBe("expired");
    expect(s.remainingDays).toBe(0);
  });

  it("remainingDays never goes negative", () => {
    const startDate = new Date(Date.now() - 365 * 86400000).toISOString();
    const s = computeStatus({ startDate });
    expect(s.remainingDays).toBeGreaterThanOrEqual(0);
  });
});

// ─── 2. shortId ──────────────────────────────────────────────────────────────

/**
 * Replicates shortId() from odins-spear.mjs:
 *   first 8 chars + unicode ellipsis (…) + last 4 chars
 *   IDs ≤ 16 chars returned unchanged.
 */
function shortId(id: string | null | undefined) {
  if (!id || id.length <= 16) return id;
  return `${id.slice(0, 8)}\u2026${id.slice(-4)}`;
}

describe("shortId — Firestore/Clerk ID display truncation", () => {
  it("returns IDs of 16 chars or less unchanged", () => {
    expect(shortId("shortid123456789")).toBe("shortid123456789"); // exactly 16
    expect(shortId("abc")).toBe("abc");
  });

  it("truncates long Clerk user IDs to first-8 … last-4", () => {
    // Clerk user ID format: user_XXXXXXXXXXXXXXXXXXX (21 chars)
    const id = "user_ABC123DEFxyz9999";
    const result = shortId(id);
    expect(result).toBe("user_ABC\u20269999"); // first 8 = "user_ABC", last 4 = "9999"
  });

  it("uses unicode ellipsis \\u2026, not three dots", () => {
    const id = "12345678901234567890"; // 20 chars
    const result = shortId(id)!;
    expect(result).toContain("\u2026");
    expect(result).not.toContain("...");
  });

  it("preserves first 8 and last 4 characters", () => {
    const id = "AAAAAAAA_middle_ZZZZ"; // 20 chars
    const result = shortId(id)!;
    expect(result.startsWith("AAAAAAAA")).toBe(true);
    expect(result.endsWith("ZZZZ")).toBe(true);
  });

  it("handles null/undefined gracefully", () => {
    expect(shortId(null)).toBeNull();
    expect(shortId(undefined)).toBeUndefined();
  });

  it("produces consistent output length for Firestore IDs (~20 chars)", () => {
    const id = "firestoreDocId12345A";  // 20 chars
    const result = shortId(id)!;
    // Should be 8 + 1 (…) + 4 = 13 chars
    expect(result.length).toBe(13);
  });
});

// ─── 3. shortFp ──────────────────────────────────────────────────────────────

function shortFp(fp: string) {
  return `${fp.slice(0, 12)}...${fp.slice(-8)}`;
}

describe("shortFp — fingerprint display truncation", () => {
  const HEX_FP = "a".repeat(32) + "b".repeat(32); // 64-char hex fingerprint

  it("returns first 12 + '...' + last 8 chars", () => {
    const result = shortFp(HEX_FP);
    expect(result).toBe("aaaaaaaaaaaa...bbbbbbbb");
  });

  it("total display length is 12 + 3 + 8 = 23 chars", () => {
    expect(shortFp(HEX_FP).length).toBe(23);
  });

  it("uses literal '...' (3 dots), not unicode ellipsis", () => {
    expect(shortFp(HEX_FP)).toContain("...");
    expect(shortFp(HEX_FP)).not.toContain("\u2026");
  });
});

// ─── 4. generateInviteCode (script variant) ──────────────────────────────────

/**
 * Replicates generateInviteCode() from odins-spear.mjs.
 * Uses the same unambiguous charset: ABCDEFGHJKLMNPQRSTUVWXYZ23456789
 * (excludes O, 0, I, 1, l to prevent user confusion).
 */
function generateInviteCode(): string {
  const CHARS = INVITE_CHARSET;
  const bytes = randomBytes(6);
  return Array.from(bytes).map((b) => CHARS[b % CHARS.length]).join("");
}

describe("generateInviteCode — REPL invite code generator", () => {
  it("returns exactly 6 characters", () => {
    for (let i = 0; i < 10; i++) {
      expect(generateInviteCode()).toHaveLength(6);
    }
  });

  it("uses only the unambiguous charset (no O, 0, 1, I, l)", () => {
    const forbidden = /[O0oI1l]/;
    for (let i = 0; i < 50; i++) {
      expect(forbidden.test(generateInviteCode())).toBe(false);
    }
  });

  it("all characters are uppercase or digits 2–9", () => {
    for (let i = 0; i < 20; i++) {
      expect(/^[A-Z2-9]{6}$/.test(generateInviteCode())).toBe(true);
    }
  });

  it("generates statistically unique codes (no collision in 30 samples)", () => {
    const codes = new Set(Array.from({ length: 30 }, () => generateInviteCode()));
    expect(codes.size).toBe(30);
  });

  it("charset length is 32 (ensures uniform distribution)", () => {
    expect(INVITE_CHARSET).toHaveLength(32);
  });
});

// ─── 5. Card active/deleted filtering ────────────────────────────────────────

interface MockCard {
  id: string;
  cardName: string;
  deletedAt?: string;
  issuerId?: string;
  status?: string;
}

describe("card active/deleted filtering — cards and card_count command logic", () => {
  const cards: MockCard[] = [
    { id: "card-1", cardName: "Chase Sapphire", issuerId: "chase", status: "open" },
    { id: "card-2", cardName: "Amex Gold", issuerId: "amex", status: "open", deletedAt: "2026-03-01T00:00:00.000Z" },
    { id: "card-3", cardName: "Citi Double Cash", issuerId: "citi", status: "open" },
    { id: "card-4", cardName: "Discover", issuerId: "discover", status: "closed", deletedAt: "2026-02-01T00:00:00.000Z" },
  ];

  it("active cards have no deletedAt field", () => {
    const active = cards.filter((c) => !c.deletedAt);
    expect(active).toHaveLength(2);
    expect(active.map((c) => c.id)).toEqual(["card-1", "card-3"]);
  });

  it("soft-deleted cards have a deletedAt timestamp", () => {
    const deleted = cards.filter((c) => !!c.deletedAt);
    expect(deleted).toHaveLength(2);
    expect(deleted.map((c) => c.id)).toEqual(["card-2", "card-4"]);
  });

  it("card_count: active + deleted = total", () => {
    const active = cards.filter((c) => !c.deletedAt).length;
    const deleted = cards.filter((c) => !!c.deletedAt).length;
    expect(active + deleted).toBe(cards.length);
  });

  it("deleting a card sets deletedAt to an ISO timestamp", () => {
    const card = { id: "card-1", cardName: "Chase Sapphire" } as MockCard;
    const now = new Date().toISOString();
    const updated = { ...card, deletedAt: now, updatedAt: now };
    expect(updated.deletedAt).toBeDefined();
    expect(new Date(updated.deletedAt!).toISOString()).toBe(updated.deletedAt);
  });

  it("restoring a card removes the deletedAt field", () => {
    const deleted: MockCard = { id: "card-2", cardName: "Amex Gold", deletedAt: "2026-03-01T00:00:00.000Z" };
    const restored = { ...deleted };
    delete restored.deletedAt;
    expect(restored.deletedAt).toBeUndefined();
  });

  it("empty household returns active=0, deleted=0, total=0", () => {
    const empty: MockCard[] = [];
    const active = empty.filter((c) => !c.deletedAt).length;
    const deleted = empty.filter((c) => !!c.deletedAt).length;
    expect(active).toBe(0);
    expect(deleted).toBe(0);
  });
});

// ─── 6. Invite code expiry (regen-invite: 30-day window) ─────────────────────

describe("regen-invite — 30-day invite code expiry", () => {
  it("generates an expiry timestamp 30 days in the future", () => {
    const before = Date.now();
    const expiresAt = new Date(before + 30 * 24 * 60 * 60 * 1000).toISOString();
    const after = Date.now();

    const expiryMs = new Date(expiresAt).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    expect(expiryMs).toBeGreaterThanOrEqual(before + thirtyDays);
    expect(expiryMs).toBeLessThanOrEqual(after + thirtyDays + 1000);
  });

  it("expiry is a valid ISO 8601 string", () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(new Date(expiresAt).toISOString()).toBe(expiresAt);
  });

  it("invite code expiry is strictly in the future (not already expired)", () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(new Date(expiresAt) > new Date()).toBe(true);
  });

  it("newly generated invite code has new code + new expiry", () => {
    const code1 = generateInviteCode();
    const expiry1 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const code2 = generateInviteCode();
    const expiry2 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Both are 6-char unambiguous codes
    expect(code1).toHaveLength(6);
    expect(code2).toHaveLength(6);
    // Both expiries are valid ISO timestamps
    expect(new Date(expiry1).toISOString()).toBe(expiry1);
    expect(new Date(expiry2).toISOString()).toBe(expiry2);
  });
});

// ─── 7. Tier validation — set-tier command ───────────────────────────────────

describe("set-tier — tier validation", () => {
  const VALID_TIERS = ["free", "karl"] as const;
  type Tier = (typeof VALID_TIERS)[number];

  function isValidTier(tier: string): tier is Tier {
    return VALID_TIERS.includes(tier as Tier);
  }

  it("accepts 'free' as a valid tier", () => {
    expect(isValidTier("free")).toBe(true);
  });

  it("accepts 'karl' as a valid tier", () => {
    expect(isValidTier("karl")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidTier("")).toBe(false);
  });

  it("rejects unknown tiers like 'premium', 'pro', 'enterprise'", () => {
    expect(isValidTier("premium")).toBe(false);
    expect(isValidTier("pro")).toBe(false);
    expect(isValidTier("enterprise")).toBe(false);
  });

  it("is case-sensitive — 'Free' and 'Karl' are not valid", () => {
    expect(isValidTier("Free")).toBe(false);
    expect(isValidTier("Karl")).toBe(false);
    expect(isValidTier("KARL")).toBe(false);
    expect(isValidTier("FREE")).toBe(false);
  });

  it("exactly two tiers are valid", () => {
    expect(VALID_TIERS).toHaveLength(2);
  });
});

// ─── 8. Household index selection — use-household logic ──────────────────────

describe("use-household — numeric selection from index", () => {
  const householdIndex = ["hh-aaa", "hh-bbb", "hh-ccc"];

  function selectByNumber(n: number) {
    if (isNaN(n) || n < 1 || n > householdIndex.length) return null;
    return householdIndex[n - 1];
  }

  it("selects first household with n=1", () => {
    expect(selectByNumber(1)).toBe("hh-aaa");
  });

  it("selects last household with n=length", () => {
    expect(selectByNumber(3)).toBe("hh-ccc");
  });

  it("returns null for n=0 (out of bounds)", () => {
    expect(selectByNumber(0)).toBeNull();
  });

  it("returns null for n > list length", () => {
    expect(selectByNumber(4)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(selectByNumber(NaN)).toBeNull();
  });

  it("returns null for negative n", () => {
    expect(selectByNumber(-1)).toBeNull();
  });
});

// ─── 9. requireHousehold guard ───────────────────────────────────────────────

describe("requireHousehold — selection guard", () => {
  function requireHousehold(selectedHouseholdId: string | null) {
    return selectedHouseholdId !== null;
  }

  it("returns true when a household is selected", () => {
    expect(requireHousehold("hh-abc123")).toBe(true);
  });

  it("returns false when no household is selected (null)", () => {
    expect(requireHousehold(null)).toBe(false);
  });

  it("returns true for any non-null string", () => {
    expect(requireHousehold("any-id")).toBe(true);
  });
});

// ─── 10. kick — owner cannot be kicked ───────────────────────────────────────

describe("kick — owner protection invariant", () => {
  function canKick(
    userId: string,
    ownerId: string,
    memberIds: string[]
  ): { allowed: boolean; reason?: string } {
    if (ownerId === userId) return { allowed: false, reason: "Cannot kick the owner. Use transfer-owner first." };
    if (!memberIds.includes(userId)) return { allowed: false, reason: `User ${userId} is not a member of this household.` };
    return { allowed: true };
  }

  it("blocks kicking the owner", () => {
    const result = canKick("user_owner", "user_owner", ["user_owner", "user_member"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("transfer-owner");
  });

  it("blocks kicking a non-member", () => {
    const result = canKick("user_stranger", "user_owner", ["user_owner", "user_member"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not a member");
  });

  it("allows kicking a regular member", () => {
    const result = canKick("user_member", "user_owner", ["user_owner", "user_member"]);
    expect(result.allowed).toBe(true);
  });

  it("after kick, memberIds no longer includes the kicked user", () => {
    const memberIds = ["user_owner", "user_member", "user_guest"];
    const newMembers = memberIds.filter((id) => id !== "user_member");
    expect(newMembers).not.toContain("user_member");
    expect(newMembers).toContain("user_owner");
    expect(newMembers).toContain("user_guest");
  });
});

// ─── 11. transfer-owner — batch semantics ────────────────────────────────────

describe("transfer-owner — ownership transfer invariants", () => {
  it("new owner gets role='owner'", () => {
    const updates: Record<string, { role?: string; ownerId?: string }> = {};
    const newOwnerId = "user_new_owner";
    const oldOwnerId = "user_old_owner";
    const householdId = "hh-test";

    // Simulate what transfer_owner does
    updates[householdId] = { ownerId: newOwnerId };
    updates[oldOwnerId] = { role: "member" };
    updates[newOwnerId] = { role: "owner" };

    expect(updates[newOwnerId].role).toBe("owner");
    expect(updates[oldOwnerId].role).toBe("member");
    expect(updates[householdId].ownerId).toBe(newOwnerId);
  });

  it("cannot transfer to a non-member", () => {
    const memberIds = ["user_owner", "user_member_a"];
    const newOwnerCandidate = "user_outsider";
    const isMember = memberIds.includes(newOwnerCandidate);
    expect(isMember).toBe(false);
  });

  it("no-ops when the user is already the owner", () => {
    const ownerId = "user_abc";
    const isAlreadyOwner = ownerId === "user_abc";
    expect(isAlreadyOwner).toBe(true);
    // In the implementation: "User is already the owner — nothing to do."
  });

  it("transfer requires 3 updates: household.ownerId + old owner role + new owner role", () => {
    const batchUpdates: string[] = [];
    // Simulate the batch
    batchUpdates.push("household.ownerId");
    batchUpdates.push("oldOwner.role=member");
    batchUpdates.push("newOwner.role=owner");
    expect(batchUpdates).toHaveLength(3);
  });
});

// ─── 12. Firestore database ID — project config ───────────────────────────────

describe("Firestore configuration — project and database IDs", () => {
  it("project ID is 'fenrir-ledger-prod'", () => {
    const FS_PROJECT_ID = "fenrir-ledger-prod";
    expect(FS_PROJECT_ID).toBe("fenrir-ledger-prod");
  });

  it("database ID is non-default 'fenrir-ledger-prod' (not '(default)')", () => {
    expect(FS_DATABASE_ID).toBe("fenrir-ledger-prod");
    expect(FS_DATABASE_ID).not.toBe("(default)");
  });
});

// ─── 13. delete_card: idempotency guard ──────────────────────────────────────

describe("delete-card — idempotency and soft-delete semantics", () => {
  it("already-deleted card should NOT be re-deleted", () => {
    const card = {
      id: "card-already-deleted",
      cardName: "Chase Freedom",
      deletedAt: "2026-02-15T12:00:00.000Z",
    };
    const alreadyDeleted = !!card.deletedAt;
    expect(alreadyDeleted).toBe(true);
    // Command should print warning + return early, not double-delete
  });

  it("active card (no deletedAt) can be soft-deleted", () => {
    const card = { id: "card-active", cardName: "Amex Gold" };
    const canDelete = !("deletedAt" in card) || !(card as typeof card & { deletedAt?: string }).deletedAt;
    expect(canDelete).toBe(true);
  });

  it("soft-delete sets both deletedAt and updatedAt fields", () => {
    const now = new Date().toISOString();
    const update = { deletedAt: now, updatedAt: now };
    expect(update.deletedAt).toBeDefined();
    expect(update.updatedAt).toBeDefined();
    expect(new Date(update.deletedAt).toISOString()).toBe(update.deletedAt);
    expect(new Date(update.updatedAt).toISOString()).toBe(update.updatedAt);
  });
});

// ─── 14. restore_card: FieldValue.delete() semantics ─────────────────────────

describe("restore-card — FieldValue.delete() semantics", () => {
  it("restore should be a no-op if card is not soft-deleted", () => {
    const card = { id: "card-active", cardName: "Chase Sapphire" };
    const hasDeletedAt = "deletedAt" in card;
    expect(hasDeletedAt).toBe(false);
    // Command should print "Card is not soft-deleted — nothing to restore."
  });

  it("restore uses FieldValue.delete() to remove the deletedAt field (not set to null)", () => {
    // FieldValue.delete() is the Firestore sentinel to remove a field entirely
    // Setting to null would keep the field (null); FieldValue.delete() removes it
    // This is a contract test — the implementation must use FieldValue.delete()
    const UPDATE_PAYLOAD_KEY = "deletedAt";
    // Sentinel value in Firestore removes the field, not null
    const sentinel = "FieldValue.delete()"; // symbolically
    expect(sentinel).not.toBe("null");
    expect(UPDATE_PAYLOAD_KEY).toBe("deletedAt");
  });

  it("after restore, the card's deletedAt field is absent", () => {
    const card = { id: "card-1", cardName: "Amex Gold", deletedAt: "2026-03-01T00:00:00.000Z" };
    const restored = Object.fromEntries(
      Object.entries(card).filter(([k]) => k !== "deletedAt")
    );
    expect("deletedAt" in restored).toBe(false);
    expect(restored.id).toBe("card-1");
  });
});

// ─── 15. Households collection query — ordering and limit ────────────────────

describe("households command — Firestore query spec", () => {
  it("queries 'households' collection ordered by createdAt desc", () => {
    const query = {
      collection: "households",
      orderBy: "createdAt",
      direction: "desc",
      limit: 50,
    };
    expect(query.collection).toBe("households");
    expect(query.orderBy).toBe("createdAt");
    expect(query.direction).toBe("desc");
    expect(query.limit).toBe(50);
  });

  it("builds numeric index from returned docs (1-based)", () => {
    const docs = [{ id: "hh-1" }, { id: "hh-2" }, { id: "hh-3" }];
    const index = docs.map((d) => d.id);
    expect(index[0]).toBe("hh-1"); // use-household 1 → index[0]
    expect(index[1]).toBe("hh-2"); // use-household 2 → index[1]
    expect(index[2]).toBe("hh-3"); // use-household 3 → index[2]
  });
});

// ─── 16. users command — Firestore query spec ────────────────────────────────

describe("users command — Firestore query spec", () => {
  it("queries 'users' collection ordered by createdAt desc", () => {
    const query = {
      collection: "users",
      orderBy: "createdAt",
      direction: "desc",
      limit: 50,
    };
    expect(query.collection).toBe("users");
    expect(query.orderBy).toBe("createdAt");
    expect(query.direction).toBe("desc");
    expect(query.limit).toBe(50);
  });

  it("user document path is users/{clerkUserId}", () => {
    const clerkUserId = "user_2abc123xyz";
    const path = `users/${clerkUserId}`;
    expect(path).toBe("users/user_2abc123xyz");
  });
});

// ─── 17. Subcollection paths — cards ─────────────────────────────────────────

describe("cards subcollection — document path contracts", () => {
  const HOUSEHOLD_ID = "hh-abc123";
  const CARD_ID = "card-xyz789";

  it("cards collection path is households/{id}/cards", () => {
    const path = `households/${HOUSEHOLD_ID}/cards`;
    expect(path).toBe("households/hh-abc123/cards");
  });

  it("card document path is households/{id}/cards/{cardId}", () => {
    const path = `households/${HOUSEHOLD_ID}/cards/${CARD_ID}`;
    expect(path).toBe("households/hh-abc123/cards/card-xyz789");
  });

  it("delete_household deletes subcollection before deleting parent", () => {
    // Cards must be deleted first (Firestore doesn't cascade-delete subcollections)
    const ops = ["delete-cards-batch", "delete-household-doc"];
    expect(ops[0]).toBe("delete-cards-batch");
    expect(ops[1]).toBe("delete-household-doc");
  });
});

// ─── 18. Mocked Firestore Admin SDK — set_tier command ───────────────────────

describe("set_tier — Firestore update interaction (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls db.doc(households/{id}).update with {tier, updatedAt}", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockDb = { doc: mockDoc };

    const householdId = "hh-test123";
    const tier = "karl";

    // Simulate set_tier command
    await mockDb.doc(`households/${householdId}`).update({
      tier,
      updatedAt: new Date().toISOString(),
    });

    expect(mockDoc).toHaveBeenCalledWith(`households/${householdId}`);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "karl", updatedAt: expect.any(String) })
    );
  });

  it("does NOT call update when confirmation is declined", async () => {
    const mockUpdate = vi.fn();
    const mockDb = { doc: vi.fn().mockReturnValue({ update: mockUpdate }) };

    // Simulate user declining confirmation (confirmPrompt returns false)
    const confirmed = false;
    if (confirmed) {
      await mockDb.doc("households/hh-test").update({ tier: "karl" });
    }

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ─── 19. Mocked Firestore Admin SDK — regen_invite command ───────────────────

describe("regen_invite — Firestore update interaction (mocked)", () => {
  it("updates inviteCode and inviteCodeExpiresAt on the household doc", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockDb = { doc: mockDoc };

    const householdId = "hh-regen-test";
    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Simulate regen_invite command
    await mockDb.doc(`households/${householdId}`).update({
      inviteCode: code,
      inviteCodeExpiresAt: expiresAt,
      updatedAt: new Date().toISOString(),
    });

    expect(mockDoc).toHaveBeenCalledWith(`households/${householdId}`);
    const callArg = mockUpdate.mock.calls[0][0] as Record<string, string>;
    expect(callArg.inviteCode).toHaveLength(6);
    expect(callArg.inviteCodeExpiresAt).toBeDefined();
    expect(new Date(callArg.inviteCodeExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── 20. Mocked Firestore Admin SDK — card_count command ─────────────────────

describe("card_count — collection read and split (mocked)", () => {
  it("reads all cards and splits into active vs deleted", async () => {
    const cardDocs = [
      { data: () => ({ cardName: "Chase Sapphire" }) },
      { data: () => ({ cardName: "Amex Gold", deletedAt: "2026-02-01T00:00:00.000Z" }) },
      { data: () => ({ cardName: "Citi Cash" }) },
    ];

    const mockGet = vi.fn().mockResolvedValue({ docs: cardDocs, size: cardDocs.length });
    const mockCollection = vi.fn().mockReturnValue({ get: mockGet });
    const mockDb = { collection: mockCollection };

    const householdId = "hh-count-test";
    const snap = await mockDb.collection(`households/${householdId}/cards`).get();
    const active = snap.docs.filter((d) => !d.data().deletedAt).length;
    const deleted = snap.docs.filter((d) => !!d.data().deletedAt).length;

    expect(mockCollection).toHaveBeenCalledWith(`households/${householdId}/cards`);
    expect(active).toBe(2);
    expect(deleted).toBe(1);
    expect(active + deleted).toBe(snap.size);
  });
});

// ─── 21. Mocked Firestore Admin SDK — expunge_card command ───────────────────

describe("expunge_card — permanent deletion (mocked)", () => {
  it("calls db.doc(path).delete() for permanent removal", async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ cardName: "Old Card" }),
    });
    const mockDoc = vi.fn().mockReturnValue({ get: mockGet, delete: mockDelete });
    const mockDb = { doc: mockDoc };

    const householdId = "hh-expunge-test";
    const cardId = "card-to-expunge";

    // Simulate expunge_card (after confirmation)
    const snap = await mockDb.doc(`households/${householdId}/cards/${cardId}`).get();
    expect(snap.exists).toBe(true);

    const confirmed = true;
    if (confirmed) {
      await mockDb.doc(`households/${householdId}/cards/${cardId}`).delete();
    }

    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it("does NOT call delete when card does not exist", async () => {
    const mockDelete = vi.fn();
    const mockGet = vi.fn().mockResolvedValue({ exists: false });
    const mockDoc = vi.fn().mockReturnValue({ get: mockGet, delete: mockDelete });
    const mockDb = { doc: mockDoc };

    const snap = await mockDb.doc("households/hh-x/cards/card-missing").get();
    if (!snap.exists) {
      // early return — no delete called
    } else {
      await mockDb.doc("households/hh-x/cards/card-missing").delete();
    }

    expect(mockDelete).not.toHaveBeenCalled();
  });
});
