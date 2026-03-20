/**
 * Vitest — Odin's Spear: Context-Aware Help (Loki QA Supplement)
 * Issue #1560: Complementary tests to cover gaps in FiremanDecko's 41-test suite.
 *
 * Focus areas:
 *   1. isAvailable — context-gating logic (not tested in base suite)
 *   2. fuzzyMatch edge cases — case-insensitivity, single-char, spread chars
 *   3. Tab + availability intersection — correct gate per tab
 *   4. Undefined tab defaults to "all" treatment
 *   5. Subsystem-based tab alignment (trial, stripe, firestore)
 *   6. Destructive + needsInput flag tab correctness
 *   7. filterCommandsForTab — query that matches name vs desc only
 *   8. getSectionsForTab — exact section counts
 *   9. Global command isolation — no global command is tab-specific
 */

import { describe, it, expect } from "vitest";

// ── Mirrors of registry types ─────────────────────────────────────────────────

type CommandTab = "users" | "households" | "all";
type RequiresContext = "user" | "household" | "trial";

interface PaletteCommand {
  name: string;
  desc: string;
  subsystem: string;
  tab?: CommandTab;
  requiresContext?: RequiresContext;
  destructive?: boolean;
  needsInput?: boolean;
}

interface CommandContext {
  selectedUserId: string | null;
  selectedHouseholdId: string | null;
  selectedFp: string | null;
  selectedSubId: string | null;
}

// ── Command set (matches src/commands/*.ts registrations) ─────────────────────

const COMMANDS: PaletteCommand[] = [
  // Global / system ("all")
  { name: "firestore-ping",             desc: "Ping the Firestore connection (connectivity check)",      subsystem: "firestore", tab: "all" },
  { name: "firestore-list-collections", desc: "List all top-level Firestore collections",                subsystem: "firestore", tab: "all" },
  { name: "stripe-check-key",           desc: "Verify Stripe secret key is available",                   subsystem: "stripe",    tab: "all" },
  // Users tab
  { name: "firestore-get-user",         desc: "Fetch Firestore document for the selected user",          subsystem: "firestore", tab: "users",      requiresContext: "user" },
  { name: "firestore-delete-user",      desc: "Delete the selected user document from Firestore — destructive", subsystem: "firestore", tab: "users", requiresContext: "user", destructive: true },
  { name: "stripe-list-customers",      desc: "List recent Stripe customers (up to 10)",                 subsystem: "stripe",    tab: "users" },
  { name: "stripe-cancel-subscription", desc: "Cancel the selected Stripe subscription — destructive",   subsystem: "stripe",    tab: "users",      requiresContext: "trial", destructive: true },
  { name: "trial-adjust",               desc: "Shift trial start date by +N / -N days (+N ages, -N restores)", subsystem: "trial", tab: "users", requiresContext: "trial", needsInput: true },
  { name: "trial-complete",             desc: "Expire trial immediately (>30 days ago)",                  subsystem: "trial",     tab: "users",      requiresContext: "trial" },
  { name: "trial-progress",             desc: "Advance to next phase boundary (day 15 or expiry)",        subsystem: "trial",     tab: "users",      requiresContext: "trial" },
  // Households tab
  { name: "firestore-get-household",    desc: "Fetch Firestore document for the selected household",     subsystem: "firestore", tab: "households", requiresContext: "household" },
];

// ── Mirrored helpers ──────────────────────────────────────────────────────────

function getCommandsForTab(tabIndex: number): PaletteCommand[] {
  const tabName: CommandTab = tabIndex === 0 ? "users" : "households";
  return COMMANDS.filter((cmd) => {
    const t = cmd.tab ?? "all";
    return t === "all" || t === tabName;
  });
}

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (needle.length === 0) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let hi = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const ch = n[ni];
    if (ch === undefined) break;
    const found = h.indexOf(ch, hi);
    if (found === -1) return false;
    hi = found + 1;
  }
  return true;
}

function filterCommandsForTab(query: string, tabIndex: number): PaletteCommand[] {
  return getCommandsForTab(tabIndex).filter((cmd) =>
    fuzzyMatch(cmd.name + " " + cmd.desc, query)
  );
}

