/**
 * Unit tests for lib/auth/session.ts — Fenrir Ledger
 *
 * Tests localStorage-backed session management:
 *   - getSession: returns null on SSR, null when absent, null on malformed JSON,
 *     and the stored session when present
 *   - setSession: writes serialized JSON to localStorage
 *   - clearSession: removes the key from localStorage
 *   - isSessionValid: checks expires_at > Date.now()
 *
 * @see src/lib/auth/session.ts
 * @ref #1848
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { FenrirSession } from "@/lib/types";

// ─── localStorage mock ────────────────────────────────────────────────────────

const store: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SESSION_KEY = "fenrir:auth";

function makeSession(overrides: Partial<FenrirSession> = {}): FenrirSession {
  return {
    access_token: "ya29.access_token",
    id_token: "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.sig",
    refresh_token: "1//refresh_token",
    expires_at: Date.now() + 3600 * 1000,
    user: {
      sub: "user123",
      email: "thor@fenrir.dev",
      name: "Thor Odinson",
      picture: "https://example.com/thor.jpg",
    },
    ...overrides,
  };
}

// ─── getSession ───────────────────────────────────────────────────────────────

describe("getSession", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when localStorage is empty", async () => {
    const { getSession } = await import("@/lib/auth/session");
    expect(getSession()).toBeNull();
  });

  it("returns parsed session when present in localStorage", async () => {
    const session = makeSession();
    store[SESSION_KEY] = JSON.stringify(session);
    const { getSession } = await import("@/lib/auth/session");
    expect(getSession()).toEqual(session);
  });

  it("returns null when stored value is malformed JSON", async () => {
    store[SESSION_KEY] = "not-valid-json{{{";
    const { getSession } = await import("@/lib/auth/session");
    expect(getSession()).toBeNull();
  });

  it("returns null when stored value is empty string", async () => {
    store[SESSION_KEY] = "";
    const { getSession } = await import("@/lib/auth/session");
    // getItem returns "" → falsy → returns null
    expect(getSession()).toBeNull();
  });
});

// ─── setSession ───────────────────────────────────────────────────────────────

describe("setSession", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("serializes and stores the session under fenrir:auth", async () => {
    const { setSession } = await import("@/lib/auth/session");
    const session = makeSession();
    setSession(session);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      SESSION_KEY,
      JSON.stringify(session)
    );
  });

  it("overwrites an existing session", async () => {
    const { setSession, getSession } = await import("@/lib/auth/session");
    const first = makeSession({ access_token: "first_token" });
    const second = makeSession({ access_token: "second_token" });

    setSession(first);
    setSession(second);

    // After overwrite, getSession should return the second session
    expect(getSession()?.access_token).toBe("second_token");
  });

  it("can store a session without a refresh_token", async () => {
    const { setSession, getSession } = await import("@/lib/auth/session");
    const session = makeSession();
    const { refresh_token: _r, ...sessionNoRefresh } = session;
    setSession(sessionNoRefresh as FenrirSession);
    expect(getSession()?.refresh_token).toBeUndefined();
  });
});

// ─── clearSession ─────────────────────────────────────────────────────────────

describe("clearSession", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("removes fenrir:auth from localStorage", async () => {
    const { setSession, clearSession, getSession } = await import("@/lib/auth/session");
    setSession(makeSession());
    clearSession();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(SESSION_KEY);
    expect(getSession()).toBeNull();
  });

  it("is idempotent — calling twice does not throw", async () => {
    const { clearSession } = await import("@/lib/auth/session");
    expect(() => {
      clearSession();
      clearSession();
    }).not.toThrow();
  });
});

// ─── isSessionValid ───────────────────────────────────────────────────────────

describe("isSessionValid", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("returns false when no session is stored", async () => {
    const { isSessionValid } = await import("@/lib/auth/session");
    expect(isSessionValid()).toBe(false);
  });

  it("returns true when expires_at is in the future", async () => {
    const { setSession, isSessionValid } = await import("@/lib/auth/session");
    const futureSession = makeSession({ expires_at: Date.now() + 60 * 60 * 1000 });
    setSession(futureSession);
    expect(isSessionValid()).toBe(true);
  });

  it("returns false when expires_at is in the past", async () => {
    const { setSession, isSessionValid } = await import("@/lib/auth/session");
    const expiredSession = makeSession({ expires_at: Date.now() - 1000 });
    setSession(expiredSession);
    expect(isSessionValid()).toBe(false);
  });

  it("returns false when expires_at equals Date.now() (boundary — expired)", async () => {
    const { setSession, isSessionValid } = await import("@/lib/auth/session");
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const session = makeSession({ expires_at: now });
    setSession(session);
    // expires_at <= Date.now() → not valid
    expect(isSessionValid()).toBe(false);
  });

  it("returns false when stored JSON is malformed", async () => {
    store[SESSION_KEY] = "{bad json";
    const { isSessionValid } = await import("@/lib/auth/session");
    expect(isSessionValid()).toBe(false);
  });
});
