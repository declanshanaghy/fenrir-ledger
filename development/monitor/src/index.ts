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
const NAMESPACE = process.env.K8S_NAMESPACE ?? "fenrir-app";
const JOB_LABEL = process.env.JOB_LABEL_SELECTOR ?? "app=odin-agent";

// ── Health check (public) ────────────────────────────────────────────────────
app.get("/healthz", (c) => {
  return c.json({ status: "ok", service: "odin-throne-monitor", ts: Date.now() });
});

// ── Auth routes (public) ─────────────────────────────────────────────────────
app.get("/auth/login", handleLogin);
app.get("/auth/callback", handleCallback);
app.get("/auth/logout", handleLogout);

// ── Session gate — all routes below require a valid session ──────────────────
app.use("*", async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token || !verifySessionToken(token)) {
    // JSON clients get 401; browsers get the login page
    const accept = c.req.header("accept") ?? "";
    if (accept.includes("application/json")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return c.html(loginPage(), 401);
  }
  await next();
});

// ── Protected routes ─────────────────────────────────────────────────────────

// List agent jobs
app.get("/api/jobs", async (c) => {
  try {
    const jobs = await listAgentJobs(NAMESPACE, JOB_LABEL);
    return c.json({ jobs, count: jobs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Graceful fallback when no cluster is available
    console.warn("[k8s] Could not list jobs:", message);
    return c.json({ jobs: [], count: 0, error: message });
  }
});

// Dashboard index
app.get("/", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Odin's Throne — Monitor</title>
  <style>
    :root { --gold: #c8a44a; --bg: #0a0a0f; --fg: #e8e0d0; --dim: #6b6460; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--fg); font-family: 'Cinzel', Georgia, serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; }
    h1 { color: var(--gold); font-size: 2rem; letter-spacing: 0.15em; }
    p { color: var(--dim); font-size: 0.9rem; }
    a { color: var(--gold); text-decoration: none; border-bottom: 1px solid var(--gold); padding-bottom: 1px; }
    .links { display: flex; gap: 2rem; }
  </style>
</head>
<body>
  <h1>Odin&#8217;s Throne</h1>
  <p>Real-time agent monitor for Fenrir Ledger</p>
  <div class="links">
    <a href="/healthz">Health</a>
    <a href="/api/jobs">Jobs</a>
    <a href="/auth/logout">Sign out</a>
  </div>
</body>
</html>`);
});

// ── Start server with WebSocket support ──────────────────────────────────────
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(
    `[odin-throne] Listening on http://localhost:${info.port}`
  );
});

attachWebSocketServer(server);

export { app };
