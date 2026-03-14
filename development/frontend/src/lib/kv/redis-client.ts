/**
 * Redis client singleton for in-cluster Redis.
 *
 * Connects to the Redis instance specified by the REDIS_URL environment variable.
 * Defaults to redis://localhost:6379 for local development.
 *
 * @module kv/redis-client
 */

import Redis from "ioredis";

let redis: Redis | null = null;

/**
 * Returns a singleton Redis client instance.
 * Creates the connection on first call, reuses it thereafter.
 */
export function getRedisClient(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}
