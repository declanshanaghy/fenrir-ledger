// ── Temporary log buffer (odin-throne:log:<sessionId>) ──────────────────────
// Written as log-lines arrive for live sessions that are NOT pinned.
// Ephemeral — evicts freely. Pinned sessions skip this buffer entirely.

const LOG_PREFIX = "odin-throne:log:";
const MAX_LOG_SESSIONS = 10;
const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5MB

// ── Pin cache (odin-throne:cache:<sessionId>) ────────────────────────────────
// Single authoritative data store for pinned sessions.
// When a session is pinned, data flows here only — no log: duplicate.

const CACHE_PREFIX = "odin-throne:cache:";
const MAX_CACHE_SESSIONS = 10;
const MAX_CACHE_BYTES = 20 * 1024 * 1024; // 20MB

// ── Metadata stored alongside cache entries ──────────────────────────────────
// Key: odin-throne:cache-meta:<sessionId>
// Value: JSON with name, issueNumber, agent, startedAt etc.

const META_PREFIX = "odin-throne:cache-meta:";

export interface CachedSessionMeta {
  sessionId: string;
  name: string;
  issueNumber: number;
  agent: string;
  step: number;
  startedAt: string | null;
  completedAt: string | null;
  issueTitle: string | null;
  branchName: string | null;
  pinnedAt: number; // ms timestamp when pinned
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function keysWithPrefix(prefix: string): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
  } catch {
    // localStorage unavailable
  }
  return keys;
}

// ── Temporary log buffer API ─────────────────────────────────────────────────

