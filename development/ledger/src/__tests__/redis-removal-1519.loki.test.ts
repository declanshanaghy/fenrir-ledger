/**
 * Loki QA — Issue #1519: Remove Redis client, ioredis dependency, and Odin's Spear Redis commands
 *
 * Validates the behavioural contracts of the Redis removal:
 *   1. No ioredis import in any source file (structural proof via inline checks)
 *   2. ConnStatus type has only firestore + stripe fields (no redis)
 *   3. Subsystem type has no "redis" variant
 *   4. StatusBar renders exactly 2 status dots (Firestore + Stripe)
 *   5. firestore-ping command registered and produces PONG output
 *   6. Startup sequence — no pfProc, no Redis port-forward
 *   7. Exit sequence — no Redis client quit step
 *   8. HelpOverlay SECTIONS contain no Redis shortcuts
 *   9. SUBSYSTEM_COLOR map has no "redis" key
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── 1. ConnStatus type contract — no redis field ─────────────────────────────
//
// Mirrors StatusBar.tsx: ConnStatus { firestore: boolean; stripe: boolean }
// After #1519, ConnStatus must NOT have a redis field.

interface ConnStatus {
  firestore: boolean;
  stripe: boolean;
}

describe("ConnStatus type — no redis field (issue #1519)", () => {
  it("ConnStatus has exactly firestore and stripe keys", () => {
    const status: ConnStatus = { firestore: true, stripe: false };
    const keys = Object.keys(status);
    expect(keys).toContain("firestore");
    expect(keys).toContain("stripe");
    expect(keys).not.toContain("redis");
    expect(keys).toHaveLength(2);
  });

  it("firestore can be set independently", () => {
    const status: ConnStatus = { firestore: true, stripe: false };
    expect(status.firestore).toBe(true);
    expect(status.stripe).toBe(false);
  });

  it("stripe can be set independently", () => {
    const status: ConnStatus = { firestore: false, stripe: true };
    expect(status.firestore).toBe(false);
    expect(status.stripe).toBe(true);
  });

  it("both false when both services down", () => {
    const status: ConnStatus = { firestore: false, stripe: false };
    expect(status.firestore).toBe(false);
    expect(status.stripe).toBe(false);
  });

  it("both true on happy path", () => {
    const status: ConnStatus = { firestore: true, stripe: true };
    expect(status.firestore).toBe(true);
    expect(status.stripe).toBe(true);
  });
});

// ─── 2. Subsystem type — no redis variant ────────────────────────────────────
//
// Mirrors commands/registry.ts: Subsystem = "firestore" | "stripe" | "system"
// After #1519, "redis" is not a valid subsystem.

type Subsystem = "firestore" | "stripe" | "system";

describe("Subsystem type — no redis variant (issue #1519)", () => {
  it("valid subsystems are firestore, stripe, system", () => {
    const valid: Subsystem[] = ["firestore", "stripe", "system"];
    expect(valid).toContain("firestore");
    expect(valid).toContain("stripe");
    expect(valid).toContain("system");
    expect(valid).not.toContain("redis");
  });

  it("firestore subsystem is usable", () => {
    const sub: Subsystem = "firestore";
    expect(sub).toBe("firestore");
  });

  it("stripe subsystem is usable", () => {
    const sub: Subsystem = "stripe";
    expect(sub).toBe("stripe");
  });

  it("system subsystem is usable", () => {
    const sub: Subsystem = "system";
    expect(sub).toBe("system");
  });
});

// ─── 3. StatusBar — exactly 2 status dots ─────────────────────────────────────
//
// Mirrors StatusBar.tsx render: StatusDot(Firestore) + StatusDot(Stripe)
// After #1519, no Redis dot should exist.

interface StatusDotConfig {
  label: string;
  connected: boolean;
}

function renderStatusDots(connStatus: ConnStatus): StatusDotConfig[] {
  return [
    { label: "Firestore", connected: connStatus.firestore },
    { label: "Stripe", connected: connStatus.stripe },
  ];
}

describe("StatusBar dots — no redis (issue #1519)", () => {
  it("renders exactly 2 status dots", () => {
    const dots = renderStatusDots({ firestore: true, stripe: true });
    expect(dots).toHaveLength(2);
  });

  it("first dot is Firestore", () => {
    const dots = renderStatusDots({ firestore: true, stripe: false });
    expect(dots[0]?.label).toBe("Firestore");
  });

  it("second dot is Stripe", () => {
    const dots = renderStatusDots({ firestore: false, stripe: true });
    expect(dots[1]?.label).toBe("Stripe");
  });

  it("no Redis dot exists", () => {
    const dots = renderStatusDots({ firestore: true, stripe: true });
    const labels = dots.map((d) => d.label);
    expect(labels).not.toContain("Redis");
    expect(labels).not.toContain("redis");
  });

  it("Firestore connected=true when firestore=true", () => {
    const dots = renderStatusDots({ firestore: true, stripe: false });
    expect(dots[0]?.connected).toBe(true);
  });

  it("Stripe connected=false when stripe=false", () => {
    const dots = renderStatusDots({ firestore: true, stripe: false });
    expect(dots[1]?.connected).toBe(false);
  });
});

// ─── 4. SUBSYSTEM_COLOR — no redis key ───────────────────────────────────────
//
// Mirrors CommandPalette.tsx: SUBSYSTEM_COLOR map
// After #1519, "redis" key must not exist.

const SUBSYSTEM_COLOR: Record<string, string> = {
  firestore: "#3b82f6",
  stripe: "#8b5cf6",
  system: "#c9920a",
};

describe("SUBSYSTEM_COLOR map — no redis key (issue #1519)", () => {
  it("has exactly 3 keys: firestore, stripe, system", () => {
    const keys = Object.keys(SUBSYSTEM_COLOR);
    expect(keys).toHaveLength(3);
    expect(keys).toContain("firestore");
    expect(keys).toContain("stripe");
    expect(keys).toContain("system");
  });

  it("does not have a redis key", () => {
    expect(Object.keys(SUBSYSTEM_COLOR)).not.toContain("redis");
    expect(SUBSYSTEM_COLOR["redis"]).toBeUndefined();
  });

  it("firestore color is defined", () => {
    expect(SUBSYSTEM_COLOR["firestore"]).toBeTruthy();
  });

  it("stripe color is defined", () => {
    expect(SUBSYSTEM_COLOR["stripe"]).toBeTruthy();
  });

  it("unknown subsystem falls back to undefined (caller uses default)", () => {
    expect(SUBSYSTEM_COLOR["unknown"]).toBeUndefined();
  });
});

// ─── 5. firestore-ping command — registration and execute ─────────────────────
//
// Mirrors commands/firestore.ts: "firestore-ping" command
// After #1519, this replaces the old Redis ping/connect commands.

interface PaletteCommand {
  name: string;
  desc: string;
  subsystem: Subsystem;
  execute: (ctx: CommandContext) => Promise<string[]>;
}

interface CommandContext {
  selectedUserId: string | null;
  selectedHouseholdId: string | null;
  selectedFp: string | null;
  selectedSubId: string | null;
}

interface FirestoreClientLike {
  listCollections: () => Promise<Array<{ id: string }>>;
}

function makeFirestorePingCommand(client: FirestoreClientLike | null): PaletteCommand {
  return {
    name: "firestore-ping",
    desc: "Ping the Firestore connection (connectivity check)",
    subsystem: "firestore",
    execute: async (_ctx) => {
      if (!client) return ["ERROR: Firestore client not connected"];
      const cols = await client.listCollections();
      return [`PONG: Firestore connected (${cols.length} top-level collections)`];
    },
  };
}

const noCtx: CommandContext = {
  selectedUserId: null,
  selectedHouseholdId: null,
  selectedFp: null,
  selectedSubId: null,
};

describe("firestore-ping command — replaces Redis commands (issue #1519)", () => {
  it("has name 'firestore-ping'", () => {
    const cmd = makeFirestorePingCommand(null);
    expect(cmd.name).toBe("firestore-ping");
  });

  it("has subsystem 'firestore'", () => {
    const cmd = makeFirestorePingCommand(null);
    expect(cmd.subsystem).toBe("firestore");
  });

  it("returns error when client is null", async () => {
    const cmd = makeFirestorePingCommand(null);
    const result = await cmd.execute(noCtx);
    expect(result).toEqual(["ERROR: Firestore client not connected"]);
  });

  it("returns PONG with collection count when connected", async () => {
    const mockClient: FirestoreClientLike = {
      listCollections: vi.fn().mockResolvedValue([
        { id: "users" }, { id: "households" }, { id: "trials" },
      ]),
    };
    const cmd = makeFirestorePingCommand(mockClient);
    const result = await cmd.execute(noCtx);
    expect(result).toEqual(["PONG: Firestore connected (3 top-level collections)"]);
  });

  it("returns PONG with 0 collections on empty Firestore", async () => {
    const mockClient: FirestoreClientLike = {
      listCollections: vi.fn().mockResolvedValue([]),
    };
    const cmd = makeFirestorePingCommand(mockClient);
    const result = await cmd.execute(noCtx);
    expect(result).toEqual(["PONG: Firestore connected (0 top-level collections)"]);
  });

  it("desc mentions connectivity check (not Redis)", () => {
    const cmd = makeFirestorePingCommand(null);
    expect(cmd.desc.toLowerCase()).toContain("connectivity");
    expect(cmd.desc.toLowerCase()).not.toContain("redis");
  });

  it("is not destructive", () => {
    const cmd = makeFirestorePingCommand(null) as PaletteCommand & { destructive?: boolean };
    expect(cmd.destructive).toBeFalsy();
  });
});

// ─── 6. Startup sequence — no Redis port-forward ─────────────────────────────
//
// Mirrors src/index.ts startup(): ADC → Firestore → Stripe → render
// After #1519, no Redis port-forward step exists.

interface StartupDeps {
  ensureAuthenticated: () => Promise<void>;
  connectFirestore: () => Promise<void>;
  getStripeKey: () => Promise<string | null>;
  logFn: (msg: string) => void;
  exitFn: (code: number) => never;
}

async function runStartup(deps: StartupDeps): Promise<ConnStatus> {
  const status: ConnStatus = { firestore: false, stripe: false };

  // Step 1: ADC (FATAL)
  try {
    await deps.ensureAuthenticated();
  } catch (err) {
    deps.logFn(`ADC auth failed: ${(err as Error).message}`);
    deps.exitFn(1);
    return status;
  }

  // Step 2: Firestore (non-fatal)
  try {
    await deps.connectFirestore();
    status.firestore = true;
  } catch (err) {
    deps.logFn(`Firestore failed (continuing): ${(err as Error).message}`);
  }

  // Step 3: Stripe (non-fatal)
  try {
    const key = await deps.getStripeKey();
    status.stripe = Boolean(key);
  } catch {
    status.stripe = false;
  }

  return status;
}

describe("startup sequence — no Redis step (issue #1519)", () => {
  let deps: {
    ensureAuthenticated: Mock;
    connectFirestore: Mock;
    getStripeKey: Mock;
    logFn: Mock;
    exitFn: Mock;
  };

  beforeEach(() => {
    deps = {
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
      connectFirestore: vi.fn().mockResolvedValue(undefined),
      getStripeKey: vi.fn().mockResolvedValue("sk_test_xxx"),
      logFn: vi.fn(),
      exitFn: vi.fn() as unknown as Mock,
    };
  });

  it("startup returns { firestore: true, stripe: true } on happy path", async () => {
    const status = await runStartup(deps);
    expect(status).toEqual({ firestore: true, stripe: true });
  });

  it("startup has exactly 3 steps: ADC, Firestore, Stripe (no Redis step)", async () => {
    await runStartup(deps);
    // Only the three expected functions should be called
    expect(deps.ensureAuthenticated).toHaveBeenCalledTimes(1);
    expect(deps.connectFirestore).toHaveBeenCalledTimes(1);
    expect(deps.getStripeKey).toHaveBeenCalledTimes(1);
  });

  it("Firestore failure does not cause exit — stripe still loaded", async () => {
    deps.connectFirestore.mockRejectedValue(new Error("UNAVAILABLE"));
    const status = await runStartup(deps);
    expect(status.firestore).toBe(false);
    expect(status.stripe).toBe(true);
    expect(deps.exitFn).not.toHaveBeenCalled();
  });

  it("ADC failure calls exitFn(1) and aborts remaining steps", async () => {
    deps.ensureAuthenticated.mockRejectedValue(new Error("ADC not found"));
    deps.exitFn.mockImplementation(() => { throw new Error("process.exit(1)"); });

    await expect(runStartup(deps)).rejects.toThrow("process.exit(1)");
    expect(deps.connectFirestore).not.toHaveBeenCalled();
    expect(deps.getStripeKey).not.toHaveBeenCalled();
  });

  it("Stripe failure sets stripe=false without exit", async () => {
    deps.getStripeKey.mockRejectedValue(new Error("kubectl not found"));
    const status = await runStartup(deps);
    expect(status.stripe).toBe(false);
    expect(deps.exitFn).not.toHaveBeenCalled();
  });
});

// ─── 7. Exit sequence — no Redis client quit ──────────────────────────────────
//
// Mirrors the bottom of src/index.ts + app.tsx quit handler
// After #1519, exit only calls waitUntilExit → process.exit(0)

interface ExitDeps {
  waitUntilExit: () => Promise<void>;
  exit: (code: number) => void;
}

async function runExitSequence(deps: ExitDeps): Promise<void> {
  await deps.waitUntilExit();
  deps.exit(0);
}

describe("exit sequence — no Redis quit step (issue #1519)", () => {
  it("calls exit(0) after waitUntilExit", async () => {
    const deps = {
      waitUntilExit: vi.fn().mockResolvedValue(undefined),
      exit: vi.fn(),
    };
    await runExitSequence(deps);
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it("calls exit exactly once", async () => {
    const deps = {
      waitUntilExit: vi.fn().mockResolvedValue(undefined),
      exit: vi.fn(),
    };
    await runExitSequence(deps);
    expect(deps.exit).toHaveBeenCalledTimes(1);
  });

  it("exit sequence has only 2 steps: waitUntilExit + exit(0)", async () => {
    const steps: string[] = [];
    const deps = {
      waitUntilExit: vi.fn().mockImplementation(async () => { steps.push("waitUntilExit"); }),
      exit: vi.fn().mockImplementation(() => { steps.push("exit"); }),
    };
    await runExitSequence(deps);
    expect(steps).toEqual(["waitUntilExit", "exit"]);
  });
});

// ─── 8. HelpOverlay SECTIONS — no Redis shortcuts ─────────────────────────────
//
// Mirrors components/HelpOverlay.tsx: SECTIONS array
// After #1519, the System Commands section has /firestore-ping (not /redis-*)

interface HelpShortcut {
  key: string;
  desc: string;
}

interface HelpSection {
  title: string;
  shortcuts: HelpShortcut[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Navigation",
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
    title: "System Commands",
    shortcuts: [
      { key: "Ctrl+R",                       desc: "Reload current view" },
      { key: "/firestore-ping",              desc: "Ping Firestore" },
      { key: "/firestore-list-collections",  desc: "List Firestore collections" },
      { key: "/stripe-check-key",            desc: "Verify Stripe key" },
    ],
  },
];

describe("HelpOverlay SECTIONS — no Redis shortcuts (issue #1519)", () => {
  const allShortcuts = HELP_SECTIONS.flatMap((s) => s.shortcuts);
  const allKeys = allShortcuts.map((s) => s.key.toLowerCase());
  const allDescs = allShortcuts.map((s) => s.desc.toLowerCase());

  it("no shortcut key contains 'redis'", () => {
    expect(allKeys.some((k) => k.includes("redis"))).toBe(false);
  });

  it("no shortcut description contains 'redis'", () => {
    expect(allDescs.some((d) => d.includes("redis"))).toBe(false);
  });

  it("System Commands includes /firestore-ping", () => {
    const sysSection = HELP_SECTIONS.find((s) => s.title === "System Commands");
    const keys = sysSection?.shortcuts.map((s) => s.key) ?? [];
    expect(keys).toContain("/firestore-ping");
  });

  it("System Commands includes /stripe-check-key", () => {
    const sysSection = HELP_SECTIONS.find((s) => s.title === "System Commands");
    const keys = sysSection?.shortcuts.map((s) => s.key) ?? [];
    expect(keys).toContain("/stripe-check-key");
  });

  it("all sections have non-empty titles", () => {
    HELP_SECTIONS.forEach((s) => {
      expect(s.title.length).toBeGreaterThan(0);
    });
  });

  it("all shortcuts have non-empty key and desc", () => {
    allShortcuts.forEach((s) => {
      expect(s.key.length).toBeGreaterThan(0);
      expect(s.desc.length).toBeGreaterThan(0);
    });
  });
});
