/**
 * dev-local.test.ts — Vitest tests for issue #911 acceptance criteria
 *
 * Validates the local dev environment for Odin's Throne:
 *   AC-J1  just dev-monitor recipe exists in Justfile
 *   AC-J2  Recipe sources development/monitor/.secrets for env vars
 *   AC-J3  Recipe prints active kubectl context
 *   AC-J4  Recipe starts via npm run dev (tsx watch)
 *   AC-J5  Package dev script uses tsx watch for HMR
 *   AC-W1  WS server rejects unauthenticated connections with error message
 *   AC-W2  WS server closes unauthenticated connections with code 1008
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EventEmitter } from "node:events";
import type { IncomingMessage, Server } from "node:http";

// ── Justfile tests ───────────────────────────────────────────────────────────

describe("just dev-monitor recipe (issue #911)", () => {
  const justfilePath = resolve(__dirname, "../../../../Justfile");
  let justfile: string;

  beforeEach(() => {
    justfile = readFileSync(justfilePath, "utf-8");
  });

  it("AC-J1: dev-monitor recipe is defined in the Justfile", () => {
    expect(justfile).toMatch(/^dev-monitor\s*:/m);
  });

  it("AC-J2: recipe sources the .secrets file when it exists", () => {
    // The recipe must use `source .secrets` to load env vars
    expect(justfile).toContain("source .secrets");
  });

  it("AC-J3: recipe prints the active kubectl context for cluster verification", () => {
    // Must call kubectl config current-context and echo it
    expect(justfile).toContain("kubectl config current-context");
    expect(justfile).toContain("[dev-monitor] kubectl context:");
  });

  it("AC-J4: recipe starts the monitor via npm run dev", () => {
    // FiremanDecko used `exec npm run dev` — not tsx directly
    expect(justfile).toContain("npm run dev");
  });

  it("AC-J5: package.json dev script uses tsx watch for HMR", () => {
    const pkgPath = resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      scripts: Record<string, string>;
    };
    // tsx watch provides HMR (file change restarts) without a full build step
    expect(pkg.scripts.dev).toMatch(/tsx\s+watch/);
  });
});

// ── WS auth rejection tests ──────────────────────────────────────────────────

// Minimal fakes (same pattern as ws.test.ts to stay consistent)

class FakeWs extends EventEmitter {
  readyState = 1; // OPEN
  sent: string[] = [];
  closeCode?: number;
  closeReason?: string;

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3;
  }

  static readonly OPEN = 1;
}

class FakeWss extends EventEmitter {
  constructor(_opts: unknown) {
    super();
  }
}

const mockFindPodForSession = vi.fn();
const mockStreamPodLogs = vi.fn();

vi.mock("../k8s.js", () => ({
  findPodForSession: mockFindPodForSession,
  streamPodLogs: mockStreamPodLogs,
}));

vi.mock("ws", () => ({
  WebSocketServer: FakeWss,
  WebSocket: { OPEN: 1 },
}));

// Auth mock — starts returning null (unauthorized) by default
const mockVerifySessionToken = vi.fn().mockReturnValue(null);

vi.mock("../auth.js", () => ({
  SESSION_COOKIE: "odin_session",
  verifySessionToken: mockVerifySessionToken,
}));

const { attachWebSocketServer } = await import("../ws.js");

function simulateConnection(
  wss: FakeWss,
  urlPath: string,
  cookie = ""
): FakeWs {
  const fakeWs = new FakeWs();
  const fakeReq = {
    url: urlPath,
    headers: { cookie },
  } as unknown as IncomingMessage;
  wss.emit("connection", fakeWs, fakeReq);
  return fakeWs;
}

describe("WS auth rejection (issue #911 — WS guard)", () => {
  let wss: FakeWss;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: session token verification fails (unauthorized)
    mockVerifySessionToken.mockReturnValue(null);
    wss = attachWebSocketServer(
      new EventEmitter() as unknown as Server
    ) as unknown as FakeWss;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-W1: unauthenticated connection receives error message before being closed", () => {
    const ws = simulateConnection(wss, "/ws/logs/some-session", "odin_session=bad-token");
    expect(ws.sent.length).toBeGreaterThan(0);
    const msg = JSON.parse(ws.sent[0]) as Record<string, unknown>;
    expect(msg.type).toBe("error");
    expect(typeof msg.message).toBe("string");
  });

  it("AC-W2: unauthenticated connection is closed with code 1008 (Policy Violation)", () => {
    const ws = simulateConnection(wss, "/ws/logs/some-session", "odin_session=bad-token");
    expect(ws.closeCode).toBe(1008);
  });
});
