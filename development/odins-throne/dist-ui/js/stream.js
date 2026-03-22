'use strict';
/**
 * stream.js — Main Thread coordinator for Odin's Throne log streaming.
 *
 * Thin layer that:
 *  - Spawns log-parser.worker.js (owns the WebSocket)
 *  - Sends connect/subscribe/unsubscribe/flush messages to Worker
 *  - Receives chunk-ready pointers → reads from IndexedDB → writes DOM via rAF
 *  - Receives jobs-updated → re-renders sidebar job cards
 *  - Receives connection-status → drives ws-badge + error banner
 *  - Receives verdict → shows verdict banner + updates sidebar card
 *  - Receives session-end → marks stream as done
 *  - Receives report → shows report panel
 *
 * All heavy lifting (WebSocket, JSONL parsing, IDB writes) is in the Worker.
 * Main thread never touches WebSocket directly.
 */

// ── CSS ───────────────────────────────────────────────────────────────────────

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

.connection-error-banner {
  display: none; padding: .5rem 1rem; background: #1a0a0a;
  border-bottom: 1px solid #c94a0a; font-family: 'JetBrains Mono', monospace;
  font-size: .72rem; color: #ef4444;
}
.connection-error-banner.visible { display: block; }
`;
  document.head.appendChild(style);
})();

// ── IndexedDB (read-only from Main Thread) ────────────────────────────────────

const IDB_NAME    = 'odin-throne-logs';
const IDB_VERSION = 1;
let mainThreadIdb = null;

function openMainIdb() {
  if (mainThreadIdb) return Promise.resolve(mainThreadIdb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains('log-chunks')) {
        db.createObjectStore('log-chunks', { keyPath: ['sessionId', 'chunkId'] });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'sessionId' });
      }
    };
    req.onsuccess  = (ev) => { mainThreadIdb = ev.target.result; resolve(mainThreadIdb); };
    req.onerror    = ()   => reject(req.error);
  });
}

function readChunk(sessionId, chunkId) {
  return openMainIdb().then((db) => new Promise((resolve, reject) => {
    const tx    = db.transaction('log-chunks', 'readonly');
    const store = tx.objectStore('log-chunks');
    const req   = store.get([sessionId, chunkId]);
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror   = ()   => reject(req.error);
  }));
}

// ── Report Panel ──────────────────────────────────────────────────────────────

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
  btn.addEventListener('click', () => { if (reportHtml) showReport(reportHtml); });
  headerEl.appendChild(btn);
}

// ── DOM Helpers ───────────────────────────────────────────────────────────────

function getTerminal() { return document.getElementById('log-terminal'); }

/**
 * Append a pre-rendered HTML fragment entry to the terminal.
 * Handles placement of tool-call entries inside the current turn body,
 * and tool-result entries inside their matching tool row.
 */
function appendEntry(entry, term) {
  if (!term || !entry.html) return;

  const tmp = document.createElement('div');
  tmp.innerHTML = entry.html;
  const el = tmp.firstElementChild;
  if (!el) return;

  if (entry.type === 'tool-result') {
    // Inject result inside its matching tool row
    const toolId = el.dataset.forTool;
    if (toolId) {
      const toolRow = term.querySelector(`[data-tool-id="${CSS.escape(toolId)}"]`);
      if (toolRow) {
        toolRow.appendChild(el);
        return;
      }
    }
    // Fallback: append to current turn body or terminal
  }

  if (entry.type === 'tool-call') {
    // Append inside the last open turn block's body
    const openBody = term.querySelector('.turn-block.open .turn-block-body:last-of-type') ||
                     term.querySelector('.turn-block .turn-block-body:last-of-type');
    if (openBody) {
      openBody.appendChild(el);
      // Update tool count in the matching header
      const header = openBody.previousElementSibling;
      if (header) {
        const countEl = header.querySelector('[data-tool-count]');
        if (countEl) {
          const n = (parseInt(countEl.dataset.toolCount || '0') || 0) + 1;
          countEl.dataset.toolCount = String(n);
          countEl.textContent = n + ' tool' + (n !== 1 ? 's' : '');
        }
      }
      return;
    }
  }

  if (entry.type === 'turn-start') {
    term.appendChild(el);
    // Wire collapse/expand click handler
    const header = el.querySelector('.turn-block-header');
    if (header) {
      header.addEventListener('click', () => el.classList.toggle('open'));
    }
    return;
  }

  term.appendChild(el);
}

// ── rAF-batched DOM writer ────────────────────────────────────────────────────

/** Pending chunks waiting for the next rAF flush. */
const pendingChunks = [];
let rafPending = false;

function scheduleRaf() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    drainPendingChunks();
  });
}

function drainPendingChunks() {
  if (!pendingChunks.length) return;
  const term = getTerminal();
  if (!term) { pendingChunks.length = 0; return; }

  // Take a snapshot of what's ready, clear queue, then apply
  const snapshot = pendingChunks.splice(0, pendingChunks.length);
  for (const entries of snapshot) {
    for (const entry of entries) {
      appendEntry(entry, term);
    }
  }
  term.scrollTop = term.scrollHeight;
}

// ── Connection Error Banner ───────────────────────────────────────────────────

function ensureErrorBanner() {
  let banner = document.getElementById('connection-error-banner');
  if (banner) return banner;
  banner = document.createElement('div');
  banner.id        = 'connection-error-banner';
  banner.className = 'connection-error-banner';
  banner.setAttribute('role', 'alert');
  // Insert above the terminal area
  const term = getTerminal();
  if (term && term.parentNode) {
    term.parentNode.insertBefore(banner, term);
  } else {
    document.body.appendChild(banner);
  }
  return banner;
}

function setConnectionStatus(connected, reconnecting, error) {
  const badge = document.getElementById('ws-badge');
  if (badge) {
    if (connected) {
      badge.className = 'ws-badge open';
      badge.textContent = 'live';
    } else if (reconnecting) {
      badge.className = 'ws-badge connecting';
      badge.textContent = 'reconnecting';
    } else {
      badge.className = 'ws-badge closed';
      badge.textContent = 'disconnected';
    }
  }

  const banner = ensureErrorBanner();
  if (!connected && (reconnecting || error)) {
    banner.textContent = error
      ? `⚠ ${error}`
      : '⚠ WebSocket disconnected — reconnecting…';
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
    banner.textContent = '';
  }
}

// ── Sidebar Helpers ───────────────────────────────────────────────────────────

function updateSidebarVerdict(sessionId, pass) {
  const card = document.querySelector('[data-session="' + CSS.escape(sessionId) + '"]');
  if (!card) return;
  const statusEl = card.querySelector('.card-status');
  if (!statusEl) return;
  statusEl.textContent = pass ? '✓' : '✗';
  statusEl.style.color = pass ? '#22c55e' : '#ef4444';
  statusEl.classList.remove('pulse');
  statusEl.title = pass ? 'PASS' : 'FAIL';
}

/** Render the sidebar job cards from a jobs array. */
function renderJobCards(jobs) {
  const sidebar = document.getElementById('job-list');
  if (!sidebar || !Array.isArray(jobs)) return;
  sidebar.innerHTML = '';
  for (const job of jobs) {
    const card = document.createElement('div');
    card.className = 'card' + (job.sessionId === activeSessionId ? ' active' : '');
    card.dataset.session = job.sessionId;
    const statusSymbol =
      job.status === 'succeeded' ? '✓' :
      job.status === 'failed'    ? '✗' :
      job.status === 'running'   ? '●' : '○';
    const statusColor =
      job.status === 'succeeded' ? '#22c55e' :
      job.status === 'failed'    ? '#ef4444' :
      job.status === 'running'   ? 'var(--gold)' : 'var(--text-void)';
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">${escHtml(job.name || job.sessionId)}</span>
        <span class="card-status" style="color:${statusColor}">${statusSymbol}</span>
      </div>
      <div class="card-meta">#${job.issueNumber || '?'} · ${escHtml(job.agent || '')} · Step ${job.step || 1}</div>
    `;
    card.addEventListener('click', () => openSession(job.sessionId, {
      agentName: job.agent,
      issue:     job.issueNumber,
      step:      job.step,
    }));
    sidebar.appendChild(card);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Worker Lifecycle ──────────────────────────────────────────────────────────

