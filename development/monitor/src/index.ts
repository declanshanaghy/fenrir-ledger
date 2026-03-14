import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { listAgentJobs } from "./k8s.js";
import { attachWebSocketServer } from "./ws.js";

const app = new Hono();

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const NAMESPACE = process.env.K8S_NAMESPACE ?? "fenrir-app";
const JOB_LABEL = process.env.JOB_LABEL_SELECTOR ?? "app=odin-agent";

// Health check
app.get("/healthz", (c) => {
  return c.json({ status: "ok", service: "odin-throne-monitor", ts: Date.now() });
});

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

// Basic index
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
  <h1>Odin's Throne</h1>
  <p>Real-time agent monitor for Fenrir Ledger</p>
  <div class="links">
    <a href="/healthz">Health</a>
    <a href="/api/jobs">Jobs</a>
  </div>
</body>
</html>`);
});

// Start server with WebSocket support
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(
    `[odin-throne] Listening on http://localhost:${info.port}`
  );
});

attachWebSocketServer(server);

export { app };
