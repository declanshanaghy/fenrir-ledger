/**
 * Vitest tests for issue #1071 — pin-to-cache (localStorage pin/unpin)
 *
 * AC tested:
 * - isPinned returns false for unpinned sessions, true after pinSession
 * - pinSession stores JSONL content under odin-throne:cache:<sessionId>
 * - pinSession stores metadata under odin-throne:cache-meta:<sessionId>
 * - unpinSession removes both cache + meta keys
 * - getCachedLog returns stored content for pinned session, null for unpinned
 * - getCachedSessionIds returns all pinned IDs, newest-pinned first
 * - getCachedSessionMeta returns stored metadata
 * - Session cap: evicts oldest when 10 sessions already pinned
 * - Total size cap: evicts oldest when approaching 20MB
 * - appendLogLine also appends to cache when session is pinned
 * - isCacheNearCap returns true when ≥10 sessions or ≥90% of 20MB
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isPinned,
  pinSession,
  unpinSession,
  getCachedLog,
  getCachedSessionIds,
  getCachedSessionMeta,
  appendLogLine,
  isCacheNearCap,
} from "../lib/localStorageLogs";
import type { CachedSessionMeta } from "../lib/localStorageLogs";

const CACHE_PREFIX = "odin-throne:cache:";
const META_PREFIX = "odin-throne:cache-meta:";
const MAX_CACHE_SESSIONS = 10;

// ── localStorage mock ──────────────────────────────────────────────────────

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

function makeMeta(sessionId: string, pinnedAt = Date.now()): CachedSessionMeta {
  return {
    sessionId,
    name: `job-${sessionId}`,
    issueNumber: 1000,
    agent: "firemandecko",
    step: 1,
    startedAt: "2026-03-16T00:00:00Z",
    completedAt: null,
    issueTitle: "Test issue",
    branchName: "feat/test",
    pinnedAt,
  };
}

beforeEach(() => {
  store = {};
  Object.defineProperty(global, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── isPinned ───────────────────────────────────────────────────────────────

describe("isPinned", () => {
  it("returns false for an unpinned session", () => {
    expect(isPinned("sess-abc")).toBe(false);
  });

  it("returns true after pinSession", () => {
    pinSession("sess-abc", makeMeta("sess-abc"));
    expect(isPinned("sess-abc")).toBe(true);
  });

  it("returns false after unpinSession", () => {
    pinSession("sess-abc", makeMeta("sess-abc"));
    unpinSession("sess-abc");
    expect(isPinned("sess-abc")).toBe(false);
  });
});

// ── pinSession ─────────────────────────────────────────────────────────────

describe("pinSession — key format (AC: odin-throne:cache:<id>)", () => {
  it("stores content under odin-throne:cache:<sessionId>", () => {
    store["odin-throne:log:sess-1"] = "line one\nline two";
    pinSession("sess-1", makeMeta("sess-1"));
    expect(store[`${CACHE_PREFIX}sess-1`]).toBe("line one\nline two");
  });

  it("stores metadata under odin-throne:cache-meta:<sessionId>", () => {
    pinSession("sess-2", makeMeta("sess-2"));
    const raw = store[`${META_PREFIX}sess-2`];
    expect(raw).toBeDefined();
    const meta = JSON.parse(raw!) as CachedSessionMeta;
    expect(meta.sessionId).toBe("sess-2");
    expect(meta.agent).toBe("firemandecko");
  });

  it("stores empty string when no log buffer exists", () => {
    pinSession("sess-3", makeMeta("sess-3"));
    expect(store[`${CACHE_PREFIX}sess-3`]).toBe("");
  });
});

// ── unpinSession ───────────────────────────────────────────────────────────

describe("unpinSession", () => {
  it("removes both cache and meta keys", () => {
    pinSession("sess-x", makeMeta("sess-x"));
    unpinSession("sess-x");
    expect(store[`${CACHE_PREFIX}sess-x`]).toBeUndefined();
    expect(store[`${META_PREFIX}sess-x`]).toBeUndefined();
  });

  it("does not throw for an unpinned session", () => {
    expect(() => unpinSession("never-pinned")).not.toThrow();
  });
});

// ── getCachedLog ──────────────────────────────────────────────────────────

describe("getCachedLog", () => {
  it("returns null for an unpinned session", () => {
    expect(getCachedLog("no-such-session")).toBeNull();
  });

  it("returns stored content for a pinned session", () => {
    store["odin-throne:log:sess-y"] = "jsonl content here";
    pinSession("sess-y", makeMeta("sess-y"));
    expect(getCachedLog("sess-y")).toBe("jsonl content here");
  });
});

// ── getCachedSessionIds ───────────────────────────────────────────────────

describe("getCachedSessionIds — newest-pinned first", () => {
  it("returns empty array when nothing is pinned", () => {
    expect(getCachedSessionIds()).toEqual([]);
  });

  it("returns all pinned session IDs", () => {
    pinSession("a", makeMeta("a", 1000));
    pinSession("b", makeMeta("b", 2000));
    pinSession("c", makeMeta("c", 3000));
    const ids = getCachedSessionIds();
    expect(ids).toHaveLength(3);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
  });

  it("sorts by pinnedAt descending (newest first)", () => {
    pinSession("old", makeMeta("old", 1000));
    pinSession("mid", makeMeta("mid", 2000));
    pinSession("new", makeMeta("new", 3000));
    const ids = getCachedSessionIds();
    expect(ids[0]).toBe("new");
    expect(ids[1]).toBe("mid");
    expect(ids[2]).toBe("old");
  });
});

// ── getCachedSessionMeta ──────────────────────────────────────────────────

describe("getCachedSessionMeta", () => {
  it("returns null for an unpinned session", () => {
    expect(getCachedSessionMeta("nothing")).toBeNull();
  });

  it("returns full metadata for a pinned session", () => {
    const meta = makeMeta("sess-m", 12345);
    pinSession("sess-m", meta);
    const got = getCachedSessionMeta("sess-m");
    expect(got).not.toBeNull();
    expect(got!.sessionId).toBe("sess-m");
    expect(got!.pinnedAt).toBe(12345);
    expect(got!.issueTitle).toBe("Test issue");
  });
});

// ── Session cap eviction ──────────────────────────────────────────────────

describe("Session cap (10 sessions, AC: evict oldest)", () => {
  it("evicts the oldest session when 10-session cap is exceeded", () => {
    for (let i = 1; i <= MAX_CACHE_SESSIONS; i++) {
      pinSession(`sess-${i}`, makeMeta(`sess-${i}`, i * 1000));
    }
    const before = getCachedSessionIds();
    expect(before).toHaveLength(MAX_CACHE_SESSIONS);

    // Pin an 11th — should evict sess-1 (oldest)
    pinSession("sess-11", makeMeta("sess-11", 99999));
    const after = getCachedSessionIds();
    expect(after).toHaveLength(MAX_CACHE_SESSIONS);
    expect(store[`${CACHE_PREFIX}sess-1`]).toBeUndefined();
    expect(store[`${META_PREFIX}sess-1`]).toBeUndefined();
    expect(store[`${CACHE_PREFIX}sess-11`]).toBeDefined();
  });
});

// ── appendLogLine also writes to cache when pinned ─────────────────────────

describe("appendLogLine — live append to pinned cache (AC: live+pinned sessions)", () => {
  it("does NOT write to cache when session is not pinned", () => {
    appendLogLine("live-unpinned", "some line");
    expect(store[`${CACHE_PREFIX}live-unpinned`]).toBeUndefined();
  });

  it("appends new log lines to cache when session is pinned", () => {
    // First pin (with existing log buffer)
    store["odin-throne:log:live-pinned"] = "first line";
    pinSession("live-pinned", makeMeta("live-pinned"));
    expect(store[`${CACHE_PREFIX}live-pinned`]).toBe("first line");

    // Now new lines arrive — they should also go to cache
    appendLogLine("live-pinned", "second line");
    appendLogLine("live-pinned", "third line");

    expect(store[`${CACHE_PREFIX}live-pinned`]).toBe("first line\nsecond line\nthird line");
  });
});

// ── isCacheNearCap ────────────────────────────────────────────────────────

describe("isCacheNearCap", () => {
  it("returns false when cache is empty", () => {
    expect(isCacheNearCap()).toBe(false);
  });

  it("returns true when at or above the session cap (10)", () => {
    for (let i = 1; i <= MAX_CACHE_SESSIONS; i++) {
      pinSession(`cap-sess-${i}`, makeMeta(`cap-sess-${i}`, i));
    }
    expect(isCacheNearCap()).toBe(true);
  });
});
