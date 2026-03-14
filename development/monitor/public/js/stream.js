'use strict';
/**
 * stream.js — Client-side incremental log renderer for Odin's Throne.
 *
 * Overrides the base openSession() with a rich renderer that handles:
 *  - Incremental turn/tool-call blocks as they arrive
 *  - Tool results injected into the matching tool block
 *  - Mayo heckler chat bubbles (simulated client-side between turns)
 *  - Verdict banner with PASS/FAIL styling
 *  - Full brandified report panel on stream end
 */

// ── CSS injected at runtime ──────────────────────────────────────────────────

(function injectStreamStyles() {
  const style = document.createElement('style');
  style.textContent = `
/* stream.js styles */
.turn-block {
  border: 1px solid var(--rune-border); border-radius: 4px; margin-bottom: .4rem; overflow: hidden;
}
.turn-block-header {
  display: flex; align-items: center; gap: .6rem; padding: .4rem .7rem;
  background: var(--forge); cursor: pointer; user-select: none;
}
.turn-block-header:hover { background: var(--chain); }
.turn-block-num {
  font-family: 'Cinzel', serif; font-size: .65rem; color: var(--text-void); min-width: 1.8rem;
}
.turn-block-tools {
  font-family: 'JetBrains Mono', monospace; font-size: .65rem; color: var(--text-rune); flex: 1;
}
.turn-block-chevron { color: var(--gold); transition: transform .15s; }
.turn-block.open .turn-block-chevron { transform: rotate(90deg); }
.turn-block-body {
  display: none; padding: .6rem; border-top: 1px solid var(--rune-border); background: var(--void);
}
.turn-block.open .turn-block-body { display: block; }

.tool-row {
  background: var(--forge); border: 1px solid var(--rune-border); border-radius: 3px;
  margin-bottom: .3rem; overflow: hidden;
}
.tool-row.tool-error { border-color: #c94a0a; }
.tool-row-header { display: flex; align-items: center; gap: .5rem; padding: .3rem .6rem; }
.tool-badge {
  font-family: 'JetBrains Mono', monospace; font-size: .62rem;
  padding: .1rem .35rem; border-radius: 2px; background: var(--chain); color: var(--text-rune); flex-shrink: 0;
}
.tool-badge.bash   { background: #1a2a1a; color: #4ade80; }
.tool-badge.read   { background: #1a1a2a; color: var(--teal-asgard); }
.tool-badge.edit   { background: #2a1a2a; color: #c084fc; }
.tool-badge.write  { background: #2a1a1a; color: #fb923c; }
.tool-badge.todo   { background: #2a2a1a; color: var(--gold-bright); }
.tool-preview {
  font-family: 'JetBrains Mono', monospace; font-size: .62rem; color: var(--text-void);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
}
.tool-result-block {
  font-family: 'JetBrains Mono', monospace; font-size: .62rem; color: var(--text-void);
  padding: .3rem .6rem; border-top: 1px solid var(--rune-border);
  white-space: pre-wrap; word-break: break-word; max-height: 100px; overflow-y: auto;
}
.tool-result-block.is-error { color: #ef4444; }

.heckle-bubble {
  display: flex; align-items: flex-start; gap: .6rem;
  padding: .5rem .7rem; margin-bottom: .4rem; border-radius: 4px;
  border: 1px solid var(--rune-border); background: var(--forge);
  animation: heckle-in .3s ease-out;
}
@keyframes heckle-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.heckle-bubble.mayo { border-color: rgba(201,146,10,.35); }
.heckle-bubble.comeback { border-color: rgba(78,205,196,.35); }
.heckle-bubble.entrance { border-color: rgba(240,180,41,.5); font-style: italic; }
.heckle-avatar {
  width: 28px; height: 28px; border-radius: 50%; background: var(--chain);
  border: 1px solid var(--rune-border); flex-shrink: 0; display: flex;
  align-items: center; justify-content: center; font-size: .75rem;
}
.heckle-bubble.mayo .heckle-avatar { border-color: rgba(201,146,10,.5); }
.heckle-bubble.comeback .heckle-avatar { border-color: rgba(78,205,196,.5); }
.heckle-content { flex: 1; min-width: 0; }
.heckle-name {
  font-family: 'Cinzel', serif; font-size: .65rem; color: var(--text-void); margin-bottom: .15rem;
}
.heckle-bubble.mayo .heckle-name { color: var(--gold-bright); }
.heckle-bubble.comeback .heckle-name { color: var(--teal-asgard); }
.heckle-text { font-size: .75rem; color: var(--text-rune); line-height: 1.4; }
.heckle-bubble.mayo .heckle-text { color: var(--text-saga); }

.verdict-banner {
  padding: .75rem 1rem; border-radius: 4px; margin-bottom: .5rem;
  border: 1px solid var(--rune-border); font-family: 'Cinzel', serif;
  animation: heckle-in .3s ease-out;
}
.verdict-banner.pass { border-color: var(--teal-asgard); color: var(--teal-asgard); }
.verdict-banner.fail { border-color: #ef4444; color: #ef4444; }
.verdict-banner .verdict-title { font-size: 1rem; font-weight: 700; margin-bottom: .3rem; }
.verdict-banner .verdict-summary {
  font-family: 'JetBrains Mono', monospace; font-size: .68rem; color: var(--text-rune);
  white-space: pre-wrap; word-break: break-word; margin-top: .35rem;
}

#report-panel {
  display: none; position: fixed; inset: 0; background: rgba(7,7,13,.9);
  z-index: 100; overflow: auto; padding: 2rem;
}
#report-panel.visible { display: block; }
#report-panel iframe {
  width: 100%; max-width: 1000px; margin: 0 auto; display: block;
  border: 1px solid var(--rune-border); border-radius: 4px;
  background: var(--void); min-height: 80vh;
}
#report-close-btn {
  position: fixed; top: 1rem; right: 1rem; z-index: 101;
  background: var(--forge); border: 1px solid var(--rune-border); border-radius: 4px;
  color: var(--text-rune); font-family: 'JetBrains Mono', monospace; font-size: .75rem;
  padding: .35rem .75rem; cursor: pointer;
}
#report-close-btn:hover { color: var(--text-saga); border-color: var(--gold); }
#report-open-btn {
  background: var(--forge); border: 1px solid var(--rune-border); border-radius: 3px;
  color: var(--gold); font-family: 'JetBrains Mono', monospace; font-size: .68rem;
  padding: .25rem .6rem; cursor: pointer; margin-left: .5rem; flex-shrink: 0;
}
#report-open-btn:hover { border-color: var(--gold); }
`;
  document.head.appendChild(style);
})();

