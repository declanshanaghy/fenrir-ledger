/**
 * Loki QA — Issue #1071: pin-to-cache gap tests
 *
 * Covers edge cases NOT in the existing pin-to-cache.test.ts or
 * download-button-header.test.tsx. Each describe block maps to a specific
 * handoff edge case or AC item not yet validated.
 *
 * Tests are pure (no DOM, no React) except the JobCard badge test.
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

// ── localStorage mock ───────────────────────────────────────────────────────

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

function makeMeta(sessionId: string, pinnedAt = Date.now(), overrides: Partial<CachedSessionMeta> = {}): CachedSessionMeta {
  return {
    sessionId,
    name: `job-${sessionId}`,
    issueNumber: 1071,
    agent: "firemandecko",
    step: 1,
    startedAt: "2026-03-16T00:00:00Z",
    completedAt: null,
    issueTitle: "Replace download button with pin-to-cache",
    branchName: "enhance/issue-1071-pin-to-cache",
    pinnedAt,
    ...overrides,
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

// ── Edge case: pinSession with all-null optional meta fields ────────────────

describe("pinSession — null metadata fields (edge case)", () => {
  it("stores a session with all null optional fields without throwing", () => {
    const meta = makeMeta("null-meta-sess", 1000, {
      startedAt: null,
      completedAt: null,
      issueTitle: null,
      branchName: null,
    });
    expect(() => pinSession("null-meta-sess", meta)).not.toThrow();
    expect(isPinned("null-meta-sess")).toBe(true);
  });

  it("getCachedSessionMeta round-trips null fields correctly", () => {
    const meta = makeMeta("null-fields", 5000, {
      startedAt: null,
      completedAt: null,
      issueTitle: null,
      branchName: null,
    });
    pinSession("null-fields", meta);
    const got = getCachedSessionMeta("null-fields");
    expect(got).not.toBeNull();
    expect(got!.startedAt).toBeNull();
    expect(got!.completedAt).toBeNull();
    expect(got!.issueTitle).toBeNull();
    expect(got!.branchName).toBeNull();
  });

  it("getCachedSessionIds includes session with null startedAt", () => {
    pinSession("no-start-time", makeMeta("no-start-time", 9999, { startedAt: null }));
    const ids = getCachedSessionIds();
    expect(ids).toContain("no-start-time");
  });
});

// ── Edge case: pinSession with empty log buffer ─────────────────────────────

describe("pinSession — empty log buffer (handoff edge case)", () => {
  it("is considered pinned even when getLog returns null (no buffer yet)", () => {
    // No log key written — log buffer is missing entirely
    pinSession("no-log-yet", makeMeta("no-log-yet"));
    // isPinned must return true — the whole point of pinning before content arrives
    expect(isPinned("no-log-yet")).toBe(true);
  });

  it("getCachedLog returns empty string (not null) when pinned with no buffer", () => {
    pinSession("empty-buf", makeMeta("empty-buf"));
    // pinSession writes "" when getLog returns null, so getCachedLog should return ""
    expect(getCachedLog("empty-buf")).toBe("");
  });

  it("subsequent appendLogLine writes to cache for empty-buffer pinned session", () => {
    // Pin first (no existing log)
    pinSession("empty-then-live", makeMeta("empty-then-live"));
    expect(getCachedLog("empty-then-live")).toBe("");

    // First live line arrives
    appendLogLine("empty-then-live", "first live line");
    // Cache should now have the new line (appendToCacheRaw)
    expect(getCachedLog("empty-then-live")).toBe("first live line");
  });
});

// ── Edge case: appendToCacheRaw skips when not pinned ──────────────────────

describe("appendLogLine — cache write only when pinned (edge case)", () => {
  it("writing lines to an unpinned session never creates a cache entry", () => {
    for (let i = 0; i < 5; i++) {
      appendLogLine("never-pinned", `line ${i}`);
    }
    expect(getCachedLog("never-pinned")).toBeNull();
    expect(isPinned("never-pinned")).toBe(false);
  });

  it("unpin then append: lines after unpin do NOT go to cache", () => {
    store["odin-throne:log:unpin-then-append"] = "existing content";
    pinSession("unpin-then-append", makeMeta("unpin-then-append"));
    expect(getCachedLog("unpin-then-append")).toBe("existing content");

    unpinSession("unpin-then-append");
    appendLogLine("unpin-then-append", "post-unpin line");

    // Cache key was removed by unpinSession and should not be recreated
    expect(getCachedLog("unpin-then-append")).toBeNull();
  });
});

// ── 20MB total size cap enforcement ────────────────────────────────────────

describe("pinSession — 20MB total size cap eviction", () => {
  it("evicts oldest cached session when total bytes would exceed 20MB cap", () => {
    const MAX_BYTES = 20 * 1024 * 1024;
    // Each session = ~7MB (stays under 20MB for 2 sessions but 3 would overflow)
    const bigChunk = "x".repeat(7 * 1024 * 1024); // 7MB string

    // Pin session A with 7MB content
    store["odin-throne:log:big-a"] = bigChunk;
    pinSession("big-a", makeMeta("big-a", 1000));

    // Pin session B with 7MB content (total = 14MB, under cap)
    store["odin-throne:log:big-b"] = bigChunk;
    pinSession("big-b", makeMeta("big-b", 2000));

    // Both should be present
    expect(isPinned("big-a")).toBe(true);
    expect(isPinned("big-b")).toBe(true);

    // Pin session C with 7MB (total would be 21MB > 20MB cap — must evict big-a)
    store["odin-throne:log:big-c"] = bigChunk;
    pinSession("big-c", makeMeta("big-c", 3000));

    // big-a (oldest) should have been evicted to stay under cap
    expect(isPinned("big-a")).toBe(false);
    expect(isPinned("big-c")).toBe(true);
  });

  it("total size after cap-triggered eviction is within 20MB", () => {
    const bigChunk = "y".repeat(7 * 1024 * 1024); // 7MB

    store["odin-throne:log:sz-a"] = bigChunk;
    pinSession("sz-a", makeMeta("sz-a", 1000));
    store["odin-throne:log:sz-b"] = bigChunk;
    pinSession("sz-b", makeMeta("sz-b", 2000));
    store["odin-throne:log:sz-c"] = bigChunk;
    pinSession("sz-c", makeMeta("sz-c", 3000));

    const ids = getCachedSessionIds();
    // After eviction, total size should be ≤ 20MB
    const totalBytes = ids.reduce((sum, id) => {
      const content = getCachedLog(id);
      return sum + (content?.length ?? 0);
    }, 0);
    expect(totalBytes).toBeLessThanOrEqual(20 * 1024 * 1024);
  });
});

// ── isCacheNearCap — bytes threshold ───────────────────────────────────────

describe("isCacheNearCap — 90% bytes threshold", () => {
  it("returns false when only a few small sessions are cached", () => {
    pinSession("tiny-a", makeMeta("tiny-a", 1));
    pinSession("tiny-b", makeMeta("tiny-b", 2));
    expect(isCacheNearCap()).toBe(false);
  });

  it("returns true when total bytes exceed 90% of 20MB (18MB)", () => {
    // Write 9.5MB to cache directly (simulating a large pinned session)
    const nineAndHalf = "z".repeat(9.5 * 1024 * 1024);
    store["odin-throne:cache:large-sess"] = nineAndHalf;
    store["odin-throne:cache-meta:large-sess"] = JSON.stringify(makeMeta("large-sess", 1));
    // Another 9MB
    const nine = "z".repeat(9 * 1024 * 1024);
    store["odin-throne:cache:large-sess-2"] = nine;
    store["odin-throne:cache-meta:large-sess-2"] = JSON.stringify(makeMeta("large-sess-2", 2));
    // Total ~18.5MB > 18MB (90% of 20MB)
    expect(isCacheNearCap()).toBe(true);
  });
});

// ── getCachedSessionIds — ordering stability ────────────────────────────────

describe("getCachedSessionIds — ordering with equal pinnedAt timestamps", () => {
  it("handles two sessions with identical pinnedAt without throwing", () => {
    const sameTime = 5000;
    pinSession("tie-a", makeMeta("tie-a", sameTime));
    pinSession("tie-b", makeMeta("tie-b", sameTime));
    const ids = getCachedSessionIds();
    expect(ids).toHaveLength(2);
    expect(ids).toContain("tie-a");
    expect(ids).toContain("tie-b");
  });

  it("a session with pinnedAt=0 sorts after sessions with real timestamps", () => {
    pinSession("zero-time", makeMeta("zero-time", 0));
    pinSession("real-time", makeMeta("real-time", 1000));
    const ids = getCachedSessionIds();
    expect(ids[0]).toBe("real-time");
    expect(ids[ids.length - 1]).toBe("zero-time");
  });
});

// ── Dedup: live session takes precedence over cached ───────────────────────
// This tests the pure buildCachedJobs logic via the public API surface
// (getCachedSessionIds + getCachedSessionMeta) which is what useJobs consumes.

describe("Cached session dedup with live list (AC: live job takes precedence)", () => {
  it("getCachedSessionIds includes a session whether or not live list has it (raw cache is source of truth)", () => {
    // The dedup logic lives in buildCachedJobs (useJobs.ts), not the cache API itself.
    // Here we verify the cache API returns all IDs regardless; the hook deduplicates.
    pinSession("live-and-cached", makeMeta("live-and-cached", 1000));
    pinSession("cached-only", makeMeta("cached-only", 2000));

    const ids = getCachedSessionIds();
    // Both are in cache regardless of live list
    expect(ids).toContain("live-and-cached");
    expect(ids).toContain("cached-only");
  });

  it("unpinSession removes a session from getCachedSessionIds immediately", () => {
    pinSession("remove-me", makeMeta("remove-me", 1000));
    expect(getCachedSessionIds()).toContain("remove-me");

    unpinSession("remove-me");
    expect(getCachedSessionIds()).not.toContain("remove-me");
  });
});

// ── Sidebar disappears on unpin of active cached session ───────────────────
// Pure cache-layer verification: after unpin, session has no cache entry.
// The sidebar refresh (refreshCached) is wired in useJobs — tested here
// at the cache-API level (the input to refreshCached).

describe("Active cached session disappears from cache after unpin", () => {
  it("after unpinSession the session is absent from getCachedSessionIds", () => {
    pinSession("active-cached", makeMeta("active-cached", 5000));
    expect(getCachedSessionIds()).toContain("active-cached");

    // User unpins the currently-selected cached session
    unpinSession("active-cached");

    // Cache is empty — sidebar would show nothing for this session
    expect(getCachedSessionIds()).not.toContain("active-cached");
    expect(getCachedLog("active-cached")).toBeNull();
    expect(getCachedSessionMeta("active-cached")).toBeNull();
  });

  it("unpinning one session does not disturb other cached sessions", () => {
    pinSession("keep-me-1", makeMeta("keep-me-1", 1000));
    pinSession("keep-me-2", makeMeta("keep-me-2", 2000));
    pinSession("remove-active", makeMeta("remove-active", 3000));

    unpinSession("remove-active");

    const ids = getCachedSessionIds();
    expect(ids).not.toContain("remove-active");
    expect(ids).toContain("keep-me-1");
    expect(ids).toContain("keep-me-2");
  });
});

// ── Session cap: meta key also evicted alongside cache key ─────────────────

describe("Session cap eviction — meta keys cleaned up (AC: no orphaned meta)", () => {
  it("evicting a session also removes its meta key", () => {
    const MAX = 10;
    for (let i = 1; i <= MAX; i++) {
      pinSession(`evict-meta-${i}`, makeMeta(`evict-meta-${i}`, i * 100));
    }

    // Pin an 11th — evicts evict-meta-1 (oldest)
    pinSession("evict-meta-11", makeMeta("evict-meta-11", MAX * 100 + 1));

    // Both cache AND meta keys for evict-meta-1 should be gone
    expect(store["odin-throne:cache:evict-meta-1"]).toBeUndefined();
    expect(store["odin-throne:cache-meta:evict-meta-1"]).toBeUndefined();

    // Confirm exact cache+meta keys are absent (no orphaned meta)
    const exactCacheKey = "odin-throne:cache:evict-meta-1";
    const exactMetaKey = "odin-throne:cache-meta:evict-meta-1";
    expect(store[exactCacheKey]).toBeUndefined();
    expect(store[exactMetaKey]).toBeUndefined();
  });
});
