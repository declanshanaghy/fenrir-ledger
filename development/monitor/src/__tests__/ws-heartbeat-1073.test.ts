/**
 * WebSocket heartbeat tests — issue #1073
 *
 * Validates that the server sends periodic protocol-level ping frames to keep
 * WebSocket connections alive through the GKE Cloud Load Balancer's 30 s idle
 * timeout.
 *
 * AC tested:
 * - HEARTBEAT_INTERVAL_MS is ≤ 25 s (safely below the 30 s proxy timeout)
 * - Server sends a protocol-level ping within HEARTBEAT_INTERVAL_MS of connect
 * - Heartbeat does not crash when the connection closes normally
 */

import { createServer } from "node:http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";

// ── vi.hoisted — lift state above the vi.mock hoist boundary ─────────────────

vi.mock("../k8s.js", () => ({
  listAgentJobs: vi.fn().mockResolvedValue([]),
  watchAgentJobs: vi.fn(),
  mapAgentJobToJob: vi.fn(),
  streamPodLogs: vi.fn(),
  findPodForSession: vi.fn().mockResolvedValue(null),
}));

import { attachWebSocketServer, HEARTBEAT_INTERVAL_MS } from "../ws.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function openConnection(
  port: number
): { ws: WebSocket; open: Promise<void> } {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const open = new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return { ws, open };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("WebSocket heartbeat — issue #1073", () => {
  // ── Constant sanity check ──────────────────────────────────────────────────

  it("HEARTBEAT_INTERVAL_MS is ≤ 25 000 ms (below 30 s proxy timeout)", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThanOrEqual(25_000);
  });

  it("HEARTBEAT_INTERVAL_MS is ≥ 10 000 ms (not too aggressive)", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeGreaterThanOrEqual(10_000);
  });

  // ── Server sends protocol-level pings ─────────────────────────────────────
  // Use fake timers so the test runs instantly instead of waiting 20 s.

  it("server sends a protocol-level ping within HEARTBEAT_INTERVAL_MS of connect", async () => {
    vi.useFakeTimers();

    const httpServer = createServer();
    attachWebSocketServer(httpServer as Parameters<typeof attachWebSocketServer>[0]);
    await new Promise<void>((resolve) =>
      httpServer.listen(0, "127.0.0.1", resolve)
    );
    const port = (httpServer.address() as { port: number }).port;

    try {
      const { ws, open } = openConnection(port);
      await open;

      let pingReceived = false;
      ws.on("ping", () => {
        pingReceived = true;
      });

      // Advance past one heartbeat interval
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 100);

      expect(pingReceived).toBe(true);
      ws.close();
    } finally {
      httpServer.closeAllConnections?.();
      await new Promise<void>((r) => httpServer.close(r));
      vi.useRealTimers();
    }
  });

  // ── No error on normal close ───────────────────────────────────────────────

  it("does not throw when the connection closes normally before the first ping", async () => {
    vi.useFakeTimers();

    const httpServer = createServer();
    attachWebSocketServer(httpServer as Parameters<typeof attachWebSocketServer>[0]);
    await new Promise<void>((resolve) =>
      httpServer.listen(0, "127.0.0.1", resolve)
    );
    const port = (httpServer.address() as { port: number }).port;

    try {
      const { ws, open } = openConnection(port);
      await open;

      // Close immediately — heartbeat interval should be cleared cleanly
      ws.close();
      await new Promise<void>((r) => ws.once("close", r));

      // Advance past the interval — no unhandled errors should fire
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2 + 100);
      // If we reach here without throwing, the test passes
    } finally {
      httpServer.closeAllConnections?.();
      await new Promise<void>((r) => httpServer.close(r));
      vi.useRealTimers();
    }
  });

  // ── Application-level JSON ping → pong (Loki) ─────────────────────────────
  // AC: Client responds to ping with pong.
  // ws.ts handles `{type:"ping"}` ClientMessage and replies with `{type:"pong"}`.
  // This is separate from the protocol-level ping tested above.

  it("responds with JSON {type:'pong'} when client sends {type:'ping'} message", async () => {
    const httpServer = createServer();
    attachWebSocketServer(httpServer as Parameters<typeof attachWebSocketServer>[0]);
    await new Promise<void>((resolve) =>
      httpServer.listen(0, "127.0.0.1", resolve)
    );
    const port = (httpServer.address() as { port: number }).port;

    try {
      const { ws, open } = openConnection(port);
      await open;

      const pongReceived = new Promise<boolean>((resolve) => {
        ws.on("message", (data) => {
          try {
            const msg = JSON.parse(String(data)) as { type: string };
            if (msg.type === "pong") resolve(true);
          } catch { /* ignore */ }
        });
        // Timeout safety: if no pong in 2 s, resolve false
        setTimeout(() => resolve(false), 2000);
      });

      // Skip the initial jobs-snapshot message, then send a ping
      await new Promise<void>((r) => setTimeout(r, 50));
      ws.send(JSON.stringify({ type: "ping" }));

      expect(await pongReceived).toBe(true);
      ws.close();
    } finally {
      httpServer.closeAllConnections?.();
      await new Promise<void>((r) => httpServer.close(r));
    }
  });

  // ── Dead-connection detection: server terminates when no pong arrives ─────
  // With fake timers advancing faster than real I/O, the server's second
  // heartbeat check finds isAlive=false and calls ws.terminate().

  it("terminates the connection when no pong arrives before the next ping check", async () => {
    vi.useFakeTimers();

    const httpServer = createServer();
    attachWebSocketServer(httpServer as Parameters<typeof attachWebSocketServer>[0]);
    await new Promise<void>((resolve) =>
      httpServer.listen(0, "127.0.0.1", resolve)
    );
    const port = (httpServer.address() as { port: number }).port;

    try {
      const { ws, open } = openConnection(port);
      await open;

      const closedPromise = new Promise<void>((r) => ws.once("close", () => r()));

      // Advance two full intervals at fake speed — the real pong hasn't arrived
      // between the two intervals, so the server terminates the connection.
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2 + 200);

      // Connection should be closed (code 1006 = abnormal closure from ws.terminate())
      await expect(closedPromise).resolves.toBeUndefined();
    } finally {
      httpServer.closeAllConnections?.();
      await new Promise<void>((r) => httpServer.close(r));
      vi.useRealTimers();
    }
  });
});