/** Mirror of registry.isAvailable */
function isAvailable(cmd: PaletteCommand, ctx: CommandContext): boolean {
  if (!cmd.requiresContext) return true;
  if (cmd.requiresContext === "user") return ctx.selectedUserId !== null;
  if (cmd.requiresContext === "household") return ctx.selectedHouseholdId !== null;
  return ctx.selectedFp !== null; // "trial"
}

interface Section {
  title: string;
  tabs: "all" | "users" | "households";
}

const HELP_SECTIONS: Section[] = [
  { title: "Navigation",                             tabs: "all" },
  { title: "User Actions  (user selected)",          tabs: "users" },
  { title: "Trial Actions  (trial in scope)",        tabs: "users" },
  { title: "Household Actions  (household selected)", tabs: "households" },
  { title: "System Commands",                        tabs: "all" },
];

function getSectionsForTab(tabIndex: number): Section[] {
  const tabName = tabIndex === 0 ? "users" : "households";
  return HELP_SECTIONS.filter((s) => s.tabs === "all" || s.tabs === tabName);
}

const EMPTY_CTX: CommandContext = {
  selectedUserId: null,
  selectedHouseholdId: null,
  selectedFp: null,
  selectedSubId: null,
};

// ── 1. isAvailable — context-gating logic ────────────────────────────────────

describe("isAvailable — context gating per command — issue #1560", () => {
  it("command with no requiresContext is always available (empty ctx)", () => {
    const cmd = COMMANDS.find((c) => c.name === "firestore-ping")!;
    expect(isAvailable(cmd, EMPTY_CTX)).toBe(true);
  });

  it("command with no requiresContext is always available (full ctx)", () => {
    const cmd = COMMANDS.find((c) => c.name === "stripe-list-customers")!;
    const ctx = { selectedUserId: "u1", selectedHouseholdId: "h1", selectedFp: "fp1", selectedSubId: "sub1" };
    expect(isAvailable(cmd, ctx)).toBe(true);
  });

  it("user-context command is NOT available without selectedUserId", () => {
    const cmd = COMMANDS.find((c) => c.name === "firestore-get-user")!;
    expect(isAvailable(cmd, EMPTY_CTX)).toBe(false);
  });

  it("user-context command IS available when selectedUserId is set", () => {
    const cmd = COMMANDS.find((c) => c.name === "firestore-get-user")!;
    expect(isAvailable(cmd, { ...EMPTY_CTX, selectedUserId: "user-123" })).toBe(true);
  });

  it("household-context command is NOT available without selectedHouseholdId", () => {
    const cmd = COMMANDS.find((c) => c.name === "firestore-get-household")!;
    expect(isAvailable(cmd, EMPTY_CTX)).toBe(false);
  });

  it("household-context command IS available when selectedHouseholdId is set", () => {
    const cmd = COMMANDS.find((c) => c.name === "firestore-get-household")!;
    expect(isAvailable(cmd, { ...EMPTY_CTX, selectedHouseholdId: "hh-456" })).toBe(true);
  });

  it("trial-context command is NOT available without selectedFp", () => {
    const cmd = COMMANDS.find((c) => c.name === "trial-adjust")!;
    expect(isAvailable(cmd, EMPTY_CTX)).toBe(false);
  });

  it("trial-context command IS available when selectedFp is set", () => {
    const cmd = COMMANDS.find((c) => c.name === "trial-adjust")!;
    expect(isAvailable(cmd, { ...EMPTY_CTX, selectedFp: "fp-abc" })).toBe(true);
  });

  it("trial-context stripe-cancel-subscription is NOT available without selectedFp", () => {
    const cmd = COMMANDS.find((c) => c.name === "stripe-cancel-subscription")!;
    expect(isAvailable(cmd, EMPTY_CTX)).toBe(false);
  });

  it("destructive user command is not available when user not selected", () => {
    const cmd = COMMANDS.find((c) => c.name === "firestore-delete-user")!;
    expect(cmd.destructive).toBe(true);
    expect(isAvailable(cmd, EMPTY_CTX)).toBe(false);
  });
});

// ── 2. fuzzyMatch edge cases ──────────────────────────────────────────────────