// ── Mayo heckler (simplified client-side engine) ─────────────────────────────

const MAYO_LINES = [
  "MAYO FOR SAM!! 🏆",
  "C'MON THE MAYO LADS!! This is YOUR year!!",
  "SEVENTY-THREE YEARS IS ENOUGH!! LET'S GO MAYO!!",
  "The Yew Wood watching over ye!! MAYO ABÚ!!",
  "James Horan for Taoiseach and Sam for Mayo!! IN THAT ORDER!!",
  "I'm not crying, YOU'RE crying!! MAYO FOR SAM!!",
  "Every line of code is a step closer to SAM!! C'MON!!",
];

const COMEBACK_LINES = [
  "Right so… back to the code. WHERE WERE WE. 💻",
  "…I'll dedicate this commit to yer man. ANYWAY.",
  "Focus. Ship. Repeat. Even Odin tunes out the crowd sometimes.",
];

const MAYO_NAMES = ["Seamus", "Brigid", "Cormac", "Aisling", "Padraig", "Fionnuala"];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const hecklerState = { counter: 0, name: randomFrom(MAYO_NAMES) };

/** Maybe generate a heckle event object; returns null most of the time. */
function maybeHeckle() {
  hecklerState.counter++;
  if (hecklerState.counter < 2 + Math.floor(Math.random() * 2)) return null;
  hecklerState.counter = 0;
  const events = [];
  events.push({ style: 'mayo', name: hecklerState.name, text: randomFrom(MAYO_LINES) });
  if (Math.random() < 0.4) {
    events.push({ style: 'comeback', name: 'Agent', text: randomFrom(COMEBACK_LINES) });
  }
  return events;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toolBadgeClass(name) {
  const n = name.toLowerCase();
  if (n === 'bash') return 'bash';
  if (n === 'read' || n === 'grep' || n === 'glob') return 'read';
  if (n === 'edit' || n === 'multiedit') return 'edit';
  if (n === 'write') return 'write';
  if (n === 'todowrite' || n === 'todoupdate') return 'todo';
  return '';
}

function toolInputPreview(toolName, input) {
  if (!input) return '';
  const n = toolName.toLowerCase();
  if (n === 'bash' && input.command) return String(input.command).slice(0, 120);
  if ((n === 'read' || n === 'edit' || n === 'write') && input.file_path) return input.file_path;
  if ((n === 'grep' || n === 'glob') && input.pattern) return input.pattern;
  const keys = Object.keys(input);
  if (keys.length) return String(input[keys[0]]).slice(0, 80);
  return '';
}

// ── Report panel ─────────────────────────────────────────────────────────────

let reportHtml = null;

function ensureReportPanel() {
  if (document.getElementById('report-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'report-panel';
  panel.setAttribute('aria-label', 'Agent report');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = `
    <button id="report-close-btn" aria-label="Close report">✕ Close</button>
    <iframe id="report-iframe" title="Agent report" aria-label="Full agent report"></iframe>
  `;
  document.body.appendChild(panel);
  document.getElementById('report-close-btn').addEventListener('click', () => {
    panel.classList.remove('visible');
  });
}

function showReport(html) {
  ensureReportPanel();
  reportHtml = html;
  const iframe = document.getElementById('report-iframe');
  if (iframe) {
    const blob = new Blob([html], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);
  }
  document.getElementById('report-panel').classList.add('visible');
}

function ensureReportButton(headerEl) {
  if (headerEl.querySelector('#report-open-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'report-open-btn';
  btn.textContent = 'View Report';
  btn.setAttribute('aria-label', 'View full agent report');
  btn.addEventListener('click', () => {
    if (reportHtml) showReport(reportHtml);
  });
  headerEl.appendChild(btn);
}

// ── State ────────────────────────────────────────────────────────────────────

let streamActiveWs = null;
let streamActiveSessionId = null;
/** Map from toolId → DOM element of that tool row */
const toolRowElements = new Map();
/** Current open turn block body element */
let currentTurnBody = null;
let currentTurnHeader = null;

// ── DOM helpers ──────────────────────────────────────────────────────────────

function getTerminal() { return document.getElementById('log-terminal'); }

function appendToTerminal(el) {
  const term = getTerminal();
  if (!term) return;
  term.appendChild(el);
  term.scrollTop = term.scrollHeight;
}

function appendTurnBlock(turnNum) {
  const block = document.createElement('div');
  block.className = 'turn-block open';
  block.setAttribute('aria-label', 'Turn ' + turnNum);
  block.dataset.turnNum = String(turnNum);
  block.innerHTML = `
    <div class="turn-block-header" aria-label="Turn ${turnNum} header">
      <span class="turn-block-num">T${turnNum}</span>
      <span class="turn-block-tools" id="turn-${turnNum}-tool-count">0 tools</span>
      <span class="turn-block-chevron" aria-hidden="true">›</span>
    </div>
    <div class="turn-block-body" id="turn-${turnNum}-body"></div>
  `;
  block.querySelector('.turn-block-header').addEventListener('click', () => {
    block.classList.toggle('open');
  });
  appendToTerminal(block);
  currentTurnBody = block.querySelector('#turn-' + turnNum + '-body');
  currentTurnHeader = block.querySelector('#turn-' + turnNum + '-tool-count');
  return block;
}

function appendToolRow(turnNum, toolId, toolName, input) {
  if (!currentTurnBody) appendTurnBlock(turnNum);
  const badgeClass = toolBadgeClass(toolName);
  const preview = escHtml(toolInputPreview(toolName, input));

  const row = document.createElement('div');
  row.className = 'tool-row';
  row.setAttribute('aria-label', 'Tool call: ' + toolName);
  row.innerHTML = `
    <div class="tool-row-header">
      <span class="tool-badge${badgeClass ? ' ' + badgeClass : ''}">${escHtml(toolName)}</span>
      <span class="tool-preview">${preview}</span>
    </div>
  `;
  currentTurnBody.appendChild(row);
  toolRowElements.set(toolId, row);

  // Update tool count in header
  if (currentTurnHeader) {
    const countEl = currentTurnHeader;
    const current = parseInt(countEl.textContent) || 0;
    const next = current + 1;
    countEl.textContent = next + ' tool' + (next !== 1 ? 's' : '');
  }

  const term = getTerminal();
  if (term) term.scrollTop = term.scrollHeight;
  return row;
}

function appendToolResult(toolId, content, isError) {
  const row = toolRowElements.get(toolId);
  if (!row) return;
  if (isError) row.classList.add('tool-error');
  const resultEl = document.createElement('div');
  resultEl.className = 'tool-result-block' + (isError ? ' is-error' : '');
  resultEl.textContent = content.slice(0, 800) + (content.length > 800 ? '\n…' : '');
  row.appendChild(resultEl);
  const term = getTerminal();
  if (term) term.scrollTop = term.scrollHeight;
}

function appendHeckleBubble(style, name, text) {
  const isComeback = style === 'comeback';
  const isEntrance = style === 'entrance';
  const avatar = isComeback ? '⚡' : isEntrance ? '🚪' : '🟢';
  const bubble = document.createElement('div');
  bubble.className = 'heckle-bubble ' + style;
  bubble.setAttribute('aria-label', 'Heckle from ' + name);
  bubble.innerHTML = `
    <div class="heckle-avatar" aria-hidden="true">${avatar}</div>
    <div class="heckle-content">
      <div class="heckle-name">${escHtml(name)}</div>
      <div class="heckle-text">${escHtml(text)}</div>
    </div>
  `;
  appendToTerminal(bubble);
}

function appendVerdictBanner(pass, summary) {
  const banner = document.createElement('div');
  banner.className = 'verdict-banner ' + (pass ? 'pass' : 'fail');
  banner.setAttribute('aria-label', 'Verdict: ' + (pass ? 'PASS' : 'FAIL'));
  banner.innerHTML = `
    <div class="verdict-title">${pass ? '✓ PASS' : '✗ FAIL'}</div>
    <div class="verdict-summary">${escHtml(summary.slice(0, 500))}</div>
  `;
  appendToTerminal(banner);
}

// ── openSession override ─────────────────────────────────────────────────────

/**
 * Enhanced openSession — overrides the base version in the inline HTML script.
 * Handles structured WS events: turn_start, tool_call, tool_result,
 * heckle, verdict, report — plus falls back to raw log lines.
 */
window.openSession = function openSession(sessionId, job) {
  if (streamActiveWs) {
    streamActiveWs.close();
    streamActiveWs = null;
  }

  streamActiveSessionId = sessionId;
  reportHtml = null;
  toolRowElements.clear();
  currentTurnBody = null;
  currentTurnHeader = null;

  // Show content areas
  document.getElementById('content-header').style.display = 'flex';
  document.getElementById('log-terminal').style.display = 'block';
  document.getElementById('empty-state').style.display = 'none';

  // Set title
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

  // Clear terminal
  const term = getTerminal();
  if (term) term.innerHTML = '';

  // Set WS badge
  const badge = document.getElementById('ws-badge');
  if (badge) { badge.className = 'ws-badge connecting'; badge.textContent = 'connecting'; }

  // Open WebSocket
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = proto + '//' + location.host + '/ws/logs/' + encodeURIComponent(sessionId);
  const ws = new WebSocket(wsUrl);
  streamActiveWs = ws;

  ws.addEventListener('open', () => {
    if (badge) { badge.className = 'ws-badge open'; badge.textContent = 'live'; }
  });

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    handleStreamMessage(msg, sessionId);
  });

  ws.addEventListener('close', () => {
    if (streamActiveWs === ws) {
      if (badge) { badge.className = 'ws-badge closed'; badge.textContent = 'closed'; }
    }
  });

  ws.addEventListener('error', () => {
    const errEl = document.createElement('div');
    errEl.className = 'log-line';
    errEl.innerHTML = '<span class="log-error">WebSocket error — check that the session pod exists</span>';
    appendToTerminal(errEl);
    if (badge) { badge.className = 'ws-badge error'; badge.textContent = 'error'; }
  });
};

// ── WS message handler ───────────────────────────────────────────────────────

function handleStreamMessage(msg, sessionId) {
  const badge = document.getElementById('ws-badge');

  switch (msg.type) {
    case 'connected': {
      const connEl = document.createElement('div');
      connEl.className = 'log-line';
      connEl.innerHTML = '<span class="log-system">\u2014 connected to session ' + escHtml(msg.sessionId) + ' \u2014</span>';
      appendToTerminal(connEl);
      break;
    }

    case 'turn_start': {
      appendTurnBlock(msg.turnNum);
      // Heckle between turns (client-side simulation)
      const heckles = maybeHeckle();
      if (heckles) {
        heckles.forEach(h => appendHeckleBubble(h.style, h.name, h.text));
      }
      break;
    }

    case 'tool_call': {
      appendToolRow(msg.turnNum, msg.toolId, msg.toolName, msg.input);
      break;
    }

    case 'tool_result': {
      appendToolResult(msg.toolId, msg.content, msg.isError);
      break;
    }

    case 'heckle': {
      appendHeckleBubble(msg.style, msg.name, msg.text);
      break;
    }

    case 'verdict': {
      appendVerdictBanner(msg.pass, msg.summary);
      // Update sidebar card status visually
      updateSidebarVerdict(sessionId, msg.pass);
      break;
    }

    case 'report': {
      reportHtml = msg.html;
      const header = document.getElementById('content-header');
      if (header) ensureReportButton(header);
      break;
    }

    case 'error': {
      const errEl = document.createElement('div');
      errEl.className = 'log-line';
      errEl.innerHTML = '<span class="log-error">\u26A0 ' + escHtml(msg.message) + '</span>';
      appendToTerminal(errEl);
      if (badge) { badge.className = 'ws-badge error'; badge.textContent = 'error'; }
      break;
    }

    case 'end': {
      const endEl = document.createElement('div');
      endEl.className = 'log-line log-end';
      endEl.textContent = '\u2014 stream ended \u2014';
      appendToTerminal(endEl);
      if (badge) { badge.className = 'ws-badge closed'; badge.textContent = 'done'; }
      break;
    }

    case 'log':
      // Raw log lines are shown only when we haven't yet parsed any JSONL turns.
      // Once turns start appearing, raw lines are redundant but harmless.
      // To avoid flooding the terminal, skip raw lines once turn rendering is active.
      if (!currentTurnBody) {
        const ts = msg.ts ? '<span class="log-ts">' + new Date(msg.ts).toLocaleTimeString() + '</span>' : '';
        const logEl = document.createElement('div');
        logEl.className = 'log-line';
        logEl.innerHTML = ts + escHtml(msg.line);
        appendToTerminal(logEl);
      }
      break;

    default:
      break;
  }
}

// ── Sidebar verdict update ───────────────────────────────────────────────────

function updateSidebarVerdict(sessionId, pass) {
  const card = document.querySelector('[data-session="' + CSS.escape(sessionId) + '"]');
  if (!card) return;
  const statusEl = card.querySelector('.card-status');
  if (!statusEl) return;
  statusEl.textContent = pass ? '\u2713' : '\u2717';
  statusEl.style.color = pass ? '#22c55e' : '#ef4444';
  statusEl.classList.remove('pulse');
  statusEl.title = pass ? 'PASS' : 'FAIL';
}
