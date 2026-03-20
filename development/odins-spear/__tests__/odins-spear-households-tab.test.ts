/**
 * Vitest — Odin's Spear TUI: Households Tab
 * Issue #1388: Households tab — list + detail panel
 *
 * Tests pure helper functions extracted from HouseholdsTab.tsx.
 * No Ink/React/Firestore imports — fully unit-testable.
 *
 * Suites:
 *   1. getEntitlements — tier → feature flags
 *   2. fmtDateShort — ISO date formatting
 *   3. fmtDatetimeShort — ISO datetime formatting
 *   4. truncate — string truncation
 *   5. tierBadge / tierColor — tier badge derivation
 *   6. isExpired — invite code expiry logic
 *   7. Household list navigation — scroll + index clamping
 *   8. Action guard: [s] no-op without stripeSubId
 *   9. Action guard: [k]/[o] with no non-owner members
 *  10. Firestore data normalisation — loadHouseholds shape
 */

import { describe, it, expect } from "vitest";

// ─── Mirror pure helpers from HouseholdsTab.tsx ───────────────────────────────
// These are duplicated here (not imported) because the component file
// contains Ink imports with side effects unsuitable for the vitest environment.

type HouseholdTier = "free" | "karl" | "trial";

interface Entitlements {
  cloudSync: boolean;
  priorityHowl: boolean;
  analytics: boolean;
  hiddenRunes: boolean;
}

function getEntitlements(tier: HouseholdTier): Entitlements {
  return {
    cloudSync:    tier === "karl" || tier === "trial",
    priorityHowl: tier === "karl",
    analytics:    tier === "karl",
    hiddenRunes:  tier === "karl",
  };
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

function fmtDatetimeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const date = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 16);
    return `${date} ${time}`;
  } catch {
    return "—";
  }
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "\u2026";
}

function tierBadge(tier: HouseholdTier): string {
  if (tier === "karl")  return "K";
  if (tier === "trial") return "T";
  return "F";
}

