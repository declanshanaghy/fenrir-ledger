'use strict';
/**
 * log-parser.worker.js — Web Worker for Odin's Throne
 *
 * Owns the single multiplexed WebSocket connection. Parses JSONL log lines,
 * renders HTML fragments, batches entries into IndexedDB, and sends lightweight
 * chunk-ready pointer messages to the main thread.
 *
 * Wire protocol consumed (Issue #910 / #917):
 *   Server → Worker: jobs-snapshot, jobs-updated, log-line, verdict,
 *                    stream-end, stream-error, pong, error
 *   Worker → Server: subscribe, unsubscribe, ping
 *
 * Also handles legacy server messages (pre-#917) for backward compat:
 *   turn_start, tool_call, tool_result, heckle, verdict, report, log, end
 *
 * Main Thread → Worker: connect, subscribe, unsubscribe, flush
 * Worker → Main Thread: chunk-ready, jobs-updated, verdict, session-end,
 *                       connection-status, report
 */

// ── Configuration ─────────────────────────────────────────────────────────────

const BATCH_SIZE     = 20;
const BATCH_MS       = 200;
const IDB_NAME       = 'odin-throne-logs';
const IDB_VERSION    = 1;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const PING_INTERVAL  = 30_000;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16_000, 30_000];

// ── State ─────────────────────────────────────────────────────────────────────

let wsUrl            = null;
let ws               = null;
let idb              = null;
let reconnectAttempt = 0;
let reconnectTimer   = null;
let pingInterval     = null;

/** Sessions currently subscribed (user is viewing their log panel). */
const subscribedSessions = new Set();

/** Per-session batch: Map<sessionId, { entries, chunkId, timer }> */
const sessionBatches = new Map();

/** Per-session JSONL parser state (new wire protocol). */
const sessionParserState = new Map();

/** Per-session legacy protocol state (pre-#917 backward compat). */
const sessionLegacyState = new Map();

// ── Mayo Heckler Data ─────────────────────────────────────────────────────────

const MAYO_LINES = [
  'MAYO FOR SAM!! 🏆',
  "C'MON THE MAYO LADS!! This is YOUR year!!",
  'SEVENTY-THREE YEARS IS ENOUGH!! LET\'S GO MAYO!!',
  'The Yew Wood watching over ye!! MAYO ABÚ!!',
  'James Horan for Taoiseach and Sam for Mayo!! IN THAT ORDER!!',
  "I'm not crying, YOU'RE crying!! MAYO FOR SAM!!",
  'Every line of code is a step closer to SAM!! C\'MON!!',
];
const COMEBACK_LINES = [
  'Right so… back to the code. WHERE WERE WE. 💻',
  "…I'll dedicate this commit to yer man. ANYWAY.",
  'Focus. Ship. Repeat. Even Odin tunes out the crowd sometimes.',
];
const MAYO_NAMES = ['Seamus', 'Brigid', 'Cormac', 'Aisling', 'Padraig', 'Fionnuala'];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── HTML Helpers ──────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toolBadgeClass(name) {
  const n = (name || '').toLowerCase();
  if (n === 'bash') return 'bash';
  if (n === 'read' || n === 'grep' || n === 'glob') return 'read';
  if (n === 'edit' || n === 'multiedit') return 'edit';
  if (n === 'write') return 'write';
  if (n === 'todowrite' || n === 'todoupdate') return 'todo';
  return '';
}

function toolInputPreview(toolName, input) {
  if (!input) return '';
  const n = (toolName || '').toLowerCase();
  if (n === 'bash' && input.command) return String(input.command).slice(0, 120);
  if ((n === 'read' || n === 'edit' || n === 'write') && input.file_path) return input.file_path;
  if ((n === 'grep' || n === 'glob') && input.pattern) return input.pattern;
  const keys = Object.keys(input);
  if (keys.length) return String(input[keys[0]]).slice(0, 80);
  return '';
}

// ── HTML Renderers ────────────────────────────────────────────────────────────

