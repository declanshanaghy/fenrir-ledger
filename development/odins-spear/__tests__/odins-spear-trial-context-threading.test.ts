/**
 * Vitest — Odin's Spear: trial-adjust context threading (issue #1600)
 *
 * Verifies that:
 *   1. When a user is selected in UsersTab, selectedFp is resolved via Firestore
 *      reverse-lookup (trials where userId == user.id).
 *   2. When a user has no trial, selectedFp is set to null (not an error).
 *   3. When no user is selected, both selectedUserId and selectedFp are cleared.
 *   4. handleTrialInputConfirm receives selectedFp in the execute context.
 *   5. trial-adjust execute succeeds when selectedFp is provided.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ── Mock @fenrir/logger ────────────────────────────────────────────────────────
vi.mock("@fenrir/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

// ── Mock lib/firestore ─────────────────────────────────────────────────────────
let mockFirestoreClient: unknown = null;
vi.mock("../src/lib/firestore.js", () => ({
  get firestoreClient() {
    return mockFirestoreClient;
  },
}));

import {
  getCommands,
  type CommandContext,
} from "../src/commands/registry.js";
import { registerTrialCommands } from "../src/commands/trial.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTrialFirestore(
  fp: string | null,
  trialDoc: { startDate: string; convertedDate?: string } | null
) {
  const querySnap = fp
    ? {
        empty: false,
        docs: [{ id: fp, data: () => trialDoc, exists: true }],
      }
    : { empty: true, docs: [] };

  const docRef = {
    get: vi.fn().mockResolvedValue({ exists: trialDoc !== null, data: () => trialDoc }),
    update: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };

  const whereChain = {
    limit: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(querySnap),
    }),
  };

  const collectionRef = {
    where: vi.fn().mockReturnValue(whereChain),
    doc: vi.fn().mockReturnValue(docRef),
    get: vi.fn().mockResolvedValue({ docs: [] }),
  };

  return {
    fs: { collection: vi.fn().mockReturnValue(collectionRef) },
    collectionRef,
    whereChain,
    docRef,
  };
}

// ─── 1. fp reverse-lookup logic ───────────────────────────────────────────────
//
// Mirrors the useEffect in UsersTab that queries trials where userId == user.id

interface SelectionState {
  selectedUserId: string | null;
  selectedFp: string | null;
  setSelectedUserId: (id: string | null) => void;
  setSelectedFp: (fp: string | null) => void;
}

interface MockFirestoreClient {
  collection: (name: string) => {
    where: (field: string, op: string, value: string) => {
      limit: (n: number) => {
        get: () => Promise<{ empty: boolean; docs: Array<{ id: string }> }>;
      };
    };
  };
}

async function syncSelectionContext(
  selectedIdx: number,
  users: Array<{ id: string }>,
  selection: SelectionState,
  fs: MockFirestoreClient | null
): Promise<void> {
  if (selectedIdx < 0 || selectedIdx >= users.length) {
    selection.setSelectedUserId(null);
    selection.setSelectedFp(null);
    return;
  }
  const user = users[selectedIdx];
  if (!user) return;

  selection.setSelectedUserId(user.id);
  selection.setSelectedFp(null);

  if (!fs) return;
  const snap = await fs
    .collection("trials")
    .where("userId", "==", user.id)
    .limit(1)
    .get();
  const fp = !snap.empty && snap.docs[0] ? snap.docs[0].id : null;
  selection.setSelectedFp(fp);
}

describe("UsersTab fp reverse-lookup (issue #1600)", () => {
  let selection: SelectionState;

  beforeEach(() => {
    selection = {
      selectedUserId: null,
      selectedFp: null,
      setSelectedUserId: vi.fn((id) => { selection.selectedUserId = id; }),
      setSelectedFp: vi.fn((fp) => { selection.selectedFp = fp; }),
    };
  });

  it("sets selectedFp to trial doc id when user has a trial", async () => {
    const { fs } = buildTrialFirestore("fp-abc123", { startDate: "2026-01-01T00:00:00.000Z" });
    const users = [{ id: "user-001" }];
    await syncSelectionContext(0, users, selection, fs as unknown as MockFirestoreClient);
    expect(selection.selectedUserId).toBe("user-001");
    expect(selection.selectedFp).toBe("fp-abc123");
  });

  it("sets selectedFp to null when user has no trial", async () => {
    const { fs } = buildTrialFirestore(null, null);
    const users = [{ id: "user-002" }];
    await syncSelectionContext(0, users, selection, fs as unknown as MockFirestoreClient);
    expect(selection.selectedUserId).toBe("user-002");
    expect(selection.selectedFp).toBeNull();
  });

  it("clears both selectedUserId and selectedFp when no user is selected (idx < 0)", async () => {
    const { fs } = buildTrialFirestore("fp-xyz", { startDate: "2026-01-01T00:00:00.000Z" });
    const users = [{ id: "user-003" }];
    await syncSelectionContext(-1, users, selection, fs as unknown as MockFirestoreClient);
    expect(selection.setSelectedUserId).toHaveBeenCalledWith(null);
    expect(selection.setSelectedFp).toHaveBeenCalledWith(null);
  });

  it("clears context when user list is empty", async () => {
    const { fs } = buildTrialFirestore(null, null);
    await syncSelectionContext(0, [], selection, fs as unknown as MockFirestoreClient);
    expect(selection.setSelectedUserId).toHaveBeenCalledWith(null);
    expect(selection.setSelectedFp).toHaveBeenCalledWith(null);
  });

  it("resets fp to null initially then sets it after async lookup", async () => {
    const fpSetCalls: Array<string | null> = [];
    selection.setSelectedFp = vi.fn((fp) => {
      selection.selectedFp = fp;
      fpSetCalls.push(fp);
    });

    const { fs } = buildTrialFirestore("fp-delay", { startDate: "2026-01-01T00:00:00.000Z" });
    const users = [{ id: "user-004" }];
    await syncSelectionContext(0, users, selection, fs as unknown as MockFirestoreClient);

    // First call resets to null, second call sets the real fp
    expect(fpSetCalls[0]).toBeNull();
    expect(fpSetCalls[1]).toBe("fp-delay");
  });

  it("queries trials collection with correct userId filter", async () => {
    const { fs, collectionRef } = buildTrialFirestore("fp-filter-test", {
      startDate: "2026-02-01T00:00:00.000Z",
    });
    const users = [{ id: "user-filter-test" }];
    await syncSelectionContext(0, users, selection, fs as unknown as MockFirestoreClient);
    expect(fs.collection).toHaveBeenCalledWith("trials");
    expect(collectionRef.where).toHaveBeenCalledWith("userId", "==", "user-filter-test");
  });

  it("skips Firestore query when client is null (not connected)", async () => {
    const users = [{ id: "user-no-db" }];
    await syncSelectionContext(0, users, selection, null);
    expect(selection.selectedUserId).toBe("user-no-db");
    // fp stays null — no query was made
    expect(selection.selectedFp).toBeNull();
  });
});

// ─── 2. handleTrialInputConfirm context threading ─────────────────────────────
//
// Mirrors the execute call in handleTrialInputConfirm:
//   cmd.execute({ ...cmdCtx, input: dayInput })
// Verifies that selectedFp is included when cmdCtx has it.

interface PaletteCommandStub {
  name: string;
  execute: (ctx: CommandContext) => Promise<string[]>;
}

async function simulateHandleTrialInputConfirm(
  cmd: PaletteCommandStub,
  cmdCtx: CommandContext,
  dayInput: string
): Promise<string[]> {
  return cmd.execute({ ...cmdCtx, input: dayInput });
}

describe("handleTrialInputConfirm context threading (issue #1600)", () => {
  it("passes selectedFp from cmdCtx to cmd.execute when fp is set", async () => {
    const capturedCtx: CommandContext[] = [];
    const cmd: PaletteCommandStub = {
      name: "trial-adjust",
      execute: vi.fn(async (ctx) => {
        capturedCtx.push(ctx);
        return ["ok"];
      }),
    };
    const cmdCtx: CommandContext = {
      selectedUserId: "user-001",
      selectedHouseholdId: null,
      selectedFp: "fp-abc123",
      selectedSubId: null,
    };
    await simulateHandleTrialInputConfirm(cmd, cmdCtx, "+5");
    expect(capturedCtx[0]?.selectedFp).toBe("fp-abc123");
    expect(capturedCtx[0]?.input).toBe("+5");
  });

  it("passes selectedFp: null when no user with trial is selected", async () => {
    const capturedCtx: CommandContext[] = [];
    const cmd: PaletteCommandStub = {
      name: "trial-adjust",
      execute: vi.fn(async (ctx) => {
        capturedCtx.push(ctx);
        return ["ERROR: No trial selected"];
      }),
    };
    const cmdCtx: CommandContext = {
      selectedUserId: null,
      selectedHouseholdId: null,
      selectedFp: null,
      selectedSubId: null,
    };
    await simulateHandleTrialInputConfirm(cmd, cmdCtx, "+5");
    expect(capturedCtx[0]?.selectedFp).toBeNull();
  });

  it("spreads all cmdCtx fields into execute context", async () => {
    const capturedCtx: CommandContext[] = [];
    const cmd: PaletteCommandStub = {
      name: "trial-adjust",
      execute: vi.fn(async (ctx) => {
        capturedCtx.push(ctx);
        return ["ok"];
      }),
    };
    const cmdCtx: CommandContext = {
      selectedUserId: "user-999",
      selectedHouseholdId: "hh-001",
      selectedFp: "fp-full",
      selectedSubId: "sub-001",
    };
    await simulateHandleTrialInputConfirm(cmd, cmdCtx, "-3");
    const ctx = capturedCtx[0]!;
    expect(ctx.selectedUserId).toBe("user-999");
    expect(ctx.selectedHouseholdId).toBe("hh-001");
    expect(ctx.selectedFp).toBe("fp-full");
    expect(ctx.selectedSubId).toBe("sub-001");
    expect(ctx.input).toBe("-3");
  });
});

// ─── 3. trial-adjust execute with correct fp ──────────────────────────────────
//
// End-to-end: trial-adjust execute succeeds when selectedFp is set.

describe("trial-adjust execute — succeeds with selectedFp set (issue #1600)", () => {
  let setUpdateFn: Mock;

  beforeEach(() => {
    registerTrialCommands();

    setUpdateFn = vi.fn().mockResolvedValue(undefined);
    const docRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ startDate: "2026-01-01T00:00:00.000Z" }),
      }),
      update: setUpdateFn,
      set: vi.fn().mockResolvedValue(undefined),
    };
    mockFirestoreClient = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue(docRef),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: false, docs: [{ id: "fp-trial-ok" }] }),
          }),
        }),
      }),
    };
  });

  it("returns result lines (not error) when selectedFp is provided", async () => {
    const cmd = getCommands().find((c) => c.name === "trial-adjust");
    expect(cmd).toBeDefined();
    const result = await cmd!.execute({
      selectedUserId: "user-001",
      selectedHouseholdId: null,
      selectedFp: "fp-trial-ok",
      selectedSubId: null,
      input: "+5",
    });
    expect(result.some((l) => l.includes("trial-adjust"))).toBe(true);
    expect(result.every((l) => !l.startsWith("ERROR:"))).toBe(true);
  });

  it("still returns ERROR when selectedFp is null (guard still works)", async () => {
    const cmd = getCommands().find((c) => c.name === "trial-adjust");
    expect(cmd).toBeDefined();
    const result = await cmd!.execute({
      selectedUserId: "user-001",
      selectedHouseholdId: null,
      selectedFp: null,
      selectedSubId: null,
      input: "+5",
    });
    expect(result[0]).toMatch(/ERROR.*No trial selected/);
  });
});
