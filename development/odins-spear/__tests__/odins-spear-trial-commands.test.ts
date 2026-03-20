/**
 * Loki QA — Odin's Spear Trial Commands (issue #1472)
 * Integration tests that import from the ACTUAL source modules:
 *   - src/commands/trial-helpers.ts  (pure helpers + constants)
 *   - src/commands/registry.ts       (PaletteCommand, registerCommand, isAvailable, fuzzyMatch, filterCommands)
 *   - src/commands/trial.ts          (registerTrialCommands + execute paths, Firestore mocked)
 *
 * These tests are distinct from odins-spear-trial-manipulation.test.ts which
 * uses mirrored pure functions. Here we import the real exports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock @fenrir/logger before any source import ───────────────────────────────
vi.mock("@fenrir/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

// ── Mock lib/firestore so trial.ts can be imported without GCP credentials ────
// We expose a mutable reference so individual tests can swap in a mock client.
let mockFirestoreClient: unknown = null;
vi.mock("../src/lib/firestore.js", () => ({
  get firestoreClient() {
    return mockFirestoreClient;
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import {
  TRIAL_DURATION_DAYS,
  TRIAL_NUDGE_DAY,
  computeTrialState,
  computeTrialProgressTarget,
  startDateForRemaining,
  describeTrialState,
  type TrialState,
} from "../src/commands/trial-helpers.js";

import {
  getCommands,
  isAvailable,
  fuzzyMatch,
  filterCommands,
  type CommandContext,
} from "../src/commands/registry.js";

import { registerTrialCommands } from "../src/commands/trial.js";

// ─── Helper: build a mock Firestore client ────────────────────────────────────

type MockDocRef = {
  get: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

function buildMockFirestore(trialDoc: { startDate: string; convertedDate?: string } | null): {
  fs: { collection: ReturnType<typeof vi.fn> };
  docRef: MockDocRef;
} {
  const docRef: MockDocRef = {
    get: vi.fn().mockResolvedValue({ exists: trialDoc !== null, data: () => trialDoc }),
    update: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };
  const fs = {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue(docRef),
    }),
  };
  return { fs, docRef };
}

// ─── 1. trial-helpers.ts exports: constants and pure functions ─────────────────

describe("trial-helpers: exported constants (issue #1472)", () => {
  it("TRIAL_DURATION_DAYS is 30", () => {
    expect(TRIAL_DURATION_DAYS).toBe(30);
  });

  it("TRIAL_NUDGE_DAY is 15", () => {
    expect(TRIAL_NUDGE_DAY).toBe(15);
  });

  it("TRIAL_NUDGE_DAY < TRIAL_DURATION_DAYS (nudge is before expiry)", () => {
    expect(TRIAL_NUDGE_DAY).toBeLessThan(TRIAL_DURATION_DAYS);
  });
});

// ─── 2. computeTrialState (actual import) ─────────────────────────────────────

describe("computeTrialState — actual import from trial-helpers (issue #1472)", () => {
  it("returns status='none' for null trial", () => {
    const s = computeTrialState(null);
    expect(s.status).toBe("none");
    expect(s.remainingDays).toBe(0);
  });

  it("returns status='converted' when convertedDate is set", () => {
    const s = computeTrialState({
      startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
      convertedDate: new Date().toISOString(),
    });
    expect(s.status).toBe("converted");
    expect(s.remainingDays).toBe(0);
  });

  it("returns status='active' for a fresh trial", () => {
    const s = computeTrialState({ startDate: new Date().toISOString() });
    expect(s.status).toBe("active");
    expect(s.remainingDays).toBeGreaterThanOrEqual(TRIAL_DURATION_DAYS - 1);
  });

  it("returns status='expired' after TRIAL_DURATION_DAYS elapsed", () => {
    const startDate = new Date(Date.now() - TRIAL_DURATION_DAYS * 86400000).toISOString();
    const s = computeTrialState({ startDate });
    expect(s.status).toBe("expired");
    expect(s.remainingDays).toBe(0);
  });

  it("remainingDays never goes negative", () => {
    const startDate = new Date(Date.now() - 365 * 86400000).toISOString();
    const s = computeTrialState({ startDate });
    expect(s.remainingDays).toBeGreaterThanOrEqual(0);
  });

  it("active trial at day 10 has remainingDays == 20", () => {
    const startDate = new Date(Date.now() - 10 * 86400000).toISOString();
    const s = computeTrialState({ startDate });
    expect(s.status).toBe("active");
    // floor arithmetic: should be 20 (within ±1 for sub-second variance)
    expect(s.remainingDays).toBeGreaterThanOrEqual(19);
    expect(s.remainingDays).toBeLessThanOrEqual(20);
  });
});

// ─── 3. computeTrialProgressTarget (actual import) ────────────────────────────

describe("computeTrialProgressTarget — actual import (issue #1472)", () => {
  it("remaining > TRIAL_NUDGE_DAY → targetRemaining == TRIAL_NUDGE_DAY", () => {
    const result = computeTrialProgressTarget(20);
    expect(result).not.toBeNull();
    expect(result!.targetRemaining).toBe(TRIAL_NUDGE_DAY);
  });

  it("remaining == TRIAL_NUDGE_DAY → targetRemaining == 0 (progress to expiry)", () => {
    const result = computeTrialProgressTarget(TRIAL_NUDGE_DAY);
    expect(result).not.toBeNull();
    expect(result!.targetRemaining).toBe(0);
  });

  it("remaining == 1 → targetRemaining == 0", () => {
    const result = computeTrialProgressTarget(1);
    expect(result!.targetRemaining).toBe(0);
  });

  it("remaining == 0 → null (already expired)", () => {
    expect(computeTrialProgressTarget(0)).toBeNull();
  });

  it("remaining < 0 → null (guard handles impossible state)", () => {
    expect(computeTrialProgressTarget(-10)).toBeNull();
  });

  it("nudge target label contains TRIAL_NUDGE_DAY", () => {
    const result = computeTrialProgressTarget(TRIAL_DURATION_DAYS);
    expect(result!.label).toContain(String(TRIAL_NUDGE_DAY));
  });

  it("expiry target label contains 'Expiry' or 'expiry'", () => {
    const result = computeTrialProgressTarget(5);
    expect(result!.label.toLowerCase()).toContain("expiry");
  });
});

// ─── 4. startDateForRemaining (actual import) ─────────────────────────────────

describe("startDateForRemaining — actual import (issue #1472)", () => {
  it("returns a valid ISO string", () => {
    const iso = startDateForRemaining(15);
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it("remaining=0 → startDate is TRIAL_DURATION_DAYS ago", () => {
    const iso = startDateForRemaining(0);
    const daysAgo = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    expect(daysAgo).toBe(TRIAL_DURATION_DAYS);
  });

  it("remaining=TRIAL_DURATION_DAYS → startDate is today", () => {
    const iso = startDateForRemaining(TRIAL_DURATION_DAYS);
    const daysAgo = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    expect(daysAgo).toBe(0);
  });

  it("roundtrip: computeTrialState(startDateForRemaining(N)).remainingDays == N", () => {
    const target = 12;
    const iso = startDateForRemaining(target);
    const s = computeTrialState({ startDate: iso });
    expect(s.remainingDays).toBe(target);
    expect(s.status).toBe("active");
  });
});

// ─── 5. describeTrialState (actual import) ────────────────────────────────────

describe("describeTrialState — actual import (issue #1472)", () => {
  it("status='none' → 'no trial'", () => {
    expect(describeTrialState({ status: "none", remainingDays: 0 })).toBe("no trial");
  });

  it("status='converted' → 'converted (Karl)'", () => {
    expect(describeTrialState({ status: "converted", remainingDays: 0 })).toBe("converted (Karl)");
  });

  it("status='expired' → 'expired — 0 days remaining'", () => {
    expect(describeTrialState({ status: "expired", remainingDays: 0 })).toBe("expired — 0 days remaining");
  });

  it("status='active' with 20 days → 'active — 20d remaining'", () => {
    expect(describeTrialState({ status: "active", remainingDays: 20 })).toBe("active — 20d remaining");
  });

  it("status='active' with 1 day → 'active — 1d remaining'", () => {
    expect(describeTrialState({ status: "active", remainingDays: 1 })).toBe("active — 1d remaining");
  });

  it("status='active' uses status string directly (not hardcoded)", () => {
    const s: TrialState = { status: "active", remainingDays: 7 };
    const desc = describeTrialState(s);
    expect(desc).toContain(s.status);
    expect(desc).toContain(String(s.remainingDays));
  });
});

// ─── 6. Registry: trial commands registered ───────────────────────────────────

describe("registry: registerTrialCommands integration (issue #1472)", () => {
  beforeEach(() => {
    // Register trial commands fresh for each test
    registerTrialCommands();
  });

  it("getCommands() includes trial-adjust", () => {
    const names = getCommands().map((c) => c.name);
    expect(names).toContain("trial-adjust");
  });

  it("getCommands() includes trial-complete", () => {
    const names = getCommands().map((c) => c.name);
    expect(names).toContain("trial-complete");
  });

  it("getCommands() includes trial-progress", () => {
    const names = getCommands().map((c) => c.name);
    expect(names).toContain("trial-progress");
  });

  it("trial-adjust has subsystem='trial'", () => {
    const cmd = getCommands().find((c) => c.name === "trial-adjust");
    expect(cmd?.subsystem).toBe("trial");
  });

  it("trial-complete has subsystem='trial'", () => {
    const cmd = getCommands().find((c) => c.name === "trial-complete");
    expect(cmd?.subsystem).toBe("trial");
  });

  it("trial-progress has subsystem='trial'", () => {
    const cmd = getCommands().find((c) => c.name === "trial-progress");
    expect(cmd?.subsystem).toBe("trial");
  });

  it("trial-adjust has needsInput=true", () => {
    const cmd = getCommands().find((c) => c.name === "trial-adjust");
    expect(cmd?.needsInput).toBe(true);
  });

  it("trial-complete does NOT have needsInput (no input required)", () => {
    const cmd = getCommands().find((c) => c.name === "trial-complete");
    expect(cmd?.needsInput).toBeFalsy();
  });

  it("trial-progress does NOT have needsInput", () => {
    const cmd = getCommands().find((c) => c.name === "trial-progress");
    expect(cmd?.needsInput).toBeFalsy();
  });

  it("all trial commands have requiresContext='trial'", () => {
    const trialCmds = getCommands().filter((c) => c.subsystem === "trial");
    for (const cmd of trialCmds) {
      expect(cmd.requiresContext).toBe("trial");
    }
  });

  it("all trial commands have non-empty descriptions", () => {
    const trialCmds = getCommands().filter((c) => c.subsystem === "trial");
    expect(trialCmds.length).toBeGreaterThanOrEqual(3);
    for (const cmd of trialCmds) {
      expect(cmd.desc.length).toBeGreaterThan(0);
    }
  });
});

// ─── 7. Registry: isAvailable with trial context ──────────────────────────────

describe("isAvailable — trial commands require selectedFp (issue #1472)", () => {
  const ctxWithFp: CommandContext = {
    selectedUserId: null,
    selectedHouseholdId: null,
    selectedFp: "fp-abc123",
    selectedSubId: null,
  };
  const ctxWithoutFp: CommandContext = {
    selectedUserId: null,
    selectedHouseholdId: null,
    selectedFp: null,
    selectedSubId: null,
  };

  beforeEach(() => {
    registerTrialCommands();
  });

  it("trial-adjust is available when selectedFp is set", () => {
    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    expect(isAvailable(cmd, ctxWithFp)).toBe(true);
  });

  it("trial-adjust is NOT available when selectedFp is null", () => {
    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    expect(isAvailable(cmd, ctxWithoutFp)).toBe(false);
  });

  it("trial-complete is available when selectedFp is set", () => {
    const cmd = getCommands().find((c) => c.name === "trial-complete")!;
    expect(isAvailable(cmd, ctxWithFp)).toBe(true);
  });

  it("trial-complete is NOT available without selectedFp", () => {
    const cmd = getCommands().find((c) => c.name === "trial-complete")!;
    expect(isAvailable(cmd, ctxWithoutFp)).toBe(false);
  });

  it("trial-progress is available when selectedFp is set", () => {
    const cmd = getCommands().find((c) => c.name === "trial-progress")!;
    expect(isAvailable(cmd, ctxWithFp)).toBe(true);
  });

  it("trial-progress is NOT available without selectedFp", () => {
    const cmd = getCommands().find((c) => c.name === "trial-progress")!;
    expect(isAvailable(cmd, ctxWithoutFp)).toBe(false);
  });
});

// ─── 8. Registry: fuzzyMatch and filterCommands ───────────────────────────────

describe("fuzzyMatch + filterCommands — trial commands discoverable (issue #1472)", () => {
  beforeEach(() => {
    registerTrialCommands();
  });

  it("fuzzyMatch('trial-adjust', 'trial') returns true", () => {
    expect(fuzzyMatch("trial-adjust", "trial")).toBe(true);
  });

  it("fuzzyMatch('trial-complete', 'tc') returns true (chars in order)", () => {
    expect(fuzzyMatch("trial-complete", "tc")).toBe(true);
  });

  it("fuzzyMatch('', '') returns true (empty needle always matches)", () => {
    expect(fuzzyMatch("", "")).toBe(true);
  });

  it("fuzzyMatch('trial-adjust', 'xyz') returns false", () => {
    expect(fuzzyMatch("trial-adjust", "xyz")).toBe(false);
  });

  it("filterCommands('trial') returns all three trial commands", () => {
    const results = filterCommands("trial");
    const names = results.map((c) => c.name);
    expect(names).toContain("trial-adjust");
    expect(names).toContain("trial-complete");
    expect(names).toContain("trial-progress");
  });

  it("filterCommands('') returns all registered commands", () => {
    const all = filterCommands("");
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it("filterCommands('trial-c') matches trial-complete", () => {
    const results = filterCommands("trial-c");
    const names = results.map((c) => c.name);
    expect(names).toContain("trial-complete");
  });

  it("filterCommands('tadj') fuzzy-matches trial-adjust", () => {
    const results = filterCommands("tadj");
    const names = results.map((c) => c.name);
    expect(names).toContain("trial-adjust");
  });
});

// ─── 9. trial-adjust execute: error paths ─────────────────────────────────────

describe("trial-adjust execute — error paths (issue #1472)", () => {
  beforeEach(() => {
    mockFirestoreClient = null; // no Firestore client by default
    registerTrialCommands();
  });

  afterEach(() => {
    mockFirestoreClient = null;
  });

  it("returns ERROR when Firestore client is not connected", async () => {
    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
      input: "+5",
    });
    expect(result[0]).toMatch(/ERROR.*Firestore/i);
  });

  it("returns ERROR when selectedFp is null (no trial selected)", async () => {
    mockFirestoreClient = buildMockFirestore(null).fs;
    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: null,
      selectedSubId: null,
      input: "+5",
    });
    expect(result[0]).toMatch(/ERROR.*[Nn]o trial selected/);
  });

  it("returns ERROR when input is missing", async () => {
    mockFirestoreClient = buildMockFirestore(null).fs;
    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
    });
    expect(result[0]).toMatch(/ERROR/);
  });

  it("returns ERROR for zero input", async () => {
    mockFirestoreClient = buildMockFirestore(null).fs;
    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
      input: "0",
    });
    expect(result[0]).toMatch(/ERROR/);
  });

  it("returns ERROR for non-numeric input", async () => {
    mockFirestoreClient = buildMockFirestore(null).fs;
    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
      input: "abc",
    });
    expect(result[0]).toMatch(/ERROR/);
  });
});

// ─── 10. trial-adjust execute: success path ───────────────────────────────────

describe("trial-adjust execute — success path with mocked Firestore (issue #1472)", () => {
  beforeEach(() => {
    registerTrialCommands();
  });

  afterEach(() => {
    mockFirestoreClient = null;
  });

  it("+5 on a 20-day-remaining trial → result contains 'Was:' and 'Now:'", async () => {
    const startDate = startDateForRemaining(20);
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
      input: "+5",
    });

    expect(result[0]).toContain("trial-adjust");
    expect(result[0]).toContain("+5");
    expect(result[1]).toMatch(/^Was:/);
    expect(result[2]).toMatch(/^Now:/);
  });

  it("+5 on 20-remaining → now line contains 15d remaining", async () => {
    const startDate = startDateForRemaining(20);
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
      input: "+5",
    });

    expect(result[2]).toContain("15d remaining");
  });

  it("-5 on 20-remaining trial → now line shows more remaining days", async () => {
    const startDate = startDateForRemaining(20);
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
      input: "-5",
    });

    expect(result[2]).toContain("25d remaining");
  });

  it("existing trial null (no doc) uses current time as base and creates doc via set", async () => {
    const { fs, docRef } = buildMockFirestore(null);
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-new",
      selectedSubId: null,
      input: "+10",
    });

    // Since doc doesn't exist, writeTrialStartDate calls set() not update()
    expect(docRef.set).toHaveBeenCalledOnce();
    expect(docRef.update).not.toHaveBeenCalled();
  });

  it("existing trial doc → uses update() not set()", async () => {
    const startDate = startDateForRemaining(15);
    const { fs, docRef } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-existing",
      selectedSubId: null,
      input: "+3",
    });

    expect(docRef.update).toHaveBeenCalledOnce();
    expect(docRef.set).not.toHaveBeenCalled();
  });
});

// ─── 11. trial-complete execute: error paths ──────────────────────────────────

describe("trial-complete execute — error paths (issue #1472)", () => {
  beforeEach(() => {
    mockFirestoreClient = null;
    registerTrialCommands();
  });

  afterEach(() => {
    mockFirestoreClient = null;
  });

  it("returns ERROR when Firestore not connected", async () => {
    const cmd = getCommands().find((c) => c.name === "trial-complete")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
    });
    expect(result[0]).toMatch(/ERROR.*Firestore/i);
  });

  it("returns ERROR when selectedFp is null", async () => {
    mockFirestoreClient = buildMockFirestore(null).fs;
    const cmd = getCommands().find((c) => c.name === "trial-complete")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: null,
      selectedSubId: null,
    });
    expect(result[0]).toMatch(/ERROR.*[Nn]o trial selected/);
  });
});

// ─── 12. trial-complete execute: success paths ────────────────────────────────

describe("trial-complete execute — success paths (issue #1472)", () => {
  beforeEach(() => {
    registerTrialCommands();
  });

  afterEach(() => {
    mockFirestoreClient = null;
  });

  it("active trial → result[0] contains 'trial-complete applied'", async () => {
    const startDate = startDateForRemaining(20);
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-complete")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-active",
      selectedSubId: null,
    });

    expect(result[0]).toBe("trial-complete applied");
  });

  it("active trial → result[2] is 'Now: expired — 0 days remaining'", async () => {
    const startDate = startDateForRemaining(10);
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-complete")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-active",
      selectedSubId: null,
    });

    expect(result[2]).toBe("Now: expired — 0 days remaining");
  });

  it("already-expired trial (idempotent) → still returns 'trial-complete applied'", async () => {
    const startDate = new Date(Date.now() - (TRIAL_DURATION_DAYS + 5) * 86400000).toISOString();
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-complete")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-expired",
      selectedSubId: null,
    });

    expect(result[0]).toBe("trial-complete applied");
    // Was line should reflect expired state
    expect(result[1]).toContain("expired");
    expect(result[2]).toBe("Now: expired — 0 days remaining");
  });

  it("trial-complete always writes startDate > TRIAL_DURATION_DAYS ago", async () => {
    const startDate = startDateForRemaining(25);
    const { fs, docRef } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-complete")!;
    await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-complete",
      selectedSubId: null,
    });

    expect(docRef.update).toHaveBeenCalledOnce();
    const call0 = docRef.update.mock.calls[0] as [{ startDate: string }];
    const writtenStart: string = call0[0].startDate;
    const daysAgo = Math.floor((Date.now() - new Date(writtenStart).getTime()) / 86400000);
    expect(daysAgo).toBeGreaterThanOrEqual(TRIAL_DURATION_DAYS);
  });
});

// ─── 13. trial-progress execute: error paths ──────────────────────────────────

describe("trial-progress execute — error paths (issue #1472)", () => {
  beforeEach(() => {
    mockFirestoreClient = null;
    registerTrialCommands();
  });

  afterEach(() => {
    mockFirestoreClient = null;
  });

  it("returns ERROR when Firestore not connected", async () => {
    const cmd = getCommands().find((c) => c.name === "trial-progress")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
    });
    expect(result[0]).toMatch(/ERROR.*Firestore/i);
  });

  it("returns ERROR when selectedFp is null", async () => {
    mockFirestoreClient = buildMockFirestore(null).fs;
    const cmd = getCommands().find((c) => c.name === "trial-progress")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: null,
      selectedSubId: null,
    });
    expect(result[0]).toMatch(/ERROR.*[Nn]o trial selected/);
  });
});

// ─── 14. trial-progress execute: success paths ────────────────────────────────

describe("trial-progress execute — success paths (issue #1472)", () => {
  beforeEach(() => {
    registerTrialCommands();
  });

  afterEach(() => {
    mockFirestoreClient = null;
  });

  it("remaining > TRIAL_NUDGE_DAY → advances to day-15 nudge, result contains label", async () => {
    const startDate = startDateForRemaining(20); // 20 remaining → target = nudge (15)
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-progress")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-active",
      selectedSubId: null,
    });

    expect(result[0]).toContain("trial-progress applied");
    expect(result[0]).toMatch(/[Dd]ay.?15|nudge/i);
  });

  it("remaining <= TRIAL_NUDGE_DAY → advances to expiry, Now line shows expired", async () => {
    const startDate = startDateForRemaining(10); // 10 remaining → target = 0 (expiry)
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-progress")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-near-expiry",
      selectedSubId: null,
    });

    expect(result[0]).toContain("trial-progress applied");
    expect(result[2]).toContain("expired");
  });

  it("already expired (remaining = 0) → returns 'Trial already expired' without writing", async () => {
    const startDate = new Date(Date.now() - (TRIAL_DURATION_DAYS + 2) * 86400000).toISOString();
    const { fs, docRef } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-progress")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-expired",
      selectedSubId: null,
    });

    expect(result[0]).toMatch(/Trial already expired/i);
    // Should NOT write anything to Firestore
    expect(docRef.update).not.toHaveBeenCalled();
    expect(docRef.set).not.toHaveBeenCalled();
  });

  it("null trial doc treated as status='none', target computed from 0 remaining → already expired path", async () => {
    const { fs, docRef } = buildMockFirestore(null);
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-progress")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-none",
      selectedSubId: null,
    });

    // computeTrialState(null) = { status: "none", remainingDays: 0 }
    // computeTrialProgressTarget(0) = null → already expired branch
    expect(result[0]).toMatch(/Trial already expired/i);
    expect(docRef.update).not.toHaveBeenCalled();
  });

  it("progress from 20 remaining → writes new startDate 15 days ago", async () => {
    const startDate = startDateForRemaining(20);
    const { fs, docRef } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-progress")!;
    await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-progress",
      selectedSubId: null,
    });

    expect(docRef.update).toHaveBeenCalledOnce();
    const call0 = docRef.update.mock.calls[0] as [{ startDate: string }];
    const writtenStart: string = call0[0].startDate;
    // Should be TRIAL_DURATION_DAYS - TRIAL_NUDGE_DAY days ago = 15 days ago
    const daysAgo = Math.floor((Date.now() - new Date(writtenStart).getTime()) / 86400000);
    expect(daysAgo).toBe(TRIAL_DURATION_DAYS - TRIAL_NUDGE_DAY);
  });
});

// ─── 15. describeTrialState composition: Was/Now lines ────────────────────────

describe("Was/Now line composition in execute results (issue #1472)", () => {
  beforeEach(() => {
    registerTrialCommands();
  });

  afterEach(() => {
    mockFirestoreClient = null;
  });

  it("trial-adjust Was line contains description of old state", async () => {
    const startDate = startDateForRemaining(20);
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-adjust")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
      input: "+5",
    });

    expect(result[1]).toBe(`Was: ${describeTrialState(computeTrialState({ startDate }))}`);
  });

  it("trial-complete Was line correctly describes an active trial", async () => {
    const startDate = startDateForRemaining(15);
    const { fs } = buildMockFirestore({ startDate });
    mockFirestoreClient = fs;

    const cmd = getCommands().find((c) => c.name === "trial-complete")!;
    const result = await cmd.execute({
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: "fp-test",
      selectedSubId: null,
    });

    expect(result[1]).toContain("active");
    expect(result[1]).toContain("15d remaining");
  });
});
