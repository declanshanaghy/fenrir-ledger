#!/usr/bin/env node
/**
 * generate-agent-report.mjs — Converts Claude Code stream-json agent logs
 * into styled HTML reports using the Fenrir Ledger theme system.
 *
 * Usage:
 *   node generate-agent-report.mjs --input <log-file> [--output <html-file>]
 *   node generate-agent-report.mjs --input <log-file> --publish [--blog-dir <dir>]
 *   node generate-agent-report.mjs --regen-assets [--output-dir <dir>]
 *
 * If --output is omitted, replaces .log with .html in the same directory.
 * --publish generates MDX output to content/blog/ for chronicles publishing.
 * --regen-assets regenerates shared CSS/JS files in the output directory.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { createHecklerEngine, AGENT_NAMES } from "../../../../infrastructure/k8s/agents/mayo-heckler.mjs";
import { sanitizeText, sanitizeToolOutput } from "./sanitize-chronicle.mjs";
import {
  AGENT_SIGNOFFS,
  AGENT_CALLBACK_QUOTES,
  AGENT_CALLBACK_RUNES,
  parseDecreeBlock,
} from "./agent-identity.mjs";

// Resolve script directory for relative asset paths (ESM-safe)
const __scriptDir = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  return args[i + 1] || true;
}

const regenOnly = args.includes("--regen-assets");
const publishMode = args.includes("--publish");
const inputPath = flag("input");
const outputPath = flag("output");
const outputDir = flag("output-dir");
const blogDir = flag("blog-dir");

if (!regenOnly && !inputPath) {
  console.error("Usage: generate-agent-report.mjs --input <log> [--output <html>]");
  console.error("       generate-agent-report.mjs --input <log> --publish [--blog-dir <dir>]");
  console.error("       generate-agent-report.mjs --regen-assets [--output-dir <dir>]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Shared CSS — loaded from canonical chronicle.css
// ---------------------------------------------------------------------------
// chronicle.css lives at: development/ledger/src/app/chronicles/chronicle.css
// The script resolves it relative to its own location so it works from any CWD.
const _chronicleCssPath = join(
  __scriptDir,
  "../../../../development/ledger/src/app/chronicles/chronicle.css"
);
const CSS = readFileSync(_chronicleCssPath, "utf-8");

// ---------------------------------------------------------------------------
// Shared JS
// ---------------------------------------------------------------------------
const JS = `/* agent-report.js — Toggle logic + profile dialogs for agent report */

// Heckler family profiles
const HECKLER_PROFILES = {
  'heckler-avatar.png': { role: 'The Patriarch', bio: "Been going to matches since before the curse. Pint always full, voice always hoarse." },
  'heckler-granny.png': { role: 'The Granny', bio: "Remembers 1951. ACTUALLY remembers it. Has been waiting 73 years." },
  'heckler-da.png': { role: 'The Da', bio: "Accountant by day, lunatic by Sunday. Has a spreadsheet tracking every Mayo score since 1989." },
  'heckler-uncle.png': { role: 'The Uncle', bio: "Played minor for Mayo in \\'84. Still talks about it. Every. Single. Sunday." },
  'heckler-mammy.png': { role: 'The Mammy', bio: "Doesn\\'t fully understand the rules but NOBODY supports Mayo harder." },
  'heckler-teen.png': { role: 'The Teenager', bio: "Never known anything but heartbreak. Runs the Mayo GAA TikTok with 12 followers." },
  'heckler-lad.png': { role: 'The Young Lad', bio: "Can recite every Mayo team since 2004. Communion money went on a Cillian O\\'Connor jersey." },
  'heckler-lass.png': { role: 'The Wee Girl', bio: "Got sent home from school for painting the classroom green and red." },
};

const AGENT_PROFILES = {
  'fireman-decko': { name: 'FiremanDecko', role: 'Principal Engineer', bio: 'Forges code in the fires of Muspelheim. Ships code like Mayo ships heartbreak — relentlessly.' },
  'loki': { name: 'Loki', role: 'QA Tester', bio: 'The trickster who finds every flaw. PASS or FAIL, there is no maybe.' },
  'luna': { name: 'Luna', role: 'UX Designer', bio: 'Moonlight illuminates the wireframes. Mobile-first, always.' },
  'freya': { name: 'Freya', role: 'Product Owner', bio: 'Goddess of strategy, keeper of the backlog.' },
  'heimdall': { name: 'Heimdall', role: 'Security Specialist', bio: 'The watchman who sees all threats.' },
};

function showProfile(name, imgSrc, role, bio, color) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(7,7,13,0.85);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = '<div style="background:linear-gradient(135deg,#1a1a2e,#07070d);border:2px solid '+color+';border-radius:1rem;padding:2rem;max-width:400px;width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.5);">'
    + '<img src="'+imgSrc+'" style="width:80px;height:80px;border-radius:50%;display:block;margin:0 auto 1rem;border:3px solid '+color+';object-fit:cover;" onerror="this.style.display=\\'none\\'">'
    + '<div style="text-align:center;color:'+color+';font-size:1.2rem;font-weight:700;">'+name+'</div>'
    + '<div style="text-align:center;color:#c9920a;font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin:0.25rem 0 1rem;">'+role+'</div>'
    + '<div style="text-align:center;color:#f5f5f5;font-size:0.85rem;line-height:1.6;margin-bottom:1.5rem;">'+bio+'</div>'
    + '<button onclick="this.closest(\\'div\\').parentElement.remove()" style="display:block;width:100%;padding:0.6rem;background:'+color+';color:white;border:none;border-radius:0.5rem;font-weight:700;cursor:pointer;">Back to the Match!!</button>'
    + '</div>';
  document.body.appendChild(overlay);
}

const ODIN_QUOTES = [
  "I hung on that windy tree for nine long nights, wounded by my own spear. What\\'s a failed build to that?",
  "I gave my eye for wisdom. You lot better not waste it on sloppy commits.",
  "The wolves are always hungry. Ship or be devoured.",
  "In the beginning there was nothing. Then I filed an issue.",
  "I see all nine worlds from Hlidskjalf. I can certainly see your merge conflicts.",
  "Huginn brings me thought, Muninn brings me memory. Neither brings me passing tests — that\\'s Loki\\'s job.",
  "Even Ragnarok has a sprint deadline.",
  "The All-Father watches. The All-Father judges. The All-Father merges.",
  "I didn\\'t sacrifice everything to build Asgard just to watch agents idle.",
  "Wisdom is knowing when to dispatch. Courage is reading the agent logs.",
  "Every rune I carved cost blood. Every PR you ship better be worth it.",
  "Fenrir breaks chains. We break annual fees. Same energy.",
  "The ravens fly at dawn. The agents deploy at merge.",
  "I walked among mortals to learn their ways. Now I walk among agents to review their code.",
  "My spear Gungnir never misses its mark. Your tests should aspire to the same.",
];

document.addEventListener('DOMContentLoaded', () => {
  // Odin quote
  const quoteEl = document.getElementById('odin-quote');
  if (quoteEl) quoteEl.textContent = ODIN_QUOTES[Math.floor(Math.random() * ODIN_QUOTES.length)];

  // Turn collapse/expand
  document.querySelectorAll('.turn-header').forEach(h => {
    h.addEventListener('click', () => h.closest('.turn-box').classList.toggle('open'));
  });
  document.querySelectorAll('.tool-block-header').forEach(h => {
    h.addEventListener('click', e => {
      e.stopPropagation();
      h.closest('.tool-block').classList.toggle('open');
    });
  });
  document.getElementById('expand-all')?.addEventListener('click', () => {
    document.querySelectorAll('.turn-box').forEach(t => t.classList.add('open'));
  });
  document.getElementById('collapse-all')?.addEventListener('click', () => {
    document.querySelectorAll('.turn-box, .tool-block').forEach(t => t.classList.remove('open'));
  });

  // Make all heckler avatars clickable
  document.querySelectorAll('.heckle-mayo .heckle-avatar, .heckle-entrance .heckle-avatar').forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', e => {
      e.stopPropagation();
      const src = img.src.split('/').pop();
      const profile = HECKLER_PROFILES[src] || { role: 'Mayo Fan', bio: 'A passionate supporter of the green and red.' };
      const nameEl = img.closest('.heckle')?.querySelector('strong');
      const name = nameEl ? nameEl.textContent.replace(':', '') : 'Mayo Fan';
      showProfile(name, img.src, profile.role, profile.bio, '#ef4444');
    });
  });

  // Make all agent avatars clickable (turn headers + comebacks)
  document.querySelectorAll('.turn-agent-avatar, .heckle-comeback .heckle-avatar').forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', e => {
      e.stopPropagation();
      const src = img.src.split('/').pop().replace('-dark.png', '');
      const profile = AGENT_PROFILES[src] || { name: 'Agent', role: 'Team Member', bio: 'Part of the Fenrir Ledger pack.' };
      showProfile(profile.name, img.src, profile.role, profile.bio, '#22c55e');
    });
  });
});
`;

// ---------------------------------------------------------------------------
// Write shared assets
// ---------------------------------------------------------------------------
function writeIndex(dir) {
  // Include .log files without .html (pending/generating sessions)
  const htmlSet = new Set(readdirSync(dir).filter(f => f.endsWith(".html") && f !== "index.html"));
  const pendingLogs = readdirSync(dir)
    .filter(f => f.endsWith(".log") && !htmlSet.has(f.replace(".log", ".html")))
    .map(f => f.replace(".log", ".html"));
  const allEntries = [...htmlSet, ...pendingLogs];

  const files = allEntries
    .map(f => {
      const m = f.match(/issue-(\d+)-step(\d+)-(\w+)/);
      const htmlExists = htmlSet.has(f);
      const actualFile = htmlExists ? f : f.replace(".html", ".log");
      let mtime;
      try { mtime = statSync(join(dir, actualFile)).mtime; } catch { mtime = new Date(); }
      // Detect status from corresponding log file
      let status = htmlExists ? "unknown" : "pending";
      const logFile = join(dir, f.replace(".html", ".log"));
      try {
        const logContent = readFileSync(logFile, "utf-8");
        const hasResult = logContent.includes('"type":"result"');
        const hasVerdict = /Loki QA Verdict/i.test(logContent);
        const hasFail = /FAIL/i.test(logContent) && hasVerdict;
        const hasPass = /PASS/i.test(logContent) && hasVerdict;
        const hasHandoff = /Handoff/i.test(logContent);
        const isEmpty = logContent.trim().length < 100;
        if (isEmpty) status = htmlExists ? "empty" : "pending";
        else if (hasFail) status = "fail";
        else if (hasPass) status = "pass";
        else if (hasResult || hasHandoff) status = "complete";
        else status = htmlExists ? "live" : "pending";
      } catch { status = htmlExists ? "unknown" : "pending"; }
      return {
        file: f,
        issue: m ? m[1] : "?",
        step: m ? m[2] : "?",
        agent: m ? m[3] : "unknown",
        agentName: m ? (AGENT_NAMES[m[3]] || m[3]) : "Unknown",
        date: mtime.toISOString().slice(0, 16).replace("T", " "),
        ts: mtime.getTime(),
        status,
      };
    })
    .sort((a, b) => b.ts - a.ts);

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
  ];
  const quote = ODIN_QUOTES[Math.floor(Math.random() * ODIN_QUOTES.length)];

  const agentColors = {
    firemandecko: "#4ecdc4", loki: "#a78bfa", luna: "#6b8afd",
    freya: "#f0b429", heimdall: "#ef4444",
  };

  const statusIcons = {
    live: "&#9679;",      // filled circle
    complete: "&#10003;", // checkmark
    pass: "&#10003;",     // checkmark
    fail: "&#10007;",     // X
    empty: "&#9675;",     // empty circle
    unknown: "&#8212;",   // em dash
  };
  const statusColors = {
    live: "#4ecdc4", complete: "#c9920a", pass: "#22c55e",
    fail: "#ef4444", empty: "#606070", unknown: "#606070",
  };

  const cards = files.map((f, i) => {
    const color = agentColors[f.agent] || "#c9920a";
    const active = i === 0 ? " active" : "";
    const sIcon = statusIcons[f.status] || "—";
    const sColor = statusColors[f.status] || "#606070";
    const pulse = f.status === "live" ? " pulse" : "";
    const statusLabels = {
      live: "running", complete: "completed", pass: "PASS",
      fail: "FAIL", empty: "no data", unknown: "unknown",
    };
    const sLabel = statusLabels[f.status] || "";
    return `<div class="card${active}" data-file="${f.file}" onclick="loadReport('${f.file}', this)">
  <div class="card-top"><span class="card-agent" style="color:${color}">${f.agentName}</span><span class="card-status${pulse}" style="color:${sColor}" title="${f.status}">${sIcon}</span></div>
  <div class="card-meta">#${f.issue} &middot; Step ${f.step} &middot; <span style="color:${sColor}">${sLabel}</span></div>
  <div class="card-date" data-ts="${f.ts}"></div>