describe("fuzzyMatch edge cases — issue #1560", () => {
  it("empty needle always matches", () => {
    expect(fuzzyMatch("any string here", "")).toBe(true);
    expect(fuzzyMatch("", "")).toBe(true);
  });

  it("needle longer than haystack never matches", () => {
    expect(fuzzyMatch("abc", "abcdef")).toBe(false);
  });

  it("exact match returns true", () => {
    expect(fuzzyMatch("trial-adjust", "trial-adjust")).toBe(true);
  });

  it("case-insensitive: UPPERCASE needle matches lowercase haystack", () => {
    expect(fuzzyMatch("trial-adjust shift trial", "TRIAL")).toBe(true);
    expect(fuzzyMatch("firestore-ping connectivity", "FIRE")).toBe(true);
  });

  it("case-insensitive: mixed case needle matches", () => {
    expect(fuzzyMatch("stripe-check-key", "StRiPe")).toBe(true);
  });

  it("single character needle matches if char exists anywhere", () => {
    expect(fuzzyMatch("firestore-ping", "f")).toBe(true);
    expect(fuzzyMatch("firestore-ping", "z")).toBe(false);
  });

  it("fuzzy spread chars match in order", () => {
    // 'fsp' should match 'firestore-ping' (f...s...p)
    expect(fuzzyMatch("firestore-ping", "fsp")).toBe(true);
  });

  it("characters out of order do NOT match", () => {
    // 'pf' after 'f' in firestore-ping — 'p' comes before second 'f'? No.
    // 'pf' requires p then f in that order — in 'firestore-ping': f,i,r,e,s,t,o,r,e,-,p,i,n,g
    // p at index 10, f at index 0 — 'p' then 'f' requires p before f, but p is after f.
    expect(fuzzyMatch("firestore-ping", "pf")).toBe(false);
  });

  it("needle with hyphen matches command names with hyphens", () => {
    expect(fuzzyMatch("trial-adjust shift dates", "trial-")).toBe(true);
  });

  it("empty haystack with non-empty needle never matches", () => {
    expect(fuzzyMatch("", "a")).toBe(false);
  });
});

// ── 3. Tab + availability intersection ───────────────────────────────────────

describe("Tab + availability intersection — issue #1560", () => {
  it("users-tab commands that require user context are not available in empty ctx", () => {
    const userCmds = getCommandsForTab(0).filter((c) => c.requiresContext === "user");
    expect(userCmds.length).toBeGreaterThan(0);
    for (const cmd of userCmds) {
      expect(isAvailable(cmd, EMPTY_CTX)).toBe(false);
    }
  });

  it("users-tab commands that require user context become available when user set", () => {
    const userCmds = getCommandsForTab(0).filter((c) => c.requiresContext === "user");
    const ctx = { ...EMPTY_CTX, selectedUserId: "u-1" };
    for (const cmd of userCmds) {
      expect(isAvailable(cmd, ctx)).toBe(true);
    }
  });

  it("households-tab commands that require household context are not available in empty ctx", () => {
    const hhCmds = getCommandsForTab(1).filter((c) => c.requiresContext === "household");
    expect(hhCmds.length).toBeGreaterThan(0);
    for (const cmd of hhCmds) {
      expect(isAvailable(cmd, EMPTY_CTX)).toBe(false);
    }
  });

  it("households-tab commands are available when household set but no user set", () => {
    const hhCmds = getCommandsForTab(1).filter((c) => c.requiresContext === "household");
    const ctx = { ...EMPTY_CTX, selectedHouseholdId: "hh-99" };
    for (const cmd of hhCmds) {
      expect(isAvailable(cmd, ctx)).toBe(true);
    }
  });

  it("global commands visible on both tabs have no requiresContext", () => {
    const globalCmds = COMMANDS.filter((c) => (c.tab ?? "all") === "all");
    for (const cmd of globalCmds) {
      expect(isAvailable(cmd, EMPTY_CTX)).toBe(true);
    }
  });
});

// ── 4. Undefined tab defaults to "all" treatment ─────────────────────────────

