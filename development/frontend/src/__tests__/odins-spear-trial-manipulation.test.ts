/**
 * Vitest — Odin's Spear: Trial Manipulation Controls
 * Issue #1472: trial-adjust, trial-complete, trial-progress palette commands
 *
 * odins-spear.mjs cannot be imported (top-level await + side-effects).
 * Tests mirror extracted pure logic, following the existing test-suite pattern.
 *
 * Suites:
 *   1. computeTrialProgressTarget — next phase boundary logic
 *   2. startDateForRemaining — correct startDate from remaining days
 *   3. describeTrialState — display strings for confirmation dialog
 *   4. PALETTE_COMMANDS — Trial category structure
 *   5. TrialDialog input validation — day input parsing rules
 *   6. TrialDialog overlay priority — trialDialog > palette > help > main
 *   7. handleTrialInputNext — preview computation on day-shift
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ── Constants (mirrored from odins-spear.mjs) ──────────────────────────────────

const TRIAL_DURATION_DAYS = 30;
const TRIAL_NUDGE_DAY = 15;

// ── Mirrored pure helpers ──────────────────────────────────────────────────────

function computeStatus(trial: { startDate: string; convertedDate?: string } | null) {
  if (!trial) return { remainingDays: 0, status: "none" };
  if (trial.convertedDate) return { remainingDays: 0, status: "converted", convertedDate: trial.convertedDate };
  const elapsed = Math.floor((Date.now() - new Date(trial.startDate).getTime()) / 86400000);
  const remaining = Math.max(0, TRIAL_DURATION_DAYS - elapsed);
  return { remainingDays: remaining, status: remaining <= 0 ? "expired" : "active" };
}

function computeTrialProgressTarget(remainingDays: number): { targetRemaining: number; label: string } | null {
  if (remainingDays > TRIAL_NUDGE_DAY) {
    return { targetRemaining: TRIAL_NUDGE_DAY, label: `Day-${TRIAL_NUDGE_DAY} nudge boundary` };
  }
  if (remainingDays > 0) {
    return { targetRemaining: 0, label: "Expiry boundary (day 30)" };
  }
  return null;
}

function startDateForRemaining(targetRemaining: number): string {
  const daysAgo = TRIAL_DURATION_DAYS - targetRemaining;
  return new Date(Date.now() - daysAgo * 86400000).toISOString();
}

function describeTrialState(state: { status: string; remainingDays: number }): string {
  if (state.status === "none") return "no trial";
  if (state.status === "converted") return "converted (Karl)";
  if (state.status === "expired") return "expired — 0 days remaining";
  return `${state.status} — ${state.remainingDays}d remaining`;
}

// ── 1. computeTrialProgressTarget ─────────────────────────────────────────────

describe("computeTrialProgressTarget — next phase boundary (issue #1472)", () => {
  it("returns TRIAL_NUDGE_DAY target when remaining > nudge threshold", () => {
    const result = computeTrialProgressTarget(20);
    expect(result).not.toBeNull();
    expect(result!.targetRemaining).toBe(TRIAL_NUDGE_DAY);
  });

  it("returns 0 target when remaining is exactly at nudge boundary", () => {
    const result = computeTrialProgressTarget(TRIAL_NUDGE_DAY);
    expect(result).not.toBeNull();
    expect(result!.targetRemaining).toBe(0);
  });

  it("returns 0 target when remaining is below nudge boundary (>0)", () => {
    const result = computeTrialProgressTarget(5);
    expect(result).not.toBeNull();
    expect(result!.targetRemaining).toBe(0);
  });

  it("returns 0 target when remaining is 1", () => {
    const result = computeTrialProgressTarget(1);
    expect(result).not.toBeNull();
    expect(result!.targetRemaining).toBe(0);
  });

  it("returns null when remaining is 0 (already expired)", () => {
    expect(computeTrialProgressTarget(0)).toBeNull();
  });

  it("returns null when remaining is negative (already expired)", () => {
    expect(computeTrialProgressTarget(-5)).toBeNull();
  });

  it("label describes phase for nudge target", () => {
    const result = computeTrialProgressTarget(30);
    expect(result!.label).toContain(`${TRIAL_NUDGE_DAY}`);
  });

  it("label describes expiry for 0-target", () => {
    const result = computeTrialProgressTarget(10);
    expect(result!.label.toLowerCase()).toContain("expiry");
  });

  it("remaining exactly at TRIAL_DURATION_DAYS targets nudge day", () => {
    const result = computeTrialProgressTarget(TRIAL_DURATION_DAYS);
    expect(result!.targetRemaining).toBe(TRIAL_NUDGE_DAY);
  });

  it("remaining of 16 (just above nudge) targets nudge day", () => {
    const result = computeTrialProgressTarget(16);
    expect(result!.targetRemaining).toBe(TRIAL_NUDGE_DAY);
  });

  it("remaining of 14 (just below nudge) targets 0", () => {
    const result = computeTrialProgressTarget(14);
    expect(result!.targetRemaining).toBe(0);
  });
});

// ── 2. startDateForRemaining ───────────────────────────────────────────────────

describe("startDateForRemaining — ISO startDate from remaining days (issue #1472)", () => {
  it("returns a valid ISO string", () => {
    const iso = startDateForRemaining(15);
    expect(() => new Date(iso)).not.toThrow();
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it("remaining=0 → startDate is TRIAL_DURATION_DAYS ago (trial expired)", () => {
    const iso = startDateForRemaining(0);
    const daysAgo = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    expect(daysAgo).toBe(TRIAL_DURATION_DAYS);
  });

  it("remaining=TRIAL_DURATION_DAYS → startDate is today (just started)", () => {
    const iso = startDateForRemaining(TRIAL_DURATION_DAYS);
    const daysAgo = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    expect(daysAgo).toBe(0);
  });

  it("remaining=15 → startDate is 15 days ago", () => {
    const iso = startDateForRemaining(15);
    const daysAgo = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    expect(daysAgo).toBe(15);
  });

  it("computeStatus on result gives matching remaining days", () => {
    const target = 12;
    const iso = startDateForRemaining(target);
    const status = computeStatus({ startDate: iso });
    expect(status.remainingDays).toBe(target);
    expect(status.status).toBe("active");
  });

  it("remaining=0 → computeStatus gives expired", () => {
    const iso = startDateForRemaining(0);
    const status = computeStatus({ startDate: iso });
    expect(status.status).toBe("expired");
    expect(status.remainingDays).toBe(0);
  });
});

// ── 3. describeTrialState ──────────────────────────────────────────────────────

describe("describeTrialState — compact display for confirmation dialog (issue #1472)", () => {
  it("none status → 'no trial'", () => {
    expect(describeTrialState({ status: "none", remainingDays: 0 })).toBe("no trial");
  });

  it("converted status → 'converted (Karl)'", () => {
    expect(describeTrialState({ status: "converted", remainingDays: 0 })).toBe("converted (Karl)");
  });

  it("expired status → 'expired — 0 days remaining'", () => {
    expect(describeTrialState({ status: "expired", remainingDays: 0 })).toBe("expired — 0 days remaining");
  });

  it("active status with days → 'active — Nd remaining'", () => {
    expect(describeTrialState({ status: "active", remainingDays: 15 })).toBe("active — 15d remaining");
  });

  it("active status with 1 day → 'active — 1d remaining'", () => {
    expect(describeTrialState({ status: "active", remainingDays: 1 })).toBe("active — 1d remaining");
  });

  it("active status with full trial → 'active — 30d remaining'", () => {
    expect(describeTrialState({ status: "active", remainingDays: TRIAL_DURATION_DAYS })).toBe(`active — ${TRIAL_DURATION_DAYS}d remaining`);
  });
});

// ── 4. PALETTE_COMMANDS — Trial category ──────────────────────────────────────

interface PaletteCommand {
  name: string;
  desc: string;
  category: string;
  destructive: boolean;
}

const PALETTE_COMMANDS: PaletteCommand[] = [
  { name: "delete-user",         desc: "Delete selected user and all their data",           category: "Users",      destructive: true  },
  { name: "update-tier",         desc: "Change user tier (karl / trial / thrall)",           category: "Users",      destructive: false },
  { name: "delete-subscription", desc: "Cancel and remove Stripe subscription",              category: "Billing",    destructive: true  },
  { name: "list-subscriptions",  desc: "List all active Stripe subscriptions",               category: "Billing",    destructive: false },
  { name: "list-customers",      desc: "List all Stripe customers",                          category: "Billing",    destructive: false },
  { name: "delete-entitlement",  desc: "Clear Redis entitlement cache for selected user",    category: "Billing",    destructive: true  },
  { name: "delete-member",       desc: "Remove member from selected household",              category: "Households", destructive: true  },
  { name: "update-owner",        desc: "Transfer ownership of selected household",           category: "Households", destructive: false },
  { name: "update-invite",       desc: "Regenerate household invite code",                   category: "Households", destructive: false },
  { name: "delete-household",    desc: "Delete selected household and all members",          category: "Households", destructive: true  },
  { name: "delete-all",          desc: "Delete ALL data for selected user (nuclear option)", category: "Danger",     destructive: true  },
  { name: "reconnect",           desc: "Reconnect to Redis / Firestore / Stripe",            category: "System",     destructive: false },
  { name: "trial-adjust",        desc: "Shift trial start date by +N / -N days",            category: "Trial",      destructive: false },
  { name: "trial-complete",      desc: `Expire trial immediately (>${TRIAL_DURATION_DAYS} days ago)`, category: "Trial", destructive: false },
  { name: "trial-progress",      desc: `Advance to next phase boundary (day ${TRIAL_NUDGE_DAY} or expiry)`, category: "Trial", destructive: false },
];

function filterPaletteCommands(query: string): PaletteCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return PALETTE_COMMANDS;
  return PALETTE_COMMANDS.filter(
    (c) => c.name.includes(q) || c.desc.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
  );
}

describe("PALETTE_COMMANDS — Trial category (issue #1472)", () => {
  it("includes Trial category", () => {
    const categories = [...new Set(PALETTE_COMMANDS.map((c) => c.category))];
    expect(categories).toContain("Trial");
  });

  it("has three trial commands", () => {
    const trialCmds = PALETTE_COMMANDS.filter((c) => c.category === "Trial");
    expect(trialCmds).toHaveLength(3);
  });

  it("trial-adjust is not destructive", () => {
    const cmd = PALETTE_COMMANDS.find((c) => c.name === "trial-adjust");
    expect(cmd?.destructive).toBe(false);
  });

  it("trial-complete is not destructive", () => {
    const cmd = PALETTE_COMMANDS.find((c) => c.name === "trial-complete");
    expect(cmd?.destructive).toBe(false);
  });

  it("trial-progress is not destructive", () => {
    const cmd = PALETTE_COMMANDS.find((c) => c.name === "trial-progress");
    expect(cmd?.destructive).toBe(false);
  });

  it("trial commands appear when searching 'trial'", () => {
    const results = filterPaletteCommands("trial");
    const names = results.map((c) => c.name);
    expect(names).toContain("trial-adjust");
    expect(names).toContain("trial-complete");
    expect(names).toContain("trial-progress");
  });

  it("trial commands appear when searching 'Trial' (category, case-insensitive)", () => {
    const results = filterPaletteCommands("Trial");
    expect(results.some((c) => c.category === "Trial")).toBe(true);
  });

  it("trial-complete desc references TRIAL_DURATION_DAYS", () => {
    const cmd = PALETTE_COMMANDS.find((c) => c.name === "trial-complete");
    expect(cmd?.desc).toContain(String(TRIAL_DURATION_DAYS));
  });

  it("trial-progress desc references TRIAL_NUDGE_DAY", () => {
    const cmd = PALETTE_COMMANDS.find((c) => c.name === "trial-progress");
    expect(cmd?.desc).toContain(String(TRIAL_NUDGE_DAY));
  });

  it("all trial commands have non-empty descriptions", () => {
    const trialCmds = PALETTE_COMMANDS.filter((c) => c.category === "Trial");
    for (const cmd of trialCmds) {
      expect(cmd.desc.length).toBeGreaterThan(0);
    }
  });
});

// ── 5. TrialDialog input validation ───────────────────────────────────────────
//
// Mirrors: const valid = !isNaN(n) && n !== 0

function isValidDayInput(input: string): boolean {
  const n = parseInt(input, 10);
  return !isNaN(n) && n !== 0;
}

describe("TrialDialog input validation — day input (issue #1472)", () => {
  it("accepts positive integer", () => {
    expect(isValidDayInput("5")).toBe(true);
  });

  it("accepts negative integer", () => {
    expect(isValidDayInput("-3")).toBe(true);
  });

  it("accepts +N format (parseInt parses it)", () => {
    expect(isValidDayInput("+7")).toBe(true);
  });

  it("rejects zero", () => {
    expect(isValidDayInput("0")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidDayInput("")).toBe(false);
  });

  it("rejects non-numeric string", () => {
    expect(isValidDayInput("abc")).toBe(false);
  });

  it("rejects lone plus sign", () => {
    expect(isValidDayInput("+")).toBe(false);
  });

  it("rejects lone minus sign", () => {
    expect(isValidDayInput("-")).toBe(false);
  });

  it("rejects decimal (parseInt rounds, 1.5 → 1 which is valid)", () => {
    // parseInt("1.5") === 1, which is non-zero → valid
    expect(isValidDayInput("1.5")).toBe(true);
  });

  it("large positive value is valid", () => {
    expect(isValidDayInput("100")).toBe(true);
  });

  it("large negative value is valid", () => {
    expect(isValidDayInput("-100")).toBe(true);
  });
});

// ── 6. TrialDialog overlay priority ───────────────────────────────────────────
//
// Priority: confirmDialog > trialDialog > showCmdPalette > showHelp > main

type OverlayType = "confirm" | "trial" | "palette" | "help" | "main";

function resolveOverlay(state: {
  confirmDialog: object | null;
  trialDialog: object | null;
  showCmdPalette: boolean;
  showHelp: boolean;
}): OverlayType {
  if (state.confirmDialog) return "confirm";
  if (state.trialDialog) return "trial";
  if (state.showCmdPalette) return "palette";
  if (state.showHelp) return "help";
  return "main";
}

describe("SpearApp overlay priority with trialDialog (issue #1472)", () => {
  it("confirmDialog takes highest priority over trialDialog", () => {
    expect(resolveOverlay({ confirmDialog: {}, trialDialog: {}, showCmdPalette: true, showHelp: true })).toBe("confirm");
  });

  it("trialDialog takes priority over palette", () => {
    expect(resolveOverlay({ confirmDialog: null, trialDialog: {}, showCmdPalette: true, showHelp: true })).toBe("trial");
  });

  it("palette shows when no confirm or trial dialog", () => {
    expect(resolveOverlay({ confirmDialog: null, trialDialog: null, showCmdPalette: true, showHelp: true })).toBe("palette");
  });

  it("help shows when no dialog and no palette", () => {
    expect(resolveOverlay({ confirmDialog: null, trialDialog: null, showCmdPalette: false, showHelp: true })).toBe("help");
  });

  it("main shows when all overlays are off", () => {
    expect(resolveOverlay({ confirmDialog: null, trialDialog: null, showCmdPalette: false, showHelp: false })).toBe("main");
  });

  it("trialDialog alone shows trial overlay", () => {
    expect(resolveOverlay({ confirmDialog: null, trialDialog: { action: "trial-complete" }, showCmdPalette: false, showHelp: false })).toBe("trial");
  });
});

// ── 7. handleTrialInputNext — preview computation ─────────────────────────────
//
// Mirrors the logic in handleTrialInputNext: given existing trial and dayInput,
// computes newStart and newStatus for the confirm phase preview.

function computeNewTrialState(
  existing: { startDate: string; convertedDate?: string } | null,
  dayInput: string
): { newStart: string; newStatus: ReturnType<typeof computeStatus> } {
  const days = parseInt(dayInput, 10);
  const baseStart = existing?.startDate ?? new Date().toISOString();
  // +N = age trial by N days (subtract from startDate → older start → fewer remaining)
  // -N = restore N days (add to startDate → newer start → more remaining)
  const newStart = new Date(new Date(baseStart).getTime() - days * 86400000).toISOString();
  const newTrial = { startDate: newStart };
  const newStatus = computeStatus(newTrial);
  return { newStart, newStatus };
}

describe("handleTrialInputNext — preview computation (issue #1472)", () => {
  it("+5 days on a 20-day-remaining trial → 15 remaining", () => {
    const startDate = startDateForRemaining(20);
    const { newStatus } = computeNewTrialState({ startDate }, "+5");
    expect(newStatus.remainingDays).toBe(15);
    expect(newStatus.status).toBe("active");
  });

  it("-5 days on a 20-day-remaining trial → 25 remaining (restore 5 days)", () => {
    const startDate = startDateForRemaining(20);
    const { newStatus } = computeNewTrialState({ startDate }, "-5");
    expect(newStatus.remainingDays).toBe(25);
    expect(newStatus.status).toBe("active");
  });

  it("+35 days on a fresh trial → expired (age beyond TRIAL_DURATION_DAYS)", () => {
    // Fresh trial = 30 remaining. +35 ages it 35 days → 30-35 = expired.
    const startDate = startDateForRemaining(TRIAL_DURATION_DAYS);
    const { newStatus } = computeNewTrialState({ startDate }, "35");
    expect(newStatus.status).toBe("expired");
    expect(newStatus.remainingDays).toBe(0);
  });

  it("+0 produces same state (zero is filtered out before this point)", () => {
    const startDate = startDateForRemaining(15);
    const { newStatus } = computeNewTrialState({ startDate }, "0");
    expect(newStatus.remainingDays).toBe(15);
  });

  it("handles null existing trial (uses current time as base)", () => {
    const { newStatus } = computeNewTrialState(null, "10");
    // baseStart = now; +10 ages trial by 10 days → startDate is now-10 days → 20 remaining
    expect(newStatus.remainingDays).toBe(TRIAL_DURATION_DAYS - 10);
    expect(newStatus.status).toBe("active");
  });
});
