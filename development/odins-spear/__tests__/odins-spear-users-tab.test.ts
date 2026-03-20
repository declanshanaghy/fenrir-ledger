/**
 * Vitest — Odin's Spear TUI: Users Tab
 * Issue #1387: Users tab — list + detail panel
 *
 * odins-spear.mjs cannot be imported (top-level await + side effects).
 * Tests mirror the logic with injectable dependencies, following the same
 * pattern as other odins-spear-*.test.ts suites.
 *
 * Suites:
 *   1. loadUsersWithTiers — tier derivation from household map
 *   2. loadUserDetailData — card count, household, cloud sync, stripe
 *   3. Users tab keyboard navigation — scroll offset, index clamping
 *   4. Tier badge derivation — Karl/Trial/Thrall edge cases
 *   5. Action: deleteUser — household member removal
 *   6. Action: updateTier — household tier update
 *   7. inputCaptured guard — tier prompt blocks global quit/tab
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── 1. loadUsersWithTiers — tier derivation ──────────────────────────────────
//
// Mirrors the logic in loadUsersWithTiers():
//   - If user has householdId → tier comes from hhMap
//   - If user has no householdId → falls back to u.tier or "thrall"

interface HouseholdSnap {
  id: string;
  tier: string;
  name: string;
}

interface UserDoc {
  email?: string;
  displayName?: string;
  role?: string;
  householdId?: string;
  createdAt?: string;
  tier?: string;
  stripeCustomerId?: string;
  lastSyncAt?: string;
  syncCount?: number;
  syncHealth?: string;
}

interface EnrichedUser {
  id: string;
  email: string;
  tier: string;
  householdId: string | null;
  householdName: string | null;
  stripeCustomerId: string | null;
  lastSyncAt: string | null;
  syncCount: number | null;
  syncHealth: string | null;
}

function deriveUsersWithTiers(
  userDocs: Array<{ id: string; data: () => UserDoc }>,
  householdDocs: Array<{ id: string; data: () => { tier?: string; name?: string } }>
): EnrichedUser[] {
  const hhMap = new Map<string, { tier: string; name: string }>();
  householdDocs.forEach((d) => {
    const h = d.data();
    hhMap.set(d.id, { tier: h.tier || "thrall", name: h.name || "" });
  });

  return userDocs.map((d) => {
    const u = d.data();
    const hh = u.householdId ? hhMap.get(u.householdId) : null;
    return {
      id: d.id,
      email: u.email || "",
      displayName: u.displayName || "",
      role: u.role || "",
      householdId: u.householdId || null,
      householdName: hh ? hh.name : null,
      tier: hh ? hh.tier : (u.tier || "thrall"),
      createdAt: u.createdAt || null,
      updatedAt: null,
      stripeCustomerId: u.stripeCustomerId || null,
      lastSyncAt: u.lastSyncAt || null,
      syncCount: u.syncCount != null ? u.syncCount : null,
      syncHealth: u.syncHealth || null,
    } as EnrichedUser;
  });
}

describe("loadUsersWithTiers — tier derivation from household map (issue #1387)", () => {
  it("assigns Karl tier to a user in a Karl household", () => {
    const users = [{ id: "usr_1", data: () => ({ email: "a@b.com", householdId: "hh_1" }) }];
    const households = [{ id: "hh_1", data: () => ({ tier: "karl", name: "Ironforge" }) }];
    const result = deriveUsersWithTiers(users, households);
    expect(result[0].tier).toBe("karl");
  });

  it("assigns Trial tier to a user in a Trial household", () => {
    const users = [{ id: "usr_2", data: () => ({ email: "b@b.com", householdId: "hh_2" }) }];
    const households = [{ id: "hh_2", data: () => ({ tier: "trial", name: "Berserker" }) }];
    const result = deriveUsersWithTiers(users, households);
    expect(result[0].tier).toBe("trial");
  });

  it("defaults to thrall when user has no householdId and no tier field", () => {
    const users = [{ id: "usr_3", data: () => ({ email: "c@b.com" }) }];
    const result = deriveUsersWithTiers(users, []);
    expect(result[0].tier).toBe("thrall");
  });

  it("uses user.tier field as fallback when there is no household", () => {
    const users = [{ id: "usr_4", data: () => ({ email: "d@b.com", tier: "trial" }) }];
    const result = deriveUsersWithTiers(users, []);
    expect(result[0].tier).toBe("trial");
  });

  it("household tier takes precedence over user-level tier field", () => {
    // User doc says 'thrall' but household says 'karl'
    const users = [{ id: "usr_5", data: () => ({ email: "e@b.com", householdId: "hh_3", tier: "thrall" }) }];
    const households = [{ id: "hh_3", data: () => ({ tier: "karl", name: "Warriors" }) }];
    const result = deriveUsersWithTiers(users, households);
    expect(result[0].tier).toBe("karl");
  });

  it("sets householdName from the household map", () => {
    const users = [{ id: "usr_6", data: () => ({ email: "f@b.com", householdId: "hh_4" }) }];
    const households = [{ id: "hh_4", data: () => ({ tier: "karl", name: "Shield Maidens" }) }];
    const result = deriveUsersWithTiers(users, households);
    expect(result[0].householdName).toBe("Shield Maidens");
  });

  it("sets householdName to null for users with no household", () => {
    const users = [{ id: "usr_7", data: () => ({ email: "g@b.com" }) }];
    const result = deriveUsersWithTiers(users, []);
    expect(result[0].householdName).toBeNull();
  });

  it("defaults household tier to 'thrall' when household has no tier field", () => {
    const users = [{ id: "usr_8", data: () => ({ email: "h@b.com", householdId: "hh_5" }) }];
    const households = [{ id: "hh_5", data: () => ({ name: "Empty" }) }]; // no tier
    const result = deriveUsersWithTiers(users, households);
    expect(result[0].tier).toBe("thrall");
  });

  it("includes stripeCustomerId when present on user doc", () => {
    const users = [{ id: "usr_9", data: () => ({ email: "i@b.com", stripeCustomerId: "cus_abc123" }) }];
    const result = deriveUsersWithTiers(users, []);
    expect(result[0].stripeCustomerId).toBe("cus_abc123");
  });

  it("sets stripeCustomerId to null when absent", () => {
    const users = [{ id: "usr_10", data: () => ({ email: "j@b.com" }) }];
    const result = deriveUsersWithTiers(users, []);
    expect(result[0].stripeCustomerId).toBeNull();
  });

  it("handles multiple users with different households", () => {
    const users = [
      { id: "usr_11", data: () => ({ email: "k@b.com", householdId: "hh_6" }) },
      { id: "usr_12", data: () => ({ email: "l@b.com", householdId: "hh_7" }) },
      { id: "usr_13", data: () => ({ email: "m@b.com" }) },
    ];
    const households = [
      { id: "hh_6", data: () => ({ tier: "karl", name: "A" }) },
      { id: "hh_7", data: () => ({ tier: "trial", name: "B" }) },
    ];
    const result = deriveUsersWithTiers(users, households);
    expect(result[0].tier).toBe("karl");
    expect(result[1].tier).toBe("trial");
    expect(result[2].tier).toBe("thrall");
  });

  it("preserves the full userId without truncation", () => {
    const fullId = "user_T3kR9mXp2vLq8nAbCdEfGhIjKlMn";
    const users = [{ id: fullId, data: () => ({ email: "n@b.com" }) }];
    const result = deriveUsersWithTiers(users, []);
    expect(result[0].id).toBe(fullId);
    expect(result[0].id.length).toBe(fullId.length);
  });
});

// ─── 2. loadUserDetailData — cloud sync from household ────────────────────────
//
// Mirrors loadUserDetailData():
//   - If user has lastSyncAt → cloudSync is set from user doc
//   - If not → cloudSync may come from household doc
//   - cardCount = { active, total }

interface UserDetailResult {
  household: { id: string; name: string; tier: string } | null;
  stripe: null;
  cloudSync: { lastSync: string | null; totalSyncs: number; health: string } | null;
  cardCount: { active: number; total: number } | null;
}

function buildUserDetail(
  user: { householdId?: string | null; lastSyncAt?: string | null; syncCount?: number | null; syncHealth?: string | null },
  householdData: { name?: string; tier?: string; lastSyncAt?: string | null; syncCount?: number; syncHealth?: string } | null,
  cards: Array<{ deletedAt?: string }>
): UserDetailResult {
  const result: UserDetailResult = {
    household: null,
    stripe: null,
    cloudSync: user.lastSyncAt != null ? {
      lastSync: user.lastSyncAt,
      totalSyncs: user.syncCount || 0,
      health: user.syncHealth || "unknown",
    } : null,
    cardCount: null,
  };

  if (user.householdId && householdData) {
    result.household = {
      id: user.householdId,
      name: householdData.name || "",
      tier: householdData.tier || "thrall",
    };
    // Cloud sync fallback from household
    if (!result.cloudSync && (householdData.lastSyncAt || householdData.syncCount != null)) {
      result.cloudSync = {
        lastSync: householdData.lastSyncAt || null,
        totalSyncs: householdData.syncCount || 0,
        health: householdData.syncHealth || "unknown",
      };
    }
    const active = cards.filter((c) => !c.deletedAt).length;
    result.cardCount = { active, total: cards.length };
  }

  return result;
}

describe("loadUserDetailData — household, cloud sync, card count (issue #1387)", () => {
  it("sets household info when user has householdId", () => {
    const result = buildUserDetail(
      { householdId: "hh_1" },
      { name: "Ironforge", tier: "karl" },
      []
    );
    expect(result.household).toEqual({ id: "hh_1", name: "Ironforge", tier: "karl" });
  });

  it("leaves household null when user has no householdId", () => {
    const result = buildUserDetail({ householdId: null }, null, []);
    expect(result.household).toBeNull();
  });

  it("uses user.lastSyncAt for cloudSync when present", () => {
    const result = buildUserDetail(
      { householdId: "hh_1", lastSyncAt: "2026-03-18T08:00:00Z", syncCount: 100, syncHealth: "healthy" },
      { name: "A", tier: "karl", lastSyncAt: "2026-01-01T00:00:00Z" }, // household value should be ignored
      []
    );
    expect(result.cloudSync?.lastSync).toBe("2026-03-18T08:00:00Z");
    expect(result.cloudSync?.totalSyncs).toBe(100);
    expect(result.cloudSync?.health).toBe("healthy");
  });

  it("falls back to household cloudSync when user has no lastSyncAt", () => {
    const result = buildUserDetail(
      { householdId: "hh_1" },
      { name: "B", tier: "karl", lastSyncAt: "2026-03-17T22:00:00Z", syncCount: 50, syncHealth: "healthy" },
      []
    );
    expect(result.cloudSync?.lastSync).toBe("2026-03-17T22:00:00Z");
    expect(result.cloudSync?.totalSyncs).toBe(50);
  });

  it("leaves cloudSync null when neither user nor household has sync data", () => {
    const result = buildUserDetail(
      { householdId: "hh_1" },
      { name: "C", tier: "thrall" },
      []
    );
    expect(result.cloudSync).toBeNull();
  });

  it("counts active cards correctly", () => {
    const cards = [
      {},           // active
      {},           // active
      { deletedAt: "2026-01-01" }, // deleted
    ];
    const result = buildUserDetail({ householdId: "hh_1" }, { name: "D", tier: "karl" }, cards);
    expect(result.cardCount).toEqual({ active: 2, total: 3 });
  });

  it("returns cardCount null for users with no householdId", () => {
    const result = buildUserDetail({ householdId: null }, null, [{ }, {}]);
    expect(result.cardCount).toBeNull();
  });

  it("sets cardCount to zero active when all cards are deleted", () => {
    const cards = [{ deletedAt: "2026-01-01" }, { deletedAt: "2026-01-02" }];
    const result = buildUserDetail({ householdId: "hh_1" }, { name: "E", tier: "karl" }, cards);
    expect(result.cardCount).toEqual({ active: 0, total: 2 });
  });
});

// ─── 3. Users tab keyboard navigation — scroll offset logic ──────────────────
//
// Mirrors the useInput handler in UsersTab:
//   upArrow   → selectedIdx = max(0, selectedIdx - 1), adjust scrollOffset
//   downArrow → selectedIdx = min(maxIdx, selectedIdx + 1), adjust scrollOffset
//   return    → if no selection, select 0
//   escape    → selectedIdx = -1

const LIST_HEIGHT = 18;

interface NavState {
  selectedIdx: number;
  scrollOffset: number;
}

function navUp(state: NavState): NavState {
  const newIdx = Math.max(0, state.selectedIdx <= 0 ? 0 : state.selectedIdx - 1);
  const newScroll = newIdx < state.scrollOffset ? newIdx : state.scrollOffset;
  return { selectedIdx: newIdx, scrollOffset: newScroll };
}

function navDown(state: NavState, totalUsers: number): NavState {
  const maxIdx = totalUsers - 1;
  const newIdx = state.selectedIdx < 0 ? 0 : Math.min(maxIdx, state.selectedIdx + 1);
  const newScroll = newIdx >= state.scrollOffset + LIST_HEIGHT
    ? newIdx - LIST_HEIGHT + 1
    : state.scrollOffset;
  return { selectedIdx: newIdx, scrollOffset: newScroll };
}

function navEnter(state: NavState, totalUsers: number): NavState {
  if (state.selectedIdx < 0 && totalUsers > 0) {
    return { ...state, selectedIdx: 0 };
  }
  return state;
}

function navEscape(state: NavState): NavState {
  return { ...state, selectedIdx: -1 };
}

describe("Users tab keyboard navigation — scroll and index logic (issue #1387)", () => {
  describe("upArrow", () => {
    it("decrements selectedIdx", () => {
      const { selectedIdx } = navUp({ selectedIdx: 5, scrollOffset: 0 });
      expect(selectedIdx).toBe(4);
    });

    it("clamps to 0 at the top of the list", () => {
      const { selectedIdx } = navUp({ selectedIdx: 0, scrollOffset: 0 });
      expect(selectedIdx).toBe(0);
    });

    it("scrolls up when selection moves above viewport", () => {
      const { scrollOffset } = navUp({ selectedIdx: 3, scrollOffset: 3 });
      expect(scrollOffset).toBe(2);
    });

    it("does not scroll when selection stays within viewport", () => {
      const { scrollOffset } = navUp({ selectedIdx: 10, scrollOffset: 5 });
      expect(scrollOffset).toBe(5);
    });
  });

  describe("downArrow", () => {
    it("increments selectedIdx", () => {
      const { selectedIdx } = navDown({ selectedIdx: 3, scrollOffset: 0 }, 20);
      expect(selectedIdx).toBe(4);
    });

    it("clamps to last index at the bottom of the list", () => {
      const { selectedIdx } = navDown({ selectedIdx: 19, scrollOffset: 0 }, 20);
      expect(selectedIdx).toBe(19);
    });

    it("selects index 0 when starting from no selection", () => {
      const { selectedIdx } = navDown({ selectedIdx: -1, scrollOffset: 0 }, 20);
      expect(selectedIdx).toBe(0);
    });

    it("advances scrollOffset when selection exceeds LIST_HEIGHT", () => {
      // selectedIdx = LIST_HEIGHT - 1 = 17, scrollOffset = 0 → next down = 18
      const { scrollOffset } = navDown({ selectedIdx: LIST_HEIGHT - 1, scrollOffset: 0 }, 30);
      expect(scrollOffset).toBe(1);
    });

    it("does not scroll when selection stays within viewport", () => {
      const { scrollOffset } = navDown({ selectedIdx: 5, scrollOffset: 0 }, 20);
      expect(scrollOffset).toBe(0);
    });
  });

  describe("Enter key", () => {
    it("selects first item when no item is selected", () => {
      const { selectedIdx } = navEnter({ selectedIdx: -1, scrollOffset: 0 }, 10);
      expect(selectedIdx).toBe(0);
    });

    it("does not change selection if already selected", () => {
      const { selectedIdx } = navEnter({ selectedIdx: 3, scrollOffset: 0 }, 10);
      expect(selectedIdx).toBe(3);
    });

    it("does nothing when list is empty", () => {
      const { selectedIdx } = navEnter({ selectedIdx: -1, scrollOffset: 0 }, 0);
      expect(selectedIdx).toBe(-1);
    });
  });

  describe("Escape key", () => {
    it("deselects the current item", () => {
      const { selectedIdx } = navEscape({ selectedIdx: 5, scrollOffset: 2 });
      expect(selectedIdx).toBe(-1);
    });

    it("preserves scrollOffset on escape", () => {
      const { scrollOffset } = navEscape({ selectedIdx: 5, scrollOffset: 2 });
      expect(scrollOffset).toBe(2);
    });
  });
});

// ─── 4. Tier badge derivation — Karl/Trial/Thrall ─────────────────────────────

const TIER_STYLES: Record<string, { label: string; bg: string | undefined; color: string }> = {
  karl:   { label: "KARL",   bg: "yellow",       color: "black"  },
  trial:  { label: "TRIAL",  bg: "yellowBright", color: "black"  },
  thrall: { label: "THRALL", bg: undefined,       color: "gray"   },
};

function getTierStyle(tier: string) {
  return TIER_STYLES[tier] ?? TIER_STYLES.thrall;
}

describe("TierBadge tier style derivation (issue #1387)", () => {
  it("returns yellow bg for karl tier", () => {
    expect(getTierStyle("karl").bg).toBe("yellow");
  });

  it("returns yellowBright bg for trial tier", () => {
    expect(getTierStyle("trial").bg).toBe("yellowBright");
  });

  it("returns undefined bg for thrall tier (text-only)", () => {
    expect(getTierStyle("thrall").bg).toBeUndefined();
  });

  it("returns gray color for thrall tier", () => {
    expect(getTierStyle("thrall").color).toBe("gray");
  });

  it("returns black text for karl (legible on yellow)", () => {
    expect(getTierStyle("karl").color).toBe("black");
  });

  it("falls back to thrall style for unknown tier strings", () => {
    expect(getTierStyle("unknown").label).toBe("THRALL");
  });

  it("badge labels match expected tier names (uppercase)", () => {
    expect(getTierStyle("karl").label).toBe("KARL");
    expect(getTierStyle("trial").label).toBe("TRIAL");
    expect(getTierStyle("thrall").label).toBe("THRALL");
  });
});

// ─── 5. Action: deleteUser — household member list update ─────────────────────
//
// Mirrors doDeleteUser():
//   1. If user has householdId, remove userId from household memberIds
//   2. Delete user doc from Firestore
//   3. Remove user from local state list

interface DeleteUserDeps {
  getHouseholdDoc: (hhId: string) => Promise<{ exists: boolean; data: () => { memberIds: string[] } }>;
  updateHousehold: (hhId: string, patch: { memberIds: string[] }) => Promise<void>;
  deleteUserDoc: (userId: string) => Promise<void>;
  setUsers: (updater: (prev: string[]) => string[]) => void;
  setStatusMessage: (msg: string) => void;
  setSelectedIdx: (idx: number) => void;
}

async function simulateDeleteUser(
  userId: string,
  householdId: string | null,
  currentUsers: string[],
  deps: DeleteUserDeps
): Promise<void> {
  try {
    if (householdId) {
      const hhDoc = await deps.getHouseholdDoc(householdId);
      if (hhDoc.exists) {
        const h = hhDoc.data();
        const newMembers = (h.memberIds || []).filter((id) => id !== userId);
        await deps.updateHousehold(householdId, { memberIds: newMembers });
      }
    }
    await deps.deleteUserDoc(userId);
    deps.setUsers((prev) => prev.filter((id) => id !== userId));
    deps.setSelectedIdx(-1);
    deps.setStatusMessage(`Deleted ${userId}`);
  } catch (err) {
    deps.setStatusMessage(`Error: ${(err as Error).message}`);
  }
}

describe("Action: deleteUser — household cleanup (issue #1387)", () => {
  let deps: {
    getHouseholdDoc: Mock;
    updateHousehold: Mock;
    deleteUserDoc: Mock;
    setUsers: Mock;
    setStatusMessage: Mock;
    setSelectedIdx: Mock;
  };

  beforeEach(() => {
    deps = {
      getHouseholdDoc: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ memberIds: ["usr_A", "usr_B", "usr_C"] }),
      }),
      updateHousehold: vi.fn().mockResolvedValue(undefined),
      deleteUserDoc: vi.fn().mockResolvedValue(undefined),
      setUsers: vi.fn(),
      setStatusMessage: vi.fn(),
      setSelectedIdx: vi.fn(),
    };
  });

  it("removes user from household memberIds before deleting", async () => {
    await simulateDeleteUser("usr_B", "hh_1", ["usr_A", "usr_B", "usr_C"], deps);
    expect(deps.updateHousehold).toHaveBeenCalledWith("hh_1", {
      memberIds: ["usr_A", "usr_C"],
    });
  });

  it("deletes the user Firestore doc", async () => {
    await simulateDeleteUser("usr_B", "hh_1", ["usr_A", "usr_B"], deps);
    expect(deps.deleteUserDoc).toHaveBeenCalledWith("usr_B");
  });

  it("resets selectedIdx to -1 after delete", async () => {
    await simulateDeleteUser("usr_B", "hh_1", ["usr_A", "usr_B"], deps);
    expect(deps.setSelectedIdx).toHaveBeenCalledWith(-1);
  });

  it("shows success status message", async () => {
    await simulateDeleteUser("usr_B", "hh_1", ["usr_A", "usr_B"], deps);
    expect(deps.setStatusMessage).toHaveBeenCalledWith("Deleted usr_B");
  });

  it("skips household update for a user with no household", async () => {
    await simulateDeleteUser("usr_solo", null, ["usr_solo"], deps);
    expect(deps.getHouseholdDoc).not.toHaveBeenCalled();
    expect(deps.updateHousehold).not.toHaveBeenCalled();
  });

  it("shows error message when Firestore throws", async () => {
    deps.deleteUserDoc.mockRejectedValue(new Error("PERMISSION_DENIED"));
    await simulateDeleteUser("usr_B", "hh_1", ["usr_A", "usr_B"], deps);
    const msg = (deps.setStatusMessage as Mock).mock.calls[0][0] as string;
    expect(msg).toMatch(/Error:/);
    expect(msg).toMatch(/PERMISSION_DENIED/);
  });
});

// ─── 6. Action: updateTier — validates tier before writing ───────────────────

type ValidTier = "karl" | "trial" | "thrall";

function validateTierInput(raw: string): ValidTier | null {
  const tier = raw.trim().toLowerCase();
  if (tier === "karl" || tier === "trial" || tier === "thrall") return tier as ValidTier;
  return null;
}

describe("Action: updateTier — input validation (issue #1387)", () => {
  it("accepts 'karl' as a valid tier", () => {
    expect(validateTierInput("karl")).toBe("karl");
  });

  it("accepts 'trial' as a valid tier", () => {
    expect(validateTierInput("trial")).toBe("trial");
  });

  it("accepts 'thrall' as a valid tier", () => {
    expect(validateTierInput("thrall")).toBe("thrall");
  });

  it("is case-insensitive for valid tiers", () => {
    expect(validateTierInput("KARL")).toBe("karl");
    expect(validateTierInput("Trial")).toBe("trial");
    expect(validateTierInput("THRALL")).toBe("thrall");
  });

  it("trims whitespace before validating", () => {
    expect(validateTierInput("  karl  ")).toBe("karl");
  });

  it("returns null for invalid tier strings", () => {
    expect(validateTierInput("free")).toBeNull();
    expect(validateTierInput("premium")).toBeNull();
    expect(validateTierInput("")).toBeNull();
    expect(validateTierInput("karl!")).toBeNull();
  });
});

// ─── 7. inputCaptured guard — tier prompt blocks global handlers ──────────────
//
// Mirrors: if (inputCaptured) return; in SpearApp.useInput
// When a tab sets inputCaptured=true (e.g. during tier prompt), global
// handlers (q, ?, Tab) must NOT fire.

function handleGlobalInput(
  input: string,
  key: { tab?: boolean; ctrl?: boolean },
  inputCaptured: boolean,
  deps: {
    quit: () => void;
    setShowHelp: () => void;
    setActiveTab: () => void;
  }
): void {
  if (inputCaptured) return;
  if (input === "q") { deps.quit(); return; }
  if (input === "?") { deps.setShowHelp(); return; }
  if (key.tab) { deps.setActiveTab(); return; }
}

describe("inputCaptured guard — global input blocked during tier prompt (issue #1387)", () => {
  let deps: { quit: Mock; setShowHelp: Mock; setActiveTab: Mock };

  beforeEach(() => {
    deps = { quit: vi.fn(), setShowHelp: vi.fn(), setActiveTab: vi.fn() };
  });

  it("blocks quit when inputCaptured is true", () => {
    handleGlobalInput("q", {}, true, deps);
    expect(deps.quit).not.toHaveBeenCalled();
  });

  it("blocks help toggle when inputCaptured is true", () => {
    handleGlobalInput("?", {}, true, deps);
    expect(deps.setShowHelp).not.toHaveBeenCalled();
  });

  it("blocks tab switch when inputCaptured is true", () => {
    handleGlobalInput("", { tab: true }, true, deps);
    expect(deps.setActiveTab).not.toHaveBeenCalled();
  });

  it("allows quit when inputCaptured is false", () => {
    handleGlobalInput("q", {}, false, deps);
    expect(deps.quit).toHaveBeenCalledTimes(1);
  });

  it("allows help toggle when inputCaptured is false", () => {
    handleGlobalInput("?", {}, false, deps);
    expect(deps.setShowHelp).toHaveBeenCalledTimes(1);
  });

  it("allows tab switch when inputCaptured is false", () => {
    handleGlobalInput("", { tab: true }, false, deps);
    expect(deps.setActiveTab).toHaveBeenCalledTimes(1);
  });
});