describe("Undefined tab defaults to global — issue #1560", () => {
  it("command with undefined tab appears on Users tab (treated as 'all')", () => {
    // Simulate a command with no tab field
    const noTabCmd: PaletteCommand = {
      name: "test-no-tab",
      desc: "Command with no explicit tab",
      subsystem: "system",
      // tab is intentionally absent
    };
    const augmented = [...COMMANDS, noTabCmd];
    const tabName: CommandTab = "users";
    const result = augmented.filter((cmd) => {
      const t = cmd.tab ?? "all";
      return t === "all" || t === tabName;
    });
    expect(result.some((c) => c.name === "test-no-tab")).toBe(true);
  });

  it("command with undefined tab appears on Households tab (treated as 'all')", () => {
    const noTabCmd: PaletteCommand = {
      name: "test-no-tab",
      desc: "Command with no explicit tab",
      subsystem: "system",
    };
    const augmented = [...COMMANDS, noTabCmd];
    const tabName: CommandTab = "households";
    const result = augmented.filter((cmd) => {
      const t = cmd.tab ?? "all";
      return t === "all" || t === tabName;
    });
    expect(result.some((c) => c.name === "test-no-tab")).toBe(true);
  });
});

// ── 5. Subsystem-based tab alignment ─────────────────────────────────────────

describe("Subsystem-based tab alignment — issue #1560", () => {
  it("all trial-subsystem commands are on the users tab only", () => {
    const trialCmds = COMMANDS.filter((c) => c.subsystem === "trial");
    expect(trialCmds.length).toBeGreaterThan(0);
    for (const cmd of trialCmds) {
      expect(cmd.tab).toBe("users");
    }
  });

  it("trial-subsystem commands do NOT appear on households tab", () => {
    const householdsTab = getCommandsForTab(1);
    const trialOnHouseholds = householdsTab.filter((c) => c.subsystem === "trial");
    expect(trialOnHouseholds).toHaveLength(0);
  });

  it("all global (all-tab) commands appear on both Users and Households tabs", () => {
    const globalCmds = COMMANDS.filter((c) => (c.tab ?? "all") === "all");
    const usersTab = getCommandsForTab(0);
    const householdsTab = getCommandsForTab(1);
    for (const cmd of globalCmds) {
      expect(usersTab.some((c) => c.name === cmd.name)).toBe(true);
      expect(householdsTab.some((c) => c.name === cmd.name)).toBe(true);
    }
  });

  it("stripe-list-customers is users-tab only (not global, not households)", () => {
    const cmd = COMMANDS.find((c) => c.name === "stripe-list-customers")!;
    expect(cmd.tab).toBe("users");
    const householdsTab = getCommandsForTab(1);
    expect(householdsTab.some((c) => c.name === "stripe-list-customers")).toBe(false);
  });
});

// ── 6. Destructive + needsInput flag tab correctness ─────────────────────────

describe("Destructive and needsInput flag tab correctness — issue #1560", () => {
  it("all destructive commands are on users tab (destructive ops are user/trial-scoped)", () => {
    const destructiveCmds = COMMANDS.filter((c) => c.destructive === true);
    expect(destructiveCmds.length).toBeGreaterThan(0);
    for (const cmd of destructiveCmds) {
      expect(cmd.tab).toBe("users");
    }
  });

  it("trial-adjust has needsInput:true and is on users tab", () => {
    const cmd = COMMANDS.find((c) => c.name === "trial-adjust")!;
    expect(cmd.needsInput).toBe(true);
    expect(cmd.tab).toBe("users");
  });

  it("needsInput commands require trial context (input only makes sense with trial)", () => {
    const inputCmds = COMMANDS.filter((c) => c.needsInput === true);
    for (const cmd of inputCmds) {
      expect(cmd.requiresContext).toBe("trial");
    }
  });

  it("destructive commands on users tab do NOT appear on households tab", () => {
    const destructiveCmds = COMMANDS.filter((c) => c.destructive === true);
    const householdsTab = getCommandsForTab(1);
    for (const cmd of destructiveCmds) {
      expect(householdsTab.some((c) => c.name === cmd.name)).toBe(false);
    }
  });
});

// ── 7. filterCommandsForTab — query matching name vs desc ────────────────────

