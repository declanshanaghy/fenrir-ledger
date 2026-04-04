import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { listAgentJobs, deleteAgentJob, findPodForSession, streamPodLogs } from "./k8s.js";
import { attachWebSocketServer } from "./ws.js";
import { listHouseholds, getCardsForHousehold } from "./firestore.js";

const app = new Hono();

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const NAMESPACE = process.env.K8S_NAMESPACE ?? "fenrir-agents";
const JOB_LABEL = process.env.JOB_LABEL_SELECTOR ?? "app.kubernetes.io/component=agent-sandbox";

// ── Health check (public) ────────────────────────────────────────────────────
app.get("/healthz", (c) => {
  return c.json({ status: "ok", service: "odin-throne-monitor", ts: Date.now() });
});

// ── Protected routes (auth enforced by oauth2-proxy sidecar) ─────────────────

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

// Download full agent session log from K8s pod
app.get("/api/logs/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  try {
    const podName = await findPodForSession(sessionId, NAMESPACE);
    if (!podName) {
      return c.json({ error: "Pod not found for session" }, 404);
    }
    const lines: string[] = [];
    await new Promise<void>((resolve, reject) => {
      streamPodLogs(
        podName,
        NAMESPACE,
        (line) => lines.push(line),
        () => resolve(),
        (err) => reject(err),
        { follow: false }
      );
    });
    const content = lines.join("\n");
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sessionId}.log"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[k8s] Could not fetch logs for session ${sessionId}:`, message);
    return c.json({ error: message }, 500);
  }
});

// Cancel / delete a running agent job — invoked by Ragnarök dialog confirm
app.delete("/api/jobs/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  try {
    await deleteAgentJob(sessionId, NAMESPACE);
    console.log(`[k8s] Job deleted for session ${sessionId}`);
    return c.json({ ok: true, sessionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[k8s] Could not delete job for session ${sessionId}:`, message);
    return c.json({ ok: false, error: message }, 500);
  }
});

// ── Household / card routes (admin monitoring) ────────────────────────────────

// List all households — for the household selector in the monitoring UI
app.get("/api/households", async (c) => {
  try {
    const households = await listHouseholds();
    return c.json({ households, count: households.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[firestore] Could not list households:", message);
    return c.json({ households: [], count: 0, error: message });
  }
});

// List cards for a household — called when a household is selected in the UI
app.get("/api/households/:householdId/cards", async (c) => {
  const householdId = c.req.param("householdId");
  try {
    const cards = await getCardsForHousehold(householdId);
    return c.json({ cards, count: cards.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[firestore] Could not list cards for household ${householdId}:`, message);
    return c.json({ cards: [], count: 0, error: message });
  }
});

// ── Static file serving — Vite build output ───────────────────────────────────
// Serves dist-ui/ as static assets (production build of the React UI).
// This runs AFTER API routes so API requests are never intercepted.
app.use("/*", serveStatic({ root: "./dist-ui" }));

// SPA fallback — serve index.html for any unmatched routes
app.get("/*", serveStatic({ path: "./dist-ui/index.html" }));

// ── Start server with WebSocket support ──────────────────────────────────────
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[odin-throne] Listening on http://localhost:${info.port}`);
});

attachWebSocketServer(server, NAMESPACE, JOB_LABEL);

export { app };
