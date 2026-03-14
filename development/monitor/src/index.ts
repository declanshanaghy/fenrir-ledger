import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { getCookie } from "hono/cookie";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new Hono();

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const NAMESPACE = process.env.K8S_NAMESPACE ?? "fenrir-app";
const JOB_LABEL = process.env.JOB_LABEL_SELECTOR ?? "app=odin-agent";

const ODIN_QUOTES = [
  "I hung on that windy tree for nine long nights. What's a failed build to that?",
  "I gave my eye for wisdom. You lot better not waste it on sloppy commits.",
  "The wolves are always hungry. Ship or be devoured.",
  "I see all nine worlds from Hlidskjalf. I can certainly see your merge conflicts.",
  "Even Ragnarok has a sprint deadline.",
  "The All-Father watches. The All-Father judges. The All-Father merges.",
  "Every rune I carved cost blood. Every PR you ship better be worth it.",
  "Fenrir breaks chains. We break annual fees. Same energy.",
  "My spear Gungnir never misses its mark. Your tests should aspire to the same.",
] as const;

function randomQuote(): string {
  return ODIN_QUOTES[Math.floor(Math.random() * ODIN_QUOTES.length)];
}

let odinAvatarPng: Buffer | null = null;
try {
  odinAvatarPng = readFileSync(resolve(__dirname, "../public/odin-dark.png"));
} catch {
  // Avatar not found — image will be omitted gracefully
}