const GRAY = "#6b6b80";
function tierColor(tier: HouseholdTier): string {
  if (tier === "karl")  return "yellow";
  if (tier === "trial") return "yellowBright";
  return GRAY;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

// ─── Navigation helpers (mirrors useInput logic in HouseholdsTab) ─────────────

const LIST_HEIGHT = 18;

interface NavState {
  selectedIdx: number;
  scrollOffset: number;
}

function navUp(state: NavState): NavState {
  const next = Math.max(0, state.selectedIdx <= 0 ? 0 : state.selectedIdx - 1);
  const scroll = next < state.scrollOffset ? next : state.scrollOffset;
  return { selectedIdx: next, scrollOffset: scroll };
}

function navDown(state: NavState, total: number): NavState {
  const max = total - 1;
  const next = state.selectedIdx < 0 ? 0 : Math.min(max, state.selectedIdx + 1);
  const scroll = next >= state.scrollOffset + LIST_HEIGHT
    ? next - LIST_HEIGHT + 1
    : state.scrollOffset;
  return { selectedIdx: next, scrollOffset: scroll };
}

function navEscape(state: NavState): NavState {
  return { ...state, selectedIdx: -1 };
}

function navEnter(state: NavState, total: number): NavState {
  if (state.selectedIdx < 0 && total > 0) {
    return { ...state, selectedIdx: 0 };
  }
  return state;
}

// ─── Firestore doc → HouseholdListItem normalisation ─────────────────────────

interface HouseholdListItem {
  id: string;
  name: string;
  memberCount: number;
  tier: HouseholdTier;
  createdAt: string | null;
  ownerId: string;
  inviteCode: string;
  inviteCodeExpiresAt: string | null;
  updatedAt: string | null;
  stripeSubId: string | null;
}

function normaliseHouseholdDoc(
  id: string,
  data: Record<string, unknown>
): HouseholdListItem {
  return {
    id,
    name:                 (data["name"] as string) || id,
    memberCount:          Array.isArray(data["memberIds"]) ? (data["memberIds"] as string[]).length : 0,
    tier:                 ((data["tier"] as string) || "free") as HouseholdTier,
    createdAt:            (data["createdAt"] as string | null) || null,
    ownerId:              (data["ownerId"] as string) || "",
    inviteCode:           (data["inviteCode"] as string) || "",
    inviteCodeExpiresAt:  (data["inviteCodeExpiresAt"] as string | null) || null,
    updatedAt:            (data["updatedAt"] as string | null) || null,
    stripeSubId:          (data["stripeSubId"] as string | null) || null,
  };
}

// ─── 1. getEntitlements ───────────────────────────────────────────────────────

describe("getEntitlements — tier to feature flags (issue #1388)", () => {
  it("karl: all features enabled", () => {
    const ent = getEntitlements("karl");
    expect(ent.cloudSync).toBe(true);
    expect(ent.priorityHowl).toBe(true);
    expect(ent.analytics).toBe(true);
    expect(ent.hiddenRunes).toBe(true);
  });

  it("trial: only cloudSync enabled", () => {
    const ent = getEntitlements("trial");
    expect(ent.cloudSync).toBe(true);
    expect(ent.priorityHowl).toBe(false);
    expect(ent.analytics).toBe(false);
    expect(ent.hiddenRunes).toBe(false);
  });

  it("free: all features disabled", () => {
    const ent = getEntitlements("free");
    expect(ent.cloudSync).toBe(false);
    expect(ent.priorityHowl).toBe(false);
    expect(ent.analytics).toBe(false);
    expect(ent.hiddenRunes).toBe(false);
  });

  it("karl returns all four entitlement keys", () => {
    const keys = Object.keys(getEntitlements("karl"));
    expect(keys).toContain("cloudSync");
    expect(keys).toContain("priorityHowl");
    expect(keys).toContain("analytics");
    expect(keys).toContain("hiddenRunes");
  });
});

// ─── 2. fmtDateShort ─────────────────────────────────────────────────────────

describe("fmtDateShort — ISO to YYYY-MM-DD (issue #1388)", () => {
  it("formats a valid ISO string to YYYY-MM-DD", () => {
    expect(fmtDateShort("2026-03-18T22:00:00Z")).toBe("2026-03-18");
  });

  it("returns '—' for null", () => {
    expect(fmtDateShort(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(fmtDateShort(undefined)).toBe("—");
  });

  it("returns '—' for empty string", () => {
    expect(fmtDateShort("")).toBe("—");
  });

  it("handles ISO string with only a date part", () => {
    expect(fmtDateShort("2026-01-01T00:00:00.000Z")).toBe("2026-01-01");
  });
});

// ─── 3. fmtDatetimeShort ─────────────────────────────────────────────────────

describe("fmtDatetimeShort — ISO to YYYY-MM-DD HH:MM (issue #1388)", () => {
  it("formats a valid ISO string to 'YYYY-MM-DD HH:MM'", () => {
    expect(fmtDatetimeShort("2026-03-18T14:30:00Z")).toBe("2026-03-18 14:30");
  });

  it("returns '—' for null", () => {
    expect(fmtDatetimeShort(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(fmtDatetimeShort(undefined)).toBe("—");
  });

  it("returns '—' for empty string", () => {
    expect(fmtDatetimeShort("")).toBe("—");
  });

  it("output contains a space between date and time", () => {
    const result = fmtDatetimeShort("2026-06-15T09:05:00Z");
    const parts = result.split(" ");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parts[1]).toMatch(/^\d{2}:\d{2}$/);
  });
});

// ─── 4. truncate ─────────────────────────────────────────────────────────────

describe("truncate — string truncation (issue #1388)", () => {
  it("returns string unchanged if at or under maxLen", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends ellipsis when over maxLen", () => {
    const result = truncate("hello world", 8);
    expect(result.length).toBe(8);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles exactly maxLen+1 length correctly", () => {
    const result = truncate("abcde", 4);
    expect(result).toBe("abc\u2026");
  });

  it("handles empty string", () => {
    expect(truncate("", 10)).toBe("");
  });

  it("truncation preserves start of string content", () => {
    const s = "Household Ironforge";
    const result = truncate(s, 10);
    expect(result.startsWith("Household")).toBe(true);
  });
});

// ─── 5. tierBadge / tierColor ─────────────────────────────────────────────────

describe("tierBadge / tierColor — tier display helpers (issue #1388)", () => {
  describe("tierBadge", () => {
    it("returns 'K' for karl", () => {
      expect(tierBadge("karl")).toBe("K");
    });

    it("returns 'T' for trial", () => {
      expect(tierBadge("trial")).toBe("T");
    });

    it("returns 'F' for free", () => {
      expect(tierBadge("free")).toBe("F");
    });
  });

  describe("tierColor", () => {
    it("returns 'yellow' for karl", () => {
      expect(tierColor("karl")).toBe("yellow");
    });

    it("returns 'yellowBright' for trial", () => {
      expect(tierColor("trial")).toBe("yellowBright");
    });

    it("returns gray for free tier", () => {
      expect(tierColor("free")).toBe(GRAY);
    });
  });
});

// ─── 6. isExpired ─────────────────────────────────────────────────────────────

describe("isExpired — invite code expiry (issue #1388)", () => {
  it("returns false for a future date", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(future)).toBe(false);
  });

  it("returns true for a past date", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it("returns false for null (no expiry set)", () => {
    expect(isExpired(null)).toBe(false);
  });

  it("marks codes from one month ago as expired", () => {
    const expired = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(expired)).toBe(true);
  });
});

// ─── 7. Household list navigation ─────────────────────────────────────────────

describe("Households tab keyboard navigation — scroll and index (issue #1388)", () => {
  describe("upArrow", () => {
    it("decrements selectedIdx", () => {
      expect(navUp({ selectedIdx: 5, scrollOffset: 0 }).selectedIdx).toBe(4);
    });

    it("clamps to 0 at the top", () => {
      expect(navUp({ selectedIdx: 0, scrollOffset: 0 }).selectedIdx).toBe(0);
    });

    it("scrolls up when selection moves above viewport", () => {
      expect(navUp({ selectedIdx: 3, scrollOffset: 3 }).scrollOffset).toBe(2);
    });

    it("does not scroll when selection remains in viewport", () => {
      expect(navUp({ selectedIdx: 10, scrollOffset: 2 }).scrollOffset).toBe(2);
    });
  });

  describe("downArrow", () => {
    it("increments selectedIdx", () => {
      expect(navDown({ selectedIdx: 3, scrollOffset: 0 }, 20).selectedIdx).toBe(4);
    });

    it("clamps at last index", () => {
      expect(navDown({ selectedIdx: 19, scrollOffset: 0 }, 20).selectedIdx).toBe(19);
    });

    it("selects index 0 from -1 (no selection)", () => {
      expect(navDown({ selectedIdx: -1, scrollOffset: 0 }, 10).selectedIdx).toBe(0);
    });

    it("advances scrollOffset when selection exceeds LIST_HEIGHT", () => {
      const { scrollOffset } = navDown({ selectedIdx: LIST_HEIGHT - 1, scrollOffset: 0 }, 30);
      expect(scrollOffset).toBe(1);
    });

    it("does not scroll when in viewport", () => {
      expect(navDown({ selectedIdx: 5, scrollOffset: 0 }, 20).scrollOffset).toBe(0);
    });
  });

  describe("Escape key", () => {
    it("resets selectedIdx to -1", () => {
      expect(navEscape({ selectedIdx: 5, scrollOffset: 2 }).selectedIdx).toBe(-1);
    });

    it("preserves scrollOffset", () => {
      expect(navEscape({ selectedIdx: 5, scrollOffset: 2 }).scrollOffset).toBe(2);
    });
  });

  describe("Enter key", () => {
    it("selects first item when nothing selected", () => {
      expect(navEnter({ selectedIdx: -1, scrollOffset: 0 }, 5).selectedIdx).toBe(0);
    });

    it("no-op when already selected", () => {
      expect(navEnter({ selectedIdx: 3, scrollOffset: 0 }, 5).selectedIdx).toBe(3);
    });

    it("no-op when list is empty", () => {
      expect(navEnter({ selectedIdx: -1, scrollOffset: 0 }, 0).selectedIdx).toBe(-1);
    });
  });
});

// ─── 8. Action guard: [s] cancel-sub ─────────────────────────────────────────

type ActionGuardResult =
  | { kind: "confirm"; actionKind: string }
  | { kind: "noop"; reason: string };

function guardCancelSub(hh: { tier: HouseholdTier; stripeSubId: string | null }): ActionGuardResult {
  if (hh.tier !== "karl" || !hh.stripeSubId) {
    return { kind: "noop", reason: "requires Karl tier with stripeSubId" };
  }
  return { kind: "confirm", actionKind: "cancel-sub" };
}

describe("Action guard: [s] cancel-sub (issue #1388)", () => {
  it("allows cancel-sub for karl household with stripeSubId", () => {
    const result = guardCancelSub({ tier: "karl", stripeSubId: "sub_abc123" });
    expect(result.kind).toBe("confirm");
  });

  it("blocks cancel-sub for free tier", () => {
    const result = guardCancelSub({ tier: "free", stripeSubId: null });
    expect(result.kind).toBe("noop");
  });

  it("blocks cancel-sub for trial tier", () => {
    const result = guardCancelSub({ tier: "trial", stripeSubId: null });
    expect(result.kind).toBe("noop");
  });

  it("blocks cancel-sub for karl without stripeSubId", () => {
    const result = guardCancelSub({ tier: "karl", stripeSubId: null });
    expect(result.kind).toBe("noop");
  });

  it("noop result contains a reason string", () => {
    const result = guardCancelSub({ tier: "free", stripeSubId: null });
    if (result.kind === "noop") {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});

// ─── 9. Action guards: [k] kick / [o] xfer owner ─────────────────────────────

interface MemberRow {
  userId: string;
  email: string;
  role: string;
}

function guardKick(members: MemberRow[]): ActionGuardResult {
  const target = members.find((m) => m.role !== "owner");
  if (!target) return { kind: "noop", reason: "no non-owner members" };
  return { kind: "confirm", actionKind: "kick" };
}

function guardXferOwner(members: MemberRow[]): ActionGuardResult {
  const target = members.find((m) => m.role !== "owner");
  if (!target) return { kind: "noop", reason: "no non-owner members" };
  return { kind: "confirm", actionKind: "xfer" };
}

describe("Action guards: [k] kick and [o] xfer owner (issue #1388)", () => {
  describe("[k] kick", () => {
    it("allows kick when non-owner member exists", () => {
      const members: MemberRow[] = [
        { userId: "u1", email: "owner@x.com", role: "owner" },
        { userId: "u2", email: "member@x.com", role: "member" },
      ];
      expect(guardKick(members).kind).toBe("confirm");
    });

    it("blocks kick when only owner", () => {
      const members: MemberRow[] = [
        { userId: "u1", email: "owner@x.com", role: "owner" },
      ];
      expect(guardKick(members).kind).toBe("noop");
    });

    it("blocks kick on empty member list", () => {
      expect(guardKick([]).kind).toBe("noop");
    });
  });

  describe("[o] xfer owner", () => {
    it("allows xfer when non-owner member exists", () => {
      const members: MemberRow[] = [
        { userId: "u1", email: "owner@x.com", role: "owner" },
        { userId: "u2", email: "member@x.com", role: "member" },
      ];
      expect(guardXferOwner(members).kind).toBe("confirm");
    });

    it("blocks xfer when only owner", () => {
      const members: MemberRow[] = [
        { userId: "u1", email: "owner@x.com", role: "owner" },
      ];
      expect(guardXferOwner(members).kind).toBe("noop");
    });

    it("blocks xfer on empty member list", () => {
      expect(guardXferOwner([]).kind).toBe("noop");
    });
  });
});

// ─── 10. Firestore doc normalisation ─────────────────────────────────────────

describe("Firestore doc → HouseholdListItem normalisation (issue #1388)", () => {
  it("extracts name from doc data", () => {
    const item = normaliseHouseholdDoc("hh_1", { name: "Ironforge", memberIds: ["u1", "u2"], tier: "karl" });
    expect(item.name).toBe("Ironforge");
  });

  it("falls back to id when name is absent", () => {
    const item = normaliseHouseholdDoc("hh_fallback", {});
    expect(item.name).toBe("hh_fallback");
  });

  it("counts memberIds correctly", () => {
    const item = normaliseHouseholdDoc("hh_2", { memberIds: ["u1", "u2", "u3"] });
    expect(item.memberCount).toBe(3);
  });

  it("sets memberCount to 0 when memberIds absent", () => {
    const item = normaliseHouseholdDoc("hh_3", {});
    expect(item.memberCount).toBe(0);
  });

  it("defaults tier to free when absent", () => {
    const item = normaliseHouseholdDoc("hh_4", { name: "Solo" });
    expect(item.tier).toBe("free");
  });

  it("preserves karl tier", () => {
    const item = normaliseHouseholdDoc("hh_5", { name: "Premium", tier: "karl" });
    expect(item.tier).toBe("karl");
  });

  it("preserves trial tier", () => {
    const item = normaliseHouseholdDoc("hh_6", { name: "Trial HH", tier: "trial" });
    expect(item.tier).toBe("trial");
  });

  it("sets stripeSubId when present", () => {
    const item = normaliseHouseholdDoc("hh_7", { stripeSubId: "sub_abc" });
    expect(item.stripeSubId).toBe("sub_abc");
  });

  it("sets stripeSubId to null when absent", () => {
    const item = normaliseHouseholdDoc("hh_8", {});
    expect(item.stripeSubId).toBeNull();
  });

  it("sets inviteCodeExpiresAt to null when absent", () => {
    const item = normaliseHouseholdDoc("hh_9", {});
    expect(item.inviteCodeExpiresAt).toBeNull();
  });

  it("preserves inviteCode from data", () => {
    const item = normaliseHouseholdDoc("hh_10", { inviteCode: "X7K2MQ" });
    expect(item.inviteCode).toBe("X7K2MQ");
  });

  it("preserves ownerId from data", () => {
    const item = normaliseHouseholdDoc("hh_11", { ownerId: "user_owner123" });
    expect(item.ownerId).toBe("user_owner123");
  });
});