</div>`;
  }).join("\n");

  const firstFile = files.length > 0 ? files[0].file : "";

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Odin's Throne — Hlidskjalf</title>
<link rel="icon" type="image/png" href="favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&family=Source+Serif+4:wght@300;400;600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --void: #07070d; --forge: #12121f; --chain: #1a1a2e;
  --gold: #c9920a; --gold-bright: #f0b429;
  --text-saga: #f5f5f5; --text-rune: #a0a0b0; --text-void: #606070;
  --rune-border: #2a2a3e; --teal-asgard: #4ecdc4;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; }
body { background: var(--void); color: var(--text-saga); font-family: 'Source Serif 4', serif; display: flex; }

/* Sidebar */
.sidebar { width: 300px; min-width: 300px; height: 100vh; overflow-y: auto; border-right: 1px solid var(--rune-border); background: var(--forge); display: flex; flex-direction: column; }
.sidebar-header { padding: 1rem; border-bottom: 1px solid var(--rune-border); flex-shrink: 0; }
.sidebar-header .brand { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.sidebar-header img { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--gold); background: var(--void); mix-blend-mode: lighten; }
.sidebar-header h1 { font-family: 'Cinzel Decorative', serif; font-size: 1.1rem; color: var(--gold); }
.sidebar-header .quote { font-style: italic; font-size: 0.75rem; color: var(--text-rune); opacity: 0.8; line-height: 1.4; }
.sidebar-header .count { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: var(--text-void); margin-top: 0.5rem; }
.card-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
.card { padding: 0.6rem 0.75rem; border-radius: 4px; cursor: pointer; margin-bottom: 2px; border-left: 3px solid transparent; transition: background 0.15s; }
.card:hover { background: var(--chain); }
.card.active { background: var(--chain); border-left-color: var(--gold); }
.card-top { display: flex; justify-content: space-between; align-items: center; }
.card-agent { font-family: 'Cinzel', serif; font-weight: 700; font-size: 0.8rem; }
.card-status { font-size: 0.9rem; flex-shrink: 0; }
.card-status.pulse { animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.card-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: var(--text-rune); margin-top: 0.15rem; }
.card-date { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: var(--text-void); }

/* Content */
.content { flex: 1; height: 100vh; }
.content iframe { width: 100%; height: 100%; border: none; }
.content .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-void); font-family: 'Cinzel', serif; font-size: 1.2rem; }
</style>
</head>
<body>
<div class="sidebar">
  <div class="sidebar-header">
    <div class="brand">
      <img src="agents/profiles/odin-dark.png" alt="Odin">
      <h1>Hlidskjalf</h1>
    </div>
    <div class="quote">"${quote}"</div>
    <div class="count">${files.length} sessions</div>
  </div>
  <div class="card-list">
${cards}
  </div>
</div>
<div class="content">
  ${firstFile ? `<iframe id="viewer" src="${firstFile}"></iframe>` : '<div class="empty">No reports yet</div>'}
</div>
<script>
const AGENT_COLORS = {
  firemandecko: '#4ecdc4', loki: '#a78bfa', luna: '#6b8afd',
  freya: '#f0b429', heimdall: '#ef4444',
};
const STATUS_ICONS = {
  live: '\\u25CF', complete: '\\u2713', pass: '\\u2713',
  fail: '\\u2717', empty: '\\u25CB', unknown: '\\u2014', pending: '\\u29D7',
};
const STATUS_COLORS = {
  live: '#4ecdc4', complete: '#c9920a', pass: '#22c55e',
  fail: '#ef4444', empty: '#606070', unknown: '#606070', pending: '#f0b429',
};
const STATUS_LABELS = {
  live: 'running', complete: 'completed', pass: 'PASS',
  fail: 'FAIL', empty: 'no data', unknown: 'unknown', pending: 'generating...',
};

let activeFile = null;

function loadReport(file, el) {
  activeFile = file;
  document.getElementById('viewer').src = file;
  document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
}

function timeAgo(ts) {
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
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short'
  });
}

function renderCards(items) {
  const list = document.querySelector('.card-list');
  if (!list) return;
  const oldActive = activeFile;
  list.innerHTML = items.map(f => {
    const color = AGENT_COLORS[f.agent] || '#c9920a';
    const sColor = STATUS_COLORS[f.status] || '#606070';
    const sIcon = STATUS_ICONS[f.status] || '—';
    const sLabel = STATUS_LABELS[f.status] || '';
    const pulse = (f.status === 'live' || f.status === 'pending') ? ' pulse' : '';
    const active = f.file === oldActive ? ' active' : '';
    const time = fmtTime(f.ts);
    const ago = timeAgo(f.ts);
    return '<div class="card' + active + '" data-file="' + f.file + '" onclick="loadReport(\\'' + f.file + '\\', this)">'
      + '<div class="card-top"><span class="card-agent" style="color:' + color + '">' + f.agentName + '</span>'
      + '<span class="card-status' + pulse + '" style="color:' + sColor + '" title="' + f.status + '">' + sIcon + '</span></div>'
      + '<div class="card-meta">#' + f.issue + ' &middot; Step ' + f.step + ' &middot; <span style="color:' + sColor + '">' + sLabel + '</span></div>'
      + '<div class="card-date">' + time + ' <span style="color:var(--teal-asgard);margin-left:0.3rem">' + ago + '</span></div>'
      + '</div>';
  }).join('');
  // Update count
  const countEl = document.querySelector('.count');
  if (countEl) countEl.textContent = items.length + ' sessions';
}

// Initial render from embedded data
let currentManifest = ${JSON.stringify(files.map(f => ({
  file: f.file, issue: f.issue, step: f.step, agent: f.agent,
  agentName: f.agentName, ts: f.ts, status: f.status,
})))};
renderCards(currentManifest);
if (currentManifest.length > 0 && !activeFile) {
  loadReport(currentManifest[0].file, document.querySelector('.card'));
}

// Poll manifest.json every 15s for live updates
async function pollManifest() {
  try {
    const res = await fetch('manifest.json?t=' + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    // Only update if changed
    const newHash = JSON.stringify(data.map(d => d.file + d.ts + d.status));
    const oldHash = JSON.stringify(currentManifest.map(d => d.file + d.ts + d.status));
    if (newHash !== oldHash) {
      currentManifest = data;
      renderCards(currentManifest);
    } else {
      // Still update ago times
      renderCards(currentManifest);
    }
  } catch {}
}
setInterval(pollManifest, 15000);
// Also update times every 10s
setInterval(() => renderCards(currentManifest), 10000);
</script>
</body>
</html>`;

  writeFileSync(join(dir, "index.html"), indexHtml);

  // Write manifest.json for live polling
  const manifest = files.map(f => ({
    file: f.file, issue: f.issue, step: f.step, agent: f.agent,
    agentName: f.agentName, ts: f.ts, status: f.status,
  }));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
}

function writeAssets(dir) {
  writeFileSync(join(dir, "agent-report.css"), CSS);
  writeFileSync(join(dir, "agent-report.js"), JS);
  writeIndex(dir);
  console.log(`[ok] assets written to ${dir}/agent-report.{css,js}`);
}

if (regenOnly) {
  const dir = outputDir ? resolve(outputDir) : process.cwd();
  writeAssets(dir);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Parse log
// ---------------------------------------------------------------------------
const logFile = resolve(inputPath);
const raw = readFileSync(logFile, "utf-8");
const lines = raw.split("\n");

const entrypointLines = [];
const jsonEvents = [];
let inEntrypoint = true;

for (const line of lines) {
  if (line.startsWith("{")) {
    inEntrypoint = false;
    try {
      jsonEvents.push(JSON.parse(line));
    } catch {}
  } else if (inEntrypoint && line.trim()) {
    entrypointLines.push(line);
  }
}

// ---------------------------------------------------------------------------
// Extract metadata from entrypoint lines, JSON init event, and filename
// ---------------------------------------------------------------------------
function extractMeta(lines, events, filePath) {
  const meta = {};

  // 1. Try entrypoint text lines (GKE logs that include startup output)
  //    Only take the FIRST match for each field — later lines may contain prompt echoes.
  for (const l of lines) {
    if (!meta.session && l.includes("Session:")) meta.session = l.split("Session:")[1].trim();
    if (!meta.branch && l.includes("Branch:")) meta.branch = l.split("Branch:")[1].trim();
    if (!meta.model && l.includes("Model:")) meta.model = l.split("Model:")[1].trim();
  }

  // 2. Extract from system/init JSON event (always present in stream-json logs)
  const initEvent = events.find(e => e.type === "system" && e.subtype === "init");
  if (initEvent) {
    if (!meta.model && initEvent.model) meta.model = initEvent.model;
  }

  // 3. Derive dispatch session ID from filename (e.g. issue-839-step1-firemandecko-08287a1f.log)
  if (filePath) {
    const basename = filePath.split("/").pop().replace(/\.log$/, "");
    // Only use filename as session if it looks like a dispatch session ID
    if (!meta.session && /^issue-\d+-step\d+-\w+-[a-f0-9]+$/.test(basename)) {
      meta.session = basename;
    }
  }

  // 4. Extract branch from git commands in the log (look for branch --show-current output)
  //    Only check the FIRST matching tool result to avoid picking up handoff comments.
  if (!meta.branch) {
    // Build a set of tool_use IDs for "git branch --show-current" commands
    const branchToolIds = new Set();
    for (const ev of events) {
      if (ev.type !== "assistant" || !ev.message?.content) continue;
      for (const b of ev.message.content) {
        if (b.type === "tool_use" && b.name === "Bash" &&
            b.input?.command?.includes("git branch --show-current")) {
          branchToolIds.add(b.id);
        }
      }
    }
    // Find the first tool_result for any of those IDs
    if (branchToolIds.size > 0) {
      for (const ev of events) {
        if (meta.branch) break;
        if (ev.type !== "user" || !ev.message?.content) continue;
        for (const block of ev.message.content) {
          if (block.type !== "tool_result" || !branchToolIds.has(block.tool_use_id)) continue;
          const content = typeof block.content === "string" ? block.content :
            Array.isArray(block.content) ? block.content.map(c => c.text || "").join("") : "";
          // First line of output is the branch name — validate it looks like a branch
          const firstLine = content.split("\n")[0]?.trim();
          if (firstLine && /^[a-zA-Z0-9._\/-]+$/.test(firstLine) && firstLine.includes("/")) {
            meta.branch = firstLine;
          }
          break; // Only check the first result
        }
      }
    }
  }

  return meta;
}
const meta = extractMeta(entrypointLines, jsonEvents, inputPath);

// ---------------------------------------------------------------------------
// Build turns from assistant events
// ---------------------------------------------------------------------------
const toolResults = new Map();
for (const ev of jsonEvents) {
  if (ev.type === "user" && ev.message?.content) {
    for (const block of ev.message.content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        toolResults.set(block.tool_use_id, {
          content: block.content || "",
          is_error: block.is_error || false,
        });
      }
    }
  }
  if (ev.type === "user" && ev.tool_use_result) {
    const parentId = ev.message?.content?.[0]?.tool_use_id;
    if (parentId) {
      toolResults.set(parentId, {
        content: ev.tool_use_result.stdout || ev.tool_use_result.stderr || ev.message?.content?.[0]?.content || "",
        is_error: ev.tool_use_result.stderr && !ev.tool_use_result.stdout,
      });
    }
  }
}

