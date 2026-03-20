import { registerCommand } from "./registry.js";
import { redisClient } from "../lib/redis.js";
import { log } from "@fenrir/logger";

export function registerRedisCommands(): void {
  log.debug("registerRedisCommands called");

  registerCommand({
    id: "redis:ping",
    label: "Redis: Ping",
    description: "Ping the Redis connection",
    action: async () => {
      log.debug("redis:ping action called");
      if (!redisClient) {
        log.debug("redis:ping: no client");
        return;
      }
      const result = await redisClient.ping();
      log.debug("redis:ping returning", { result });
    },
  });

  log.debug("registerRedisCommands returning");
}
