/**
 * Simple in-memory rate limiter for serverless environments.
 *
 * On Vercel, each serverless function instance has its own memory, so this
 * provides per-instance protection. It won't survive cold starts or span
 * across multiple instances, but it prevents simple abuse from a single
 * instance. For distributed rate limiting, use Upstash Redis or similar.
 *
 * @module rate-limit
 */

import { log } from "@/lib/logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check whether a request identified by `key` is within the rate limit.
 *
 * @param key - Unique identifier for the rate-limited entity (e.g. `token:<ip>`)
 * @param options.limit - Maximum requests allowed per window (default: 10)
 * @param options.windowMs - Window duration in milliseconds (default: 60000 = 1 minute)
 * @returns `{ success: true, remaining }` if allowed, `{ success: false, remaining: 0 }` if rate limited
 */
export function rateLimit(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): { success: boolean; remaining: number } {
  log.debug("rateLimit called", { key, limit, windowMs });

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    const result = { success: true, remaining: limit - 1 };
    log.debug("rateLimit returning", { key, ...result, reason: "new window" });
    return result;
  }

  entry.count++;
  if (entry.count > limit) {
    const result = { success: false, remaining: 0 };
    log.debug("rateLimit returning", { key, ...result, reason: "exceeded" });
    return result;
  }

  const result = { success: true, remaining: limit - entry.count };
  log.debug("rateLimit returning", { key, ...result });
  return result;
}