const turns = [];
for (const ev of jsonEvents) {
  if (ev.type !== "assistant" || !ev.message?.content) continue;
  const turn = { thinking: [], texts: [], tools: [], usage: ev.message?.usage || null };
  for (const block of ev.message.content) {
    if (block.type === "thinking" && block.thinking) {
      turn.thinking.push(block.thinking);
    } else if (block.type === "text" && block.text) {
      turn.texts.push(block.text);
    } else if (block.type === "tool_use") {
      const result = toolResults.get(block.id);
      turn.tools.push({
        name: block.name,
        input: block.input,
        id: block.id,
        result_content: result?.content || "",
        is_error: result?.is_error || false,
      });
    }
  }
  if (turn.thinking.length || turn.texts.length || turn.tools.length) {
    turns.push(turn);
  }
}

// ---------------------------------------------------------------------------
// Stats — basic
// ---------------------------------------------------------------------------
const totalTools = turns.reduce((s, t) => s + t.tools.length, 0);
const toolCounts = {};
for (const t of turns) for (const tool of t.tools) {
  toolCounts[tool.name] = (toolCounts[tool.name] || 0) + 1;
}
const errors = turns.reduce((s, t) => s + t.tools.filter(x => x.is_error).length, 0);

// ---------------------------------------------------------------------------
// Stats — execution time
// ---------------------------------------------------------------------------
// Use file modification time of the log minus entrypoint start indicators
// Or estimate from entrypoint timestamps and log file stats
let logStats = null;
try {
  const { statSync } = await import("fs");
  logStats = statSync(logFile);
} catch {}

// Parse entrypoint for npm ci duration and total time
let entrypointDurationSec = null;
const npmCiMatch = entrypointLines.find(l => /added \d+ packages.*in (\d+)s/.test(l));
const npmCiDuration = npmCiMatch ? parseInt(npmCiMatch.match(/in (\d+)s/)[1]) : null;

// Estimate execution time from the system event timestamp or file metadata
// The system event has a session_id we can use to correlate
const systemEvent = jsonEvents.find(e => e.type === "system");
const firstAssistant = jsonEvents.find(e => e.type === "assistant");
const lastAssistant = [...jsonEvents].reverse().find(e => e.type === "assistant");

// ---------------------------------------------------------------------------
// Stats — token usage
// ---------------------------------------------------------------------------
let totalInputTokens = 0;
let totalOutputTokens = 0;
let totalCacheCreation = 0;
let totalCacheRead = 0;
const seenMsgIds = new Set();

for (const t of turns) {
  if (!t.usage) continue;
  // Deduplicate by message ID (stream-json emits multiple events per message)
  const msgId = jsonEvents.find(e =>
    e.type === "assistant" && e.message?.usage === t.usage
  )?.message?.id;
  if (msgId && seenMsgIds.has(msgId)) continue;
  if (msgId) seenMsgIds.add(msgId);

  totalInputTokens += t.usage.input_tokens || 0;
  totalOutputTokens += t.usage.output_tokens || 0;
  totalCacheCreation += t.usage.cache_creation_input_tokens || 0;
  totalCacheRead += t.usage.cache_read_input_tokens || 0;
}

// ---------------------------------------------------------------------------
// Stats — files touched
// ---------------------------------------------------------------------------
const filesCreated = new Set();
const filesModified = new Set();
const filesRead = new Set();

for (const t of turns) {
  for (const tool of t.tools) {
    const fp = tool.input?.file_path;
    if (tool.name === "Write" && fp) filesCreated.add(fp);
    if (tool.name === "Edit" && fp) filesModified.add(fp);
    if (tool.name === "Read" && fp) filesRead.add(fp);
  }
}
// Files that were both written and edited — classify as created
for (const f of filesCreated) filesModified.delete(f);

// Strip /workspace/repo/ prefix for display
function shortPath(p) {
  return p.replace(/^\/workspace\/repo\//, "");
}

// ---------------------------------------------------------------------------
// Stats — git commits
// ---------------------------------------------------------------------------
const commits = [];
for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name !== "Bash") continue;
    const cmd = tool.input?.command || "";
    const commitMatch = cmd.match(/git commit -m ['"]([^'"]+)['"]/);
    if (commitMatch) {
      commits.push(commitMatch[1]);
    }
  }
}

// ---------------------------------------------------------------------------
// Stats — git pushes
// ---------------------------------------------------------------------------
let pushCount = 0;
for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name === "Bash" && /git push/.test(tool.input?.command || "")) {
      pushCount++;
    }
  }
}

// ---------------------------------------------------------------------------
// Stats — tests written (categorize by type)
// ---------------------------------------------------------------------------
const testFiles = {
  vitest: [],   // src/__tests__/**
  e2e: [],      // quality/test-suites/**/*.spec.ts (Playwright)
};

// From Write/Edit tool calls — look at file paths
for (const t of turns) {
  for (const tool of t.tools) {
    const fp = tool.input?.file_path || "";
    if (!fp) continue;
    if (tool.name !== "Write" && tool.name !== "Edit") continue;
    const short = shortPath(fp);
    if (/\.spec\.(ts|tsx|js)$/.test(fp) && /quality\/test-suites/.test(fp)) {
      if (!testFiles.e2e.includes(short)) testFiles.e2e.push(short);
    } else if (/\.test\.(ts|tsx|js)$/.test(fp) && /(__tests__|src\/)/.test(fp)) {
      if (!testFiles.vitest.includes(short)) testFiles.vitest.push(short);
    }
  }
}

// Count individual test cases from file content (Write tool)
function countTestCases(content) {
  if (!content) return { unit: 0, component: 0, integration: 0, total: 0 };
  const itMatches = (content.match(/\b(it|test)\s*\(/g) || []).length;
  // Heuristic categorization based on content patterns
  const hasRender = /render\s*\(/.test(content) || /screen\./.test(content);
  const hasApi = /fetch|api|route|handler|request|response/i.test(content);
  const hasComponent = /Component|jsx|tsx|<[A-Z]/.test(content);

  let component = 0, integration = 0, unit = 0;
  if (hasRender || hasComponent) {
    component = itMatches;
  } else if (hasApi) {
    integration = itMatches;
  } else {
    unit = itMatches;
  }
  return { unit, component, integration, total: itMatches };
}

// Count Playwright test cases
function countPlaywrightTests(content) {
  if (!content) return 0;
  return (content.match(/\btest\s*\(/g) || []).length;
}

// Extract test counts from Write tool calls
let vitestCounts = { unit: 0, component: 0, integration: 0, total: 0 };
let playwrightCount = 0;

for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name !== "Write") continue;
    const fp = tool.input?.file_path || "";
    const content = tool.input?.content || "";
    if (/\.test\.(ts|tsx|js)$/.test(fp)) {
      const counts = countTestCases(content);
      vitestCounts.unit += counts.unit;
      vitestCounts.component += counts.component;
      vitestCounts.integration += counts.integration;
      vitestCounts.total += counts.total;
    }
    if (/\.spec\.(ts|tsx|js)$/.test(fp)) {
      playwrightCount += countPlaywrightTests(content);
    }
  }
}

// Also scan test results from Bash outputs for pass/fail counts
let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name !== "Bash") continue;
    const output = typeof tool.result_content === "string" ? tool.result_content : "";
    // Vitest output: "Tests  14 passed (14)"
    const vitestMatch = output.match(/Tests?\s+(\d+)\s+passed/);
    if (vitestMatch) testsPassed = Math.max(testsPassed, parseInt(vitestMatch[1]));
    const vitestFail = output.match(/(\d+)\s+failed/);
    if (vitestFail) testsFailed = Math.max(testsFailed, parseInt(vitestFail[1]));
    // Playwright: "5 passed" or "3 passed, 2 failed"
    const pwPass = output.match(/(\d+)\s+passed/);
    if (pwPass && /playwright|spec/.test(tool.input?.command || "")) {
      testsPassed = Math.max(testsPassed, parseInt(pwPass[1]));
    }
    const pwFail = output.match(/(\d+)\s+failed/);
    if (pwFail && /playwright|spec/.test(tool.input?.command || "")) {
      testsFailed = Math.max(testsFailed, parseInt(pwFail[1]));
    }
    const skipMatch = output.match(/(\d+)\s+skipped/);
    if (skipMatch) testsSkipped = Math.max(testsSkipped, parseInt(skipMatch[1]));
  }
}

// ---------------------------------------------------------------------------
// Stats — verify runs
// ---------------------------------------------------------------------------
let tscRuns = 0, tscPass = 0, tscFail = 0;
let buildRuns = 0, buildPass = 0, buildFail = 0;

for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name !== "Bash") continue;
    const cmd = tool.input?.command || "";
    if (/verify\.sh\s+--step\s+tsc/.test(cmd)) {
      tscRuns++;
      if (tool.is_error) tscFail++; else tscPass++;
    }
    if (/verify\.sh\s+--step\s+build/.test(cmd)) {
      buildRuns++;
      if (tool.is_error) buildFail++; else buildPass++;
    }
  }
}

// ---------------------------------------------------------------------------
// Stats — rate limit events
// ---------------------------------------------------------------------------
const rateLimitEvents = jsonEvents.filter(e => e.type === "rate_limit_event").length;

// ---------------------------------------------------------------------------
// Stats — thinking characters (reasoning effort indicator)
// ---------------------------------------------------------------------------
const totalThinkingChars = turns.reduce((s, t) =>
  s + t.thinking.reduce((ss, th) => ss + th.length, 0), 0);