function buildHlidskjalfHtml(quote: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Odin's Throne — Hlidskjalf</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&family=Source+Serif+4:wght@300;400;600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --void: #07070d;
  --forge: #12121f;
  --chain: #1a1a2e;
  --gold: #c9920a;
  --gold-bright: #f0b429;
  --text-saga: #f5f5f5;
  --text-rune: #a0a0b0;
  --text-void: #606070;
  --rune-border: #2a2a3e;
  --teal-asgard: #4ecdc4;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; }
body { background: var(--void); color: var(--text-saga); font-family: 'Source Serif 4', serif; display: flex; }

/* ── Sidebar ─────────────────────────────────────────────────────── */
.sidebar {
  width: 300px; min-width: 300px; height: 100vh;
  overflow-y: auto; border-right: 1px solid var(--rune-border);
  background: var(--forge); display: flex; flex-direction: column;
}
.sidebar-header {
  padding: 1rem; border-bottom: 1px solid var(--rune-border); flex-shrink: 0;
}
.sidebar-header .brand { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.sidebar-header img {
  width: 40px; height: 40px; border-radius: 50%;
  border: 2px solid var(--gold); background: var(--void); mix-blend-mode: lighten;
}
.sidebar-header h1 { font-family: 'Cinzel Decorative', serif; font-size: 1.1rem; color: var(--gold); }
.sidebar-header .quote { font-style: italic; font-size: 0.75rem; color: var(--text-rune); opacity: 0.8; line-height: 1.4; }
.sidebar-header .count { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: var(--text-void); margin-top: 0.5rem; }
.card-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
.card {
  padding: 0.6rem 0.75rem; border-radius: 4px; cursor: pointer;
  margin-bottom: 2px; border-left: 3px solid transparent; transition: background 0.15s;
}
.card:hover { background: var(--chain); }
.card.active { background: var(--chain); border-left-color: var(--gold); }
.card-top { display: flex; justify-content: space-between; align-items: center; }
.card-agent { font-family: 'Cinzel', serif; font-weight: 700; font-size: 0.8rem; }
.card-status { font-size: 0.9rem; flex-shrink: 0; }
.card-status.pulse { animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.card-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: var(--text-rune); margin-top: 0.15rem; }
.card-date { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: var(--text-void); margin-top: 0.1rem; }

/* ── Content area ─────────────────────────────────────────────────── */
.content { flex: 1; height: 100vh; display: flex; flex-direction: column; background: var(--void); min-width: 0; }
.content-header {
  padding: 0.6rem 1rem; border-bottom: 1px solid var(--rune-border);
  background: var(--forge); flex-shrink: 0;
  display: flex; align-items: center; gap: 1rem;
}
.content-header .session-title { font-family: 'Cinzel', serif; font-size: 0.85rem; color: var(--gold); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.content-header .ws-badge {
  font-family: 'JetBrains Mono', monospace; font-size: 0.65rem;
  padding: 0.15rem 0.5rem; border-radius: 3px; border: 1px solid var(--rune-border);
  flex-shrink: 0;
}
.ws-badge.connecting { color: var(--gold-bright); border-color: var(--gold-bright); }
.ws-badge.open       { color: var(--teal-asgard); border-color: var(--teal-asgard); }
.ws-badge.closed     { color: var(--text-void); border-color: var(--rune-border); }
.ws-badge.error      { color: #ef4444; border-color: #ef4444; }
.log-terminal {
  flex: 1; overflow-y: auto; padding: 1rem;
  font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; line-height: 1.6;
  color: var(--text-saga); scroll-behavior: smooth;
}
.log-line { white-space: pre-wrap; word-break: break-all; }
.log-ts { color: var(--text-void); margin-right: 0.5rem; user-select: none; }
.log-error { color: #ef4444; }
.log-system { color: var(--text-void); font-style: italic; }
.log-end { color: var(--gold); font-style: italic; margin-top: 0.5rem; border-top: 1px solid var(--rune-border); padding-top: 0.5rem; }
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; flex: 1; gap: 0.75rem; color: var(--text-void);
}
.empty-state .empty-title { font-family: 'Cinzel', serif; font-size: 1.2rem; }
.empty-state .empty-sub { font-size: 0.85rem; font-style: italic; }

/* ── Responsive collapse ─────────────────────────────────────────── */
@media (max-width: 600px) {
  body { flex-direction: column; overflow: auto; }
  .sidebar { width: 100%; min-width: unset; height: auto; max-height: 40vh; border-right: none; border-bottom: 1px solid var(--rune-border); }
  .content { height: 60vh; }
  html, body { overflow: auto; }
}
</style>
</head>
<body aria-label="Odin's Throne — Hlidskjalf">

<nav class="sidebar" aria-label="Agent sessions">
  <div class="sidebar-header">
    <div class="brand">
      <img src="/static/odin-dark.png" alt="Odin" aria-hidden="true">
      <h1>Hlidskjalf</h1>
    </div>
    <div class="quote" role="note">"${quote}"</div>
    <div class="count" id="job-count" aria-live="polite">Loading…</div>
  </div>
  <div class="card-list" id="card-list" role="list" aria-label="Job sessions"></div>
</nav>

<main class="content" aria-label="Log viewer">
  <div class="content-header" id="content-header" style="display:none" aria-label="Active session">
    <span class="session-title" id="session-title"></span>
    <span class="ws-badge closed" id="ws-badge">disconnected</span>
  </div>
  <div class="log-terminal" id="log-terminal" role="log" aria-live="polite" aria-label="Session logs" style="display:none"></div>
  <div class="empty-state" id="empty-state" aria-label="No session selected">
    <div class="empty-title">All Nine Worlds await</div>
    <div class="empty-sub">Select an agent session to stream its logs</div>
  </div>
</main>

<script>
'use strict';

const AGENT_NAMES = {
  firemandecko: 'FiremanDecko',
  loki: 'Loki',
  luna: 'Luna',
  freya: 'Freya',
  heimdall: 'Heimdall',
};
const AGENT_COLORS = {
  firemandecko: '#4ecdc4',
  loki: '#a78bfa',
  luna: '#6b8afd',
  freya: '#f0b429',
  heimdall: '#ef4444',
};
const STATUS_ICONS = {
  active:    '\\u25CF', // ● filled circle — pulsing live
  succeeded: '\\u2713', // ✓ checkmark
  failed:    '\\u2717', // ✗ cross
  pending:   '\\u29D7', // ⧗ hourglass
};
const STATUS_COLORS = {
  active:    '#4ecdc4',
  succeeded: '#22c55e',
  failed:    '#ef4444',
  pending:   '#f0b429',
};
const STATUS_LABELS = {
  active:    'running',
  succeeded: 'succeeded',
  failed:    'FAILED',
  pending:   'pending',
};

/** Parse session info from job name or labels.
 *  Job name format: agent-issue-NNN-stepN-agentname[-hash] */
function parseJob(job) {
  const sessionId = (job.labels && job.labels['fenrir.dev/session-id'])
    || job.name.replace(/^agent-/, '');
  const m = sessionId.match(/issue-(\d+)-step(\d+)-([a-z]+)/i);
  const agentKey = m ? m[3].toLowerCase() : 'unknown';
  return {
    name: job.name,
    sessionId,
    issue: m ? m[1] : '?',
    step: m ? m[2] : '?',
    agentKey,
    agentName: AGENT_NAMES[agentKey] || agentKey,
    status: job.status,
    startTime: job.startTime ? new Date(job.startTime).getTime() : null,
    completionTime: job.completionTime ? new Date(job.completionTime).getTime() : null,
  };
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
  });
}

// ── State ──────────────────────────────────────────────────────────────────

let currentJobs = [];
let activeSessionId = null;
let activeWs = null;

// ── Sidebar rendering ──────────────────────────────────────────────────────

function renderCards(jobs) {
  const list = document.getElementById('card-list');
  const countEl = document.getElementById('job-count');
  if (!list) return;

  countEl.textContent = jobs.length + ' session' + (jobs.length !== 1 ? 's' : '');

  if (jobs.length === 0) {
    list.innerHTML = '<div style="padding:1rem;font-size:0.8rem;color:var(--text-void);font-style:italic">No agent jobs found</div>';
    return;
  }

  list.innerHTML = jobs.map(j => {
    const color = AGENT_COLORS[j.agentKey] || '#c9920a';
    const sColor = STATUS_COLORS[j.status] || '#606070';
    const sIcon = STATUS_ICONS[j.status] || '\\u2014';
    const sLabel = STATUS_LABELS[j.status] || j.status;
    const pulse = j.status === 'active' ? ' pulse' : '';
    const isActive = j.sessionId === activeSessionId ? ' active' : '';
    const ts = j.startTime || j.completionTime;
    const timeStr = fmtTime(ts);
    const agoStr = ts ? timeAgo(ts) : '';
    return '<div class="card' + isActive + '" role="listitem"'
      + ' aria-label="Job: ' + j.agentName + ' issue ' + j.issue + ' step ' + j.step + '"'
      + ' data-session="' + j.sessionId + '">'
      + '<div class="card-top">'
      + '<span class="card-agent" style="color:' + color + '">' + j.agentName + '</span>'
      + '<span class="card-status' + pulse + '" style="color:' + sColor + '" title="' + j.status + '">' + sIcon + '</span>'
      + '</div>'
      + '<div class="card-meta">#' + j.issue + ' &middot; Step ' + j.step + ' &middot; <span style="color:' + sColor + '">' + sLabel + '</span></div>'
      + '<div class="card-date">'
      + (timeStr ? timeStr + ' ' : '')
      + (agoStr ? '<span style="color:var(--teal-asgard)">' + agoStr + '</span>' : '')
      + '</div>'
      + '</div>';
  }).join('');

  // Attach click handlers
  list.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const sid = card.getAttribute('data-session');
      if (sid) openSession(sid, jobs.find(j => j.sessionId === sid));
    });
  });
}

