const KEY_PREFIX = "odin-throne:log:";
const MAX_SESSIONS = 10;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5MB

function sessionKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
  } catch {
    // localStorage unavailable
  }
  return keys;
}

export function appendLogLine(sessionId: string, line: string): void {
  try {
    const key = KEY_PREFIX + sessionId;
    const existing = localStorage.getItem(key) ?? "";
    const next = existing ? existing + "\n" + line : line;

    const keys = sessionKeys();

    // Enforce session cap — evict oldest session if we're at the limit and this is new
    if (!keys.includes(key) && keys.length >= MAX_SESSIONS) {
      localStorage.removeItem(keys[0]!);
    }

    // Enforce total size cap — evict oldest until we're under budget
    const updatedKeys = sessionKeys().filter((k) => k !== key);
    let totalBytes = updatedKeys.reduce(
      (sum, k) => sum + (localStorage.getItem(k)?.length ?? 0),
      0
    );
    while (totalBytes + next.length > MAX_TOTAL_BYTES && updatedKeys.length > 0) {
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
    return localStorage.getItem(KEY_PREFIX + sessionId);
  } catch {
    return null;
  }
}

export function downloadLog(sessionId: string): void {
  const content = getLog(sessionId);
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
