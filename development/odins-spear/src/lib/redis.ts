import { createConnection } from "net";
import { spawn } from "child_process";
import { log } from "@fenrir/logger";
import type { ChildProcess } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export let pfProc: ChildProcess | null = null;
export let redisClient: import("ioredis").Redis | null = null;

export function checkPortOpen(host: string, port: number): Promise<boolean> {
  log.debug("checkPortOpen called", { host, port });
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      log.debug("checkPortOpen: port is open", { host, port });
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      log.debug("checkPortOpen: port is closed", { host, port });
      resolve(false);
    });
    setTimeout(() => {
      socket.destroy();
      log.debug("checkPortOpen: timeout", { host, port });
      resolve(false);
    }, 1000);
  });
}

export function spawnPortForward(logFn: (msg: string, isErr?: boolean) => void): void {
  log.debug("spawnPortForward called");
  logFn("[redis] spawning kubectl port-forward svc/redis 6379:6379 -n fenrir-app");
  const proc = spawn(
    "kubectl",
    ["port-forward", "svc/redis", "6379:6379", "-n", "fenrir-app"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  pfProc = proc;
  proc.stdout.on("data", (d: Buffer) => {
    log.debug("port-forward stdout", { length: d.length });
    logFn(`[redis-pf] ${d.toString().trim()}`);
  });
  proc.stderr.on("data", (d: Buffer) => {
    log.debug("port-forward stderr", { length: d.length });
    logFn(`[redis-pf] ${d.toString().trim()}`, true);
  });
  proc.on("exit", (code: number | null) => {
    log.debug("port-forward exited", { code });
    logFn(`[redis-pf] exited (code ${code})`, code !== 0);
  });
}

export async function ensureRedisPortForward(logFn: (msg: string, isErr?: boolean) => void): Promise<void> {
  log.debug("ensureRedisPortForward called");
  const open = await checkPortOpen("127.0.0.1", 6379);
  if (!open) {
    log.debug("ensureRedisPortForward: port not open, spawning port-forward");
    spawnPortForward(logFn);
    await new Promise<void>((r) => setTimeout(r, 2000));
  } else {
    log.debug("ensureRedisPortForward: port already open");
  }
}

export async function connectRedis(logFn: (msg: string, isErr?: boolean) => void): Promise<boolean> {
  log.debug("connectRedis called");
  const { Redis } = require("ioredis") as typeof import("ioredis");
  const client = new Redis({ host: "127.0.0.1", port: 6379, lazyConnect: true, enableOfflineQueue: false });
  redisClient = client;
  client.on("error", (err: Error) => {
    log.debug("redis error", { messageLength: err.message.length });
    logFn(`[redis] error: ${err.message}`, true);
  });
  client.on("reconnecting", () => {
    log.debug("redis reconnecting");
    logFn("[redis] reconnecting\u2026");
  });
  await client.connect();
  log.debug("connectRedis returning");
  return true;
}
