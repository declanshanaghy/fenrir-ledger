/**
 * Vitest — Odin's Spear: trial-adjust keyboard shortcut from user view
 * Issue #1491: 'a' key opens TrialInputDialog directly when user is selected
 *
 * Tests mirror extracted pure logic following the existing test-suite pattern.
 *
 * Suites:
 *   1. UsersTab 'a' shortcut guard — only fires when user selected
 *   2. onTrialAdjust wiring — resolves trial-adjust command from registry
 *   3. Action bar hint — '[a] adjust trial' visible in user detail panel
 *   4. HelpOverlay — Trial Actions section includes 'a' shortcut
 *   5. Overlay guard — 'a' shortcut is suppressed when any overlay is open
 *   6. Palette commands — trial-adjust still accessible via '/'
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ── 1. UsersTab 'a' shortcut guard ────────────────────────────────────────────
//
// Mirrors the useInput handler in UsersTab:
// if (selectedIdx >= 0) { ... if (input === 'a') onTrialAdjust?.() }

function handleUserTabInput(
  input: string,
  selectedIdx: number,
  onTrialAdjust: (() => void) | undefined
): boolean {
  // Returns true if event was consumed
  if (selectedIdx < 0) return false;
  if (input === "a") {
    onTrialAdjust?.();
    return true;
  }
  return false;
}

describe("UsersTab 'a' shortcut guard (issue #1491)", () => {
  let onTrialAdjust: Mock;

  beforeEach(() => {
    onTrialAdjust = vi.fn();
  });

  it("calls onTrialAdjust when user is selected and 'a' is pressed", () => {
    handleUserTabInput("a", 0, onTrialAdjust);
    expect(onTrialAdjust).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onTrialAdjust when no user is selected (selectedIdx < 0)", () => {
    handleUserTabInput("a", -1, onTrialAdjust);
    expect(onTrialAdjust).not.toHaveBeenCalled();
  });

  it("does NOT call onTrialAdjust for unrelated key inputs", () => {
    handleUserTabInput("d", 0, onTrialAdjust);
    handleUserTabInput("t", 0, onTrialAdjust);
    handleUserTabInput("h", 0, onTrialAdjust);
    expect(onTrialAdjust).not.toHaveBeenCalled();
  });

  it("is a no-op when onTrialAdjust is not provided (optional prop)", () => {
    expect(() => handleUserTabInput("a", 0, undefined)).not.toThrow();
  });

  it("is consumed (returns true) so global handlers do not fire", () => {
    const consumed = handleUserTabInput("a", 2, onTrialAdjust);
    expect(consumed).toBe(true);
  });

  it("returns false when user is not selected — event falls through", () => {
    const consumed = handleUserTabInput("a", -1, onTrialAdjust);
    expect(consumed).toBe(false);
  });

  it("works at any selectedIdx >= 0 (first, middle, last)", () => {
    handleUserTabInput("a", 0, onTrialAdjust);
    handleUserTabInput("a", 5, onTrialAdjust);
    handleUserTabInput("a", 99, onTrialAdjust);
    expect(onTrialAdjust).toHaveBeenCalledTimes(3);
  });
});

// ── 2. onTrialAdjust wiring — resolves trial-adjust from registry ─────────────
//
// Mirrors the onTrialAdjust callback in app.tsx:
//   const cmd = getCommands().find((c) => c.name === "trial-adjust");
//   if (cmd) handleTrialInput(cmd);

interface PaletteCommandStub {
  name: string;
  needsInput?: boolean;
}

function resolveTrialAdjustCommand(
  commands: PaletteCommandStub[]
): PaletteCommandStub | undefined {
  return commands.find((c) => c.name === "trial-adjust");
}

function buildOnTrialAdjust(
  commands: PaletteCommandStub[],
  handleTrialInput: (cmd: PaletteCommandStub) => void
): () => void {
  return () => {
    const cmd = resolveTrialAdjustCommand(commands);
    if (cmd) handleTrialInput(cmd);
  };
}

describe("onTrialAdjust wiring — resolves trial-adjust from registry (issue #1491)", () => {
  const TRIAL_COMMANDS: PaletteCommandStub[] = [
    { name: "trial-adjust", needsInput: true },
    { name: "trial-complete" },
    { name: "trial-progress" },
  ];

  let handleTrialInput: Mock;

  beforeEach(() => {
    handleTrialInput = vi.fn();
  });

  it("finds and passes trial-adjust command to handleTrialInput", () => {
    const onTrialAdjust = buildOnTrialAdjust(TRIAL_COMMANDS, handleTrialInput);
    onTrialAdjust();
    expect(handleTrialInput).toHaveBeenCalledWith(
      expect.objectContaining({ name: "trial-adjust" })
    );
  });

  it("does NOT call handleTrialInput when trial-adjust is not registered", () => {
    const onTrialAdjust = buildOnTrialAdjust([], handleTrialInput);
    onTrialAdjust();
    expect(handleTrialInput).not.toHaveBeenCalled();
  });

  it("passes the trial-adjust command with needsInput: true", () => {
    const onTrialAdjust = buildOnTrialAdjust(TRIAL_COMMANDS, handleTrialInput);
    onTrialAdjust();
    const cmd = (handleTrialInput as Mock).mock.calls[0][0] as PaletteCommandStub;
    expect(cmd.needsInput).toBe(true);
  });

  it("does not call handleTrialInput for trial-complete or trial-progress", () => {
    const onTrialAdjust = buildOnTrialAdjust(TRIAL_COMMANDS, handleTrialInput);
    onTrialAdjust();
    const cmd = (handleTrialInput as Mock).mock.calls[0][0] as PaletteCommandStub;
    expect(cmd.name).toBe("trial-adjust");
    expect(cmd.name).not.toBe("trial-complete");
    expect(cmd.name).not.toBe("trial-progress");
  });
});

// ── 3. Action bar hint — '[a] adjust trial' ──────────────────────────────────
//
// Mirrors UserDetailPanel action bar: hint includes '[a] adjust trial'

function buildActionBarHint(
  user: { stripeCustomerId: string | null },
  detail: { household: object | null } | null
): string {
  let hint = "[d] Delete  [t] Tier  [a] adjust trial";
  if (user.stripeCustomerId) hint += "  [s] Cancel sub";
  if (detail?.household) hint += "  [h] Household  [c] Cards";
  return hint;
}

describe("Action bar hint — '[a] adjust trial' visible (issue #1491)", () => {
  it("includes '[a] adjust trial' in the action bar hint", () => {
    const hint = buildActionBarHint({ stripeCustomerId: null }, null);
    expect(hint).toContain("[a] adjust trial");
  });

  it("always shows '[a] adjust trial' regardless of stripe/household state", () => {
    const withStripe = buildActionBarHint({ stripeCustomerId: "cus_123" }, { household: {} });
    const noStripe = buildActionBarHint({ stripeCustomerId: null }, null);
    expect(withStripe).toContain("[a] adjust trial");
    expect(noStripe).toContain("[a] adjust trial");
  });

  it("still shows '[d] Delete' and '[t] Tier' alongside the new hint", () => {
    const hint = buildActionBarHint({ stripeCustomerId: null }, null);
    expect(hint).toContain("[d] Delete");
    expect(hint).toContain("[t] Tier");
  });

  it("appends household shortcuts when household is present", () => {
    const hint = buildActionBarHint({ stripeCustomerId: null }, { household: {} });
    expect(hint).toContain("[h] Household");
    expect(hint).toContain("[c] Cards");
  });

  it("does not include household shortcuts when no household", () => {
    const hint = buildActionBarHint({ stripeCustomerId: null }, null);
    expect(hint).not.toContain("[h] Household");
  });

  it("appends stripe shortcut when stripeCustomerId is present", () => {
    const hint = buildActionBarHint({ stripeCustomerId: "cus_abc" }, null);
    expect(hint).toContain("[s] Cancel sub");
  });
});

// ── 4. HelpOverlay — Trial Actions section includes 'a' ─────────────────────
//
// Mirrors the SECTIONS array in HelpOverlay.tsx

interface Shortcut {
  key: string;
  desc: string;
}

interface Section {
  title: string;
  tabs: "all" | "users" | "households";
  shortcuts: Shortcut[];
}

const SECTIONS: Section[] = [
  {
    title: "Navigation",
    tabs: "all",
    shortcuts: [
      { key: "Tab",    desc: "Switch tab (Users / Households)" },
      { key: "↑ / ↓", desc: "Navigate list" },
      { key: "Enter",  desc: "Select item" },
      { key: "Esc",    desc: "Go back / close overlay" },
      { key: "/",      desc: "Open command palette" },
      { key: "?",      desc: "Show this help" },
      { key: "q",      desc: "Quit" },
    ],
  },
  {
    title: "User Actions  (user selected)",
    tabs: "users",
    shortcuts: [
      { key: "d",  desc: "Delete selected user" },
      { key: "t",  desc: "Update subscription tier" },
      { key: "h",  desc: "Jump to user's household" },
    ],
  },
  {
    title: "Trial Actions  (user selected)",
    tabs: "users",
    shortcuts: [
      { key: "a",  desc: "Open trial-adjust dialog (shift trial start date)" },
      { key: "s",  desc: "Cancel active Stripe subscription" },
    ],
  },
  {
    title: "Household Actions  (household selected)",
    tabs: "households",
    shortcuts: [
      { key: "d",  desc: "Delete selected household" },
      { key: "u",  desc: "List household members" },
    ],
  },
];

function getSectionsForTab(tabIndex: number): Section[] {
  const tabName = tabIndex === 0 ? "users" : "households";
  return SECTIONS.filter((s) => s.tabs === "all" || s.tabs === tabName);
}

describe("HelpOverlay — Trial Actions section includes 'a' shortcut (issue #1491)", () => {
  it("Trial Actions section exists in users tab sections", () => {
    const sections = getSectionsForTab(0);
    const trialSection = sections.find((s) => s.title.startsWith("Trial Actions"));
    expect(trialSection).toBeDefined();
  });

  it("'a' key is listed in Trial Actions for users tab", () => {
    const sections = getSectionsForTab(0);
    const trialSection = sections.find((s) => s.title.startsWith("Trial Actions"));
    const aShortcut = trialSection?.shortcuts.find((sh) => sh.key === "a");
    expect(aShortcut).toBeDefined();
    expect(aShortcut?.desc).toContain("trial-adjust");
  });

  it("Trial Actions section does NOT appear on households tab", () => {
    const sections = getSectionsForTab(1);
    const trialSection = sections.find((s) => s.title.startsWith("Trial Actions"));
    expect(trialSection).toBeUndefined();
  });

  it("'a' shortcut description mentions shifting trial start date", () => {
    const sections = getSectionsForTab(0);
    const trialSection = sections.find((s) => s.title.startsWith("Trial Actions"));
    const aShortcut = trialSection?.shortcuts.find((sh) => sh.key === "a");
    expect(aShortcut?.desc.toLowerCase()).toContain("trial");
  });

  it("users tab has at least Navigation, User Actions, and Trial Actions sections", () => {
    const sections = getSectionsForTab(0);
    const titles = sections.map((s) => s.title);
    expect(titles.some((t) => t.startsWith("Navigation"))).toBe(true);
    expect(titles.some((t) => t.startsWith("User Actions"))).toBe(true);
    expect(titles.some((t) => t.startsWith("Trial Actions"))).toBe(true);
  });
});

// ── 5. Overlay guard — 'a' shortcut suppressed when overlay is open ───────────
//
// Mirrors app.tsx useInput: if (overlay.kind !== 'none') return;
// The 'a' key in UsersTab only fires when the global input is not blocked.

type OverlayKind = "none" | "help" | "palette" | "results" | "confirm" | "trial-input";

function isGlobalInputBlocked(overlayKind: OverlayKind): boolean {
  return overlayKind !== "none";
}

describe("Overlay guard — 'a' shortcut suppressed when overlay open (issue #1491)", () => {
  it("global input is NOT blocked when overlay is 'none'", () => {
    expect(isGlobalInputBlocked("none")).toBe(false);
  });

  it("global input IS blocked when overlay is 'help'", () => {
    expect(isGlobalInputBlocked("help")).toBe(true);
  });

  it("global input IS blocked when overlay is 'palette'", () => {
    expect(isGlobalInputBlocked("palette")).toBe(true);
  });

  it("global input IS blocked when overlay is 'trial-input'", () => {
    expect(isGlobalInputBlocked("trial-input")).toBe(true);
  });

  it("global input IS blocked when overlay is 'confirm'", () => {
    expect(isGlobalInputBlocked("confirm")).toBe(true);
  });

  it("global input IS blocked when overlay is 'results'", () => {
    expect(isGlobalInputBlocked("results")).toBe(true);
  });
});

// ── 6. Palette commands — trial-adjust still accessible via '/' ───────────────
//
// Regression: ensuring trial-adjust remains in the palette command set

interface PaletteCmd {
  name: string;
  tab?: string;
  requiresContext?: string;
  needsInput?: boolean;
}

const REGISTRY_COMMANDS: PaletteCmd[] = [
  { name: "trial-adjust",   tab: "users", requiresContext: "trial", needsInput: true },
  { name: "trial-complete", tab: "users", requiresContext: "trial" },
  { name: "trial-progress", tab: "users", requiresContext: "trial" },
];

function filterCommandsForTab(query: string, tabIndex: number): PaletteCmd[] {
  const tabName = tabIndex === 0 ? "users" : "households";
  return REGISTRY_COMMANDS.filter((cmd) => {
    const t = cmd.tab ?? "all";
    const matchesTab = t === "all" || t === tabName;
    if (!matchesTab) return false;
    if (!query) return true;
    return cmd.name.includes(query.toLowerCase());
  });
}

describe("Palette commands — trial-adjust accessible via '/' (issue #1491 regression)", () => {
  it("trial-adjust is in the registry for users tab", () => {
    const cmds = filterCommandsForTab("", 0);
    expect(cmds.some((c) => c.name === "trial-adjust")).toBe(true);
  });

  it("trial-adjust appears when searching 'trial' in palette", () => {
    const cmds = filterCommandsForTab("trial", 0);
    expect(cmds.some((c) => c.name === "trial-adjust")).toBe(true);
  });

  it("trial-complete still in palette after shortcut addition", () => {
    const cmds = filterCommandsForTab("trial", 0);
    expect(cmds.some((c) => c.name === "trial-complete")).toBe(true);
  });

  it("trial-progress still in palette after shortcut addition", () => {
    const cmds = filterCommandsForTab("trial", 0);
    expect(cmds.some((c) => c.name === "trial-progress")).toBe(true);
  });

  it("trial-adjust has needsInput=true (opens TrialInputDialog via both routes)", () => {
    const cmd = REGISTRY_COMMANDS.find((c) => c.name === "trial-adjust");
    expect(cmd?.needsInput).toBe(true);
  });

  it("trial commands do not appear on households tab (tab scoped)", () => {
    const cmds = filterCommandsForTab("trial", 1);
    expect(cmds).toHaveLength(0);
  });
});
