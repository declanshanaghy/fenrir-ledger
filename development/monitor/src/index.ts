import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { getCookie } from "hono/cookie";
import { listAgentJobs } from "./k8s.js";
import { attachWebSocketServer } from "./ws.js";
import {
  handleLogin,
  handleCallback,
  handleLogout,
  verifySessionToken,
  loginPage,
  SESSION_COOKIE,
} from "./auth.js";

const app = new Hono();

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const NAMESPACE = process.env.K8S_NAMESPACE ?? "fenrir-agents";
const JOB_LABEL = process.env.JOB_LABEL_SELECTOR ?? "app.kubernetes.io/component=agent-sandbox";

// ── Health check (public) ────────────────────────────────────────────────────
app.get("/healthz", (c) => {
  return c.json({ status: "ok", service: "odin-throne-monitor", ts: Date.now() });
});

// ── Auth toggle ──────────────────────────────────────────────────────────────
const AUTH_DISABLED = !process.env.SESSION_SECRET && process.env.NODE_ENV !== "production";
if (AUTH_DISABLED) {
  console.log("[odin-throne] Auth disabled (no SESSION_SECRET, non-production)");
}

// ── Auth routes (public, but only when auth is enabled) ──────────────────────
if (!AUTH_DISABLED) {
  app.get("/auth/login", handleLogin);
  app.get("/auth/callback", handleCallback);
  app.get("/auth/logout", handleLogout);
} else {
  app.get("/auth/login", (c) => c.redirect("/"));
  app.get("/auth/callback", (c) => c.redirect("/"));
  app.get("/auth/logout", (c) => c.redirect("/"));
}

// ── Session gate — all routes below require a valid session ──────────────────
app.use("*", async (c, next) => {
  if (AUTH_DISABLED) return next();
  const token = getCookie(c, SESSION_COOKIE);
  if (!token || !verifySessionToken(token)) {
    const accept = c.req.header("accept") ?? "";
    if (accept.includes("application/json")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return c.html(loginPage(), 401);
  }
  await next();
});

// ── Protected routes ─────────────────────────────────────────────────────────

// List agent jobs — kept for curl debugging; UI uses WebSocket push
app.get("/api/jobs", async (c) => {
  try {
    const jobs = await listAgentJobs(NAMESPACE, JOB_LABEL);
    return c.json({ jobs, count: jobs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[k8s] Could not list jobs:", message);
    return c.json({ jobs: [], count: 0, error: message });
  }
});

// ── Start server with WebSocket support ──────────────────────────────────────
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[odin-throne] API listening on http://localhost:${info.port}`);
});

attachWebSocketServer(server, NAMESPACE, JOB_LABEL);

export { app };