// ---------------------------------------------------------------------------
// Detect verdict
// ---------------------------------------------------------------------------
let verdict = null;
for (const t of turns) {
  for (const text of t.texts) {
    if (/Loki QA Verdict/i.test(text) || /\*\*Verdict:\*\*/i.test(text)) {
      verdict = { text, pass: /PASS/i.test(text) };
    }
  }
  for (const tool of t.tools) {
    if (tool.name === "Bash" && tool.input?.command) {
      const cmd = tool.input.command;
      if (/Loki QA Verdict/i.test(cmd)) {
        const bodyMatch = cmd.match(/--body\s+["']?([\s\S]*?)(?:["']?\s*$)/);
        const body = bodyMatch ? bodyMatch[1] : cmd;
        verdict = { text: body, pass: /PASS/i.test(cmd) };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------
function esc(s) {
  if (typeof s !== "string") s = JSON.stringify(s, null, 2) || "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toolBadgeClass(name) {
  const n = name.toLowerCase();
  if (n === "bash") return "bash";
  if (n === "read" || n === "grep" || n === "glob") return "read";
  if (n === "edit" || n === "multiedit") return "edit";
  if (n === "write") return "write";
  if (n === "todowrite" || n === "todoupdate") return "todo";
  return "";
}

function toolInputPreview(tool) {
  if (tool.name === "Bash" && tool.input?.command) return esc(tool.input.command.slice(0, 120));
  if (tool.name === "Read" && tool.input?.file_path) return esc(tool.input.file_path);
  if (tool.name === "Edit" && tool.input?.file_path) return esc(tool.input.file_path);
  if (tool.name === "Write" && tool.input?.file_path) return esc(tool.input.file_path);
  if (tool.name === "Grep" && tool.input?.pattern) return `/${esc(tool.input.pattern)}/`;
  if (tool.name === "Glob" && tool.input?.pattern) return esc(tool.input.pattern);
  if (tool.name === "TodoWrite") return "update todos";
  return "";
}

function turnSummary(turn) {
  if (turn.texts.length) return esc(turn.texts[0].slice(0, 150));
  if (turn.thinking.length) return esc(turn.thinking[0].slice(0, 150));
  return turn.tools.map(t => t.name).join(", ");
}

function renderToolInput(tool) {
  if (tool.name === "Bash") return esc(tool.input?.command || "");
  if (tool.name === "Edit") {
    const parts = [];
    if (tool.input?.file_path) parts.push(`File: ${tool.input.file_path}`);
    if (tool.input?.old_string) parts.push(`--- old\n${tool.input.old_string}`);
    if (tool.input?.new_string) parts.push(`+++ new\n${tool.input.new_string}`);
    return esc(parts.join("\n\n"));
  }
  return esc(JSON.stringify(tool.input, null, 2));
}

function renderToolOutput(tool) {
  const content = tool.result_content;
  if (typeof content === "string") return esc(content.slice(0, 5000));
  return esc(JSON.stringify(content, null, 2).slice(0, 5000));
}

function renderEntrypoint() {
  // Split into sandbox setup (before --- TASK PROMPT ---) and decree (after)
  const promptIdx = entrypointLines.findIndex(l => /TASK PROMPT/.test(l));
  const setupLines = promptIdx >= 0 ? entrypointLines.slice(0, promptIdx) : entrypointLines;
  const promptLines = promptIdx >= 0 ? entrypointLines.slice(promptIdx + 1) : [];

  // Compact sandbox setup as collapsible
  const setupColored = setupLines
    .filter(l => l.trim()) // skip blanks
    .map(l => {
      if (/\[ok\]/.test(l)) return `<span class="ok">${esc(l)}</span>`;
      if (/\[WARN\]/.test(l)) return `<span class="warn">${esc(l)}</span>`;
      if (/\[FATAL\]/.test(l)) return `<span class="fatal">${esc(l)}</span>`;
      return esc(l);
    })
    .join("\n");

  const setupHtml = `<div class="entrypoint"><details><summary>ᛊ Sandbox Forging</summary><pre>${setupColored}</pre></details></div>`;

  if (promptLines.length === 0) return setupHtml;

  // Parse the decree (task prompt) into structured sections
  const rawPrompt = promptLines.join("\n");

  // Norse agent titles for the decree
  const agentDecreeNames = {
    FiremanDecko: "FiremanDecko, Forgemaster of Midgard",
    Loki: "Loki, Trickster-Tester of the Realms",
    Luna: "Luna, Weaver of the World-Tree's Branches",
    Freya: "Freya, Keeper of the Golden Brisingamen",
    Heimdall: "Heimdall, Watcher at the Rainbow Bridge",
  };
  const decreeName = agentDecreeNames[agentName] || agentName;

  // Extract issue title from first line
  const firstLine = promptLines[0] || "";
  const issueTitle = firstLine.replace(/^You are \w+.*?(?:Fix|Design|Validate|Audit)\s+GitHub Issue #\d+:\s*/i, "").trim() || firstLine;

  // Transform prompt sections into decree format
  function formatDecree(text) {
    let html = "";
    const sections = text.split(/(?=\*\*Step \d|SANDBOX RULES|TODO TRACKING|INCREMENTAL COMMIT|VERIFY —|STRICT SCOPE|##)/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      // Skip the "You are..." intro line (already in header)
      if (/^You are \w+/.test(trimmed)) continue;

      // UNBREAKABLE oaths
      if (/UNBREAKABLE/.test(trimmed)) {
        const title = trimmed.match(/^([A-Z][A-Z\s—–-]+?)[\s:(\n]/)?.[1]?.trim() || "SACRED OATH";
        const body = trimmed.replace(/^[A-Z][A-Z\s—–-]+[\s:(]*\(?UNBREAKABLE\)?:?\s*/i, "").trim();
        html += `<div class="decree-section">
          <div class="decree-section-title"><span class="glyph">⚔</span> ${esc(title)} <span class="decree-oath">— UNBREAKABLE OATH</span></div>
          <div class="decree-law">${esc(body).replace(/\n/g, "<br>")}</div>
        </div>`;
        continue;
      }

      // Steps
      const stepMatch = trimmed.match(/^\*\*Step (\d+\w?)[\s—–-]+(.+?)\*\*/);
      if (stepMatch) {
        const stepGlyphs = ["ᚠ","ᚢ","ᚦ","ᚨ","ᚱ","ᚲ","ᚷ","ᚹ","ᚺ"];
        const stepNum = parseInt(stepMatch[1]) - 1;
        const glyph = stepGlyphs[stepNum % stepGlyphs.length] || "ᚱ";
        const stepTitle = stepMatch[2].trim();
        const stepBody = trimmed.replace(/^\*\*Step \d+\w?[\s—–-]+.+?\*\*\s*/s, "").trim();
        html += `<div class="decree-section">
          <div class="decree-section-title"><span class="glyph">${glyph}</span> Step ${stepMatch[1]} — ${esc(stepTitle)}</div>
          <div class="decree-body">${esc(stepBody).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, "<br>")}</div>
        </div>`;
        continue;
      }

      // Issue details section
      if (/^## Description|^##\s+/.test(trimmed)) {
        const body = trimmed.replace(/^##\s+\w+\s*\n?/, "").trim();
        html += `<div class="decree-section">
          <div class="decree-section-title"><span class="glyph">ᛟ</span> The Matter at Hand</div>
          <div class="decree-body">${esc(body).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, "<br>")}</div>
        </div>`;
        continue;
      }

      // Sandbox rules (compact)
      if (/^SANDBOX RULES/.test(trimmed)) {
        const body = trimmed.replace(/^SANDBOX RULES.*?\n/, "").trim();
        html += `<div class="decree-section">
          <div class="decree-section-title"><span class="glyph">ᛉ</span> Laws of the Sandbox Realm</div>
          <div class="decree-law">${esc(body).replace(/\n/g, "<br>")}</div>
        </div>`;
        continue;
      }

      // Generic remaining content
      if (trimmed.length > 20) {
        html += `<div class="decree-section">
          <div class="decree-body">${esc(trimmed).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, "<br>")}</div>
        </div>`;
      }
    }
    return html;
  }

  const decreeBody = formatDecree(rawPrompt);

  const decreeHtml = `<div class="decree">
    <div class="decree-header">
      <div class="decree-runes">ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ</div>
      <div class="decree-title">The All-Father's Decree</div>
      <div class="decree-subtitle">Spoken from Hlidskjalf unto ${esc(decreeName)}</div>
    </div>
    ${decreeBody}
    <div class="decree-seal">
      <div class="decree-seal-glyph">ᚲ</div>
      <div class="decree-seal-text">So it is written · So it shall be forged · Issue #${issueNum}</div>
    </div>
  </div>`;

  return setupHtml + decreeHtml;
}

function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

// ---------------------------------------------------------------------------
// Metadata derived from session info (shared by HTML and MDX modes)
// Fallback: parse from input filename if meta.session not available
// ---------------------------------------------------------------------------
const sessionStr = meta.session || (inputPath ? inputPath.split("/").pop().replace(/\.log$/, "") : "");
const issueMatch = sessionStr.match(/issue-(\d+)/);
const issueNum = issueMatch ? issueMatch[1] : "?";
const agentMatch = sessionStr.match(/step(\d+)-(\w+)/);
const stepNum = agentMatch ? agentMatch[1] : "?";
const agentNameKey = agentMatch ? agentMatch[2] : "agent";
const agentName = AGENT_NAMES[agentNameKey] || (agentMatch ? agentMatch[2].charAt(0).toUpperCase() + agentMatch[2].slice(1) : "Agent");
const agentSlug = {FiremanDecko:'fireman-decko',Loki:'loki',Luna:'luna',Freya:'freya',Heimdall:'heimdall'}[agentName] || agentNameKey;

// Full agent titles — professional bogger energy
const AGENT_TITLES = {
  FiremanDecko: "FiremanDecko — Principal Engineer",
  Loki: "Loki — QA Tester & Devil's Advocate",
  Luna: "Luna — UX Designer",
  Freya: "Freya — Product Owner",
  Heimdall: "Heimdall — Security Specialist",
};
const agentTitle = AGENT_TITLES[agentName] || agentName;

// Create heckler engine for Mayo heckling
const hecklerEngine = createHecklerEngine(agentName);

const totalTestsWritten = vitestCounts.total + playwrightCount;

// ---------------------------------------------------------------------------
// Agent callbacks — sourced from agent-identity.mjs (canonical source of truth)
// ---------------------------------------------------------------------------
const agentCallback = {
  quote:   AGENT_CALLBACK_QUOTES[agentName]  ?? AGENT_CALLBACK_QUOTES._fallback  ?? "The task is done. The wolf's chain holds another day.",
  signoff: AGENT_SIGNOFFS[agentName]          ?? AGENT_SIGNOFFS._fallback          ?? "Sealed by the pack",
  runes:   AGENT_CALLBACK_RUNES[agentName]    ?? AGENT_CALLBACK_RUNES._fallback    ?? "ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ",
};

// ---------------------------------------------------------------------------
// Decree Complete parser — scan all turns for ᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭ block
// ---------------------------------------------------------------------------
let decree = null;
for (const t of turns) {
  for (const text of t.texts) {
    const parsed = parseDecreeBlock(text);
    if (parsed) { decree = parsed; break; }
  }
  if (decree) break;
}

// ---------------------------------------------------------------------------
// Build MDX (--publish mode)
// ---------------------------------------------------------------------------
if (publishMode) {
  const defaultBlogDir = join(dirname(logFile), "../../development/ledger/content/blog");
  const targetBlogDir = blogDir ? resolve(blogDir) : resolve(defaultBlogDir);

  // Build slug from session metadata (prefer dispatch session ID from filename)
  const slugBase = (sessionStr || meta.session || "unknown")
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const mdxSlug = `agent-${slugBase}`;
  const mdxFile = join(targetBlogDir, `${mdxSlug}.mdx`);

  const dateStr = new Date().toISOString().slice(0, 10);
  const mdxTitle = `${agentName} Report: Issue #${issueNum}`;
  const mdxExcerpt = `Agent execution report — ${agentName} on Issue #${issueNum}, Step ${stepNum}. ${turns.length} turns, ${totalTools} tool calls.`;

  // mdxEsc — HTML entity escaping, safe ONLY for JSX attributes (alt="", href="", etc.)
  function mdxEsc(s) {
    if (typeof s !== "string") s = JSON.stringify(s, null, 2) || "";
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\{/g, "&#123;")
      .replace(/\}/g, "&#125;");
  }
  // jsxStr — safe for JSX TEXT BODIES: wraps value in {JSON.stringify()} expression
  // Use this for ALL dynamic content between JSX tags: <span>{jsxStr(val)}</span>
  function jsxStr(s) {
    if (typeof s !== "string") s = String(s ?? "");
    return `{${mdxSafeStringify(s)}}`;
  }
  // mdxSafeStringify — JSON.stringify that escapes < > to unicode escapes so MDX
  // never sees angle brackets inside string literals (prevents tag parsing)
  function mdxSafeStringify(v) {
    return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  }

  function mdxToolInputPreview(tool) {
    // Returns RAW string — caller wraps in {JSON.stringify()} for MDX safety
    function singleLine(s) { return s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim(); }
    if (tool.name === "Bash" && tool.input?.command) return singleLine(tool.input.description || tool.input.command.slice(0, 100));
    if (tool.name === "Read" && tool.input?.file_path) return shortPath(tool.input.file_path);
    if (tool.name === "Edit" && tool.input?.file_path) return shortPath(tool.input.file_path);
    if (tool.name === "Write" && tool.input?.file_path) return shortPath(tool.input.file_path);
    if (tool.name === "Grep" && tool.input?.pattern) return singleLine(tool.input.pattern);
    if (tool.name === "Glob" && tool.input?.pattern) return singleLine(tool.input.pattern);
    if (tool.name === "TodoWrite") return "update todos";
    return "";
  }

  function mdxRenderToolInput(tool) {
    if (tool.name === "Bash") return sanitizeText(tool.input?.command || "");
    if (tool.name === "Edit") {
      const parts = [];
      if (tool.input?.file_path) parts.push(`File: ${shortPath(tool.input.file_path)}`);
      if (tool.input?.old_string) parts.push(`--- old\n${tool.input.old_string.slice(0, 500)}`);
      if (tool.input?.new_string) parts.push(`+++ new\n${tool.input.new_string.slice(0, 500)}`);
      return sanitizeText(parts.join("\n\n"));
    }
    return sanitizeText(JSON.stringify(tool.input, null, 2));
  }

  function mdxRenderToolOutput(tool) {
    const content = tool.result_content;
    const raw = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    // Sanitize before truncating so the truncation limit applies to already-cleaned text
    const sanitized = sanitizeToolOutput(raw, 800);
    return sanitized;
  }

  // ---------------------------------------------------------------------------
  // MDX decree header — JSX-compatible version of renderEntrypoint()
  // ---------------------------------------------------------------------------
  function mdxRenderEntrypoint() {
    const promptIdx = entrypointLines.findIndex(l => /TASK PROMPT/.test(l));
    const setupLines = promptIdx >= 0 ? entrypointLines.slice(0, promptIdx) : entrypointLines;
    const promptLines = promptIdx >= 0 ? entrypointLines.slice(promptIdx + 1) : [];

    const setupText = setupLines
      .filter(l => l.trim())
      .join("\n");
    const setupMarkup = `
<details className="entrypoint">
<summary>ᛊ Sandbox Forging</summary>
<pre>{${mdxSafeStringify(setupText)}}</pre>
</details>`;

    if (promptLines.length === 0) return setupMarkup;

    const rawPrompt = promptLines.join("\n");

    const agentDecreeNames = {
      FiremanDecko: "FiremanDecko, Forgemaster of Midgard",
      Loki: "Loki, Trickster-Tester of the Realms",
      Luna: "Luna, Weaver of the World-Tree's Branches",
      Freya: "Freya, Keeper of the Golden Brisingamen",
      Heimdall: "Heimdall, Watcher at the Rainbow Bridge",
    };
    const decreeName = agentDecreeNames[agentName] || agentName;

    function mdxFormatDecree(text) {
      let markup = "";
      const sections = text.split(/(?=\*\*Step \d|SANDBOX RULES|TODO TRACKING|INCREMENTAL COMMIT|VERIFY —|STRICT SCOPE|##)/);

      for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;
        if (/^You are \w+/.test(trimmed)) continue;

        if (/UNBREAKABLE/.test(trimmed)) {
          const title = trimmed.match(/^([A-Z][A-Z\s—–-]+?)[\s:(\n]/)?.[1]?.trim() || "SACRED OATH";
          const body = trimmed.replace(/^[A-Z][A-Z\s—–-]+[\s:(]*\(?UNBREAKABLE\)?:?\s*/i, "").trim();
          markup += `
<div className="decree-section">
<div className="decree-section-title"><span className="glyph">⚔</span> {${mdxSafeStringify(title)}} <span className="decree-oath">— UNBREAKABLE OATH</span></div>
<div className="decree-law">{${mdxSafeStringify(body)}}</div>
</div>`;
          continue;
        }

        const stepMatch = trimmed.match(/^\*\*Step (\d+\w?)[\s—–-]+(.+?)\*\*/);
        if (stepMatch) {
          const stepGlyphs = ["ᚠ","ᚢ","ᚦ","ᚨ","ᚱ","ᚲ","ᚷ","ᚹ","ᚺ"];
          const stepNum = parseInt(stepMatch[1]) - 1;
          const glyph = stepGlyphs[stepNum % stepGlyphs.length] || "ᚱ";
          const stepTitle = stepMatch[2].trim();
          const stepBody = trimmed.replace(/^\*\*Step \d+\w?[\s—–-]+.+?\*\*\s*/s, "").trim();
          markup += `
<div className="decree-section">
<div className="decree-section-title"><span className="glyph">${glyph}</span> Step ${stepMatch[1]} — {${mdxSafeStringify(stepTitle)}}</div>
<div className="decree-body">{${mdxSafeStringify(stepBody)}}</div>
</div>`;
          continue;
        }

        if (/^## Description|^##\s+/.test(trimmed)) {
          const body = trimmed.replace(/^##\s+\w+\s*\n?/, "").trim();
          markup += `
<div className="decree-section">
<div className="decree-section-title"><span className="glyph">ᛟ</span> The Matter at Hand</div>
<div className="decree-body">{${mdxSafeStringify(body)}}</div>
</div>`;
          continue;
        }

        if (/^SANDBOX RULES/.test(trimmed)) {
          const body = trimmed.replace(/^SANDBOX RULES.*?\n/, "").trim();
          markup += `
<div className="decree-section">
<div className="decree-section-title"><span className="glyph">ᛉ</span> Laws of the Sandbox Realm</div>
<div className="decree-law">{${mdxSafeStringify(body)}}</div>
</div>`;
          continue;
        }

        if (trimmed.length > 20) {
          markup += `
<div className="decree-section">
<div className="decree-body">{${mdxSafeStringify(trimmed)}}</div>
</div>`;
        }
      }
      return markup;
    }

    const decreeBody = mdxFormatDecree(rawPrompt);

    return setupMarkup + `
<div className="decree">
<div className="decree-header">
<div className="decree-runes">ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ</div>
<div className="decree-title">The All-Father's Decree</div>
<div className="decree-subtitle">Spoken from Hlidskjalf unto {${mdxSafeStringify(decreeName)}}</div>
</div>
${decreeBody}
<div className="decree-seal">
<div className="decree-seal-glyph">ᚲ</div>
<div className="decree-seal-text">So it is written · So it shall be forged · Issue #{${mdxSafeStringify(issueNum)}}</div>
</div>
</div>`;
  }

  // ── MDX heckle event helpers ──────────────────────────────────────────────

  const MDX_HECKLER_AVATARS = [
    'heckler-avatar.png','heckler-granny.png','heckler-da.png','heckler-uncle.png',
    'heckler-mammy.png','heckler-teen.png','heckler-lad.png','heckler-lass.png',
  ];
  function mdxHecklerAvatar(name) {
    const idx = Math.abs([...name].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0));
    return `/hecklers/${MDX_HECKLER_AVATARS[idx % MDX_HECKLER_AVATARS.length]}`;
  }
  function mdxAgentAvatarPath(name) {
    const slugMap = { FiremanDecko:'fireman-decko', Loki:'loki', Luna:'luna', Freya:'freya', Heimdall:'heimdall' };
    const sl = slugMap[name] || name.toLowerCase();
    return `/agents/profiles/${sl}-dark.png`;
  }

  // ── MDX heckle bubble renderer — uses chronicle.css class names ───────────

  function mdxRenderHeckleEvents(events) {
    if (!events) return "";
    let out = "";
    for (const event of events) {
      if (event.type === "mayo") {
        // Right-aligned red Mayo heckler bubble
        const avatarSrc = mdxHecklerAvatar(event.name);
        out += `<div className="heckle heckle-mayo">
<div className="heckle-identity">
<span className="heckle-name">{${mdxSafeStringify(event.name)}}</span>
<img className="heckle-avatar" src="${avatarSrc}" alt="${mdxEsc(event.name)}" loading="lazy" />
</div>
<div className="heckle-text">{${mdxSafeStringify(event.text)}}</div>
</div>\n`;
      } else if (event.type === "mayo-comeback") {
        // Left-aligned Norse agent comeback bubble
        const avatarSrc = mdxAgentAvatarPath(event.name);
        const aTitle = AGENT_TITLES[event.name] || event.name;
        out += `<div className="heckle heckle-comeback">
<div className="heckle-identity">
<img className="heckle-avatar" src="${avatarSrc}" alt="${mdxEsc(event.name)}" loading="lazy" />
<span className="heckle-name">{${mdxSafeStringify(aTitle)}}</span>
</div>
<div className="heckle-text">{${mdxSafeStringify(event.text)}}</div>
</div>\n`;
      } else if (event.type === "mayo-entrance") {
        // Heckler entrance announcement with name + avatar
        const eName = event.name || "Mayo Fan";
        const avatarSrc = mdxHecklerAvatar(eName);
        out += `<div className="heckle heckle-entrance">
<div className="heckle-identity">
<span className="heckle-name">{${mdxSafeStringify(eName)}}</span>
<img className="heckle-avatar" src="${avatarSrc}" alt="${mdxEsc(eName)}" loading="lazy" />
</div>
<div className="heckle-text">{${mdxSafeStringify(event.text)}}</div>
</div>\n`;
      } else if (event.type === "mayo-explosion") {
        // Full-width explosion with Norse tremble animation (::before/::after rune rows via CSS)
        out += `<div className="heckle heckle-explosion">⚡ {${mdxSafeStringify(event.text)}} ⚡</div>\n`;
      }
    }
    return out;
  }

  // ── MDX tool block renderer — uses chronicle.css .tool-block classes ──────

  function mdxRenderToolBlock(tool) {
    return `<details className="tool-block${tool.is_error ? " has-error" : ""}">
<summary className="tool-block-header">
<span className="tool-name">{${mdxSafeStringify(tool.name)}}</span>
<span className="tool-input-preview">{${mdxSafeStringify(mdxToolInputPreview(tool))}}</span>
</summary>
<div className="tool-block-body">
<pre className="tool-input">{${mdxSafeStringify(mdxRenderToolInput(tool))}}</pre>
<pre className="tool-output${tool.is_error ? " error" : ""}">{${mdxSafeStringify(mdxRenderToolOutput(tool))}}</pre>
</div>
</details>\n`;
  }

  // ── isToolOnly check (same logic as HTML path) ────────────────────────────

  function mdxIsToolOnly(turn) {
    return turn.texts.length === 0 && turn.thinking.length === 0 && turn.tools.length > 0;
  }

  // ── Build turn markup with toolbox merging ────────────────────────────────
  // Uses chronicle.css class names: .turn, .turn-agent-profile, .turn-box,
  // .turn-header, .turn-num, .turn-summary, .turn-tools, .turn-body,
  // .toolbox, .text-block, .thinking, .tool-badge
  const mdxAgentAvatarSrc = mdxAgentAvatarPath(agentName);

  let turnsMarkup = "";
  let mi = 0;
  while (mi < turns.length) {
    const turn = turns[mi];

    // Merge consecutive tool-only turns into a single toolbox
    if (mdxIsToolOnly(turn)) {
      const mergedTools = [];
      const turnNums = [];
      let hasError = false;
      while (mi < turns.length && mdxIsToolOnly(turns[mi])) {
        mergedTools.push(...turns[mi].tools);
        turnNums.push(mi + 1);
        if (turns[mi].tools.some(t => t.is_error)) hasError = true;
        mi++;
      }
      const numLabel = turnNums.length === 1
        ? `#${turnNums[0]}`
        : `#${turnNums[0]}–${turnNums[turnNums.length - 1]}`;
      const toolBadges = mergedTools
        .map(t => `<span className="tool-badge ${toolBadgeClass(t.name)}">{${mdxSafeStringify(t.name)}}</span>`)
        .join(" ");

      turnsMarkup += `
<div className="turn${hasError ? " has-error" : ""}">
<div className="turn-agent-profile">
<img className="turn-agent-avatar" src="${mdxAgentAvatarSrc}" alt="${mdxEsc(agentName)}" loading="lazy" />
<span className="turn-agent-title">{${mdxSafeStringify(agentTitle)}}</span>
</div>
<details className="turn-box">
<summary className="turn-header">
<span className="turn-num">${numLabel}</span>
<span className="turn-summary">${mergedTools.length} tool calls</span>
<span className="turn-tools">${toolBadges}</span>
<span className="chevron">&#9654;</span>
</summary>
<div className="turn-body">
<div className="toolbox">
${mergedTools.map(t => mdxRenderToolBlock(t)).join("")}</div>
</div>
</details>
</div>\n`;

      // Consume heckle slot without rendering (tool-only group)
      hecklerEngine.maybeHeckle();
      continue;
    }

    // Normal turn with text content — render as left-aligned chat bubble + toolbox
    const hasError = turn.tools.some(t => t.is_error);
    const summary = turn.texts.length
      ? `{${mdxSafeStringify(turn.texts[0].slice(0, 120))}}`
      : turn.tools.map(t => t.name).join(", ");
    const toolBadges = turn.tools
      .map(t => `<span className="tool-badge ${toolBadgeClass(t.name)}">{${mdxSafeStringify(t.name)}}</span>`)
      .join(" ");

    turnsMarkup += `
<div className="turn${hasError ? " has-error" : ""}">
<div className="turn-agent-profile">
<img className="turn-agent-avatar" src="${mdxAgentAvatarSrc}" alt="${mdxEsc(agentName)}" loading="lazy" />
<span className="turn-agent-title">{${mdxSafeStringify(agentTitle)}}</span>
</div>
<details className="turn-box">
<summary className="turn-header">
<span className="turn-num">#${mi + 1}</span>
<span className="turn-summary">${summary}</span>
<span className="turn-tools">${toolBadges}</span>
<span className="chevron">&#9654;</span>
</summary>
<div className="turn-body">
`;

    for (const thinking of turn.thinking) {
      turnsMarkup += `<div className="thinking">{${mdxSafeStringify(thinking.slice(0, 1000))}}</div>\n`;
    }
    for (const text of turn.texts) {
      // Agent text blocks render as left-aligned 60% chat bubbles
      turnsMarkup += `<div className="text-block">{${mdxSafeStringify(text)}}</div>\n`;
    }
    if (turn.tools.length > 0) {
      turnsMarkup += `<div className="toolbox">\n${turn.tools.map(t => mdxRenderToolBlock(t)).join("")}</div>\n`;
    }

    // Render heckles OUTSIDE the turn body (visible without expanding)
    const mdxHeckleEvents = hecklerEngine.maybeHeckle();
    turnsMarkup += `</div>
</details>
</div>
${mdxRenderHeckleEvents(mdxHeckleEvents)}\n`;

    mi++;
  }

  // Build file changes markup — uses chronicle.css .changes-summary classes
  let changesMarkup = "";
  if (filesCreated.size > 0 || filesModified.size > 0) {
    changesMarkup = `
<div className="changes-summary">
<h2>Files Changed</h2>
<div className="changes-cols">
${filesCreated.size > 0 ? `<div className="changes-col">
<h3>Created</h3>
<ul>
${[...filesCreated].map(f => `<li className="file-new"><span className="icon">+</span>{${mdxSafeStringify(shortPath(f))}}</li>`).join("\n")}
</ul>
</div>` : ""}
${filesModified.size > 0 ? `<div className="changes-col">
<h3>Modified</h3>
<ul>
${[...filesModified].map(f => `<li className="file-mod"><span className="icon">~</span>{${mdxSafeStringify(shortPath(f))}}</li>`).join("\n")}
</ul>
</div>` : ""}
</div>
</div>`;
  }

  // Build commits markup
  let commitsMarkup = "";
  if (commits.length > 0) {
    commitsMarkup = `
<div className="changes-summary">
<h2>Commits</h2>
${commits.map(c => `<div className="commit-item"><span className="msg">{${mdxSafeStringify(c)}}</span></div>`).join("\n")}
</div>`;
  }

  // Victory heckle — full-width explosion
  const mdxVictoryHeckle = hecklerEngine.victoryHeckle();
  const victoryHeckleMarkup = `<div className="heckle heckle-explosion">⚡ {${mdxSafeStringify(mdxVictoryHeckle.text)}} ⚡</div>`;

  // Verdict markup — uses chronicle.css .verdict classes
  let verdictMarkup = "";
  if (verdict) {
    verdictMarkup = `
<div className="verdict ${verdict.pass ? "pass" : "fail"}">
<h2>ᛏ ${verdict.pass ? "PASS" : "FAIL"} — QA Verdict</h2>
<pre>{${mdxSafeStringify(verdict.text)}}</pre>
</div>`;
  }

  const mdxDecreeMarkup = mdxRenderEntrypoint();

  // All callback values use jsxStr() in templates — no pre-escaping needed

  // Build decree-complete block for MDX if present
  let mdxDecreeCompleteMarkup = "";
  if (decree) {
    const dVerdictColor = decree.verdict === "PASS" ? "var(--teal-asgard)" : decree.verdict === "FAIL" ? "var(--fire-muspel)" : "var(--amber-hati)";
    const dChecks = decree.checks.length > 0
      ? decree.checks.map(c => {
          const ok = /pass|ok|complete|delivered|approved|secured|done/i.test(c.result);
          const fail = /fail|error|missing/i.test(c.result);
          const cc = ok ? "var(--teal-asgard)" : fail ? "var(--fire-muspel)" : "var(--text-rune)";
          return `<div className="decree-check"><span className="decree-check-name">{${mdxSafeStringify(c.name)}}</span><span className="decree-check-result" style={{color:"${cc}"}}>{${mdxSafeStringify(c.result)}}</span></div>`;
        }).join("\n")
      : "";
    const dSummary = decree.summary.length > 0
      ? `<ul className="decree-summary">${decree.summary.map(s => `<li>{${mdxSafeStringify(s)}}</li>`).join("")}</ul>`
      : "";
    const dPr = decree.pr ? `<div className="decree-field"><span className="decree-label">PR:</span> <a href="${mdxEsc(decree.pr)}" target="_blank" rel="noopener">{${mdxSafeStringify(decree.pr)}}</a></div>` : "";
    mdxDecreeCompleteMarkup = `
<div className="decree-complete">
<div className="decree-complete-header">
<div className="decree-complete-runes">᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭</div>
<div className="decree-complete-verdict" style={{color:"${dVerdictColor}"}}>{${mdxSafeStringify(decree.verdict ?? "COMPLETE")}}</div>
</div>
<div className="decree-complete-body">
<div className="decree-field"><span className="decree-label">Issue:</span> #{${mdxSafeStringify(decree.issue ?? issueNum)}}</div>
${dPr}
${dSummary}
${dChecks}
<div className="decree-seal-line">
<span className="decree-seal-runes">{${mdxSafeStringify(decree.sealRunes ?? agentCallback.runes)}}</span>
<span className="decree-seal-agent">{${mdxSafeStringify(decree.sealAgent ?? agentName)}}</span>
<span className="decree-seal-title">{${mdxSafeStringify(decree.sealTitle ?? agentTitle)}}</span>
</div>
<div className="decree-signoff">{${mdxSafeStringify(decree.signoff ?? agentCallback.signoff)}}</div>
</div>
<div className="decree-complete-footer">᛭᛭᛭ END DECREE ᛭᛭᛭</div>
</div>`;
  }

  const mdxCallbackMarkup = `
<div className="agent-callback">
<div className="callback-runes">{${mdxSafeStringify(agentCallback.runes)}}</div>
<div className="callback-declaration">Odin All-Father — Your Will Is Done</div>
<div className="callback-quote">{${mdxSafeStringify(`"${agentCallback.quote}"`)}}</div>
<div className="callback-blood-seal">{${mdxSafeStringify(`ᛊ ${agentCallback.signoff} · ${agentTitle} · Issue #${issueNum} ᛊ`)}}</div>
<div className="callback-wolf">🐺</div>
</div>
${mdxDecreeCompleteMarkup}`;

  const mdx = `---
title: "${mdxTitle.replace(/"/g, '\\"')}"
date: "${dateStr}"
rune: "ᚲ"
excerpt: "${mdxExcerpt.replace(/"/g, '\\"')}"
slug: "${mdxSlug}"
category: "agent"
---

<div className="chronicle-page">

<div className="report">

<div className="report-header">
<div className="odin-header">
<img className="odin-avatar" src="${mdxAgentAvatarPath(agentName)}" alt="${mdxEsc(agentName)}" loading="lazy" />
<div className="odin-title">
<h1>{${mdxSafeStringify(`ᚲ ${agentName} — Issue #${issueNum} (Step ${stepNum})`)}}</h1>
</div>
</div>
<div className="meta">
<span><span className="label">Session:</span> {${mdxSafeStringify(meta.session || "unknown")}}</span>
<span><span className="label">Branch:</span> {${mdxSafeStringify(meta.branch || "unknown")}}</span>
<span><span className="label">Model:</span> {${mdxSafeStringify(meta.model || "unknown")}}</span>
</div>
</div>

<div className="stats-grid">
<div className="stats-card">
<div className="stats-card-label">ᛊ Session</div>
<div className="stats-row">
<div className="stat"><span className="num">${turns.length}</span><span className="lbl">turns</span></div>
<div className="stat"><span className="num">${totalTools}</span><span className="lbl">tools</span></div>
<div className="stat"><span className="num" style={{color: errors ? 'var(--fire-muspel)' : 'var(--teal-asgard)'}}>${errors}</span><span className="lbl">errors</span></div>
</div>
</div>
<div className="stats-card">
<div className="stats-card-label">ᛞ Git</div>
<div className="stats-row">
<div className="stat"><span className="num">${commits.length}</span><span className="lbl">commits</span></div>
<div className="stat"><span className="num">${pushCount}</span><span className="lbl">pushes</span></div>
</div>
</div>
<div className="stats-card">
<div className="stats-card-label">ᚠ Tokens</div>
<div className="stats-row">
<div className="stat"><span className="num sm">${fmtNum(totalInputTokens)}</span><span className="lbl">in</span></div>
<div className="stat"><span className="num sm">${fmtNum(totalOutputTokens)}</span><span className="lbl">out</span></div>
<div className="stat"><span className="num sm">${fmtNum(totalCacheRead)}</span><span className="lbl">cache</span></div>
</div>
</div>
</div>

${changesMarkup}
${commitsMarkup}

${mdxDecreeMarkup}

<div className="agent-turns-section">
<div className="agent-turns-title">Execution Turns</div>
${turnsMarkup}
</div>

${victoryHeckleMarkup}
${verdictMarkup}
${mdxCallbackMarkup}

<div className="report-footer">
ᚠ Fenrir Ledger — Agent Report — Generated ${new Date().toISOString().slice(0, 19)}Z
</div>

</div>

</div>
`;

  // ── Copy avatar assets to Next.js public/ so MDX image paths resolve ──────
  {
    const { cpSync: cp2, existsSync: ex2, mkdirSync: mk2 } = await import("fs");
    const repoRoot2 = resolve(__scriptDir, "..", "..", "..", "..");
    const publicDir = join(repoRoot2, "development", "ledger", "public");

    // Heckler avatars → public/hecklers/
    const hecklerSrc2 = join(repoRoot2, ".claude", "agents", "profiles", "hecklers");
    const hecklerDst2 = join(publicDir, "hecklers");
    if (ex2(hecklerSrc2)) {
      mk2(hecklerDst2, { recursive: true });
      for (const f of MDX_HECKLER_AVATARS) {
        const src = join(hecklerSrc2, f);
        if (ex2(src)) cp2(src, join(hecklerDst2, f));
      }
    }

    // Agent profile images → public/agents/profiles/
    const agentProfileSrc2 = join(repoRoot2, ".claude", "agents", "profiles");
    const agentProfileDst2 = join(publicDir, "agents", "profiles");
    if (ex2(agentProfileSrc2)) {
      mk2(agentProfileDst2, { recursive: true });
      for (const f of ["fireman-decko-dark.png","loki-dark.png","luna-dark.png","freya-dark.png","heimdall-dark.png","odin-dark.png"]) {
        const src = join(agentProfileSrc2, f);
        if (ex2(src)) cp2(src, join(agentProfileDst2, f));
      }
    }
  }

  // NOTE: No final sanitizeText() pass on assembled MDX — that corrupts JSX
  // tags by replacing text inside HTML attributes and tag bodies. All content
  // strings are already sanitized individually via sanitizeText/sanitizeToolOutput
  // before being embedded in JSX (via mdxEsc or JSON.stringify wrappers).
  writeFileSync(mdxFile, mdx);

  // ── Post-generation MDX compile validation ────────────────────────────────
  // Attempt to compile the generated MDX using @mdx-js/mdx. If it fails,
  // keep the file for debugging and exit non-zero to prevent silent bad publishes.
  try {
    // Resolve @mdx-js/mdx dynamically — works regardless of directory renames
    const repoRoot = resolve(__scriptDir, "..", "..", "..", "..");
    const ledgerModules = join(repoRoot, "development", "ledger", "node_modules", "@mdx-js", "mdx", "index.js");
    const rootModules = join(repoRoot, "node_modules", "@mdx-js", "mdx", "index.js");
    const { existsSync: mdxExists } = await import("fs");
    const mdxJsIndexPath = mdxExists(ledgerModules) ? ledgerModules : rootModules;
    const { compile: mdxCompile } = await import(mdxJsIndexPath);
    await mdxCompile(mdx, { format: "mdx" });
    console.log(`[ok] MDX compile validation passed`);
  } catch (validationErr) {
    console.error(`[FAIL] Generated MDX failed to compile — keeping file for debugging: ${mdxFile}`);
    console.error(validationErr.message);
    process.exit(1);
  }

  console.log(`[ok] chronicle published: ${mdxFile}`);
  console.log(`     slug: ${mdxSlug}`);
  console.log(`     url: /chronicles/${mdxSlug}`);
  console.log(`     turns: ${turns.length} | tools: ${totalTools} | errors: ${errors}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Build HTML
// ---------------------------------------------------------------------------
const outFile = outputPath
  ? resolve(outputPath)
  : logFile.replace(/\.log$/, ".html");
const assetsDir = dirname(outFile);

writeAssets(assetsDir);

let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${agentName} #${issueNum} — Agent Report</title>
<link rel="icon" type="image/png" href="favicon.png">
<link rel="stylesheet" href="agent-report.css">
</head>
<body>
<div class="report">

<div class="report-header">
  <div class="odin-header">
    <img class="odin-avatar" src="agents/profiles/${agentSlug}-dark.png" alt="${esc(agentName)}" onerror="this.style.display='none'">
    <div class="odin-title">
      <h1>ᚲ ${agentName} — Issue #${issueNum} (Step ${stepNum})</h1>
      <div class="odin-quote" id="odin-quote"></div>
    </div>
  </div>
  <div class="meta">
    <span><span class="label">Session:</span> ${esc(meta.session || "unknown")}</span>
    <span><span class="label">Branch:</span> ${esc(meta.branch || "unknown")}</span>
    <span><span class="label">Model:</span> ${esc(meta.model || "unknown")}</span>
  </div>
</div>

<!-- Stats Grid -->
<div class="stats-grid">
  <div class="stats-card">
    <div class="stats-card-label">ᛊ Session</div>
    <div class="stats-row">
      <div class="stat"><span class="num">${turns.length}</span><span class="lbl">turns</span></div>
      <div class="stat"><span class="num">${totalTools}</span><span class="lbl">tools</span></div>
      <div class="stat"><span class="num" style="color:${errors ? 'var(--fire-muspel)' : 'var(--teal-asgard)'}">${errors}</span><span class="lbl">errors</span></div>
    </div>
  </div>

  <div class="stats-card">
    <div class="stats-card-label">ᛞ Git</div>
    <div class="stats-row">
      <div class="stat"><span class="num">${commits.length}</span><span class="lbl">commits</span></div>
      <div class="stat"><span class="num">${pushCount}</span><span class="lbl">pushes</span></div>
      ${rateLimitEvents ? `<div class="stat"><span class="num sm" style="color:var(--amber-hati)">${rateLimitEvents}</span><span class="lbl">rate limits</span></div>` : ""}
    </div>
  </div>

  <div class="stats-card">
    <div class="stats-card-label">ᚠ Tokens</div>
    <div class="stats-row">
      <div class="stat"><span class="num sm">${fmtNum(totalInputTokens)}</span><span class="lbl">in</span></div>
      <div class="stat"><span class="num sm">${fmtNum(totalOutputTokens)}</span><span class="lbl">out</span></div>
      <div class="stat"><span class="num sm">${fmtNum(totalCacheRead)}</span><span class="lbl">cache rd</span></div>
      <div class="stat"><span class="num sm">${fmtNum(totalCacheCreation)}</span><span class="lbl">cache wr</span></div>
    </div>
  </div>

  <div class="stats-card">
    <div class="stats-card-label">ᛏ Tools</div>
    <div class="stats-row">
      ${Object.entries(toolCounts).sort((a,b) => b[1]-a[1]).map(([n,c]) =>
        `<div class="stat"><span class="num sm">${c}</span><span class="lbl">${esc(n)}</span></div>`
      ).join("")}
    </div>
  </div>

  ${totalTestsWritten > 0 || testsPassed > 0 || tscRuns > 0 || buildRuns > 0 ? `<div class="stats-card">
    <div class="stats-card-label">ᛉ Quality</div>
    <div class="stats-row">
      ${vitestCounts.unit > 0 ? `<div class="stat"><span class="num sm">${vitestCounts.unit}</span><span class="lbl">unit</span></div>` : ""}
      ${vitestCounts.component > 0 ? `<div class="stat"><span class="num sm">${vitestCounts.component}</span><span class="lbl">component</span></div>` : ""}
      ${vitestCounts.integration > 0 ? `<div class="stat"><span class="num sm">${vitestCounts.integration}</span><span class="lbl">integration</span></div>` : ""}
      ${playwrightCount > 0 ? `<div class="stat"><span class="num sm">${playwrightCount}</span><span class="lbl">e2e</span></div>` : ""}
      ${testsPassed > 0 ? `<div class="stat"><span class="num sm" style="color:var(--teal-asgard)">${testsPassed}</span><span class="lbl">passed</span></div>` : ""}
      ${testsFailed > 0 ? `<div class="stat"><span class="num sm" style="color:var(--fire-muspel)">${testsFailed}</span><span class="lbl">failed</span></div>` : ""}
      ${tscRuns > 0 ? `<div class="stat"><span class="num sm" style="color:${tscFail ? 'var(--fire-muspel)' : 'var(--teal-asgard)'}">${tscPass}/${tscRuns}</span><span class="lbl">tsc</span></div>` : ""}
      ${buildRuns > 0 ? `<div class="stat"><span class="num sm" style="color:${buildFail ? 'var(--fire-muspel)' : 'var(--teal-asgard)'}">${buildPass}/${buildRuns}</span><span class="lbl">build</span></div>` : ""}
    </div>
  </div>` : ""}
</div>

<!-- Changes Summary -->
<div class="changes-summary">
  <h2>ᛞ Changes</h2>
  <div class="changes-cols">
    <div class="changes-col">
      <h3>Files (${filesCreated.size} created, ${filesModified.size} modified, ${filesRead.size} read)</h3>
      <ul>
        ${[...filesCreated].map(f => `<li class="file-new"><span class="icon">+</span> ${esc(shortPath(f))}</li>`).join("\n        ")}
        ${[...filesModified].map(f => `<li class="file-mod"><span class="icon">~</span> ${esc(shortPath(f))}</li>`).join("\n        ")}
      </ul>
    </div>
    <div class="changes-col">
      <h3>Commits (${commits.length})</h3>
      <ul>
        ${commits.map(c => `<li class="commit-item"><span class="icon">&#9679;</span> <span class="msg">${esc(c)}</span></li>`).join("\n        ")}
      </ul>
    </div>
  </div>
</div>

<div style="margin-bottom:1rem; display:flex; gap:0.5rem;">
  <button id="expand-all" style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;padding:0.3rem 0.6rem;background:var(--forge);color:var(--text-rune);border:1px solid var(--rune-border);border-radius:3px;cursor:pointer;">Expand All</button>
  <button id="collapse-all" style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;padding:0.3rem 0.6rem;background:var(--forge);color:var(--text-rune);border:1px solid var(--rune-border);border-radius:3px;cursor:pointer;">Collapse All</button>
</div>

${renderEntrypoint()}

`;

// Render turns — merge consecutive tool-only turns into one toolbox
function isToolOnly(turn) {
  return turn.texts.length === 0 && turn.thinking.length === 0 && turn.tools.length > 0;
}

function renderToolBlock(tool) {
  return `      <div class="tool-block">
        <div class="tool-block-header">
          <span class="chevron">&#9654;</span>
          <span class="tool-name">${esc(tool.name)}</span>
          <span class="tool-input-preview">${toolInputPreview(tool)}</span>
        </div>
        <div class="tool-block-body">
          <div class="tool-input">${renderToolInput(tool)}</div>
          <div class="tool-output${tool.is_error ? " error" : ""}">${renderToolOutput(tool)}</div>
        </div>
      </div>\n`;
}

let ti = 0;
while (ti < turns.length) {
  const turn = turns[ti];

  // Collect consecutive tool-only turns into one merged toolbox
  if (isToolOnly(turn)) {
    const mergedTools = [];
    const turnNums = [];
    let hasError = false;
    while (ti < turns.length && isToolOnly(turns[ti])) {
      mergedTools.push(...turns[ti].tools);
      turnNums.push(ti + 1);
      if (turns[ti].tools.some(t => t.is_error)) hasError = true;
      ti++;
    }
    const numLabel = turnNums.length === 1 ? `#${turnNums[0]}` : `#${turnNums[0]}–${turnNums[turnNums.length - 1]}`;
    html += `<div class="turn${hasError ? " has-error" : ""}">
  <div class="turn-agent-profile">
    <img class="turn-agent-avatar" src="agents/profiles/${agentSlug}-dark.png" onerror="this.style.display='none'" alt="${esc(agentName)}">
    <span class="turn-agent-title">${esc(agentTitle)}</span>
  </div>
  <div class="turn-box">
  <div class="turn-header">
    <span class="turn-num">${numLabel}</span>
    <span class="turn-summary">${mergedTools.length} tool calls</span>
    <span class="turn-tools">
      ${mergedTools.map(t => `<span class="tool-badge ${toolBadgeClass(t.name)}">${esc(t.name)}</span>`).join("")}
    </span>
    <span class="chevron">&#9654;</span>
  </div>
  <div class="turn-body">
    <div class="toolbox">
${mergedTools.map(t => renderToolBlock(t)).join("")}    </div>
  </div>
  </div>
</div>\n\n`;
    // Render heckles for merged tool-only group
    hecklerEngine.maybeHeckle(); // consume without rendering for tool-only merges
    continue;
  }

  // Normal turn with text content
  const hasError = turn.tools.some(t => t.is_error);
  html += `<div class="turn${hasError ? " has-error" : ""}">
  <div class="turn-agent-profile">
    <img class="turn-agent-avatar" src="agents/profiles/${agentSlug}-dark.png" onerror="this.style.display='none'" alt="${esc(agentName)}">
    <span class="turn-agent-title">${esc(agentTitle)}</span>
  </div>
  <div class="turn-box">
  <div class="turn-header">
    <span class="turn-num">#${ti + 1}</span>
    <span class="turn-summary">${turnSummary(turn)}</span>
    <span class="turn-tools">
      ${turn.tools.map(t => `<span class="tool-badge ${toolBadgeClass(t.name)}">${esc(t.name)}</span>`).join("")}
    </span>
    <span class="chevron">&#9654;</span>
  </div>
  <div class="turn-body">
`;

  for (const thinking of turn.thinking) {
    html += `    <div class="thinking">${esc(thinking)}</div>\n`;
  }
  for (const text of turn.texts) {
    html += `    <div class="text-block">${esc(text)}</div>\n`;
  }
  if (turn.tools.length > 0) {
    html += `    <div class="toolbox">\n`;
    for (const tool of turn.tools) {
      html += renderToolBlock(tool);
    }
    html += `    </div>\n`;
  }

  // Close the turn body, turn-box, and turn div
  html += `  </div>\n  </div>\n</div>\n\n`;
  ti++;

  // Render heckles OUTSIDE the turn (visible without expanding)
  const heckleEvents = hecklerEngine.maybeHeckle();
  if (heckleEvents) {
    for (const event of heckleEvents) {
      if (event.type === "mayo") {
        const hIdx = Math.abs([...event.name].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0));
        const hAvatars = ['heckler-avatar.png','heckler-granny.png','heckler-da.png','heckler-uncle.png','heckler-mammy.png','heckler-teen.png','heckler-lad.png','heckler-lass.png'];
        const hAvatar = hAvatars[hIdx % hAvatars.length];
        html += '<div class="heckle heckle-mayo">'
          + '<div class="heckle-identity"><span class="heckle-name">' + esc(event.name) + '</span>'
          + '<img class="heckle-avatar" src="assets/' + hAvatar + '" onerror="this.style.display=\'none\'"></div>'
          + '<div class="heckle-text">' + esc(event.text) + '</div></div>\n';
      } else if (event.type === "mayo-comeback") {
        const slugMap = {FiremanDecko:'fireman-decko',Loki:'loki',Luna:'luna',Freya:'freya',Heimdall:'heimdall'};
        const aSlug = slugMap[event.name] || '';
        const aImg = aSlug ? '<img class="heckle-avatar" src="agents/profiles/' + aSlug + '-dark.png" onerror="this.style.display=\'none\'">' : '';
        const aTitle = AGENT_TITLES[event.name] || event.name;
        html += '<div class="heckle heckle-comeback">'
          + '<div class="heckle-identity">' + aImg + '<span class="heckle-name">' + esc(aTitle) + '</span></div>'
          + '<div class="heckle-text">' + esc(event.text) + '</div></div>\n';
      } else if (event.type === "mayo-entrance") {
        const eName = event.name || "Mayo Fan";
        const eIdx = Math.abs([...eName].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0));
        const eAvatars = ['heckler-avatar.png','heckler-granny.png','heckler-da.png','heckler-uncle.png','heckler-mammy.png','heckler-teen.png','heckler-lad.png','heckler-lass.png'];
        const eAvatar = eAvatars[eIdx % eAvatars.length];
        html += '<div class="heckle heckle-entrance">'
          + '<div class="heckle-identity"><span class="heckle-name">' + esc(eName) + '</span>'
          + '<img class="heckle-avatar" src="assets/' + eAvatar + '" onerror="this.style.display=\'none\'"></div>'
          + '<div class="heckle-text">' + esc(event.text) + '</div></div>\n';
      } else if (event.type === "mayo-explosion") {
        html += '<div class="heckle heckle-explosion">⚡ ' + esc(event.text) + ' ⚡</div>\n';
      }
    }
  }
}

// Victory heckle before verdict
const victoryHeckle = hecklerEngine.victoryHeckle();
html += `<div class="heckle heckle-explosion">⚡ ${esc(victoryHeckle.text)} ⚡</div>\n`;

// Verdict
if (verdict) {
  html += `<div class="verdict ${verdict.pass ? "pass" : "fail"}">
  <h2>ᛏ ${verdict.pass ? "PASS" : "FAIL"} — QA Verdict</h2>
  <pre>${esc(verdict.text)}</pre>
</div>\n`;
}

// Agent callback — use shared agentCallback resolved above
// Render structured decree block if agent emitted one
let decreeHtmlFragment = "";
if (decree) {
  const verdictColor = decree.verdict === "PASS" ? "var(--teal-asgard)" : decree.verdict === "FAIL" ? "var(--fire-muspel)" : "var(--amber-hati)";
  const checksHtml = decree.checks.length > 0
    ? decree.checks.map(c => {
        const ok = /pass|ok|complete|delivered|approved|secured|done/i.test(c.result);
        const fail = /fail|error|missing/i.test(c.result);
        const chkColor = ok ? "var(--teal-asgard)" : fail ? "var(--fire-muspel)" : "var(--text-rune)";
        return `<div class="decree-check"><span class="decree-check-name">${esc(c.name)}</span><span class="decree-check-result" style="color:${chkColor}">${esc(c.result)}</span></div>`;
      }).join("")
    : "";
  const summaryHtml = decree.summary.length > 0
    ? `<ul class="decree-summary">${decree.summary.map(s => `<li>${esc(s)}</li>`).join("")}</ul>`
    : "";
  const prHtml = decree.pr ? `<div class="decree-field"><span class="decree-label">PR:</span> <a href="${esc(decree.pr)}" target="_blank" rel="noopener">${esc(decree.pr)}</a></div>` : "";
  decreeHtmlFragment = `
<div class="decree-complete">
  <div class="decree-complete-header">
    <div class="decree-complete-runes">᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭</div>
    <div class="decree-complete-verdict" style="color:${verdictColor}">${esc(decree.verdict ?? "COMPLETE")}</div>
  </div>
  <div class="decree-complete-body">
    <div class="decree-field"><span class="decree-label">Issue:</span> #${esc(decree.issue ?? issueNum)}</div>
    ${prHtml}
    ${summaryHtml}
    ${checksHtml}
    <div class="decree-seal-line">
      <span class="decree-seal-runes">${esc(decree.sealRunes ?? agentCallback.runes)}</span>
      <span class="decree-seal-agent">${esc(decree.sealAgent ?? agentName)}</span>
      <span class="decree-seal-title">${esc(decree.sealTitle ?? agentTitle)}</span>
    </div>
    <div class="decree-signoff">${esc(decree.signoff ?? agentCallback.signoff)}</div>
  </div>
  <div class="decree-complete-footer">᛭᛭᛭ END DECREE ᛭᛭᛭</div>
</div>
`;
}

html += `
<div class="agent-callback">
  <div class="callback-runes">${agentCallback.runes}</div>
  <img class="callback-avatar" src="agents/profiles/${agentSlug}-dark.png" onerror="this.style.display='none'" alt="${esc(agentName)}">
  <div class="callback-declaration">Odin All-Father — Your Will Is Done</div>
  <div class="callback-quote">"${esc(agentCallback.quote)}"</div>
  <div class="callback-blood-seal">ᛊ ${esc(agentCallback.signoff)} · ${esc(agentTitle)} · Issue #${issueNum} ᛊ</div>
  <div class="callback-wolf">🐺</div>
</div>
${decreeHtmlFragment}
`;

html += `
<div class="report-footer">
  ᚠ Fenrir Ledger — Agent Report — Generated ${new Date().toISOString().slice(0, 19)}Z
</div>

</div>
<script src="agent-report.js"></script>
</body>
</html>`;

writeFileSync(outFile, html);

// Copy avatar assets alongside the report
import { cpSync, existsSync as exists2, mkdirSync as mkdir2 } from "fs";
const outDir = dirname(outFile);
const repoRoot = resolve(dirname(import.meta.url.replace("file://", "")), "..", "..", "..", "..");

// Copy agent profile images
const agentProfilesDir = join(repoRoot, ".claude", "agents", "profiles");
const targetAgentsDir = join(outDir, "agents", "profiles");
if (exists2(agentProfilesDir)) {
  mkdir2(targetAgentsDir, { recursive: true });
  for (const f of ["fireman-decko-dark.png", "loki-dark.png", "luna-dark.png", "freya-dark.png", "heimdall-dark.png"]) {
    const src = join(agentProfilesDir, f);
    if (exists2(src)) cpSync(src, join(targetAgentsDir, f));
  }
}

// Copy heckler avatars
const hecklerAssetsDir = join(repoRoot, ".claude", "agents", "profiles", "hecklers");
const targetAssetsDir = join(outDir, "assets");
if (exists2(hecklerAssetsDir)) {
  mkdir2(targetAssetsDir, { recursive: true });
  for (const f of ["heckler-avatar.png", "heckler-granny.png", "heckler-da.png", "heckler-uncle.png", "heckler-mammy.png", "heckler-teen.png", "heckler-lad.png", "heckler-lass.png"]) {
    const src = join(hecklerAssetsDir, f);
    if (exists2(src)) cpSync(src, join(targetAssetsDir, f));
  }
}

console.log(`[ok] report: ${outFile}`);
console.log(`     turns: ${turns.length} | tools: ${totalTools} | errors: ${errors}`);
console.log(`     tokens: ${fmtNum(totalInputTokens)} in / ${fmtNum(totalOutputTokens)} out | cache: ${fmtNum(totalCacheRead)} read / ${fmtNum(totalCacheCreation)} write`);
console.log(`     files: ${filesCreated.size} created, ${filesModified.size} modified | commits: ${commits.length}`);
console.log(`     tests: ${vitestCounts.total} vitest (${vitestCounts.unit} unit, ${vitestCounts.component} component, ${vitestCounts.integration} integration) + ${playwrightCount} e2e`);
if (tscRuns) console.log(`     verify: tsc ${tscPass}/${tscRuns} | build ${buildPass}/${buildRuns}`);
if (verdict) console.log(`     verdict: ${verdict.pass ? "PASS" : "FAIL"}`);