function renderTurnStart(turnNum) {
  return `<div class="turn-block open" data-turn="${turnNum}" aria-label="Turn ${turnNum}">` +
    `<div class="turn-block-header" role="button" tabindex="0" aria-expanded="true">` +
    `<span class="turn-block-num">T${turnNum}</span>` +
    `<span class="turn-block-tools" data-tool-count="0">0 tools</span>` +
    `<span class="turn-block-chevron" aria-hidden="true">›</span>` +
    `</div>` +
    `<div class="turn-block-body"></div>` +
    `</div>`;
}

function renderToolCall(toolName, input, toolId, turnNum) {
  const badgeClass = toolBadgeClass(toolName);
  const preview    = escHtml(toolInputPreview(toolName, input));
  return `<div class="tool-row" data-tool-id="${escHtml(toolId || '')}" data-turn="${turnNum || 0}" aria-label="Tool call: ${escHtml(toolName)}">` +
    `<div class="tool-row-header">` +
    `<span class="tool-badge${badgeClass ? ' ' + badgeClass : ''}">${escHtml(toolName)}</span>` +
    `<span class="tool-preview">${preview}</span>` +
    `</div>` +
    `</div>`;
}

function renderToolResult(content, isError, toolId) {
  const truncated = String(content || '').slice(0, 800) + (String(content || '').length > 800 ? '\n…' : '');
  return `<div class="tool-result-block${isError ? ' is-error' : ''}" data-for-tool="${escHtml(toolId || '')}">${escHtml(truncated)}</div>`;
}

function renderHeckle(style, name, text) {
  const avatar = style === 'comeback' ? '⚡' : style === 'entrance' ? '🚪' : '🟢';
  return `<div class="heckle-bubble ${escHtml(style)}" aria-label="Heckle from ${escHtml(name)}">` +
    `<div class="heckle-avatar" aria-hidden="true">${avatar}</div>` +
    `<div class="heckle-content">` +
    `<div class="heckle-name">${escHtml(name)}</div>` +
    `<div class="heckle-text">${escHtml(text)}</div>` +
    `</div>` +
    `</div>`;
}

function renderVerdict(pass, summary) {
  const cls   = pass ? 'pass' : 'fail';
  const title = pass ? '✓ PASS' : '✗ FAIL';
  return `<div class="verdict-banner ${cls}" aria-label="Verdict: ${pass ? 'PASS' : 'FAIL'}">` +
    `<div class="verdict-title">${title}</div>` +
    `<div class="verdict-summary">${escHtml(String(summary || '').slice(0, 500))}</div>` +
    `</div>`;
}

function renderRawLogLine(line, ts) {
  const tsStr = ts ? new Date(ts).toLocaleTimeString() : '';
  const tsHtml = tsStr ? `<span class="log-ts">${escHtml(tsStr)}</span>` : '';
  return `<div class="log-line">${tsHtml}${escHtml(line)}</div>`;
}

function renderSystemLine(text) {
  return `<div class="log-line"><span class="log-system">${escHtml(text)}</span></div>`;
}

function renderErrorLine(text) {
  return `<div class="log-line"><span class="log-error">⚠ ${escHtml(text)}</span></div>`;
}

function renderStreamEnd() {
  return `<div class="log-line log-end">— stream ended —</div>`;
}

// ── IndexedDB ─────────────────────────────────────────────────────────────────

function openIDB() {
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

    req.onsuccess  = (ev) => resolve(ev.target.result);
    req.onerror    = ()   => reject(req.error);
    req.onblocked  = ()   => reject(new Error('IDB blocked'));
  });
}