let logWorker         = null;
let activeSessionId   = null;

function ensureWorker() {
  if (logWorker) return logWorker;
  logWorker = new Worker('/js/log-parser.worker.js');

  logWorker.addEventListener('message', (ev) => {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;
    handleWorkerMessage(msg);
  });

  logWorker.addEventListener('error', (ev) => {
    console.error('[stream] Worker error:', ev.message);
    setConnectionStatus(false, false, 'Worker error: ' + ev.message);
  });

  // Connect to the multiplexed WebSocket endpoint (new protocol)
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = proto + '//' + location.host + '/ws';
  logWorker.postMessage({ type: 'connect', wsUrl });

  return logWorker;
}

// ── Worker → Main Thread Message Handler ─────────────────────────────────────

function handleWorkerMessage(msg) {
  switch (msg.type) {
    // ── Chunk of pre-rendered HTML ready in IDB ───────────────────────────────
    case 'chunk-ready': {
      if (msg.sessionId !== activeSessionId) break;
      readChunk(msg.sessionId, msg.chunkId)
        .then((chunk) => {
          if (!chunk || !chunk.entries) return;
          pendingChunks.push(chunk.entries);
          scheduleRaf();
        })
        .catch((err) => {
          console.warn('[stream] IDB read failed:', err);
        });
      break;
    }

    // ── Job list updated (send directly, no IDB) ──────────────────────────────
    case 'jobs-updated': {
      renderJobCards(msg.jobs);
      break;
    }

    // ── Verdict detected ──────────────────────────────────────────────────────
    case 'verdict': {
      updateSidebarVerdict(msg.sessionId, msg.result === 'PASS');
      break;
    }

    // ── Session log stream complete ───────────────────────────────────────────
    case 'session-end': {
      if (msg.sessionId === activeSessionId) {
        const badge = document.getElementById('ws-badge');
        if (badge) { badge.className = 'ws-badge closed'; badge.textContent = 'done'; }
        // Flush any remaining rAF
        pendingChunks.length && scheduleRaf();
      }
      break;
    }

    // ── Connection status → ws-badge + error banner ───────────────────────────
    case 'connection-status': {
      setConnectionStatus(msg.connected, msg.reconnecting, msg.error);
      break;
    }

    // ── Report HTML (legacy protocol forwarded by worker) ─────────────────────
    case 'report': {
      reportHtml = msg.html;
      const header = document.getElementById('content-header');
      if (header) ensureReportButton(header);
      break;
    }

    default:
      break;
  }
}

// ── openSession ───────────────────────────────────────────────────────────────

/**
 * Override of the base openSession defined in the inline HTML script.
 * Notifies the Worker to subscribe to this session; clears + resets UI.
 */
window.openSession = function openSession(sessionId, job) {
  const worker = ensureWorker();

  // Unsubscribe previous session
  if (activeSessionId && activeSessionId !== sessionId) {
    worker.postMessage({ type: 'unsubscribe', sessionId: activeSessionId });
  }

  activeSessionId = sessionId;
  reportHtml      = null;
  pendingChunks.length = 0;

  // Show content areas
  document.getElementById('content-header').style.display = 'flex';
  document.getElementById('log-terminal').style.display   = 'block';
  document.getElementById('empty-state').style.display    = 'none';

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

  // Update badge to connecting
  const badge = document.getElementById('ws-badge');
  if (badge) { badge.className = 'ws-badge connecting'; badge.textContent = 'connecting'; }

  // Subscribe via Worker (Worker opens WS to the session endpoint for legacy protocol,
  // or sends subscribe message for new multiplexed protocol)
  worker.postMessage({ type: 'subscribe', sessionId });
};
