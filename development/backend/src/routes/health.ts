import { Hono } from "hono";

const health = new Hono();

/**
 * GET /health — Liveness probe.
 * Returns a JSON object with server status, service name, and ISO timestamp.
 * Used by Fly.io health checks, monitoring, and the frontend availability probe.
 */
health.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "fenrir-ledger-backend",
    ts: new Date().toISOString(),
  });
});

export default health;