export function appendLogLine(sessionId: string, line: string): void {
  try {
    // Pinned sessions store data in cache only — no log: duplicate
    if (isPinned(sessionId)) {
      appendToCacheRaw(sessionId, line);
      return;
    }

    const key = LOG_PREFIX + sessionId;
    const existing = localStorage.getItem(key) ?? "";
    const next = existing ? existing + "\n" + line : line;

    const keys = keysWithPrefix(LOG_PREFIX);

    // Enforce session cap — evict oldest session if we're at the limit and this is new
    if (!keys.includes(key) && keys.length >= MAX_LOG_SESSIONS) {
      localStorage.removeItem(keys[0]!);
    }

    // Enforce total size cap — evict oldest until we're under budget
    const updatedKeys = keysWithPrefix(LOG_PREFIX).filter((k) => k !== key);
    let totalBytes = updatedKeys.reduce(
      (sum, k) => sum + (localStorage.getItem(k)?.length ?? 0),
      0
    );
    while (totalBytes + next.length > MAX_LOG_BYTES && updatedKeys.length > 0) {
      const oldest = updatedKeys.shift()!;
      totalBytes -= localStorage.getItem(oldest)?.length ?? 0;
      localStorage.removeItem(oldest);
    }

    localStorage.setItem(key, next);
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

export function getLog(sessionId: string): string | null {
  try {
    return localStorage.getItem(LOG_PREFIX + sessionId);
  } catch {
    return null;
  }
}

export function downloadLog(sessionId: string): void {
  const content = getLog(sessionId) ?? getCachedLog(sessionId);
  if (!content) return;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sessionId}.log`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Pin cache API ────────────────────────────────────────────────────────────

/** Returns true if this session has a cache entry (is pinned). */
export function isPinned(sessionId: string): boolean {
  try {
    return localStorage.getItem(CACHE_PREFIX + sessionId) !== null;
  } catch {
    return false;
  }
}

/**
 * Pin a session: copy current temp-log content to the cache.
 * Deletes the temp log entry — cache is the single authoritative store.
 * Returns true on success, false if no content available to pin.
 * Evicts oldest cached session if over the cap.
 */
export function pinSession(sessionId: string, meta: CachedSessionMeta): boolean {
  try {
    const content = getLog(sessionId) ?? "";
    const cacheKey = CACHE_PREFIX + sessionId;
    const metaKey = META_PREFIX + sessionId;

    const keys = keysWithPrefix(CACHE_PREFIX);

    // Enforce session cap — evict oldest cached session if at limit
    if (!keys.includes(cacheKey) && keys.length >= MAX_CACHE_SESSIONS) {
      const oldest = keys[0]!;
      const oldestId = oldest.slice(CACHE_PREFIX.length);
      localStorage.removeItem(oldest);
      localStorage.removeItem(META_PREFIX + oldestId);
    }

    // Enforce total size cap — evict oldest until we're under budget
    const updatedKeys = keysWithPrefix(CACHE_PREFIX).filter((k) => k !== cacheKey);
    let totalBytes = updatedKeys.reduce(
      (sum, k) => sum + (localStorage.getItem(k)?.length ?? 0),
      0
    );
    while (totalBytes + content.length > MAX_CACHE_BYTES && updatedKeys.length > 0) {
      const oldest = updatedKeys.shift()!;
      const oldId = oldest.slice(CACHE_PREFIX.length);
      totalBytes -= localStorage.getItem(oldest)?.length ?? 0;
      localStorage.removeItem(oldest);
      localStorage.removeItem(META_PREFIX + oldId);
    }

    localStorage.setItem(cacheKey, content);
    localStorage.setItem(metaKey, JSON.stringify(meta));

    // Remove the temp log entry — data now lives in cache only (no duplicate)
    localStorage.removeItem(LOG_PREFIX + sessionId);

    return true;
  } catch {
    return false;
  }
}

/** Unpin a session: remove it from the cache. */
export function unpinSession(sessionId: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + sessionId);
    localStorage.removeItem(META_PREFIX + sessionId);
  } catch {
    // fail silently
  }
}

/** Get cached JSONL content for a pinned session. */
export function getCachedLog(sessionId: string): string | null {
  try {
    return localStorage.getItem(CACHE_PREFIX + sessionId);
  } catch {
    return null;
  }
}

/** Get metadata for a pinned session. */
export function getCachedSessionMeta(sessionId: string): CachedSessionMeta | null {
  try {
    const raw = localStorage.getItem(META_PREFIX + sessionId);
    if (!raw) return null;
    return JSON.parse(raw) as CachedSessionMeta;
  } catch {
    return null;
  }
}

/** Get all pinned session IDs (from localStorage), newest-pinned first. */
export function getCachedSessionIds(): string[] {
  const keys = keysWithPrefix(CACHE_PREFIX);
  const withMeta: Array<{ id: string; pinnedAt: number }> = [];
  for (const key of keys) {
    const id = key.slice(CACHE_PREFIX.length);
    const meta = getCachedSessionMeta(id);
    withMeta.push({ id, pinnedAt: meta?.pinnedAt ?? 0 });
  }
  return withMeta.sort((a, b) => b.pinnedAt - a.pinnedAt).map((x) => x.id);
}

/** Internal: append a single raw line to an existing cache entry (no eviction logic). */
function appendToCacheRaw(sessionId: string, line: string): void {
  try {
    const key = CACHE_PREFIX + sessionId;
    const existing = localStorage.getItem(key);
    if (existing === null) return; // not pinned — ignore
    const next = existing ? existing + "\n" + line : line;
    localStorage.setItem(key, next);
  } catch {
    // fail silently
  }
}

/** Check if total cache usage is near the cap. Returns true if eviction occurred. */
export function isCacheNearCap(): boolean {
  try {
    const keys = keysWithPrefix(CACHE_PREFIX);
    if (keys.length >= MAX_CACHE_SESSIONS) return true;
    const totalBytes = keys.reduce(
      (sum, k) => sum + (localStorage.getItem(k)?.length ?? 0),
      0
    );
    return totalBytes > MAX_CACHE_BYTES * 0.9; // warn at 90%
  } catch {
    return false;
  }
}

/**
 * Migration: remove duplicate log entries for pinned sessions.
 * Previously both log: and cache: entries were written for pinned sessions.
 * The cache: entry is authoritative — remove any redundant log: duplicates.
 * Call once on app load.
 */
export function migrateRemoveDuplicateLogs(): void {
  try {
    const logKeys = keysWithPrefix(LOG_PREFIX);
    for (const logKey of logKeys) {
      const sessionId = logKey.slice(LOG_PREFIX.length);
      if (isPinned(sessionId)) {
        // Cache has the authoritative copy — log: is a stale duplicate
        localStorage.removeItem(logKey);
      }
    }
  } catch {
    // fail silently
  }
}