describe("filterCommandsForTab — name vs desc matching — issue #1560", () => {
  it("query matching only in desc still returns command for correct tab", () => {
    // 'connectivity' appears only in firestore-ping's desc, not its name
    const result = filterCommandsForTab("connectivity", 0);
    expect(result.some((c) => c.name === "firestore-ping")).toBe(true);
  });

  it("query matching desc of a households-only command does NOT appear on users tab", () => {
    // 'household' appears in firestore-get-household desc
    const result = filterCommandsForTab("household", 0);
    expect(result.some((c) => c.name === "firestore-get-household")).toBe(false);
  });

  it("query matching desc of a users-only command does NOT appear on households tab", () => {
    // 'shift trial start date' is in trial-adjust desc
    const result = filterCommandsForTab("shift", 1);
    expect(result.some((c) => c.name === "trial-adjust")).toBe(false);
  });

  it("'expire' query on users tab returns trial-complete", () => {
    // 'expire' is in trial-complete desc
    const result = filterCommandsForTab("expire", 0);
    expect(result.some((c) => c.name === "trial-complete")).toBe(true);
  });

  it("'delete' query on users tab returns firestore-delete-user (in desc)", () => {
    const result = filterCommandsForTab("delete", 0);
    expect(result.some((c) => c.name === "firestore-delete-user")).toBe(true);
  });

  it("'delete' query on households tab returns NO commands (delete commands are users-only)", () => {
    const result = filterCommandsForTab("delete", 1);
    expect(result.some((c) => c.name === "firestore-delete-user")).toBe(false);
  });
});

// ── 8. getSectionsForTab — exact section counts ───────────────────────────────

describe("getSectionsForTab — section counts per tab — issue #1560", () => {
  const totalSections = HELP_SECTIONS.length;

  it("Users tab shows global sections (Navigation + System) + users-specific sections", () => {
    const sections = getSectionsForTab(0);
    const globalCount = HELP_SECTIONS.filter((s) => s.tabs === "all").length;
    const usersCount = HELP_SECTIONS.filter((s) => s.tabs === "users").length;
    expect(sections).toHaveLength(globalCount + usersCount);
  });

  it("Households tab shows global sections (Navigation + System) + households-specific sections", () => {
    const sections = getSectionsForTab(1);
    const globalCount = HELP_SECTIONS.filter((s) => s.tabs === "all").length;
    const householdsCount = HELP_SECTIONS.filter((s) => s.tabs === "households").length;
    expect(sections).toHaveLength(globalCount + householdsCount);
  });

  it("total section count is correct (5 sections defined)", () => {
    expect(totalSections).toBe(5);
  });

  it("Users tab does not show all sections (households section filtered)", () => {
    expect(getSectionsForTab(0).length).toBeLessThan(totalSections);
  });

  it("Households tab does not show all sections (user + trial sections filtered)", () => {
    expect(getSectionsForTab(1).length).toBeLessThan(totalSections);
  });

  it("section order preserved: Navigation comes before User Actions on Users tab", () => {
    const sections = getSectionsForTab(0);
    const navIdx = sections.findIndex((s) => s.title === "Navigation");
    const userActIdx = sections.findIndex((s) => s.title.startsWith("User Actions"));
    expect(navIdx).toBeLessThan(userActIdx);
  });

  it("section order preserved: System Commands is last on Users tab", () => {
    const sections = getSectionsForTab(0);
    const last = sections[sections.length - 1];
    expect(last?.title).toBe("System Commands");
  });

  it("section order preserved: System Commands is last on Households tab", () => {
    const sections = getSectionsForTab(1);
    const last = sections[sections.length - 1];
    expect(last?.title).toBe("System Commands");
  });
});

// ── 9. Global command isolation ───────────────────────────────────────────────

describe("Global command isolation — no global command is tab-specific — issue #1560", () => {
  it("global commands have tab='all' explicitly (no implicit defaults needed)", () => {
    const globalCmds = COMMANDS.filter((c) => (c.tab ?? "all") === "all");
    for (const cmd of globalCmds) {
      // Explicit 'all' is cleaner than undefined — verify production commands use it
      expect(cmd.tab).toBe("all");
    }
  });

  it("global commands never have requiresContext set", () => {
    const globalCmds = COMMANDS.filter((c) => c.tab === "all");
    for (const cmd of globalCmds) {
      expect(cmd.requiresContext).toBeUndefined();
    }
  });

  it("global commands are never destructive", () => {
    const globalCmds = COMMANDS.filter((c) => c.tab === "all");
    for (const cmd of globalCmds) {
      expect(cmd.destructive).toBeFalsy();
    }
  });
});
