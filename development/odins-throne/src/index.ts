import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { listAgentJobs, deleteAgentJob, findPodForSession, streamPodLogs } from "./k8s.js";
import { attachWebSocketServer } from "./ws.js";

const app = new Hono();

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const DEFAULT_NAMESPACE = process.env.K8S_NAMESPACE ?? "fenrir-agents";
const JOB_LABEL = process.env.JOB_LABEL_SELECTOR ?? "app.kubernetes.io/component=agent-sandbox";

// ── Namespace configuration ──────────────────────────────────────────────────

export interface NamespaceConfig {
  id: string;
  label: string;
}

const DEFAULT_NAMESPACES: NamespaceConfig[] = [
  { id: "fenrir-agents", label: "Fenrir Ledger Agents" },
  { id: "say-so-agents", label: "SaySo Agents" },
];

function loadNamespaces(): NamespaceConfig[] {
  // Prefer NAMESPACES_JSON env var (injected from ConfigMap)
  const raw = process.env.NAMESPACES_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as NamespaceConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      console.warn("[config] Failed to parse NAMESPACES_JSON, using defaults");
    }
  }
  return DEFAULT_NAMESPACES;
}

const NAMESPACES = loadNamespaces();

/** Validate that a namespace param is in the allowed list. */
function resolveNamespace(param: string | undefined): string {
  if (!param) return DEFAULT_NAMESPACE;
  const allowed = NAMESPACES.map((n) => n.id);
  return allowed.includes(param) ? param : DEFAULT_NAMESPACE;
}

// ── Health check (public) ────────────────────────────────────────────────────
app.get("/healthz", (c) => {
  return c.json({ status: "ok", service: "odin-throne-monitor", ts: Date.now() });
});

// ── Protected routes (auth enforced by oauth2-proxy sidecar) ─────────────────

// Return available namespaces — read from NAMESPACES_JSON env var (sourced from ConfigMap)
app.get("/api/namespaces", (c) => {
  return c.json({ namespaces: NAMESPACES });
});

// List agent jobs — kept for curl debugging; UI uses WebSocket push
app.get("/api/jobs", async (c) => {
  const namespace = resolveNamespace(c.req.query("namespace"));
  try {
    const jobs = await listAgentJobs(namespace, JOB_LABEL);
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
  const namespace = resolveNamespace(c.req.query("namespace"));
  try {
    const podName = await findPodForSession(sessionId, namespace);
    if (!podName) {
      return c.json({ error: "Pod not found for session" }, 404);
    }
    const lines: string[] = [];
    await new Promise<void>((resolve, reject) => {
      streamPodLogs(
        podName,
        namespace,
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
  const namespace = resolveNamespace(c.req.query("namespace"));
  try {
    await deleteAgentJob(sessionId, namespace);
    console.log(`[k8s] Job deleted for session ${sessionId}`);
    return c.json({ ok: true, sessionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[k8s] Could not delete job for session ${sessionId}:`, message);
    return c.json({ ok: false, error: message }, 500);
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

attachWebSocketServer(server, JOB_LABEL, NAMESPACES.map((n) => n.id), DEFAULT_NAMESPACE);

export { app };