function idbWriteChunk(sessionId, chunkId, entries) {
  return new Promise((resolve, reject) => {
    if (!idb) { resolve(); return; }
    const tx    = idb.transaction('log-chunks', 'readwrite');
    const store = tx.objectStore('log-chunks');
    const req   = store.put({ sessionId, chunkId, entries });
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbPutSession(meta) {
  return new Promise((resolve, reject) => {
    if (!idb) { resolve(); return; }
    const tx    = idb.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    const req   = store.put(meta);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function purgeExpiredSessions() {
  if (!idb) return;
  const cutoff = Date.now() - SESSION_TTL_MS;
  try {
    const tx            = idb.transaction(['sessions', 'log-chunks'], 'readwrite');
    const sessionsStore = tx.objectStore('sessions');
    const expiredIds    = [];

    sessionsStore.openCursor().onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (!cursor) {
        // Delete log-chunks for expired sessions
        if (expiredIds.length === 0) return;
        const chunksStore = tx.objectStore('log-chunks');
        chunksStore.openCursor().onsuccess = (cev) => {
          const cc = cev.target.result;
          if (!cc) return;
          if (expiredIds.includes(cc.value.sessionId)) cc.delete();
          cc.continue();
        };
        return;
      }
      const s = cursor.value;
      if (s.startedAt && s.startedAt < cutoff) {
        expiredIds.push(s.sessionId);
        cursor.delete();
      }
      cursor.continue();
    };
  } catch (_) { /* IDB not critical */ }
}

// ── Batching ──────────────────────────────────────────────────────────────────

function getBatch(sessionId) {
  if (!sessionBatches.has(sessionId)) {
    sessionBatches.set(sessionId, { entries: [], chunkId: 0, timer: null });
  }
  return sessionBatches.get(sessionId);
}

async function flushBatch(sessionId) {
  const batch = getBatch(sessionId);
  if (batch.timer) { clearTimeout(batch.timer); batch.timer = null; }
  if (!batch.entries.length) return;

  const chunkId = batch.chunkId++;
  const entries = batch.entries.splice(0, batch.entries.length);

  try {
    await idbWriteChunk(sessionId, chunkId, entries);
  } catch (_) { /* non-fatal — main thread will still try to read */ }

  self.postMessage({ type: 'chunk-ready', sessionId, chunkId, count: entries.length });
}

function scheduleBatchFlush(sessionId) {
  const batch = getBatch(sessionId);
  if (batch.timer) return;
  batch.timer = setTimeout(() => flushBatch(sessionId), BATCH_MS);
}

function addEntry(sessionId, entry) {
  const batch = getBatch(sessionId);
  batch.entries.push(entry);
  if (batch.entries.length >= BATCH_SIZE) {
    flushBatch(sessionId);
  } else {
    scheduleBatchFlush(sessionId);
  }
}

// ── JSONL Parsing (new wire protocol: log-line messages) ─────────────────────

function getParserState(sessionId) {
  if (!sessionParserState.has(sessionId)) {
    sessionParserState.set(sessionId, {
      turnNum:       0,
      heckleCounter: 0,
      heckleName:    randomFrom(MAYO_NAMES),
      pendingTools:  new Map(), // toolId → { name, input }
    });
  }
  return sessionParserState.get(sessionId);
}

function maybeHeckleEntries(state, ts) {
  state.heckleCounter++;
  if (state.heckleCounter < 2 + Math.floor(Math.random() * 2)) return [];
  state.heckleCounter = 0;
  const entries = [{
    type: 'heckle',
    html: renderHeckle('mayo', state.heckleName, randomFrom(MAYO_LINES)),
    ts,
  }];
  if (Math.random() < 0.4) {
    entries.push({
      type: 'heckle',
      html: renderHeckle('comeback', 'Agent', randomFrom(COMEBACK_LINES)),
      ts,
    });
  }
  return entries;
}

/**
 * Parse a raw JSONL line from a log-line server message.
 * Classifies events and adds rendered entries to the session batch.
 */
function parseLogLine(sessionId, rawLine) {
  let ev;
  try { ev = JSON.parse(rawLine); } catch { return; }
  if (!ev || typeof ev !== 'object') return;

  const state = getParserState(sessionId);
  const ts    = Date.now();

  if (ev.type === 'assistant' && ev.message?.content) {
    const content = Array.isArray(ev.message.content) ? ev.message.content : [];

    // Heckle between turns
    for (const e of maybeHeckleEntries(state, ts)) addEntry(sessionId, e);

    state.turnNum++;
    addEntry(sessionId, { type: 'turn-start', html: renderTurnStart(state.turnNum), ts });

    for (const block of content) {
      if (block.type === 'tool_use') {
        state.pendingTools.set(block.id, { name: block.name, input: block.input || {} });
        addEntry(sessionId, {
          type: 'tool-call',
          html: renderToolCall(block.name, block.input, block.id, state.turnNum),
          raw:  rawLine,
          ts,
        });
      }
      // text blocks are not rendered separately (they show in turn header)
    }
  } else if (ev.type === 'user' && ev.message?.content) {
    const content = Array.isArray(ev.message.content) ? ev.message.content : [];
    for (const block of content) {
      if (block.type === 'tool_result') {
        const contentText = Array.isArray(block.content)
          ? block.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
          : String(block.content || '');
        const isError = !!block.is_error;
        addEntry(sessionId, {
          type:   'tool-result',
          html:   renderToolResult(contentText, isError, block.tool_use_id),
          raw:    rawLine,
          ts,
        });
        state.pendingTools.delete(block.tool_use_id);
      }
    }
  }
}

// ── Legacy Protocol Handling (pre-#917 backward compat) ──────────────────────

function getLegacyState(sessionId) {
  if (!sessionLegacyState.has(sessionId)) {
    sessionLegacyState.set(sessionId, { turnNum: 0 });
  }
  return sessionLegacyState.get(sessionId);
}

function handleLegacyMessage(msg, sessionId) {
  const ts = msg.ts || Date.now();

  switch (msg.type) {
    case 'connected': {
      addEntry(sessionId, {
        type: 'text',
        html: renderSystemLine(`— connected to session ${msg.sessionId || sessionId} —`),
        ts,
      });
      break;
    }

    case 'turn_start': {
      const s = getLegacyState(sessionId);
      s.turnNum = msg.turnNum;
      addEntry(sessionId, { type: 'turn-start', html: renderTurnStart(msg.turnNum), ts });
      break;
    }

    case 'tool_call': {
      const s = getLegacyState(sessionId);
      addEntry(sessionId, {
        type: 'tool-call',
        html: renderToolCall(msg.toolName, msg.input, msg.toolId, s.turnNum),
        ts,
      });
      break;
    }

    case 'tool_result': {
      addEntry(sessionId, {
        type:   'tool-result',
        html:   renderToolResult(msg.content, msg.isError, msg.toolId),
        ts,
      });
      break;
    }

    case 'heckle': {
      addEntry(sessionId, {
        type: 'heckle',
        html: renderHeckle(msg.style, msg.name, msg.text),
        ts,
      });
      break;
    }

    case 'verdict': {
      addEntry(sessionId, {
        type: 'verdict',
        html: renderVerdict(msg.pass, msg.summary),
        ts,
      });
      // also send directly (no IDB round-trip needed for verdict)
      self.postMessage({ type: 'verdict', sessionId, result: msg.pass ? 'PASS' : 'FAIL' });
      break;
    }

    case 'report': {
      // Report HTML forwarded directly — too large for IDB entry
      self.postMessage({ type: 'report', sessionId, html: msg.html });
      break;
    }

    case 'log': {
      addEntry(sessionId, {
        type: 'text',
        html: renderRawLogLine(msg.line || '', msg.ts),
        ts,
      });
      break;
    }

    case 'end': {
      flushBatch(sessionId).then(() => {
        const batch = getBatch(sessionId);
        self.postMessage({ type: 'session-end', sessionId, totalChunks: batch.chunkId });
        idbPutSession({ sessionId, status: 'complete', completedAt: ts, totalChunks: batch.chunkId }).catch(() => {});
      });
      break;
    }

    case 'error': {
      addEntry(sessionId, { type: 'error', html: renderErrorLine(msg.message || 'Unknown error'), ts });
      self.postMessage({ type: 'connection-status', connected: false, reconnecting: false, error: msg.message });
      break;
    }

    default:
      break;
  }
}

// ── New Wire Protocol Message Handling ───────────────────────────────────────

function handleServerMessage(msg) {
  switch (msg.type) {
    // ── Job list ──────────────────────────────────────────────────────────────
    case 'jobs-snapshot':
    case 'jobs-updated': {
      self.postMessage({ type: 'jobs-updated', jobs: msg.jobs || [] });
      break;
    }

    // ── Log line (new protocol: raw JSONL to parse) ───────────────────────────
    case 'log-line': {
      const sid = msg.sessionId;
      if (sid && subscribedSessions.has(sid)) {
        parseLogLine(sid, msg.line || '');
      }
      break;
    }

    // ── Verdict (new protocol) ────────────────────────────────────────────────
    case 'verdict': {
      const sid = msg.sessionId;
      if (sid) {
        addEntry(sid, {
          type: 'verdict',
          html: renderVerdict(msg.result === 'PASS', ''),
          ts:   msg.ts || Date.now(),
        });
        self.postMessage({ type: 'verdict', sessionId: sid, result: msg.result });
      }
      break;
    }

    // ── Stream end (new protocol) ─────────────────────────────────────────────
    case 'stream-end': {
      const sid = msg.sessionId;
      if (sid) {
        flushBatch(sid).then(() => {
          const batch = getBatch(sid);
          self.postMessage({ type: 'session-end', sessionId: sid, totalChunks: batch.chunkId });
          idbPutSession({ sessionId: sid, status: 'complete', completedAt: msg.ts || Date.now(), totalChunks: batch.chunkId }).catch(() => {});
        });
      }
      break;
    }

    // ── Stream error (new protocol) ───────────────────────────────────────────
    case 'stream-error': {
      const sid = msg.sessionId;
      if (sid) {
        addEntry(sid, { type: 'error', html: renderErrorLine(msg.message || 'Stream error'), ts: msg.ts || Date.now() });
      }
      self.postMessage({ type: 'connection-status', connected: true, reconnecting: false, error: msg.message });
      break;
    }

    // ── Keepalive ─────────────────────────────────────────────────────────────
    case 'pong':
      break;

    // ── Fatal server error ────────────────────────────────────────────────────
    case 'error': {
      self.postMessage({ type: 'connection-status', connected: false, reconnecting: true, error: msg.message });
      break;
    }

    // ── Legacy protocol fallback ──────────────────────────────────────────────
    default: {
      // Route to the first subscribed session (old server sends per-connection, not per-session)
      const legacySid = subscribedSessions.size > 0 ? [...subscribedSessions][0] : null;
      if (legacySid) handleLegacyMessage(msg, legacySid);
      break;
    }
  }
}

// ── WebSocket Management ──────────────────────────────────────────────────────

function postConnectionStatus(connected, reconnecting, error) {
  self.postMessage({ type: 'connection-status', connected, reconnecting, ...(error != null ? { error } : {}) });
}

function connect() {
  if (!wsUrl) return;
  postConnectionStatus(false, true);

  ws = new WebSocket(wsUrl);

  ws.addEventListener('open', () => {
    reconnectAttempt = 0;
    postConnectionStatus(true, false);
    // Re-subscribe all active sessions
    for (const sessionId of subscribedSessions) {
      ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
    }
  });

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    handleServerMessage(msg);
  });

  ws.addEventListener('close', () => {
    postConnectionStatus(false, true);
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    // 'close' event fires after 'error', reconnect handled there
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const base   = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
  const jitter = Math.floor(Math.random() * 500);
  reconnectAttempt++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, base + jitter);
}

function startPing() {
  if (pingInterval) return;
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, PING_INTERVAL);
}

function stopPing() {
  if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
}

// ── Main Thread → Worker Message Handler ─────────────────────────────────────

self.onmessage = function onmessage(ev) {
  const msg = ev.data;
  if (!msg || typeof msg !== 'object') return;

  switch (msg.type) {
    // Initialize — open IDB, then connect WebSocket
    case 'connect': {
      wsUrl = msg.wsUrl;
      openIDB()
        .then((db) => {
          idb = db;
          purgeExpiredSessions();
          connect();
          startPing();
        })
        .catch((err) => {
          // IDB unavailable — still connect WS (chunks posted without IDB)
          connect();
          startPing();
          postConnectionStatus(false, false, String(err));
        });
      break;
    }

    // Subscribe to a session's log stream
    case 'subscribe': {
      const { sessionId } = msg;
      if (!sessionId) break;
      subscribedSessions.add(sessionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
      }
      if (idb) {
        idbPutSession({
          sessionId,
          status:      'streaming',
          verdict:     null,
          totalChunks: 0,
          startedAt:   Date.now(),
          completedAt: null,
        }).catch(() => {});
      }
      break;
    }

    // Unsubscribe from a session
    case 'unsubscribe': {
      const { sessionId } = msg;
      if (!sessionId) break;
      subscribedSessions.delete(sessionId);
      flushBatch(sessionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', sessionId }));
      }
      break;
    }

    // Force flush pending batch
    case 'flush': {
      if (msg.sessionId) flushBatch(msg.sessionId);
      break;
    }

    default:
      break;
  }
};
