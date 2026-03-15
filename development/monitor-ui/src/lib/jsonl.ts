import type { JsonEvent } from "./types";

/** Strip a Kubernetes log timestamp prefix if present. */
function stripK8sTimestamp(line: string): string {
  const match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+(.*)$/.exec(line);
  return match ? match[1] : line;
}

/** Parse a single raw log line into a JsonEvent, or null if not valid JSON. */
export function parseJsonlLine(rawLine: string): JsonEvent | null {
  const line = stripK8sTimestamp(rawLine.trim());
  if (!line || !line.startsWith("{")) return null;
  try {
    return JSON.parse(line) as JsonEvent;
  } catch {
    return null;
  }
}
