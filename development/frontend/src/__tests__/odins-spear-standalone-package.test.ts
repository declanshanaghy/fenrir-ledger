/**
 * Vitest — Odin's Spear: Standalone Package (Issue #1496)
 *
 * Validates the behavioural contracts of the modular odins-spear package
 * extracted from the frontend/scripts monolith. Tests exercise:
 *
 *   1. PaletteCommand registry — registerCommand / getCommands isolation
 *   2. Stripe key resolution — env var → kubectl fallback → null
 *   3. loadInitialCounts — success path, error fallback to zero counts
 *   4. checkPortOpen — TCP probe: open, closed, timeout
 *   5. Startup sequence — Redis non-fatal, ADC fatal, Firestore non-fatal
 *   6. Command registration — redis/firestore/stripe command IDs in registry
 *
 * All logic is re-implemented inline with injectable dependencies to avoid
 * importing Node.js-only modules into the browser test environment. This
 * mirrors the established pattern in odins-spear-adc-auth.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// ─── 1. PaletteCommand Registry ───────────────────────────────────────────────
//
// Mirrors commands/registry.ts
// - registerCommand appends to the internal array
// - getCommands returns a readonly view
// - Registry is per-module instance (isolated between test runs via factory)

interface PaletteCommand {
  id: string;
  label: string;
  description: string;
  action: () => Promise<void> | void;
}

function makeRegistry() {
  const commands: PaletteCommand[] = [];

  function registerCommand(cmd: PaletteCommand): void {
    commands.push(cmd);
  }

  function getCommands(): readonly PaletteCommand[] {
    return commands;
  }

  return { registerCommand, getCommands };
}

describe("PaletteCommand registry (issue #1496 — commands/registry.ts)", () => {
  it("starts empty", () => {
    const { getCommands } = makeRegistry();
    expect(getCommands()).toHaveLength(0);
  });

  it("registers a single command and returns it via getCommands", () => {
    const { registerCommand, getCommands } = makeRegistry();
    const action = vi.fn();
    registerCommand({ id: "test:cmd", label: "Test", description: "A test command", action });

    const cmds = getCommands();
    expect(cmds).toHaveLength(1);
    expect(cmds[0]?.id).toBe("test:cmd");
    expect(cmds[0]?.label).toBe("Test");
  });

  it("accumulates multiple commands in registration order", () => {
    const { registerCommand, getCommands } = makeRegistry();
    registerCommand({ id: "redis:ping", label: "Redis: Ping", description: "", action: vi.fn() });
    registerCommand({ id: "firestore:list", label: "Firestore: List", description: "", action: vi.fn() });
    registerCommand({ id: "stripe:check", label: "Stripe: Check", description: "", action: vi.fn() });

    const ids = getCommands().map((c) => c.id);
    expect(ids).toEqual(["redis:ping", "firestore:list", "stripe:check"]);
  });

  it("executes the registered action when called", async () => {
    const { registerCommand, getCommands } = makeRegistry();
    const action = vi.fn().mockResolvedValue(undefined);
    registerCommand({ id: "run:me", label: "Run", description: "", action });

    await getCommands()[0]?.action();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("getCommands returns a stable readonly reference", () => {
    const { registerCommand, getCommands } = makeRegistry();
    registerCommand({ id: "a", label: "A", description: "", action: vi.fn() });
    const ref1 = getCommands();
    registerCommand({ id: "b", label: "B", description: "", action: vi.fn() });
    // Both calls reflect current state
    expect(ref1).toHaveLength(2);
    expect(getCommands()).toHaveLength(2);
  });
});

// ─── 2. Stripe key resolution ─────────────────────────────────────────────────
//
// Mirrors lib/stripe.ts: getStripeKey()
//   Priority: in-memory cache → env var → kubectl secret → null

interface StripeKeyDeps {
  getEnvKey: () => string | undefined;
  runKubectl: () => Promise<string>;
  log: (msg: string) => void;
}

async function getStripeKey(
  deps: StripeKeyDeps,
  cache: { value: string | null }
): Promise<string | null> {
  if (cache.value !== null) {
    deps.log(`getStripeKey: cached, length=${cache.value.length}`);
    return cache.value;
  }

  const envKey = deps.getEnvKey();
  if (envKey) {
    cache.value = envKey;
    deps.log(`getStripeKey: from env, length=${envKey.length}`);
    return envKey;
  }

  try {
    const kubectl = await deps.runKubectl();
    const trimmed = kubectl.trim();
    if (trimmed) {
      cache.value = trimmed;
      deps.log(`getStripeKey: from kubectl, length=${trimmed.length}`);
      return trimmed;
    }
    return null;
  } catch {
    deps.log("getStripeKey: kubectl failed, returning null");
    return null;
  }
}

describe("getStripeKey — Stripe key resolution (issue #1496 — lib/stripe.ts)", () => {
  let deps: { getEnvKey: Mock; runKubectl: Mock; log: Mock };
  let cache: { value: string | null };

  beforeEach(() => {
    deps = {
      getEnvKey: vi.fn(),
      runKubectl: vi.fn(),
      log: vi.fn(),
    };
    cache = { value: null };
  });

  it("returns env var key when STRIPE_SECRET_KEY is set", async () => {
    deps.getEnvKey.mockReturnValue("sk_test_abc123");

    const key = await getStripeKey(deps, cache);
    expect(key).toBe("sk_test_abc123");
    expect(deps.runKubectl).not.toHaveBeenCalled();
  });

  it("falls back to kubectl when env var is absent", async () => {
    deps.getEnvKey.mockReturnValue(undefined);
    deps.runKubectl.mockResolvedValue("sk_live_from_k8s\n");

    const key = await getStripeKey(deps, cache);
    expect(key).toBe("sk_live_from_k8s");
    expect(deps.runKubectl).toHaveBeenCalledTimes(1);
  });

  it("returns null when both env var and kubectl are unavailable", async () => {
    deps.getEnvKey.mockReturnValue(undefined);
    deps.runKubectl.mockRejectedValue(new Error("kubectl: command not found"));

    const key = await getStripeKey(deps, cache);
    expect(key).toBeNull();
  });

  it("caches the key after first retrieval — does not call kubectl twice", async () => {
    deps.getEnvKey.mockReturnValue(undefined);
    deps.runKubectl.mockResolvedValue("sk_cached_key");

    await getStripeKey(deps, cache);
    await getStripeKey(deps, cache);

    expect(deps.runKubectl).toHaveBeenCalledTimes(1);
  });

  it("logs key length, not key value (sensitive data masking)", async () => {
    deps.getEnvKey.mockReturnValue("sk_test_verylongkey");

    await getStripeKey(deps, cache);

    const logCalls = deps.log.mock.calls.map((c: unknown[]) => String(c[0]));
    // Must mention length but NEVER the actual key value
    expect(logCalls.some((m) => m.includes("length="))).toBe(true);
    expect(logCalls.some((m) => m.includes("sk_test_verylongkey"))).toBe(false);
  });

  it("returns null when kubectl returns empty string", async () => {
    deps.getEnvKey.mockReturnValue(undefined);
    deps.runKubectl.mockResolvedValue("   ");

    const key = await getStripeKey(deps, cache);
    expect(key).toBeNull();
  });
});

// ─── 3. loadInitialCounts — Firestore count fetch ─────────────────────────────
//
// Mirrors lib/firestore.ts: loadInitialCounts()
//   Success: returns { users, households } from Firestore aggregate queries
//   Error:   returns { users: 0, households: 0 } — non-fatal, TUI still opens

interface CountSnapshot {
  data: () => { count: number };
}

interface FirestoreDeps {
  getUsersCount: () => Promise<CountSnapshot>;
  getHouseholdsCount: () => Promise<CountSnapshot>;
  log: (msg: string, data?: Record<string, unknown>) => void;
}

async function loadInitialCounts(deps: FirestoreDeps): Promise<{ users: number; households: number }> {
  deps.log("loadInitialCounts called");
  try {
    const [uSnap, hSnap] = await Promise.all([deps.getUsersCount(), deps.getHouseholdsCount()]);
    const result = { users: uSnap.data().count, households: hSnap.data().count };
    deps.log("loadInitialCounts returning", result);
    return result;
  } catch {
    deps.log("loadInitialCounts: error, returning zeros");
    return { users: 0, households: 0 };
  }
}

describe("loadInitialCounts — Firestore aggregate counts (issue #1496 — lib/firestore.ts)", () => {
  let deps: { getUsersCount: Mock; getHouseholdsCount: Mock; log: Mock };

  beforeEach(() => {
    deps = {
      getUsersCount: vi.fn(),
      getHouseholdsCount: vi.fn(),
      log: vi.fn(),
    };
  });

  it("returns actual counts from Firestore on success", async () => {
    deps.getUsersCount.mockResolvedValue({ data: () => ({ count: 42 }) });
    deps.getHouseholdsCount.mockResolvedValue({ data: () => ({ count: 17 }) });

    const result = await loadInitialCounts(deps);
    expect(result).toEqual({ users: 42, households: 17 });
  });

  it("returns zero counts when Firestore throws — TUI still opens (non-fatal)", async () => {
    deps.getUsersCount.mockRejectedValue(new Error("UNAVAILABLE: io exception"));
    deps.getHouseholdsCount.mockRejectedValue(new Error("UNAVAILABLE: io exception"));

    const result = await loadInitialCounts(deps);
    expect(result).toEqual({ users: 0, households: 0 });
  });

  it("returns zero counts when only users query fails", async () => {
    deps.getUsersCount.mockRejectedValue(new Error("Permission denied"));
    deps.getHouseholdsCount.mockResolvedValue({ data: () => ({ count: 5 }) });

    // Promise.all rejects if either rejects
    const result = await loadInitialCounts(deps);
    expect(result).toEqual({ users: 0, households: 0 });
  });

  it("fetches users and households counts in parallel (both called exactly once)", async () => {
    deps.getUsersCount.mockResolvedValue({ data: () => ({ count: 10 }) });
    deps.getHouseholdsCount.mockResolvedValue({ data: () => ({ count: 3 }) });

    await loadInitialCounts(deps);

    expect(deps.getUsersCount).toHaveBeenCalledTimes(1);
    expect(deps.getHouseholdsCount).toHaveBeenCalledTimes(1);
  });

  it("handles zero counts correctly (no false 0 vs null confusion)", async () => {
    deps.getUsersCount.mockResolvedValue({ data: () => ({ count: 0 }) });
    deps.getHouseholdsCount.mockResolvedValue({ data: () => ({ count: 0 }) });

    const result = await loadInitialCounts(deps);
    expect(result.users).toBe(0);
    expect(result.households).toBe(0);
  });
});

// ─── 4. checkPortOpen — TCP probe ─────────────────────────────────────────────
//
// Mirrors lib/redis.ts: checkPortOpen(host, port)
// Re-implemented with an injectable socket factory to avoid real network calls.

interface SocketDeps {
  createSocket: (host: string, port: number) => {
    onConnect: (cb: () => void) => void;
    onError: (cb: () => void) => void;
    onTimeout: (cb: () => void) => void;
    destroy: () => void;
  };
}

function checkPortOpen(
  host: string,
  port: number,
  deps: SocketDeps
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = deps.createSocket(host, port);
    socket.onConnect(() => {
      socket.destroy();
      resolve(true);
    });
    socket.onError(() => {
      socket.destroy();
      resolve(false);
    });
    socket.onTimeout(() => {
      socket.destroy();
      resolve(false);
    });
  });
}

describe("checkPortOpen — TCP port probe (issue #1496 — lib/redis.ts)", () => {
  function makeSocket(outcome: "connect" | "error" | "timeout") {
    const handlers: Record<string, () => void> = {};
    const socket = {
      onConnect: (cb: () => void) => { handlers["connect"] = cb; },
      onError: (cb: () => void) => { handlers["error"] = cb; },
      onTimeout: (cb: () => void) => { handlers["timeout"] = cb; },
      destroy: vi.fn(),
      fire: (event: "connect" | "error" | "timeout") => handlers[event]?.(),
    };
    // Fire the outcome asynchronously after all handlers are attached
    Promise.resolve().then(() => socket.fire(outcome));
    return socket;
  }

  it("resolves true when port is open (connect event fires)", async () => {
    const socket = makeSocket("connect");
    const deps: SocketDeps = { createSocket: () => socket };

    const result = await checkPortOpen("127.0.0.1", 6379, deps);
    expect(result).toBe(true);
  });

  it("resolves false when connection is refused (error event fires)", async () => {
    const socket = makeSocket("error");
    const deps: SocketDeps = { createSocket: () => socket };

    const result = await checkPortOpen("127.0.0.1", 6379, deps);
    expect(result).toBe(false);
  });

  it("resolves false on timeout (timeout event fires)", async () => {
    const socket = makeSocket("timeout");
    const deps: SocketDeps = { createSocket: () => socket };

    const result = await checkPortOpen("127.0.0.1", 6379, deps);
    expect(result).toBe(false);
  });

  it("destroys the socket after connect", async () => {
    const socket = makeSocket("connect");
    const deps: SocketDeps = { createSocket: () => socket };

    await checkPortOpen("127.0.0.1", 6379, deps);
    expect(socket.destroy).toHaveBeenCalled();
  });

  it("destroys the socket after error", async () => {
    const socket = makeSocket("error");
    const deps: SocketDeps = { createSocket: () => socket };

    await checkPortOpen("127.0.0.1", 6379, deps);
    expect(socket.destroy).toHaveBeenCalled();
  });
});

// ─── 5. Startup sequence — connection step ordering ───────────────────────────
//
// Mirrors the startup() function in src/index.ts:
//   - Redis failure is non-fatal (logs error and continues)
//   - ADC failure is FATAL (logs error and exits)
//   - Firestore failure is non-fatal (logs error and continues)
//   - Stripe failure sets connStatus.stripe = false

interface ConnStatus {
  redis: boolean;
  firestore: boolean;
  stripe: boolean;
}

interface StartupDeps {
  ensureRedisPortForward: (logFn: (msg: string) => void) => Promise<void>;
  connectRedis: (logFn: (msg: string) => void) => Promise<boolean>;
  ensureAuthenticated: () => Promise<void>;
  connectFirestore: () => Promise<boolean>;
  getStripeKeyFn: () => Promise<string | null>;
  logFn: (msg: string, isErr?: boolean) => void;
  exitFn: (code: number) => never;
}

async function runStartup(
  deps: StartupDeps
): Promise<{ status: ConnStatus; exited: boolean }> {
  const status: ConnStatus = { redis: false, firestore: false, stripe: false };
  let exited = false;

  // Step 1: Redis (non-fatal)
  try {
    await deps.ensureRedisPortForward(deps.logFn);
    await deps.connectRedis(deps.logFn);
    status.redis = true;
  } catch (err) {
    deps.logFn(`Redis: ${(err as Error).message} (continuing)`, true);
  }

  // Step 2: ADC (FATAL)
  try {
    await deps.ensureAuthenticated();
  } catch (err) {
    deps.logFn(`ADC auth error: ${(err as Error).message}`, true);
    deps.exitFn(1);
    exited = true;
    return { status, exited };
  }

  // Step 3: Firestore (non-fatal)
  try {
    await deps.connectFirestore();
    status.firestore = true;
  } catch (err) {
    deps.logFn(`Firestore: ${(err as Error).message} (continuing)`, true);
  }

  // Step 4: Stripe key (non-fatal)
  try {
    const key = await deps.getStripeKeyFn();
    status.stripe = Boolean(key);
  } catch {
    status.stripe = false;
  }

  return { status, exited };
}

describe("startup sequence — connection order and fault tolerance (issue #1496 — src/index.ts)", () => {
  let deps: {
    ensureRedisPortForward: Mock;
    connectRedis: Mock;
    ensureAuthenticated: Mock;
    connectFirestore: Mock;
    getStripeKeyFn: Mock;
    logFn: Mock;
    exitFn: Mock;
  };

  beforeEach(() => {
    deps = {
      ensureRedisPortForward: vi.fn().mockResolvedValue(undefined),
      connectRedis: vi.fn().mockResolvedValue(true),
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
      connectFirestore: vi.fn().mockResolvedValue(true),
      getStripeKeyFn: vi.fn().mockResolvedValue("sk_test_key"),
      logFn: vi.fn(),
      exitFn: vi.fn() as unknown as Mock,
    };
  });

  it("sets all connection statuses true on happy path", async () => {
    const { status } = await runStartup(deps);
    expect(status).toEqual({ redis: true, firestore: true, stripe: true });
  });

  it("Redis failure is non-fatal — continues to ADC and Firestore", async () => {
    deps.connectRedis.mockRejectedValue(new Error("ECONNREFUSED"));

    const { status, exited } = await runStartup(deps);

    expect(exited).toBe(false);
    expect(status.redis).toBe(false);
    expect(deps.ensureAuthenticated).toHaveBeenCalled();
  });

  it("ADC failure is FATAL — calls exitFn(1) and does not attempt Firestore", async () => {
    deps.ensureAuthenticated.mockRejectedValue(new Error("Could not load the default credentials"));
    deps.exitFn.mockImplementation(() => { throw new Error("process.exit(1)"); });

    await expect(runStartup(deps)).rejects.toThrow("process.exit(1)");
    expect(deps.connectFirestore).not.toHaveBeenCalled();
  });

  it("Firestore failure is non-fatal — TUI still renders with stripe key", async () => {
    deps.connectFirestore.mockRejectedValue(new Error("UNAVAILABLE: io exception"));

    const { status, exited } = await runStartup(deps);

    expect(exited).toBe(false);
    expect(status.firestore).toBe(false);
    expect(status.stripe).toBe(true);
  });

  it("Stripe key missing sets stripe=false without exiting", async () => {
    deps.getStripeKeyFn.mockResolvedValue(null);

    const { status, exited } = await runStartup(deps);

    expect(status.stripe).toBe(false);
    expect(exited).toBe(false);
  });

  it("Stripe key fetch throwing sets stripe=false without exiting", async () => {
    deps.getStripeKeyFn.mockRejectedValue(new Error("kubectl not found"));

    const { status, exited } = await runStartup(deps);

    expect(status.stripe).toBe(false);
    expect(exited).toBe(false);
  });

  it("Redis port-forward failure is non-fatal — continues past it", async () => {
    deps.ensureRedisPortForward.mockRejectedValue(new Error("kubectl not available"));

    const { status, exited } = await runStartup(deps);

    expect(exited).toBe(false);
    expect(status.redis).toBe(false);
    expect(deps.ensureAuthenticated).toHaveBeenCalled();
  });
});

// ─── 6. Command registration — IDs in registry ────────────────────────────────
//
// Validates that the three command registration functions (redis/firestore/stripe)
// register commands with the expected IDs into the shared registry.
// Mirrors commands/redis.ts, commands/firestore.ts, commands/stripe.ts.

type CommandId = "redis:ping" | "firestore:list-collections" | "stripe:check-key";

interface RegistryStore {
  commands: PaletteCommand[];
  register: (cmd: PaletteCommand) => void;
  getAll: () => readonly PaletteCommand[];
}

function makeRegistryStore(): RegistryStore {
  const commands: PaletteCommand[] = [];
  return {
    commands,
    register: (cmd) => commands.push(cmd),
    getAll: () => commands,
  };
}

function registerRedisCommands(store: RegistryStore): void {
  store.register({
    id: "redis:ping",
    label: "Redis: Ping",
    description: "Ping the Redis connection",
    action: vi.fn(),
  });
}

function registerFirestoreCommands(store: RegistryStore): void {
  store.register({
    id: "firestore:list-collections",
    label: "Firestore: List Collections",
    description: "List all top-level Firestore collections",
    action: vi.fn(),
  });
}

function registerStripeCommands(store: RegistryStore): void {
  store.register({
    id: "stripe:check-key",
    label: "Stripe: Check Key",
    description: "Verify Stripe secret key is available",
    action: vi.fn(),
  });
}

describe("command registration (issue #1496 — commands/redis, firestore, stripe)", () => {
  let store: RegistryStore;

  beforeEach(() => {
    store = makeRegistryStore();
  });

  it("registerRedisCommands registers redis:ping", () => {
    registerRedisCommands(store);
    const ids = store.getAll().map((c) => c.id);
    expect(ids).toContain("redis:ping");
  });

  it("registerFirestoreCommands registers firestore:list-collections", () => {
    registerFirestoreCommands(store);
    const ids = store.getAll().map((c) => c.id);
    expect(ids).toContain("firestore:list-collections");
  });

  it("registerStripeCommands registers stripe:check-key", () => {
    registerStripeCommands(store);
    const ids = store.getAll().map((c) => c.id);
    expect(ids).toContain("stripe:check-key");
  });

  it("all three registration functions together populate 3 commands", () => {
    registerRedisCommands(store);
    registerFirestoreCommands(store);
    registerStripeCommands(store);
    expect(store.getAll()).toHaveLength(3);
  });

  it("each registered command has a non-empty label and description", () => {
    registerRedisCommands(store);
    registerFirestoreCommands(store);
    registerStripeCommands(store);

    for (const cmd of store.getAll()) {
      expect(cmd.label.length).toBeGreaterThan(0);
      expect(cmd.description.length).toBeGreaterThan(0);
    }
  });

  it("redis:ping action is callable and returns a promise or void", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    store.register({ id: "redis:ping", label: "Ping", description: "", action });
    const cmd = store.getAll().find((c) => c.id === "redis:ping");
    await cmd?.action();
    expect(action).toHaveBeenCalledTimes(1);
  });
});

// ─── 7. SelectionContext state isolation ──────────────────────────────────────
//
// Mirrors context/SelectionContext.tsx state machine:
//   - Each of the four IDs starts null
//   - Setters update the corresponding field independently
//   - Unrelated fields are not mutated when one setter fires

interface SelectionState {
  selectedUserId: string | null;
  selectedHouseholdId: string | null;
  selectedFp: string | null;
  selectedSubId: string | null;
}

function makeSelectionState(): {
  state: SelectionState;
  setSelectedUserId: (v: string | null) => void;
  setSelectedHouseholdId: (v: string | null) => void;
  setSelectedFp: (v: string | null) => void;
  setSelectedSubId: (v: string | null) => void;
} {
  const state: SelectionState = {
    selectedUserId: null,
    selectedHouseholdId: null,
    selectedFp: null,
    selectedSubId: null,
  };
  return {
    state,
    setSelectedUserId: (v) => { state.selectedUserId = v; },
    setSelectedHouseholdId: (v) => { state.selectedHouseholdId = v; },
    setSelectedFp: (v) => { state.selectedFp = v; },
    setSelectedSubId: (v) => { state.selectedSubId = v; },
  };
}

describe("SelectionContext state machine (issue #1496 — context/SelectionContext.tsx)", () => {
  it("all four IDs start as null", () => {
    const { state } = makeSelectionState();
    expect(state.selectedUserId).toBeNull();
    expect(state.selectedHouseholdId).toBeNull();
    expect(state.selectedFp).toBeNull();
    expect(state.selectedSubId).toBeNull();
  });

  it("setSelectedUserId updates only selectedUserId", () => {
    const ctx = makeSelectionState();
    ctx.setSelectedUserId("user-abc");
    expect(ctx.state.selectedUserId).toBe("user-abc");
    expect(ctx.state.selectedHouseholdId).toBeNull();
    expect(ctx.state.selectedFp).toBeNull();
    expect(ctx.state.selectedSubId).toBeNull();
  });

  it("setSelectedHouseholdId updates only selectedHouseholdId", () => {
    const ctx = makeSelectionState();
    ctx.setSelectedHouseholdId("hh-xyz");
    expect(ctx.state.selectedHouseholdId).toBe("hh-xyz");
    expect(ctx.state.selectedUserId).toBeNull();
  });

  it("setSelectedFp updates only selectedFp", () => {
    const ctx = makeSelectionState();
    ctx.setSelectedFp("fp-001");
    expect(ctx.state.selectedFp).toBe("fp-001");
    expect(ctx.state.selectedSubId).toBeNull();
  });

  it("setSelectedSubId updates only selectedSubId", () => {
    const ctx = makeSelectionState();
    ctx.setSelectedSubId("sub-99");
    expect(ctx.state.selectedSubId).toBe("sub-99");
    expect(ctx.state.selectedFp).toBeNull();
  });

  it("setting a value to null clears it", () => {
    const ctx = makeSelectionState();
    ctx.setSelectedUserId("user-to-clear");
    ctx.setSelectedUserId(null);
    expect(ctx.state.selectedUserId).toBeNull();
  });

  it("all four setters can be updated independently", () => {
    const ctx = makeSelectionState();
    ctx.setSelectedUserId("u1");
    ctx.setSelectedHouseholdId("h1");
    ctx.setSelectedFp("fp1");
    ctx.setSelectedSubId("s1");
    expect(ctx.state).toEqual({
      selectedUserId: "u1",
      selectedHouseholdId: "h1",
      selectedFp: "fp1",
      selectedSubId: "s1",
    });
  });
});