// ── Log terminal ───────────────────────────────────────────────────────────

function setWsBadge(state) {
  const badge = document.getElementById('ws-badge');
  if (!badge) return;
  badge.className = 'ws-badge ' + state;
  badge.textContent = state;
}

function appendLog(html) {
  const term = document.getElementById('log-terminal');
  if (!term) return;
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = html;
  term.appendChild(div);
  term.scrollTop = term.scrollHeight;
}

function clearLog() {
  const term = document.getElementById('log-terminal');
  if (term) term.innerHTML = '';
}

function openSession(sessionId, job) {
  if (activeWs) {
    activeWs.close();
    activeWs = null;
  }

  activeSessionId = sessionId;

  // Update header
  document.getElementById('content-header').style.display = 'flex';
  document.getElementById('log-terminal').style.display = 'block';
  document.getElementById('empty-state').style.display = 'none';

  const titleEl = document.getElementById('session-title');
  if (job) {
    titleEl.textContent = job.agentName + ' — #' + job.issue + ' Step ' + job.step + ' (' + sessionId + ')';
  } else {
    titleEl.textContent = sessionId;
  }

  // Mark active card
  document.querySelectorAll('.card').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-session') === sessionId);
  });

  clearLog();
  setWsBadge('connecting');

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = proto + '//' + location.host + '/ws/logs/' + encodeURIComponent(sessionId);
  const ws = new WebSocket(wsUrl);
  activeWs = ws;

  ws.addEventListener('open', () => setWsBadge('open'));

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.type === 'connected') {
      appendLog('<span class="log-system">\\u2014 connected to session ' + escHtml(msg.sessionId) + ' \\u2014</span>');
    } else if (msg.type === 'log') {
      const ts = msg.ts ? '<span class="log-ts">' + new Date(msg.ts).toLocaleTimeString() + '</span>' : '';
      appendLog(ts + escHtml(msg.line));
    } else if (msg.type === 'error') {
      appendLog('<span class="log-error">\\u26A0 ' + escHtml(msg.message) + '</span>');
      setWsBadge('error');
    } else if (msg.type === 'end') {
      appendLog('<div class="log-end">\\u2014 stream ended \\u2014</div>');
      setWsBadge('closed');
    }
  });

  ws.addEventListener('close', () => {
    if (activeWs === ws) setWsBadge('closed');
  });

  ws.addEventListener('error', () => {
    appendLog('<span class="log-error">WebSocket error — check that the session pod exists</span>');
    setWsBadge('error');
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Job polling ────────────────────────────────────────────────────────────

async function fetchJobs() {
  try {
    const res = await fetch('/api/jobs');
    if (!res.ok) return;
    const data = await res.json();
    const jobs = (data.jobs || []).map(parseJob)
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    currentJobs = jobs;
    renderCards(jobs);
  } catch { /* network error — keep last state */ }
}

// Update relative timestamps every 10s without re-fetching
function refreshTimestamps() {
  renderCards(currentJobs);
}

fetchJobs();
setInterval(fetchJobs, 15000);
setInterval(refreshTimestamps, 10000);
</script>
</body>
</html>`;
}

// ── Routes ──────────────────────────────────────────────────────────────────

// Serve Odin avatar
app.get("/static/odin-dark.png", (c) => {
  if (!odinAvatarPng) return c.notFound();
  return new Response(odinAvatarPng as Buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

// Health check
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

// Hlidskjalf UI
app.get("/", (c) => {
  return c.html(buildHlidskjalfHtml(randomQuote()));
});

// ── Start server with WebSocket support ──────────────────────────────────────
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(
    `[odin-throne] Listening on http://localhost:${info.port}`
  );
});

attachWebSocketServer(server);

export { app };
