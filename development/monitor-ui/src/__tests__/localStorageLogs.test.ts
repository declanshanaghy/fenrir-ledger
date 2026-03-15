/**
 * Vitest tests for issue #991 — localStorage session log persistence + download button
 *
 * AC tested:
 * - Session logs are persisted to localStorage under `odin-throne:log:<sessionId>`
 * - Storage is capped at 10 sessions and 5MB total
 * - Oldest sessions are evicted when limits are exceeded
 * - getLog returns persisted content
 * - downloadLog triggers a download of `<sessionId>.log` as plain text
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appendLogLine, getLog, downloadLog } from "../lib/localStorageLogs";

const KEY_PREFIX = "odin-throne:log:";
const MAX_SESSIONS = 10;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5MB

// --- localStorage mock ---
let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

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

// ---- Key prefix / basic storage ----

describe("appendLogLine — key prefix (AC-1)", () => {
  it("stores log under odin-throne:log:<sessionId>", () => {
    appendLogLine("abc123", "first line");
    expect(store[`${KEY_PREFIX}abc123`]).toBe("first line");
  });

  it("appends subsequent lines with newline separator", () => {
    appendLogLine("s1", "line one");
    appendLogLine("s1", "line two");
    appendLogLine("s1", "line three");
    expect(store[`${KEY_PREFIX}s1`]).toBe("line one\nline two\nline three");
  });

  it("stores separate sessions under their own keys", () => {
    appendLogLine("session-a", "alpha");
    appendLogLine("session-b", "beta");
    expect(store[`${KEY_PREFIX}session-a`]).toBe("alpha");
    expect(store[`${KEY_PREFIX}session-b`]).toBe("beta");
  });
});

// ---- getLog ----

describe("getLog (AC-1)", () => {
  it("returns stored log content for a known sessionId", () => {
    appendLogLine("get-test", "hello world");
    expect(getLog("get-test")).toBe("hello world");
  });

  it("returns null for an unknown sessionId", () => {
    expect(getLog("nonexistent-session")).toBeNull();
  });
});

// ---- Session cap eviction ----

describe("Session cap enforcement (AC-2, AC-3)", () => {
  it("evicts the oldest session when 10-session cap is reached", () => {
    // Fill up exactly 10 sessions
    for (let i = 1; i <= MAX_SESSIONS; i++) {
      appendLogLine(`session-${i}`, `log line for ${i}`);
    }
    expect(Object.keys(store).filter((k) => k.startsWith(KEY_PREFIX))).toHaveLength(MAX_SESSIONS);

    // Adding an 11th session should evict the first one
    appendLogLine("session-11", "new session");

    const remainingKeys = Object.keys(store).filter((k) => k.startsWith(KEY_PREFIX));
    expect(remainingKeys).toHaveLength(MAX_SESSIONS);
    // session-1 was the oldest — it should be gone
    expect(store[`${KEY_PREFIX}session-1`]).toBeUndefined();
    // session-11 is present
    expect(store[`${KEY_PREFIX}session-11`]).toBe("new session");
  });

  it("does NOT evict when writing a new line to an existing session", () => {
    for (let i = 1; i <= MAX_SESSIONS; i++) {
      appendLogLine(`session-${i}`, `log line for ${i}`);
    }
    // Appending to existing session-1 should not trigger eviction
    appendLogLine("session-1", "second line");
    const remainingKeys = Object.keys(store).filter((k) => k.startsWith(KEY_PREFIX));
    expect(remainingKeys).toHaveLength(MAX_SESSIONS);
    expect(store[`${KEY_PREFIX}session-1`]).toBe("log line for 1\nsecond line");
  });
});

// ---- Total size cap eviction ----

describe("5MB total size cap enforcement (AC-2, AC-3)", () => {
  it("evicts oldest sessions until total fits under 5MB when adding large entry", () => {
    // Write 3 sessions of ~1MB each (to put us near the 3MB mark)
    const oneMB = "x".repeat(1024 * 1024);
    appendLogLine("big-session-1", oneMB);
    appendLogLine("big-session-2", oneMB);
    appendLogLine("big-session-3", oneMB);

    expect(Object.keys(store).filter((k) => k.startsWith(KEY_PREFIX))).toHaveLength(3);

    // Adding 3 more 1MB sessions should evict earlier ones as we cross 5MB
    appendLogLine("big-session-4", oneMB);
    appendLogLine("big-session-5", oneMB);
    appendLogLine("big-session-6", oneMB);

    // Total stored should not exceed MAX_TOTAL_BYTES across all sessions
    const keys = Object.keys(store).filter((k) => k.startsWith(KEY_PREFIX));
    const totalBytes = keys.reduce((sum, k) => sum + (store[k]?.length ?? 0), 0);
    expect(totalBytes).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });

  it("retains the latest session even when it alone is near the cap", () => {
    // Fill existing storage with small sessions
    for (let i = 0; i < 5; i++) {
      appendLogLine(`small-${i}`, "short");
    }
    // Write a large session that would approach the cap
    const largeLog = "z".repeat(4 * 1024 * 1024); // 4MB
    appendLogLine("large-single", largeLog);

    // The large session itself should still be stored
    const stored = getLog("large-single");
    expect(stored).not.toBeNull();
    expect(stored).toBe(largeLog);

    // Total should be within budget
    const keys = Object.keys(store).filter((k) => k.startsWith(KEY_PREFIX));
    const totalBytes = keys.reduce((sum, k) => sum + (store[k]?.length ?? 0), 0);
    expect(totalBytes).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });
});

// ---- downloadLog ----

describe("downloadLog (AC-5, AC-6)", () => {
  it("does nothing when there is no stored log for the sessionId", () => {
    const createObjectURLSpy = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURLSpy = vi.fn();
    global.URL.createObjectURL = createObjectURLSpy;
    global.URL.revokeObjectURL = revokeObjectURLSpy;

    downloadLog("nonexistent");
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it("creates a Blob and triggers an anchor download with <sessionId>.log filename", () => {
    appendLogLine("dl-session", "log entry one");
    appendLogLine("dl-session", "log entry two");

    const mockUrl = "blob:http://localhost/test-url";
    const createObjectURLSpy = vi.fn().mockReturnValue(mockUrl);
    const revokeObjectURLSpy = vi.fn();
    global.URL.createObjectURL = createObjectURLSpy;
    global.URL.revokeObjectURL = revokeObjectURLSpy;

    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((el) => el);
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation((el) => el);
    const clickSpy = vi.fn();
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        const a = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
        return a;
      }
      return document.createElement(tag);
    });

    downloadLog("dl-session");

    // createObjectURL was called with a Blob
    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const blobArg = createObjectURLSpy.mock.calls[0]![0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("text/plain");

    // anchor was configured correctly
    const anchorArg = appendChildSpy.mock.calls[0]![0] as unknown as { href: string; download: string };
    expect(anchorArg.href).toBe(mockUrl);
    expect(anchorArg.download).toBe("dl-session.log");

    // click was triggered
    expect(clickSpy).toHaveBeenCalledOnce();

    // cleanup happened
    expect(removeChildSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl);

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("blob content matches the stored log", () => {
    const logContent = "line one\nline two\nline three";
    appendLogLine("content-check", "line one");
    appendLogLine("content-check", "line two");
    appendLogLine("content-check", "line three");

    let capturedBlob: Blob | null = null;
    global.URL.createObjectURL = vi.fn().mockImplementation((b: Blob) => {
      capturedBlob = b;
      return "blob:mock";
    });
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(document.body, "appendChild").mockImplementation((el) => el);
    vi.spyOn(document.body, "removeChild").mockImplementation((el) => el);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        return { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    downloadLog("content-check");

    expect(capturedBlob).not.toBeNull();
    return capturedBlob!.text().then((text) => {
      expect(text).toBe(logContent);
    });
  });
});

// ---- localStorage unavailability ----

describe("localStorage unavailability — silent failure", () => {
  it("does not throw when localStorage.setItem throws", () => {
    const throwingStorage = {
      ...localStorageMock,
      setItem: () => { throw new Error("QuotaExceededError"); },
    };
    Object.defineProperty(global, "localStorage", { value: throwingStorage, writable: true, configurable: true });
    expect(() => appendLogLine("fail-session", "some log")).not.toThrow();
  });

  it("returns null from getLog when localStorage is unavailable", () => {
    const throwingStorage = {
      ...localStorageMock,
      getItem: () => { throw new Error("SecurityError"); },
    };
    Object.defineProperty(global, "localStorage", { value: throwingStorage, writable: true, configurable: true });
    expect(getLog("any-session")).toBeNull();
  });
});
