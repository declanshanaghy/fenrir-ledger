#!/usr/bin/env node
// --------------------------------------------------------------------------
// serve.mjs — Agent Monitor dev server with K8s API proxy
//
// Serves index.html AND proxies /api/* to kubectl proxy, avoiding CORS.
// No dependencies — uses Node built-ins only.
//
// Usage:
//   node serve.mjs [port]     # default: 9000
//   just agent-monitor        # via Justfile
//
// Automatically starts kubectl proxy if not already running.
// --------------------------------------------------------------------------

import { createServer, request as httpRequest } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawn } from "node:child_process";
import { MAYO_HECKLES, AGENT_COMEBACKS, ESCALATION_RETORTS, NEW_HECKLER_ENTRANCES, MAYO_FIRST, MAYO_SURNAME, AGENT_NAMES } from "../../infrastructure/k8s/agents/mayo-heckler.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2] || "9000", 10);
const K8S_PROXY_PORT = 8001;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

// Ensure kubectl proxy is running
function ensureKubectlProxy() {
  try {
    execSync(`curl -sf http://localhost:${K8S_PROXY_PORT}/api/v1 > /dev/null 2>&1`);
    console.log(`kubectl proxy already running on :${K8S_PROXY_PORT}`);
  } catch {
    console.log(`Starting kubectl proxy on :${K8S_PROXY_PORT}...`);
    const proc = spawn("kubectl", ["proxy", "--port=" + K8S_PROXY_PORT], {
      stdio: "ignore",
      detached: true,
    });
    proc.unref();
    // Give it a moment to start
    execSync("sleep 1");
  }
}

ensureKubectlProxy();

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Proxy K8s API requests to kubectl proxy
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/apis/")) {
    const opts = {
      hostname: "localhost",
      port: K8S_PROXY_PORT,
      path: url.pathname + url.search,
      method: req.method,
      headers: { "Accept": "application/json" },
    };

    const proxy = httpRequest(opts, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        "Content-Type": proxyRes.headers["content-type"] || "application/json",
      });
      proxyRes.pipe(res);
    });

    proxy.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "kubectl proxy error",
        detail: err.message,
        hint: "Run: kubectl proxy --port=8001",
      }));
    });

    req.pipe(proxy);
    return;
  }

  // Mayo heckler data endpoint — SPA fetches this to share data with CLI
  if (url.pathname === "/mayo-data.json") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      heckles: MAYO_HECKLES,
      comebacks: AGENT_COMEBACKS,
      escalation: ESCALATION_RETORTS,
      entrances: NEW_HECKLER_ENTRANCES,
      firstNames: MAYO_FIRST,
      surnames: MAYO_SURNAME,
      agentNames: AGENT_NAMES,
    }));
    return;
  }

  // Static files
  const filePath = join(__dirname, url.pathname === "/" ? "index.html" : url.pathname);

  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server error");
  }
});

server.listen(PORT, () => {
  console.log(`\nAgent Monitor: http://localhost:${PORT}`);
  console.log(`K8s API proxy: localhost:${K8S_PROXY_PORT} → /api/*\n`);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
