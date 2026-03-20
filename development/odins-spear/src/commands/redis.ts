import { registerCommand } from "./registry.js";
import { redisClient } from "../lib/redis.js";
import { log } from "@fenrir/logger";

export function registerRedisCommands(): void {
  log.debug("registerRedisCommands called");

  registerCommand({
    name: "redis-ping",
    desc: "Ping the Redis connection",
    subsystem: "redis",
    execute: async (_ctx) => {
      log.debug("redis-ping execute called");
      if (!redisClient) {
        log.debug("redis-ping execute: no client");
        return ["ERROR: Redis client not connected"];
      }
      const result = await redisClient.ping();
      log.debug("redis-ping execute returning", { result });
      return [`PONG: ${result}`];
    },
  });

  registerCommand({
    name: "redis-keys",
    desc: "List all Redis keys (KEYS *)",
    subsystem: "redis",
    execute: async (_ctx) => {
      log.debug("redis-keys execute called");
      if (!redisClient) {
        log.debug("redis-keys execute: no client");
        return ["ERROR: Redis client not connected"];
      }
      const keys = await redisClient.keys("*");
      log.debug("redis-keys execute returning", { count: keys.length });
      if (keys.length === 0) return ["(no keys)"];
      return keys.sort();
    },
  });

  registerCommand({
    name: "redis-info",
    desc: "Show Redis server INFO",
    subsystem: "redis",
    execute: async (_ctx) => {
      log.debug("redis-info execute called");
      if (!redisClient) {
        log.debug("redis-info execute: no client");
        return ["ERROR: Redis client not connected"];
      }
      const info = await redisClient.info();
      log.debug("redis-info execute returning", { lineCount: info.split("\n").length });
      return info.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    },
  });

  registerCommand({
    name: "redis-flush",
    desc: "Flush ALL Redis keys (FLUSHALL) — destructive",
    subsystem: "redis",
    destructive: true,
    execute: async (_ctx) => {
      log.debug("redis-flush execute called");
      if (!redisClient) {
        log.debug("redis-flush execute: no client");
        return ["ERROR: Redis client not connected"];
      }
      await redisClient.flushall();
      log.debug("redis-flush execute returning");
      return ["FLUSHALL: OK — all keys deleted"];
    },
  });

  log.debug("registerRedisCommands returning");
}
