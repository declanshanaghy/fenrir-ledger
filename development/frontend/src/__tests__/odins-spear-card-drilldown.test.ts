/**
 * Vitest — Odin's Spear TUI: Card Drill-Down View
 * Issue #1389: Card drill-down view accessible from Users and Households tabs
 *
 * odins-spear.mjs cannot be imported (top-level await + side effects).
 * Tests mirror the logic with injectable dependencies, following the same
 * pattern as other odins-spear-*.test.ts suites.
 *
 * Suites:
 *   1. CARD_STATUS_DOT — status indicator mapping (dot + color)
 *   2. CARD_STATUS_REALM — Norse realm name mapping per card status
 *   3. SpendProgressBar logic — fill ratio, color thresholds, edge cases
 *   4. sortCards — ordering: active → fee_approaching → promo_expiring → closed → deleted
 *   5. loadCardsForHousehold — Firestore fetch + userId filter
 *   6. CardDrilldownView navigation — scroll offset, index clamping, Enter to open detail
 *   7. CardDetailPanel mode state machine — browse → confirm → expunge flow
 *   8. Expunge input validation — must type exactly "delete"
 *   9. Action: doDelete — soft delete (set deletedAt)
 *   10. Action: doRestore — restore to active (delete deletedAt field + set status)
 *   11. Action: doExpunge — permanent Firestore delete
 *   12. inputCaptured guard — expunge input blocks global handlers
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── 1. CARD_STATUS_DOT — status indicator mapping ────────────────────────────
//
// Mirrors the CARD_STATUS_DOT constant in odins-spear.mjs:
//   active          → ● green
//   fee_approaching → ◐ yellow
//   promo_expiring  → ◐ yellow
//   closed          → ○ gray

const CARD_STATUS_DOT: Record<string, { dot: string; color: string }> = {
  active:          { dot: "●", color: "green"  },
  fee_approaching: { dot: "◐", color: "yellow" },
  promo_expiring:  { dot: "◐", color: "yellow" },
  closed:          { dot: "○", color: "gray"   },
};

function getStatusDot(status: string): { dot: string; color: string } {
  return CARD_STATUS_DOT[status] || { dot: "○", color: "gray" };
}

describe("CARD_STATUS_DOT — status indicator mapping (issue #1389)", () => {
  it("active card gets filled circle dot", () => {
    expect(getStatusDot("active").dot).toBe("●");
  });

  it("active card gets green color", () => {
    expect(getStatusDot("active").color).toBe("green");
  });

  it("fee_approaching gets half-circle dot", () => {
    expect(getStatusDot("fee_approaching").dot).toBe("◐");
  });

  it("fee_approaching gets yellow color", () => {
    expect(getStatusDot("fee_approaching").color).toBe("yellow");
  });

  it("promo_expiring gets half-circle dot matching fee_approaching", () => {
    expect(getStatusDot("promo_expiring").dot).toBe("◐");
  });

  it("promo_expiring gets yellow color", () => {
    expect(getStatusDot("promo_expiring").color).toBe("yellow");
  });

  it("closed card gets empty circle dot", () => {
    expect(getStatusDot("closed").dot).toBe("○");
  });

  it("closed card gets gray color", () => {
    expect(getStatusDot("closed").color).toBe("gray");
  });

  it("unknown status falls back to empty circle + gray", () => {
    const result = getStatusDot("unknown_status");
    expect(result.dot).toBe("○");
    expect(result.color).toBe("gray");
  });
});

// ─── 2. CARD_STATUS_REALM — Norse realm name mapping ──────────────────────────
//
// Mirrors CARD_STATUS_REALM constant:
//   active          → Midgard
//   fee_approaching → Muspelheim
//   promo_expiring  → Niflheim
//   closed          → Helheim

const CARD_STATUS_REALM: Record<string, string> = {
  active:          "Midgard",
  fee_approaching: "Muspelheim",
  promo_expiring:  "Niflheim",
  closed:          "Helheim",
};

function getStatusRealm(status: string): string {
  return CARD_STATUS_REALM[status] || "Unknown";
}

describe("CARD_STATUS_REALM — Norse realm mapping (issue #1389)", () => {
  it("active status maps to Midgard", () => {
    expect(getStatusRealm("active")).toBe("Midgard");
  });

  it("fee_approaching status maps to Muspelheim", () => {
    expect(getStatusRealm("fee_approaching")).toBe("Muspelheim");
  });

  it("promo_expiring status maps to Niflheim", () => {
    expect(getStatusRealm("promo_expiring")).toBe("Niflheim");
  });

  it("closed status maps to Helheim", () => {
    expect(getStatusRealm("closed")).toBe("Helheim");
  });

  it("unknown status falls back to 'Unknown'", () => {
    expect(getStatusRealm("mystery")).toBe("Unknown");
  });

  it("all four required realms are present", () => {
    const realms = Object.values(CARD_STATUS_REALM);
    expect(realms).toContain("Midgard");
    expect(realms).toContain("Muspelheim");
    expect(realms).toContain("Niflheim");
    expect(realms).toContain("Helheim");
  });
});

// ─── 3. SpendProgressBar logic — fill ratio + color thresholds ─────────────────
//
// Mirrors SpendProgressBar():
//   raw = goal > 0 ? Math.min(1, spend / goal) : 0
//   color: >= 1.0 → green, >= 0.5 → yellow, else → white
//   BAR_WIDTH = 28, filled = Math.round(raw * 28)

const BAR_WIDTH = 28;

function computeProgressBar(spend: number, goal: number) {
  const raw = goal > 0 ? Math.min(1, (spend || 0) / goal) : 0;
  const filled = Math.round(raw * BAR_WIDTH);
  const color = raw >= 1 ? "green" : raw >= 0.5 ? "yellow" : "white";
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const pct = Math.round(raw * 100);
  return { raw, filled, color, bar, pct };
}

describe("SpendProgressBar logic — fill ratio and color (issue #1389)", () => {
  it("returns 0 ratio when goal is 0 (division guard)", () => {
    expect(computeProgressBar(500, 0).raw).toBe(0);
  });

  it("returns 0 ratio when goal is 0 regardless of spend", () => {
    expect(computeProgressBar(9999, 0).pct).toBe(0);
  });

  it("computes 50% fill at spend == goal/2", () => {
    const { pct, color } = computeProgressBar(500, 1000);
    expect(pct).toBe(50);
    expect(color).toBe("yellow");
  });

  it("computes 100% fill when spend equals goal", () => {
    const { pct, filled, color } = computeProgressBar(1000, 1000);
    expect(pct).toBe(100);
    expect(filled).toBe(BAR_WIDTH);
    expect(color).toBe("green");
  });

  it("clamps to 100% when spend exceeds goal", () => {
    const { pct, raw } = computeProgressBar(1500, 1000);
    expect(raw).toBe(1);
    expect(pct).toBe(100);
  });

  it("uses white color below 50% threshold", () => {
    expect(computeProgressBar(400, 1000).color).toBe("white");
  });

  it("uses yellow color at exactly 50%", () => {
    expect(computeProgressBar(500, 1000).color).toBe("yellow");
  });

  it("uses green color at exactly 100%", () => {
    expect(computeProgressBar(1000, 1000).color).toBe("green");
  });

  it("bar string total length is always BAR_WIDTH", () => {
    const { bar } = computeProgressBar(300, 1000);
    expect(bar.length).toBe(BAR_WIDTH);
  });

  it("treats null/undefined spend as 0", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(computeProgressBar(null as any, 1000).raw).toBe(0);
  });

  it("25% spend shows partial fill bar", () => {
    const { filled } = computeProgressBar(250, 1000);
    expect(filled).toBe(Math.round(0.25 * BAR_WIDTH));
  });
});

// ─── 4. sortCards — ordering logic ───────────────────────────────────────────
//
// Mirrors sortCards() in CardDrilldownView:
//   ORDER: active=0, fee_approaching=1, promo_expiring=2, closed=3
//   deletedAt cards → sort 99 (always last)
//   within same status → alphabetical by name

interface CardDoc {
  id: string;
  name?: string;
  status?: string;
  deletedAt?: string;
}

function sortCards(arr: CardDoc[]): CardDoc[] {
  const ORDER: Record<string, number> = {
    active: 0,
    fee_approaching: 1,
    promo_expiring: 2,
    closed: 3,
  };
  return [...arr].sort((a, b) => {
    const ao = a.deletedAt ? 99 : (ORDER[a.status ?? ""] ?? 4);
    const bo = b.deletedAt ? 99 : (ORDER[b.status ?? ""] ?? 4);
    return ao !== bo ? ao - bo : (a.name || "").localeCompare(b.name || "");
  });
}

describe("sortCards — card ordering for drill-down list (issue #1389)", () => {
  it("places active cards first", () => {
    const cards = [
      { id: "c1", name: "Closed Card", status: "closed" },
      { id: "c2", name: "Active Card", status: "active" },
    ];
    const sorted = sortCards(cards);
    expect(sorted[0].status).toBe("active");
  });

  it("places fee_approaching before promo_expiring", () => {
    const cards = [
      { id: "c1", name: "Promo", status: "promo_expiring" },
      { id: "c2", name: "Fee",   status: "fee_approaching" },
    ];
    const sorted = sortCards(cards);
    expect(sorted[0].status).toBe("fee_approaching");
    expect(sorted[1].status).toBe("promo_expiring");
  });

  it("places closed cards before deleted cards", () => {
    const cards = [
      { id: "c1", name: "Deleted", status: "active", deletedAt: "2026-01-01" },
      { id: "c2", name: "Closed", status: "closed" },
    ];
    const sorted = sortCards(cards);
    expect(sorted[0].id).toBe("c2"); // closed (order 3)
    expect(sorted[1].id).toBe("c1"); // deleted (order 99)
  });

  it("sorts alphabetically within the same status", () => {
    const cards = [
      { id: "c1", name: "Zorro Card", status: "active" },
      { id: "c2", name: "Alpha Card", status: "active" },
      { id: "c3", name: "Midway Card", status: "active" },
    ];
    const sorted = sortCards(cards);
    expect(sorted.map((c) => c.name)).toEqual(["Alpha Card", "Midway Card", "Zorro Card"]);
  });

  it("full sort order: active → fee → promo → closed → deleted", () => {
    const cards = [
      { id: "c5", name: "Del",   status: "active",          deletedAt: "2026-01-01" },
      { id: "c4", name: "Close", status: "closed"                                    },
      { id: "c3", name: "Promo", status: "promo_expiring"                            },
      { id: "c2", name: "Fee",   status: "fee_approaching"                           },
      { id: "c1", name: "Act",   status: "active"                                    },
    ];
    const sorted = sortCards(cards);
    expect(sorted.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("does not mutate the original array", () => {
    const cards = [
      { id: "c1", name: "B", status: "closed" },
      { id: "c2", name: "A", status: "active" },
    ];
    const original = [...cards];
    sortCards(cards);
    expect(cards[0].id).toBe(original[0].id);
  });

  it("treats missing status as low-priority (after known statuses)", () => {
    const cards = [
      { id: "c1", name: "Unknown", status: undefined },
      { id: "c2", name: "Active",  status: "active"  },
    ];
    const sorted = sortCards(cards);
    expect(sorted[0].status).toBe("active");
  });
});

// ─── 5. loadCardsForHousehold — Firestore fetch + userId filter ───────────────
//
// Mirrors loadCardsForHousehold() and the filterUserId logic in CardDrilldownView:
//   - Fetches all cards in households/{id}/cards
//   - filterUserId: null → all cards, non-null → only cards where userId === filterUserId

interface CardData {
  name?: string;
  status?: string;
  userId?: string;
  deletedAt?: string;
}

function mapFirestoreSnap(docs: Array<{ id: string; data: () => CardData }>): Array<CardData & { id: string }> {
  return docs.map((d) => ({ id: d.id, ...d.data() }));
}

function filterCardsByUser(
  cards: Array<CardData & { id: string }>,
  filterUserId: string | null
): Array<CardData & { id: string }> {
  return filterUserId ? cards.filter((c) => c.userId === filterUserId) : cards;
}

describe("loadCardsForHousehold — Firestore mapping and user filter (issue #1389)", () => {
  const allCards = [
    { id: "card_1", data: () => ({ name: "Chase Sapphire", status: "active",  userId: "usr_A" }) },
    { id: "card_2", data: () => ({ name: "Amex Platinum", status: "closed",   userId: "usr_B" }) },
    { id: "card_3", data: () => ({ name: "Venture X",     status: "active",   userId: "usr_A" }) },
    { id: "card_4", data: () => ({ name: "Deleted Card",  status: "active",   userId: "usr_A", deletedAt: "2026-01-01" }) },
  ];

  it("maps Firestore docs to cards with id field merged", () => {
    const result = mapFirestoreSnap([allCards[0]]);
    expect(result[0].id).toBe("card_1");
    expect(result[0].name).toBe("Chase Sapphire");
  });

  it("returns all cards when filterUserId is null", () => {
    const cards = mapFirestoreSnap(allCards);
    const result = filterCardsByUser(cards, null);
    expect(result).toHaveLength(4);
  });

  it("filters to only a user's cards when filterUserId is set", () => {
    const cards = mapFirestoreSnap(allCards);
    const result = filterCardsByUser(cards, "usr_A");
    expect(result).toHaveLength(3);
    expect(result.every((c) => c.userId === "usr_A")).toBe(true);
  });

  it("filters to only usr_B's cards", () => {
    const cards = mapFirestoreSnap(allCards);
    const result = filterCardsByUser(cards, "usr_B");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Amex Platinum");
  });

  it("returns empty array when filterUserId matches no cards", () => {
    const cards = mapFirestoreSnap(allCards);
    const result = filterCardsByUser(cards, "usr_NOBODY");
    expect(result).toHaveLength(0);
  });

  it("includes soft-deleted cards in the result (no filter on deletedAt)", () => {
    const cards = mapFirestoreSnap(allCards);
    const result = filterCardsByUser(cards, "usr_A");
    const deleted = result.find((c) => c.deletedAt);
    expect(deleted).toBeDefined();
    expect(deleted!.name).toBe("Deleted Card");
  });
});

// ─── 6. CardDrilldownView navigation — scroll offset and index logic ──────────
//
// Mirrors CardDrilldownView useInput:
//   upArrow   → selectedIdx = max(0, selectedIdx - 1), adjust scrollOffset
//   downArrow → selectedIdx = min(len-1, selectedIdx + 1), advance scrollOffset
//   return    → open detail panel (detailOpen = true)
//   escape    → call onBack()

const CARD_LIST_HEIGHT = 18;

interface CardNavState {
  selectedIdx: number;
  scrollOffset: number;
  detailOpen: boolean;
}

function cardNavUp(state: CardNavState): CardNavState {
  const ni = Math.max(0, state.selectedIdx - 1);
  const newScroll = ni < state.scrollOffset ? ni : state.scrollOffset;
  return { ...state, selectedIdx: ni, scrollOffset: newScroll };
}

function cardNavDown(state: CardNavState, totalCards: number): CardNavState {
  const ni = Math.min(totalCards - 1, state.selectedIdx + 1);
  const newScroll =
    ni >= state.scrollOffset + CARD_LIST_HEIGHT
      ? ni - CARD_LIST_HEIGHT + 1
      : state.scrollOffset;
  return { ...state, selectedIdx: ni, scrollOffset: newScroll };
}

function cardNavEnter(state: CardNavState, hasCard: boolean): CardNavState {
  if (hasCard) return { ...state, detailOpen: true };
  return state;
}

describe("CardDrilldownView navigation — scroll offset and index (issue #1389)", () => {
  describe("upArrow", () => {
    it("decrements selectedIdx by 1", () => {
      const { selectedIdx } = cardNavUp({ selectedIdx: 5, scrollOffset: 0, detailOpen: false });
      expect(selectedIdx).toBe(4);
    });

    it("clamps to 0 at the top of the list", () => {
      const { selectedIdx } = cardNavUp({ selectedIdx: 0, scrollOffset: 0, detailOpen: false });
      expect(selectedIdx).toBe(0);
    });

    it("scrolls up when selection moves above viewport", () => {
      const { scrollOffset } = cardNavUp({ selectedIdx: 3, scrollOffset: 3, detailOpen: false });
      expect(scrollOffset).toBe(2);
    });

    it("does not change scrollOffset when selection stays in viewport", () => {
      const { scrollOffset } = cardNavUp({ selectedIdx: 10, scrollOffset: 5, detailOpen: false });
      expect(scrollOffset).toBe(5);
    });
  });

  describe("downArrow", () => {
    it("increments selectedIdx by 1", () => {
      const { selectedIdx } = cardNavDown({ selectedIdx: 3, scrollOffset: 0, detailOpen: false }, 20);
      expect(selectedIdx).toBe(4);
    });

    it("clamps to last index", () => {
      const { selectedIdx } = cardNavDown({ selectedIdx: 9, scrollOffset: 0, detailOpen: false }, 10);
      expect(selectedIdx).toBe(9);
    });

    it("advances scrollOffset when selection exceeds LIST_HEIGHT", () => {
      const { scrollOffset } = cardNavDown(
        { selectedIdx: CARD_LIST_HEIGHT - 1, scrollOffset: 0, detailOpen: false },
        30
      );
      expect(scrollOffset).toBe(1);
    });

    it("does not scroll when selection stays within viewport", () => {
      const { scrollOffset } = cardNavDown({ selectedIdx: 5, scrollOffset: 0, detailOpen: false }, 20);
      expect(scrollOffset).toBe(0);
    });
  });

  describe("Enter key — open detail panel", () => {
    it("sets detailOpen to true when a card is selected", () => {
      const { detailOpen } = cardNavEnter({ selectedIdx: 2, scrollOffset: 0, detailOpen: false }, true);
      expect(detailOpen).toBe(true);
    });

    it("does not open detail when no card is selected", () => {
      const { detailOpen } = cardNavEnter({ selectedIdx: 0, scrollOffset: 0, detailOpen: false }, false);
      expect(detailOpen).toBe(false);
    });
  });
});

// ─── 7. CardDetailPanel mode state machine ────────────────────────────────────
//
// Mirrors the mode state transitions in CardDetailPanel:
//   browse → "d" (not deleted) → confirm-delete
//   browse → "r" (deleted)     → confirm-restore
//   browse → "x"               → confirm-expunge
//   confirm-delete  → "y"      → doDelete() + browse
//   confirm-delete  → other    → browse (cancelled)
//   confirm-restore → "y"      → doRestore() + browse
//   confirm-restore → other    → browse (cancelled)
//   confirm-expunge → "y"      → expunge-input
//   confirm-expunge → other    → browse (cancelled)

type DetailMode = "browse" | "confirm-delete" | "confirm-restore" | "confirm-expunge" | "expunge-input";

function handleDetailInput(
  input: string,
  key: { escape?: boolean; return?: boolean },
  mode: DetailMode,
  isDeleted: boolean,
  expungeText: string,
  callbacks: {
    doDelete: () => void;
    doRestore: () => void;
    doExpunge: () => void;
    onBack: () => void;
    setStatusMsg: (m: string) => void;
    setInputCaptured: (v: boolean) => void;
  }
): { mode: DetailMode; expungeText: string } {
  if (mode === "expunge-input") {
    if (key.return) {
      if (expungeText === "delete") callbacks.doExpunge();
      else callbacks.setStatusMsg("Aborted: must type exactly 'delete'");
      callbacks.setInputCaptured(false);
      return { mode: "browse", expungeText: "" };
    }
    if (key.escape) {
      callbacks.setStatusMsg("Expunge cancelled");
      callbacks.setInputCaptured(false);
      return { mode: "browse", expungeText: "" };
    }
    return { mode, expungeText };
  }
  if (mode === "confirm-delete") {
    if (input === "y" || input === "Y") callbacks.doDelete();
    else callbacks.setStatusMsg("Delete cancelled");
    return { mode: "browse", expungeText };
  }
  if (mode === "confirm-restore") {
    if (input === "y" || input === "Y") callbacks.doRestore();
    else callbacks.setStatusMsg("Restore cancelled");
    return { mode: "browse", expungeText };
  }
  if (mode === "confirm-expunge") {
    if (input === "y" || input === "Y") {
      callbacks.setInputCaptured(true);
      return { mode: "expunge-input", expungeText: "" };
    }
    callbacks.setStatusMsg("Expunge cancelled");
    return { mode: "browse", expungeText };
  }
  // browse mode
  if (key.escape) { callbacks.onBack(); return { mode, expungeText }; }
  if (input === "d" && !isDeleted) return { mode: "confirm-delete", expungeText };
  if (input === "r" && isDeleted)  return { mode: "confirm-restore", expungeText };
  if (input === "x")               return { mode: "confirm-expunge", expungeText };
  return { mode, expungeText };
}

describe("CardDetailPanel mode state machine (issue #1389)", () => {
  let callbacks: {
    doDelete: Mock;
    doRestore: Mock;
    doExpunge: Mock;
    onBack: Mock;
    setStatusMsg: Mock;
    setInputCaptured: Mock;
  };

  beforeEach(() => {
    callbacks = {
      doDelete:         vi.fn(),
      doRestore:        vi.fn(),
      doExpunge:        vi.fn(),
      onBack:           vi.fn(),
      setStatusMsg:     vi.fn(),
      setInputCaptured: vi.fn(),
    };
  });

  it("pressing 'd' on a non-deleted card transitions to confirm-delete", () => {
    const { mode } = handleDetailInput("d", {}, "browse", false, "", callbacks);
    expect(mode).toBe("confirm-delete");
  });

  it("pressing 'd' on a deleted card stays in browse (no action)", () => {
    const { mode } = handleDetailInput("d", {}, "browse", true, "", callbacks);
    expect(mode).toBe("browse");
  });

  it("pressing 'r' on a deleted card transitions to confirm-restore", () => {
    const { mode } = handleDetailInput("r", {}, "browse", true, "", callbacks);
    expect(mode).toBe("confirm-restore");
  });

  it("pressing 'r' on a non-deleted card stays in browse (no action)", () => {
    const { mode } = handleDetailInput("r", {}, "browse", false, "", callbacks);
    expect(mode).toBe("browse");
  });

  it("pressing 'x' transitions to confirm-expunge", () => {
    const { mode } = handleDetailInput("x", {}, "browse", false, "", callbacks);
    expect(mode).toBe("confirm-expunge");
  });

  it("pressing Escape in browse mode calls onBack", () => {
    handleDetailInput("", { escape: true }, "browse", false, "", callbacks);
    expect(callbacks.onBack).toHaveBeenCalledTimes(1);
  });

  it("confirming delete with 'y' calls doDelete and returns to browse", () => {
    const { mode } = handleDetailInput("y", {}, "confirm-delete", false, "", callbacks);
    expect(callbacks.doDelete).toHaveBeenCalledTimes(1);
    expect(mode).toBe("browse");
  });

  it("cancelling delete with any non-y key returns to browse without calling doDelete", () => {
    const { mode } = handleDetailInput("n", {}, "confirm-delete", false, "", callbacks);
    expect(callbacks.doDelete).not.toHaveBeenCalled();
    expect(mode).toBe("browse");
  });

  it("confirming restore with 'Y' (uppercase) calls doRestore", () => {
    const { mode } = handleDetailInput("Y", {}, "confirm-restore", true, "", callbacks);
    expect(callbacks.doRestore).toHaveBeenCalledTimes(1);
    expect(mode).toBe("browse");
  });

  it("confirming expunge with 'y' transitions to expunge-input", () => {
    const { mode } = handleDetailInput("y", {}, "confirm-expunge", false, "", callbacks);
    expect(mode).toBe("expunge-input");
    expect(callbacks.setInputCaptured).toHaveBeenCalledWith(true);
  });

  it("cancelling expunge with any non-y key stays in browse", () => {
    const { mode } = handleDetailInput("n", {}, "confirm-expunge", false, "", callbacks);
    expect(mode).toBe("browse");
    expect(callbacks.setStatusMsg).toHaveBeenCalledWith("Expunge cancelled");
  });
});

// ─── 8. Expunge input validation — must type exactly "delete" ─────────────────
//
// Mirrors the expunge-input mode in CardDetailPanel:
//   - Enter with "delete" → doExpunge()
//   - Enter with anything else → setStatusMsg("Aborted: must type exactly 'delete'")
//   - Escape → cancel + setStatusMsg("Expunge cancelled")

describe("Expunge input validation (issue #1389)", () => {
  let callbacks: {
    doDelete: Mock;
    doRestore: Mock;
    doExpunge: Mock;
    onBack: Mock;
    setStatusMsg: Mock;
    setInputCaptured: Mock;
  };

  beforeEach(() => {
    callbacks = {
      doDelete:         vi.fn(),
      doRestore:        vi.fn(),
      doExpunge:        vi.fn(),
      onBack:           vi.fn(),
      setStatusMsg:     vi.fn(),
      setInputCaptured: vi.fn(),
    };
  });

  it("typing exactly 'delete' and pressing Enter calls doExpunge", () => {
    const { mode } = handleDetailInput("", { return: true }, "expunge-input", false, "delete", callbacks);
    expect(callbacks.doExpunge).toHaveBeenCalledTimes(1);
    expect(mode).toBe("browse");
  });

  it("typing wrong text and pressing Enter does NOT call doExpunge", () => {
    handleDetailInput("", { return: true }, "expunge-input", false, "delet", callbacks);
    expect(callbacks.doExpunge).not.toHaveBeenCalled();
  });

  it("wrong text shows abort message", () => {
    handleDetailInput("", { return: true }, "expunge-input", false, "DELETE", callbacks);
    expect(callbacks.setStatusMsg).toHaveBeenCalledWith("Aborted: must type exactly 'delete'");
  });

  it("expunge requires exact lowercase 'delete' — uppercase fails", () => {
    handleDetailInput("", { return: true }, "expunge-input", false, "DELETE", callbacks);
    expect(callbacks.doExpunge).not.toHaveBeenCalled();
  });

  it("Escape in expunge-input cancels without expunging", () => {
    const { mode } = handleDetailInput("", { escape: true }, "expunge-input", false, "del", callbacks);
    expect(callbacks.doExpunge).not.toHaveBeenCalled();
    expect(mode).toBe("browse");
    expect(callbacks.setStatusMsg).toHaveBeenCalledWith("Expunge cancelled");
  });

  it("Escape releases inputCaptured", () => {
    handleDetailInput("", { escape: true }, "expunge-input", false, "", callbacks);
    expect(callbacks.setInputCaptured).toHaveBeenCalledWith(false);
  });

  it("successful expunge releases inputCaptured", () => {
    handleDetailInput("", { return: true }, "expunge-input", false, "delete", callbacks);
    expect(callbacks.setInputCaptured).toHaveBeenCalledWith(false);
  });
});

// ─── 9. Action: doDelete — soft delete (set deletedAt) ───────────────────────
//
// Mirrors doDelete() in CardDetailPanel:
//   Calls Firestore .update() with { deletedAt: ISO string, updatedAt: ISO string }
//   On success: setStatusMsg("Deleted: <name>"), calls onCardUpdated()
//   On error: setStatusMsg("Error: <message>")

interface SoftDeleteDeps {
  updateCard: (householdId: string, cardId: string, patch: Record<string, string>) => Promise<void>;
  setStatusMsg: (m: string) => void;
  onCardUpdated: () => void;
}

async function simulateSoftDelete(
  card: { id: string; name?: string },
  householdId: string,
  deps: SoftDeleteDeps
): Promise<void> {
  try {
    await deps.updateCard(householdId, card.id, {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    deps.setStatusMsg(`Deleted: ${card.name}`);
    deps.onCardUpdated();
  } catch (err) {
    deps.setStatusMsg(`Error: ${(err as Error).message}`);
  }
}

describe("Action: doDelete — soft delete (issue #1389)", () => {
  let deps: { updateCard: Mock; setStatusMsg: Mock; onCardUpdated: Mock };

  beforeEach(() => {
    deps = {
      updateCard:     vi.fn().mockResolvedValue(undefined),
      setStatusMsg:   vi.fn(),
      onCardUpdated:  vi.fn(),
    };
  });

  it("calls updateCard with deletedAt and updatedAt fields", async () => {
    await simulateSoftDelete({ id: "card_1", name: "Chase" }, "hh_1", deps);
    expect(deps.updateCard).toHaveBeenCalledTimes(1);
    const [hhId, cardId, patch] = deps.updateCard.mock.calls[0];
    expect(hhId).toBe("hh_1");
    expect(cardId).toBe("card_1");
    expect(patch).toHaveProperty("deletedAt");
    expect(patch).toHaveProperty("updatedAt");
  });

  it("sets success status message with card name", async () => {
    await simulateSoftDelete({ id: "card_1", name: "Chase Sapphire" }, "hh_1", deps);
    expect(deps.setStatusMsg).toHaveBeenCalledWith("Deleted: Chase Sapphire");
  });

  it("calls onCardUpdated after successful delete", async () => {
    await simulateSoftDelete({ id: "card_1", name: "Chase" }, "hh_1", deps);
    expect(deps.onCardUpdated).toHaveBeenCalledTimes(1);
  });

  it("sets error status message when Firestore throws", async () => {
    deps.updateCard.mockRejectedValue(new Error("PERMISSION_DENIED"));
    await simulateSoftDelete({ id: "card_1", name: "Chase" }, "hh_1", deps);
    expect(deps.setStatusMsg.mock.calls[0][0]).toMatch(/Error:.*PERMISSION_DENIED/);
    expect(deps.onCardUpdated).not.toHaveBeenCalled();
  });

  it("does not call onCardUpdated on Firestore error", async () => {
    deps.updateCard.mockRejectedValue(new Error("UNAVAILABLE"));
    await simulateSoftDelete({ id: "card_1", name: "Chase" }, "hh_1", deps);
    expect(deps.onCardUpdated).not.toHaveBeenCalled();
  });
});

// ─── 10. Action: doRestore — restore to active ───────────────────────────────
//
// Mirrors doRestore() in CardDetailPanel:
//   Calls Firestore .update() with { status: "active", updatedAt: ISO, deletedAt: FieldValue.delete() }
//   On success: setStatusMsg("Restored: <name>"), calls onCardUpdated()
//   On error: setStatusMsg("Error: <message>")

interface RestoreDeps {
  updateCard: (householdId: string, cardId: string, patch: Record<string, unknown>) => Promise<void>;
  setStatusMsg: (m: string) => void;
  onCardUpdated: () => void;
}

const FIELD_VALUE_DELETE = Symbol("FieldValue.delete()");

async function simulateRestore(
  card: { id: string; name?: string },
  householdId: string,
  deps: RestoreDeps
): Promise<void> {
  try {
    await deps.updateCard(householdId, card.id, {
      deletedAt: FIELD_VALUE_DELETE,
      status: "active",
      updatedAt: new Date().toISOString(),
    });
    deps.setStatusMsg(`Restored: ${card.name}`);
    deps.onCardUpdated();
  } catch (err) {
    deps.setStatusMsg(`Error: ${(err as Error).message}`);
  }
}

describe("Action: doRestore — restore to active (issue #1389)", () => {
  let deps: { updateCard: Mock; setStatusMsg: Mock; onCardUpdated: Mock };

  beforeEach(() => {
    deps = {
      updateCard:    vi.fn().mockResolvedValue(undefined),
      setStatusMsg:  vi.fn(),
      onCardUpdated: vi.fn(),
    };
  });

  it("calls updateCard with status=active and deletedAt removal sentinel", async () => {
    await simulateRestore({ id: "card_2", name: "Amex" }, "hh_1", deps);
    expect(deps.updateCard).toHaveBeenCalledTimes(1);
    const patch = deps.updateCard.mock.calls[0][2];
    expect(patch.status).toBe("active");
    expect(patch.deletedAt).toBe(FIELD_VALUE_DELETE);
  });

  it("sets success status message with card name", async () => {
    await simulateRestore({ id: "card_2", name: "Amex Platinum" }, "hh_1", deps);
    expect(deps.setStatusMsg).toHaveBeenCalledWith("Restored: Amex Platinum");
  });

  it("calls onCardUpdated after successful restore", async () => {
    await simulateRestore({ id: "card_2", name: "Amex" }, "hh_1", deps);
    expect(deps.onCardUpdated).toHaveBeenCalledTimes(1);
  });

  it("sets error status message when Firestore throws", async () => {
    deps.updateCard.mockRejectedValue(new Error("NOT_FOUND"));
    await simulateRestore({ id: "card_2", name: "Amex" }, "hh_1", deps);
    expect(deps.setStatusMsg.mock.calls[0][0]).toMatch(/Error:.*NOT_FOUND/);
  });
});

// ─── 11. Action: doExpunge — permanent Firestore delete ──────────────────────
//
// Mirrors doExpunge() in CardDetailPanel:
//   Calls Firestore .delete() on the card document
//   On success: setStatusMsg("Expunged: <name>"), calls onCardUpdated()
//   On error: setStatusMsg("Error: <message>")

interface ExpungeDeps {
  deleteCard: (householdId: string, cardId: string) => Promise<void>;
  setStatusMsg: (m: string) => void;
  onCardUpdated: () => void;
}

async function simulateExpunge(
  card: { id: string; name?: string },
  householdId: string,
  deps: ExpungeDeps
): Promise<void> {
  try {
    await deps.deleteCard(householdId, card.id);
    deps.setStatusMsg(`Expunged: ${card.name}`);
    deps.onCardUpdated();
  } catch (err) {
    deps.setStatusMsg(`Error: ${(err as Error).message}`);
  }
}

describe("Action: doExpunge — permanent delete (issue #1389)", () => {
  let deps: { deleteCard: Mock; setStatusMsg: Mock; onCardUpdated: Mock };

  beforeEach(() => {
    deps = {
      deleteCard:    vi.fn().mockResolvedValue(undefined),
      setStatusMsg:  vi.fn(),
      onCardUpdated: vi.fn(),
    };
  });

  it("calls deleteCard with correct household and card IDs", async () => {
    await simulateExpunge({ id: "card_X", name: "Old Card" }, "hh_1", deps);
    expect(deps.deleteCard).toHaveBeenCalledWith("hh_1", "card_X");
  });

  it("sets success status message with card name", async () => {
    await simulateExpunge({ id: "card_X", name: "Rare Gem" }, "hh_1", deps);
    expect(deps.setStatusMsg).toHaveBeenCalledWith("Expunged: Rare Gem");
  });

  it("calls onCardUpdated after successful expunge", async () => {
    await simulateExpunge({ id: "card_X", name: "Old" }, "hh_1", deps);
    expect(deps.onCardUpdated).toHaveBeenCalledTimes(1);
  });

  it("sets error status message when Firestore throws", async () => {
    deps.deleteCard.mockRejectedValue(new Error("PERMISSION_DENIED"));
    await simulateExpunge({ id: "card_X", name: "Old" }, "hh_1", deps);
    expect(deps.setStatusMsg.mock.calls[0][0]).toMatch(/Error:.*PERMISSION_DENIED/);
  });

  it("does not call onCardUpdated on error", async () => {
    deps.deleteCard.mockRejectedValue(new Error("fail"));
    await simulateExpunge({ id: "card_X", name: "Old" }, "hh_1", deps);
    expect(deps.onCardUpdated).not.toHaveBeenCalled();
  });
});

// ─── 12. inputCaptured guard — expunge input blocks global handlers ───────────
//
// Mirrors: if (inputCaptured) return; in SpearApp.useInput
// When CardDetailPanel sets inputCaptured=true during expunge typing,
// global handlers (q, ?, Tab) must NOT fire.

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

describe("inputCaptured guard — expunge input blocks global handlers (issue #1389)", () => {
  let deps: { quit: Mock; setShowHelp: Mock; setActiveTab: Mock };

  beforeEach(() => {
    deps = { quit: vi.fn(), setShowHelp: vi.fn(), setActiveTab: vi.fn() };
  });

  it("blocks 'q' quit when inputCaptured is true (expunge typing)", () => {
    handleGlobalInput("q", {}, true, deps);
    expect(deps.quit).not.toHaveBeenCalled();
  });

  it("blocks '?' help when inputCaptured is true", () => {
    handleGlobalInput("?", {}, true, deps);
    expect(deps.setShowHelp).not.toHaveBeenCalled();
  });

  it("blocks Tab switch when inputCaptured is true", () => {
    handleGlobalInput("", { tab: true }, true, deps);
    expect(deps.setActiveTab).not.toHaveBeenCalled();
  });

  it("allows 'q' quit when inputCaptured is false", () => {
    handleGlobalInput("q", {}, false, deps);
    expect(deps.quit).toHaveBeenCalledTimes(1);
  });

  it("allows '?' help when inputCaptured is false", () => {
    handleGlobalInput("?", {}, false, deps);
    expect(deps.setShowHelp).toHaveBeenCalledTimes(1);
  });

  it("allows Tab switch when inputCaptured is false", () => {
    handleGlobalInput("", { tab: true }, false, deps);
    expect(deps.setActiveTab).toHaveBeenCalledTimes(1);
  });
});
