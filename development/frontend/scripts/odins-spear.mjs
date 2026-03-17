#!/usr/bin/env node
/**
 * odins-spear.mjs — Odin's Spear: Interactive REPL for trials, entitlements, and Stripe.
 *
 * Usage:
 *   just frontend odins-spear                        # from repo root (recommended)
 *   node development/frontend/scripts/odins-spear.mjs  # direct invocation
 *
 * For production: kubectl port-forward svc/redis 6379:6379 -n fenrir-app
 *
 * Trial identity:
 *   - Trial key in Redis: trial:{fingerprint}
 *   - Fingerprint = SHA-256(navigator.userAgent + deviceId)
 *   - deviceId is stored in browser localStorage under "fenrir:device-id"
 *   - To find yours: browser DevTools console → localStorage.getItem('fenrir:device-id')
 *   - Or just use "list" in this REPL to see all trials and pick by number
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Redis = require("ioredis").default;
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const { GoogleAuth, OAuth2Client } = require("google-auth-library");
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { execSync, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Stripe ───────────────────────────────────────────────────────────────────

let stripeKey = process.env.STRIPE_SECRET_KEY || null;

/** Lazy-load Stripe key from K8s secret if not set via env. */
async function getStripeKey() {
  if (stripeKey) return stripeKey;
  try {
    stripeKey = execSync(
      "kubectl get secret fenrir-app-secrets -n fenrir-app -o jsonpath='{.data.STRIPE_SECRET_KEY}' | base64 -d",
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    ).trim().replace(/^'|'$/g, "");
    if (stripeKey) return stripeKey;
  } catch { /* ignore */ }
  return null;
}

/** Call Stripe API. Returns parsed JSON or null on error. */
async function stripe(method, path, body) {
  const key = await getStripeKey();
  if (!key) {
    console.error(`${RED}STRIPE_SECRET_KEY not available.${RESET} Set via env or ensure kubectl can reach fenrir-app-secrets.`);
    return null;
  }
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) opts.body = new URLSearchParams(body).toString();
  try {
    const res = await fetch(`https://api.stripe.com/v1${path}`, opts);
    const json = await res.json();
    if (json.error) {
      console.error(`${RED}Stripe error: ${json.error.message}${RESET}`);
      return null;
    }
    return json;
  } catch (err) {
    console.error(`${RED}Stripe request failed: ${err.message}${RESET}`);
    return null;
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const TRIAL_DURATION_DAYS = 30;
const TRIAL_TTL_SECONDS = 60 * 24 * 60 * 60;
const STATUS_EMOJI = { active: "\u001b[32m●\u001b[0m", expired: "\u001b[31m●\u001b[0m", converted: "\u001b[33m★\u001b[0m", none: "\u001b[90m○\u001b[0m" };
const BOLD = "\u001b[1m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";
const GOLD = "\u001b[33m";
const GREEN = "\u001b[32m";
const RED = "\u001b[31m";
const CYAN = "\u001b[36m";

// ── Args ─────────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    "redis-url": { type: "string" },
    help:        { type: "boolean", short: "h", default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(`
${BOLD}odins-spear.mjs${RESET} — Interactive REPL for managing trial state in Redis.

${BOLD}Usage:${RESET}
  just frontend odins-spear                          # from repo root (recommended)
  just frontend odins-spear --redis-url <url>        # custom Redis URL

${BOLD}How to identify yourself:${RESET}
  Trial keys in Redis use a browser fingerprint: SHA-256(userAgent + deviceId).
  Your deviceId is in browser localStorage under "fenrir:device-id".

  Easiest method: run "list" in the REPL — it shows all trials with numbered
  shortcuts. Then "use 1" to select yours.

${BOLD}For production Redis:${RESET}
  kubectl port-forward svc/redis 6379:6379 -n fenrir-app
`);
  process.exit(0);
}

// ── Port-forward management ──────────────────────────────────────────────────

const PF_NAMESPACE = "fenrir-app";
const PF_SERVICE = "svc/redis";
const PF_LOCAL_PORT = 6379;
const PF_REMOTE_PORT = 6379;

let portForwardProc = null; // track child process so we can kill on exit
let pfManagedByUs = false;  // true if we started the port-forward (vs user-managed)
let reconnecting = false;   // prevent concurrent reconnect attempts

/** Check if localhost:6379 is accepting connections. */
function isPortOpen(port, host = "127.0.0.1", timeoutMs = 1000) {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host, timeout: timeoutMs });
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => { sock.destroy(); resolve(false); });
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
  });
}

/** Check if kubectl is available and cluster is reachable. */
function hasKubectl() {
  try {
    execSync("kubectl cluster-info --request-timeout=3s", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Start kubectl port-forward in the background. Returns when the port is ready. */
async function startPortForward() {
  // Kill any existing port-forward process
  if (portForwardProc) {
    portForwardProc.kill();
    portForwardProc = null;
    await new Promise((r) => setTimeout(r, 500)); // let the port release
  }

  console.log(`${DIM}Starting kubectl port-forward ${PF_SERVICE} ${PF_LOCAL_PORT}:${PF_REMOTE_PORT} -n ${PF_NAMESPACE}...${RESET}`);

  portForwardProc = spawn(
    "kubectl",
    ["port-forward", PF_SERVICE, `${PF_LOCAL_PORT}:${PF_REMOTE_PORT}`, "-n", PF_NAMESPACE],
    { stdio: ["ignore", "pipe", "pipe"], detached: false }
  );

  // Log stderr for debugging but don't spam
  let stderrBuf = "";
  portForwardProc.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });
  portForwardProc.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${RED}Port-forward exited with code ${code}${RESET}`);
      if (stderrBuf.trim()) console.error(`${DIM}${stderrBuf.trim()}${RESET}`);
    }
    portForwardProc = null;
    // Auto-reconnect if we managed the port-forward and it dropped unexpectedly
    if (pfManagedByUs && !reconnecting) {
      reconnectPortForward();
    }
  });

  // Wait up to 10s for the port to open
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isPortOpen(PF_LOCAL_PORT)) {
      console.log(`${GREEN}Port-forward established${RESET} ${DIM}(localhost:${PF_LOCAL_PORT} → ${PF_SERVICE})${RESET}`);
      return true;
    }
  }

  console.error(`${RED}Port-forward timed out after 10s${RESET}`);
  portForwardProc?.kill();
  portForwardProc = null;
  return false;
}

/** Reconnect port-forward with exponential backoff (max 3 attempts). */
async function reconnectPortForward() {
  if (reconnecting) return;
  reconnecting = true;

  const MAX_ATTEMPTS = 3;
  const delays = [1000, 3000, 5000];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`${GOLD}Port-forward dropped — reconnecting (attempt ${attempt}/${MAX_ATTEMPTS})...${RESET}`);
    await new Promise((r) => setTimeout(r, delays[attempt - 1]));

    const ok = await startPortForward();
    if (ok) {
      reconnecting = false;
      return;
    }
  }

  reconnecting = false;
  console.error(`${RED}Port-forward reconnect failed after ${MAX_ATTEMPTS} attempts.${RESET}`);
  console.error(`${DIM}Commands will fail until the connection is restored. Try "reconnect" or restart the REPL.${RESET}`);
}

/** Clean up port-forward on exit. */
function cleanupPortForward() {
  pfManagedByUs = false; // prevent reconnect during shutdown
  if (portForwardProc) {
    portForwardProc.kill();
    portForwardProc = null;
  }
}
process.on("exit", cleanupPortForward);
process.on("SIGINT", () => { cleanupPortForward(); process.exit(0); });
process.on("SIGTERM", () => { cleanupPortForward(); process.exit(0); });

// ── Redis connection ─────────────────────────────────────────────────────────

const redisUrl = values["redis-url"] || process.env.REDIS_URL || "redis://localhost:6379";
const isLocalhost = /localhost|127\.0\.0\.1/.test(redisUrl);

// If targeting localhost and port isn't open, auto-setup port-forward
if (isLocalhost && !(await isPortOpen(PF_LOCAL_PORT))) {
  console.log(`${DIM}Redis not reachable on localhost:${PF_LOCAL_PORT}${RESET}`);

  if (!hasKubectl()) {
    console.error(`${RED}kubectl not available or cluster unreachable.${RESET}`);
    console.error(`${DIM}Either start Redis locally or configure kubectl for GKE.${RESET}`);
    process.exit(1);
  }

  const ok = await startPortForward();
  if (!ok) {
    console.error(`${RED}Could not establish port-forward. Check your GKE access.${RESET}`);
    process.exit(1);
  }
  pfManagedByUs = true; // we own this port-forward — auto-reconnect on drop
}

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      console.error(`${RED}Redis connection lost. Reconnect failed after ${times} attempts.${RESET}`);
      console.error(`${DIM}Port-forward may have dropped. Restart the REPL to reconnect.${RESET}`);
      return null; // stop retrying
    }
    return Math.min(times * 500, 2000);
  },
});

// Suppress "Unhandled error event" noise from ioredis reconnect attempts
redis.on("error", (err) => {
  if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
    console.error(`${RED}Redis connection error${RESET} ${DIM}(${err.code} — port-forward may have dropped)${RESET}`);
  } else {
    console.error(`${RED}Redis error: ${err.message}${RESET}`);
  }
});

try {
  await redis.connect();
} catch {
  console.error(`${RED}Failed to connect to Redis at ${redisUrl}${RESET}`);
  process.exit(1);
}

console.log(`${GREEN}Connected to Redis${RESET} ${DIM}(${redisUrl})${RESET}`);

// ── Google ADC authentication ─────────────────────────────────────────────────

/**
 * Ensure Google Application Default Credentials are valid before startup.
 *
 * Priority order:
 *   1. Existing valid ADC → proceed silently
 *   2. Cached refresh_token in ADC JSON → refresh silently
 *   3. No usable credentials → open browser via gcloud auth application-default login
 *
 * Throws if gcloud is not installed or auth ultimately fails.
 */
async function ensureAuthenticated() {
  // 1. Try existing ADC — if valid, return early
  try {
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    await client.getAccessToken();
    return; // credentials valid, proceed silently
  } catch { /* fall through to refresh or browser flow */ }

  // 2. Check for refresh_token in ADC JSON
  const adcPath = join(homedir(), ".config", "gcloud", "application_default_credentials.json");
  if (existsSync(adcPath)) {
    try {
      const adc = JSON.parse(readFileSync(adcPath, "utf-8"));
      if (adc.refresh_token) {
        const oauth2 = new OAuth2Client(adc.client_id, adc.client_secret);
        oauth2.setCredentials({ refresh_token: adc.refresh_token });
        const tokenResponse = await oauth2.getAccessToken();
        if (tokenResponse.token) {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
          return; // silently refreshed
        }
      }
    } catch { /* refresh_token expired or invalid — fall through to browser */ }
  }

  // 3. Fall back to browser flow via gcloud
  console.log(`\n${GOLD}Opening browser for Google authentication...${RESET}`);
  console.log(`${DIM}Complete the auth in your browser. The auth code will appear in this terminal if prompted.${RESET}\n`);
  execSync("gcloud auth application-default login", { stdio: "inherit" });
}

try {
  await ensureAuthenticated();
} catch (err) {
  const msg = err.message || String(err);
  if (/gcloud/.test(msg) || /ENOENT/.test(msg) || /not found/.test(msg)) {
    console.error(`\n${RED}gcloud CLI not found.${RESET} Install it from https://cloud.google.com/sdk/docs/install`);
  } else if (/cancelled|cancel|abort/i.test(msg)) {
    console.error(`\n${RED}Authentication cancelled.${RESET} Odin's Spear requires Google credentials to access Firestore.`);
  } else {
    console.error(`\n${RED}Authentication failed:${RESET} ${msg}`);
  }
  process.exit(1);
}

// ── Firestore client ─────────────────────────────────────────────────────────

const FS_PROJECT_ID = "fenrir-ledger-prod";
const FS_DATABASE_ID = "fenrir-ledger-prod";

let _db = null;
function getDb() {
  if (!_db) {
    _db = new Firestore({ projectId: FS_PROJECT_ID, databaseId: FS_DATABASE_ID });
  }
  return _db;
}

// ── State ────────────────────────────────────────────────────────────────────

let selectedFp = null;       // currently selected fingerprint
let trialIndex = [];         // cached list from last "list" command: [fingerprint, ...]

let selectedHouseholdId = null;  // currently selected Firestore household
let householdIndex = [];         // cached list from last "households" command: [householdId, ...]

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeStatus(trial) {
  if (!trial) return { remainingDays: 0, status: "none" };
  if (trial.convertedDate) return { remainingDays: 0, status: "converted", convertedDate: trial.convertedDate };
  const elapsed = Math.floor((Date.now() - new Date(trial.startDate).getTime()) / 86400000);
  const remaining = Math.max(0, TRIAL_DURATION_DAYS - elapsed);
  return { remainingDays: remaining, status: remaining <= 0 ? "expired" : "active" };
}

function shortFp(fp) {
  return `${fp.slice(0, 12)}...${fp.slice(-8)}`;
}

function printTrial(trial, fp, ttl) {
  const s = computeStatus(trial);
  const emoji = STATUS_EMOJI[s.status];
  console.log();
  console.log(`  ${BOLD}Fingerprint:${RESET}  ${shortFp(fp)}  ${DIM}(full: ${fp})${RESET}`);
  console.log(`  ${BOLD}Status:${RESET}       ${emoji} ${s.status}`);
  console.log(`  ${BOLD}Start date:${RESET}   ${trial.startDate}`);
  console.log(`  ${BOLD}Elapsed:${RESET}      ${TRIAL_DURATION_DAYS - s.remainingDays} days`);
  console.log(`  ${BOLD}Remaining:${RESET}    ${s.remainingDays} days`);
  if (trial.convertedDate) {
    console.log(`  ${BOLD}Converted:${RESET}    ${trial.convertedDate}`);
  }
  if (ttl !== undefined) {
    console.log(`  ${BOLD}Redis TTL:${RESET}    ${ttl}s (${Math.round(ttl / 86400)}d)`);
  }
  console.log();
}

/** Truncate a Firestore/Clerk ID for display: first-8 … last-4 */
function shortId(id) {
  if (!id || id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** Generate a 6-char alphanumeric invite code (unambiguous charset). */
function generateInviteCode() {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const { randomBytes } = require("crypto");
  const bytes = randomBytes(6);
  return Array.from(bytes).map((b) => CHARS[b % CHARS.length]).join("");
}

/**
 * Prompt the user for y/N confirmation. Returns true if they type "y".
 * NOTE: rl must be initialised before this is called (it always is at runtime).
 */
async function confirmPrompt(msg) {
  return new Promise((resolve) => {
    rl.question(`  ${GOLD}${msg} [y/N]${RESET} `, (ans) => {
      resolve(ans.trim().toLowerCase() === "y");
    });
  });
}

/** Require a household to be selected; print error and return false if not. */
function requireHousehold() {
  if (!selectedHouseholdId) {
    console.log(`${RED}No household selected.${RESET} Use ${CYAN}households${RESET} then ${CYAN}use-household <N>${RESET} to select one.`);
    return false;
  }
  return true;
}

async function getTrial(fp) {
  const raw = await redis.get(`trial:${fp}`);
  return raw ? JSON.parse(raw) : null;
}

async function setTrial(fp, trial) {
  await redis.set(`trial:${fp}`, JSON.stringify(trial), "EX", TRIAL_TTL_SECONDS);
}

function requireSelected() {
  if (!selectedFp) {
    console.log(`${RED}No trial selected.${RESET} Use ${CYAN}list${RESET} then ${CYAN}use <N>${RESET} to select one.`);
    return false;
  }
  return true;
}

// ── Commands ─────────────────────────────────────────────────────────────────

const commands = {
  async list() {
    const keys = await redis.keys("trial:*");
    if (keys.length === 0) {
      console.log("\n  No trial keys found in Redis.\n");
      return;
    }
    keys.sort();
    trialIndex = keys.map((k) => k.replace("trial:", ""));

    console.log(`\n  ${BOLD}#   Fingerprint              Status     Remaining   Started${RESET}`);
    console.log(`  ${DIM}${"─".repeat(70)}${RESET}`);
    for (let i = 0; i < keys.length; i++) {
      const fp = trialIndex[i];
      const raw = await redis.get(keys[i]);
      if (!raw) continue;
      const trial = JSON.parse(raw);
      const s = computeStatus(trial);
      const emoji = STATUS_EMOJI[s.status];
      const selected = fp === selectedFp ? `${GOLD}→${RESET}` : " ";
      const started = new Date(trial.startDate).toLocaleDateString();
      console.log(`  ${selected}${String(i + 1).padStart(2)}  ${shortFp(fp)}  ${emoji} ${s.status.padEnd(10)} ${String(s.remainingDays).padStart(2)}d left     ${started}`);
    }
    console.log(`\n  ${DIM}Use "use <N>" to select a trial${RESET}\n`);
  },

  async use(args) {
    const n = parseInt(args[0], 10);
    if (isNaN(n) || n < 1 || n > trialIndex.length) {
      // Check if it's a raw fingerprint
      if (args[0] && /^[0-9a-f]{64}$/i.test(args[0])) {
        selectedFp = args[0].toLowerCase();
        const trial = await getTrial(selectedFp);
        if (!trial) {
          console.log(`${RED}No trial found for that fingerprint.${RESET}`);
          selectedFp = null;
          return;
        }
        const ttl = await redis.ttl(`trial:${selectedFp}`);
        console.log(`${GREEN}Selected:${RESET}`);
        printTrial(trial, selectedFp, ttl);
        return;
      }
      console.log(`${RED}Invalid selection.${RESET} Run ${CYAN}list${RESET} first, then ${CYAN}use <N>${RESET} or ${CYAN}use <fingerprint>${RESET}.`);
      return;
    }
    selectedFp = trialIndex[n - 1];
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}Trial no longer exists.${RESET} Run ${CYAN}list${RESET} to refresh.`);
      selectedFp = null;
      return;
    }
    const ttl = await redis.ttl(`trial:${selectedFp}`);
    console.log(`${GREEN}Selected:${RESET}`);
    printTrial(trial, selectedFp, ttl);
  },

  async status() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}Trial no longer exists.${RESET}`);
      selectedFp = null;
      return;
    }
    const ttl = await redis.ttl(`trial:${selectedFp}`);
    printTrial(trial, selectedFp, ttl);
  },

  async shift(args) {
    if (!requireSelected()) return;
    const days = parseInt(args[0], 10);
    if (isNaN(days)) {
      console.log(`${RED}Usage: shift <days>${RESET}  (e.g., shift -25 for 5 days remaining)`);
      return;
    }
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}Trial no longer exists.${RESET} Use ${CYAN}reset${RESET} to create one.`);
      return;
    }
    const oldDate = trial.startDate;
    const newDate = new Date(new Date(oldDate).getTime() + days * 86400000);
    const updated = { ...trial, startDate: newDate.toISOString() };
    await setTrial(selectedFp, updated);
    const s = computeStatus(updated);
    console.log(`\n  ${BOLD}Shifted ${days > 0 ? "+" : ""}${days} days${RESET}`);
    console.log(`  Old: ${oldDate}`);
    console.log(`  New: ${updated.startDate}`);
    console.log(`  ${STATUS_EMOJI[s.status]} ${s.status} — ${s.remainingDays}d remaining\n`);
  },

  async set(args) {
    if (!requireSelected()) return;
    const remaining = parseInt(args[0], 10);
    if (isNaN(remaining) || remaining < 0) {
      console.log(`${RED}Usage: set <remaining-days>${RESET}  (e.g., set 5 for 5 days left, set 0 for expired)`);
      return;
    }
    const trial = await getTrial(selectedFp);
    const daysAgo = TRIAL_DURATION_DAYS - remaining;
    const newStart = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const updated = { ...(trial || {}), startDate: newStart };
    delete updated.convertedDate; // un-convert if setting days
    await setTrial(selectedFp, updated);
    const s = computeStatus(updated);
    console.log(`\n  ${BOLD}Set to ${remaining} days remaining${RESET}`);
    console.log(`  Start date: ${newStart}`);
    console.log(`  ${STATUS_EMOJI[s.status]} ${s.status} — ${s.remainingDays}d remaining\n`);
  },

  async reset() {
    if (!requireSelected()) return;
    const updated = { startDate: new Date().toISOString() };
    await setTrial(selectedFp, updated);
    console.log(`\n  ${GREEN}Trial reset to today${RESET}`);
    console.log(`  Start date: ${updated.startDate}`);
    console.log(`  ${STATUS_EMOJI.active} active — ${TRIAL_DURATION_DAYS}d remaining\n`);
  },

  async expire() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    const expired = new Date(Date.now() - 31 * 86400000).toISOString();
    const updated = { ...(trial || {}), startDate: expired };
    delete updated.convertedDate;
    await setTrial(selectedFp, updated);
    console.log(`\n  ${RED}Trial expired${RESET}`);
    console.log(`  Start date: ${expired} (31 days ago)`);
    console.log(`  ${STATUS_EMOJI.expired} expired — 0d remaining\n`);
  },

  async convert() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}No trial exists.${RESET} Use ${CYAN}reset${RESET} to create one first.`);
      return;
    }
    const updated = { ...trial, convertedDate: new Date().toISOString() };
    await setTrial(selectedFp, updated);
    console.log(`\n  ${GOLD}Trial marked as converted${RESET}`);
    console.log(`  Converted at: ${updated.convertedDate}\n`);
  },

  async unconvert() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}No trial exists.${RESET}`);
      return;
    }
    if (!trial.convertedDate) {
      console.log(`  Trial is not converted — nothing to do.`);
      return;
    }
    const updated = { ...trial };
    delete updated.convertedDate;
    await setTrial(selectedFp, updated);
    const s = computeStatus(updated);
    console.log(`\n  ${GREEN}Conversion removed${RESET}`);
    console.log(`  ${STATUS_EMOJI[s.status]} ${s.status} — ${s.remainingDays}d remaining\n`);
  },

  async delete_trial() {
    if (!requireSelected()) return;
    await redis.del(`trial:${selectedFp}`);
    console.log(`\n  ${RED}Trial deleted${RESET} for ${shortFp(selectedFp)}`);
    console.log(`  ${DIM}User will get a fresh trial on next sign-up.${RESET}\n`);
    selectedFp = null;
  },

  async create(args) {
    const fp = args[0];
    if (!fp || !/^[0-9a-f]{64}$/i.test(fp)) {
      console.log(`${RED}Usage: create <64-char-hex-fingerprint>${RESET}`);
      console.log(`${DIM}Get your fingerprint from browser DevTools — see "identity" command.${RESET}`);
      return;
    }
    const existing = await getTrial(fp);
    if (existing) {
      console.log(`${RED}Trial already exists for that fingerprint.${RESET} Use ${CYAN}use${RESET} to select it.`);
      return;
    }
    const trial = { startDate: new Date().toISOString() };
    await setTrial(fp, trial);
    selectedFp = fp;
    console.log(`\n  ${GREEN}Trial created${RESET}`);
    printTrial(trial, fp);
  },

  async keys() {
    const allKeys = await redis.keys("*");
    const grouped = {};
    for (const k of allKeys.sort()) {
      const prefix = k.split(":")[0];
      grouped[prefix] = (grouped[prefix] || 0) + 1;
    }
    console.log(`\n  ${BOLD}All Redis keys by prefix:${RESET}`);
    console.log(`  ${DIM}${"─".repeat(40)}${RESET}`);
    for (const [prefix, count] of Object.entries(grouped).sort()) {
      console.log(`  ${prefix.padEnd(25)} ${count}`);
    }
    console.log(`\n  ${DIM}Total: ${allKeys.length} keys${RESET}\n`);
  },

  async entitlements() {
    const keys = await redis.keys("entitlement:*");
    if (keys.length === 0) {
      console.log("\n  No entitlement keys found.\n");
      return;
    }
    console.log(`\n  ${BOLD}Entitlements (${keys.length}):${RESET}`);
    console.log(`  ${DIM}${"─".repeat(60)}${RESET}`);
    for (const key of keys.sort()) {
      const raw = await redis.get(key);
      if (!raw) continue;
      const ent = JSON.parse(raw);
      const sub = key.replace("entitlement:", "");
      const emoji = ent.active ? `${GREEN}●${RESET}` : `${RED}●${RESET}`;
      console.log(`  ${emoji} ${shortFp(sub)}  tier=${ent.tier}  active=${ent.active}`);
    }
    console.log();
  },

  async stripe_customers() {
    const data = await stripe("GET", "/customers?limit=20");
    if (!data) return;
    if (data.data.length === 0) {
      console.log("\n  No Stripe customers found.\n");
      return;
    }
    console.log(`\n  ${BOLD}Stripe Customers (${data.data.length}):${RESET}`);
    console.log(`  ${DIM}${"─".repeat(70)}${RESET}`);
    for (const c of data.data) {
      const subs = c.subscriptions?.data?.length || 0;
      console.log(`  ${c.id}  ${(c.email || "no email").padEnd(30)}  ${DIM}subs=${subs}${RESET}`);
    }
    console.log();
  },

  async stripe_subs() {
    const data = await stripe("GET", "/subscriptions?limit=20&status=all");
    if (!data) return;
    if (data.data.length === 0) {
      console.log("\n  No Stripe subscriptions found.\n");
      return;
    }
    console.log(`\n  ${BOLD}Stripe Subscriptions (${data.data.length}):${RESET}`);
    console.log(`  ${DIM}${"─".repeat(80)}${RESET}`);
    for (const s of data.data) {
      const emoji = s.status === "active" ? `${GREEN}●${RESET}` : s.status === "canceled" ? `${RED}●${RESET}` : `${GOLD}●${RESET}`;
      console.log(`  ${emoji} ${s.id}  ${s.status.padEnd(12)}  customer=${s.customer}`);
    }
    console.log();
  },

  async delete_customer(args) {
    const id = args[0];
    if (!id || !id.startsWith("cus_")) {
      console.log(`${RED}Usage: delete-customer <cus_xxx>${RESET}`);
      console.log(`${DIM}Use "stripe-customers" to list customer IDs.${RESET}`);
      return;
    }
    // Stripe API is source of truth — delete there, webhooks sync Redis
    const data = await stripe("DELETE", `/customers/${id}`);
    if (!data) return;
    console.log(`\n  ${RED}Deleted customer${RESET} ${id} ${DIM}(via Stripe API)${RESET}`);
    console.log(`  ${DIM}Webhooks will clean up Redis entitlements automatically.${RESET}\n`);
  },

  async cancel_sub(args) {
    const id = args[0];
    if (!id || !id.startsWith("sub_")) {
      console.log(`${RED}Usage: cancel-sub <sub_xxx>${RESET}`);
      console.log(`${DIM}Use "stripe-subs" to list subscription IDs.${RESET}`);
      return;
    }
    // Stripe API is source of truth — cancel there, webhooks sync Redis
    const data = await stripe("DELETE", `/subscriptions/${id}`);
    if (!data) return;
    console.log(`\n  ${RED}Canceled subscription${RESET} ${id} ${DIM}(via Stripe API)${RESET}`);
    console.log(`  ${DIM}Status: ${data.status}. Webhooks will update Redis entitlement.${RESET}\n`);
  },

  async flush_entitlement(args) {
    const id = args[0];
    if (!id) {
      if (selectedFp) {
        const key = `entitlement:${selectedFp}`;
        const exists = await redis.get(key);
        if (!exists) {
          console.log(`${RED}No entitlement found for selected fingerprint.${RESET}`);
          return;
        }
        await redis.del(key);
        console.log(`\n  ${GOLD}Flushed entitlement cache${RESET} for ${shortFp(selectedFp)}`);
        console.log(`  ${DIM}This only clears the Redis cache. Stripe subscription is unaffected.${RESET}`);
        console.log(`  ${DIM}Next auth check will re-fetch from Stripe and rebuild the cache.${RESET}\n`);
        return;
      }
      console.log(`${RED}Usage: flush-entitlement <key-suffix>${RESET}  or select a trial first.`);
      console.log(`${DIM}Use "entitlements" to list keys. This only clears the Redis cache.${RESET}`);
      return;
    }
    const key = id.startsWith("entitlement:") ? id : `entitlement:${id}`;
    const exists = await redis.get(key);
    if (!exists) {
      console.log(`${RED}Key not found: ${key}${RESET}`);
      return;
    }
    await redis.del(key);
    console.log(`\n  ${GOLD}Flushed entitlement cache${RESET} ${key}`);
    console.log(`  ${DIM}Stripe subscription unaffected. Cache will rebuild on next auth check.${RESET}\n`);
  },

  async nuke() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    const entKey = `entitlement:${selectedFp}`;
    const entRaw = await redis.get(entKey);

    console.log(`\n  ${BOLD}${RED}NUKE — removing all state for ${shortFp(selectedFp)}${RESET}`);
    console.log(`  ${DIM}Stripe first (source of truth), then Redis cleanup.${RESET}\n`);

    // 1. Stripe first — cancel subs + delete customer (source of truth)
    let stripeCleanedUp = false;
    if (entRaw) {
      try {
        const ent = JSON.parse(entRaw);
        if (ent.customerId) {
          const cust = await stripe("GET", `/customers/${ent.customerId}?expand[]=subscriptions`);
          if (cust?.subscriptions?.data) {
            for (const sub of cust.subscriptions.data) {
              if (sub.status !== "canceled") {
                await stripe("DELETE", `/subscriptions/${sub.id}`);
                console.log(`  ${RED}✗${RESET} Stripe: subscription ${sub.id} canceled`);
              }
            }
          }
          await stripe("DELETE", `/customers/${ent.customerId}`);
          console.log(`  ${RED}✗${RESET} Stripe: customer ${ent.customerId} deleted`);
          stripeCleanedUp = true;
        }
      } catch { /* best effort */ }
    }
    if (!stripeCleanedUp) {
      console.log(`  ${DIM}○ No Stripe customer to clean up${RESET}`);
    }

    // 2. Redis cleanup — belt-and-suspenders (webhooks would do this too)
    if (trial) {
      await redis.del(`trial:${selectedFp}`);
      console.log(`  ${RED}✗${RESET} Redis: trial deleted`);
    } else {
      console.log(`  ${DIM}○ No trial to delete${RESET}`);
    }

    if (entRaw) {
      await redis.del(entKey);
      console.log(`  ${RED}✗${RESET} Redis: entitlement cache flushed`);
    } else {
      console.log(`  ${DIM}○ No entitlement cache to flush${RESET}`);
    }

    selectedFp = null;
    console.log(`\n  ${DIM}User will get a completely fresh start on next visit.${RESET}\n`);
  },

  async reconnect() {
    if (!isLocalhost) {
      console.log(`${DIM}Not using localhost — reconnect only applies to port-forwarded connections.${RESET}`);
      return;
    }
    if (await isPortOpen(PF_LOCAL_PORT)) {
      console.log(`${GREEN}Port is already open — connection looks healthy.${RESET}`);
      return;
    }
    pfManagedByUs = true;
    await reconnectPortForward();
  },

  identity() {
    console.log(`
  ${BOLD}How to find your trial fingerprint:${RESET}

  1. Open ${CYAN}fenrirledger.com${RESET} in your browser
  2. Open DevTools (F12) → Console
  3. Run:

     ${GOLD}localStorage.getItem('fenrir:device-id')${RESET}

     This gives your deviceId (a UUID).

  4. The fingerprint is SHA-256(navigator.userAgent + deviceId).
     To compute it in the console:

     ${GOLD}async function fp() {
       const did = localStorage.getItem('fenrir:device-id');
       const data = new TextEncoder().encode(navigator.userAgent + did);
       const hash = await crypto.subtle.digest('SHA-256', data);
       return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
     }
     fp().then(console.log)${RESET}

  5. Or just use ${CYAN}list${RESET} here — if you only have one trial, that's you.
`);
  },

  // ── Firestore: Household commands ──────────────────────────────────────────

  async households() {
    const db = getDb();
    const snap = await db.collection("households").orderBy("createdAt", "desc").limit(50).get();
    if (snap.empty) { console.log("\n  No households found in Firestore.\n"); return; }
    householdIndex = snap.docs.map((d) => d.id);

    console.log(`\n  ${BOLD}#   ID              Name                   Owner          Tier   Mbrs  Created${RESET}`);
    console.log(`  ${DIM}${"─".repeat(80)}${RESET}`);
    for (let i = 0; i < snap.docs.length; i++) {
      const d = snap.docs[i];
      const h = d.data();
      const sel = d.id === selectedHouseholdId ? `${GOLD}→${RESET}` : " ";
      const tier = h.tier === "karl" ? `${GOLD}karl${RESET}` : "free";
      const created = h.createdAt ? new Date(h.createdAt).toLocaleDateString() : "—";
      console.log(`  ${sel}${String(i + 1).padStart(2)}  ${shortId(d.id).padEnd(16)} ${(h.name || "").substring(0, 20).padEnd(22)} ${shortId(h.ownerId || "").padEnd(14)} ${tier}  ${((h.memberIds || []).length).toString().padStart(2)}    ${created}`);
    }
    console.log(`\n  ${DIM}Total: ${snap.docs.length}. Use "use-household <N>" to select.${RESET}\n`);
  },

  async household(args) {
    const id = args[0];
    if (!id) {
      // Show currently selected if no arg
      if (!requireHousehold()) return;
      args = [selectedHouseholdId];
    }
    const db = getDb();
    const docId = args[0];
    const snap = await db.doc(`households/${docId}`).get();
    if (!snap.exists) { console.log(`${RED}Household not found: ${docId}${RESET}`); return; }
    const h = snap.data();
    const cardSnap = await db.collection(`households/${docId}/cards`).get();
    const activeCards = cardSnap.docs.filter((d) => !d.data().deletedAt).length;
    const tier = h.tier === "karl" ? `${GOLD}★ karl${RESET}` : `${DIM}free${RESET}`;
    const inviteExpired = h.inviteCodeExpiresAt && new Date(h.inviteCodeExpiresAt) < new Date();
    console.log();
    console.log(`  ${BOLD}Household:${RESET}        ${docId}`);
    console.log(`  ${BOLD}Name:${RESET}             ${h.name || "—"}`);
    console.log(`  ${BOLD}Tier:${RESET}             ${tier}`);
    console.log(`  ${BOLD}Owner:${RESET}            ${h.ownerId}`);
    console.log(`  ${BOLD}Members (${(h.memberIds || []).length}):${RESET}      ${(h.memberIds || []).join(", ") || "—"}`);
    console.log(`  ${BOLD}Invite code:${RESET}      ${h.inviteCode || "—"}  ${inviteExpired ? `${RED}(expired)${RESET}` : `${GREEN}(valid)${RESET}`}  expires ${h.inviteCodeExpiresAt ? new Date(h.inviteCodeExpiresAt).toLocaleDateString() : "—"}`);
    console.log(`  ${BOLD}Cards (active):${RESET}   ${activeCards} / ${cardSnap.size} total`);
    console.log(`  ${BOLD}Created:${RESET}          ${h.createdAt || "—"}`);
    console.log(`  ${BOLD}Updated:${RESET}          ${h.updatedAt || "—"}`);
    console.log();
  },

  async use_household(args) {
    const n = parseInt(args[0], 10);
    if (isNaN(n) || n < 1 || n > householdIndex.length) {
      // Maybe it's a raw ID
      const rawId = args[0];
      if (rawId && rawId.length >= 8) {
        const snap = await getDb().doc(`households/${rawId}`).get();
        if (!snap.exists) { console.log(`${RED}Household not found: ${rawId}${RESET}`); return; }
        selectedHouseholdId = rawId;
        console.log(`${GREEN}Selected household:${RESET} ${rawId}`);
        return;
      }
      console.log(`${RED}Invalid selection.${RESET} Run ${CYAN}households${RESET} first, then ${CYAN}use-household <N>${RESET}.`);
      return;
    }
    selectedHouseholdId = householdIndex[n - 1];
    const snap = await getDb().doc(`households/${selectedHouseholdId}`).get();
    if (!snap.exists) {
      console.log(`${RED}Household no longer exists.${RESET} Run ${CYAN}households${RESET} to refresh.`);
      selectedHouseholdId = null;
      return;
    }
    const h = snap.data();
    console.log(`\n  ${GREEN}Selected:${RESET} ${selectedHouseholdId}  ${DIM}(${h.name || "unnamed"})${RESET}\n`);
  },

  async select_household(args) {
    return commands.use_household(args);
  },

  async kick(args) {
    if (!requireHousehold()) return;
    const userId = args[0];
    if (!userId) { console.log(`${RED}Usage: kick <clerkUserId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}`).get();
    if (!snap.exists) { console.log(`${RED}Household not found.${RESET}`); return; }
    const h = snap.data();
    if (h.ownerId === userId) { console.log(`${RED}Cannot kick the owner. Use transfer-owner first.${RESET}`); return; }
    if (!(h.memberIds || []).includes(userId)) { console.log(`${RED}User ${userId} is not a member of this household.${RESET}`); return; }
    const confirmed = await confirmPrompt(`Remove ${userId} from household ${shortId(selectedHouseholdId)}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    const newMembers = (h.memberIds || []).filter((id) => id !== userId);
    await db.doc(`households/${selectedHouseholdId}`).update({
      memberIds: newMembers,
      updatedAt: new Date().toISOString(),
    });
    // Update user's householdId to empty (they've been removed)
    const userSnap = await db.doc(`users/${userId}`).get();
    if (userSnap.exists) {
      await db.doc(`users/${userId}`).update({ householdId: "", updatedAt: new Date().toISOString() });
    }
    console.log(`\n  ${RED}Kicked${RESET} ${userId} from household ${shortId(selectedHouseholdId)}\n`);
  },

  async transfer_owner(args) {
    if (!requireHousehold()) return;
    const userId = args[0];
    if (!userId) { console.log(`${RED}Usage: transfer-owner <clerkUserId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}`).get();
    if (!snap.exists) { console.log(`${RED}Household not found.${RESET}`); return; }
    const h = snap.data();
    if (!(h.memberIds || []).includes(userId)) { console.log(`${RED}User ${userId} is not a member of this household.${RESET}`); return; }
    if (h.ownerId === userId) { console.log(`  User is already the owner — nothing to do.`); return; }
    const confirmed = await confirmPrompt(`Transfer ownership to ${userId}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    const now = new Date().toISOString();
    const batch = db.batch();
    batch.update(db.doc(`households/${selectedHouseholdId}`), { ownerId: userId, updatedAt: now });
    const oldOwnerSnap = await db.doc(`users/${h.ownerId}`).get();
    if (oldOwnerSnap.exists) batch.update(db.doc(`users/${h.ownerId}`), { role: "member", updatedAt: now });
    const newOwnerSnap = await db.doc(`users/${userId}`).get();
    if (newOwnerSnap.exists) batch.update(db.doc(`users/${userId}`), { role: "owner", updatedAt: now });
    await batch.commit();
    console.log(`\n  ${GOLD}Ownership transferred${RESET} to ${userId}\n`);
  },

  async set_tier(args) {
    if (!requireHousehold()) return;
    const tier = args[0];
    if (tier !== "free" && tier !== "karl") {
      console.log(`${RED}Usage: set-tier <free|karl>${RESET}`);
      return;
    }
    const confirmed = await confirmPrompt(`Set tier to "${tier}" for ${shortId(selectedHouseholdId)}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    await getDb().doc(`households/${selectedHouseholdId}`).update({
      tier,
      updatedAt: new Date().toISOString(),
    });
    const badge = tier === "karl" ? `${GOLD}★ karl${RESET}` : `${DIM}free${RESET}`;
    console.log(`\n  ${GREEN}Tier updated:${RESET} ${badge}\n`);
  },

  async regen_invite() {
    if (!requireHousehold()) return;
    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await getDb().doc(`households/${selectedHouseholdId}`).update({
      inviteCode: code,
      inviteCodeExpiresAt: expiresAt,
      updatedAt: new Date().toISOString(),
    });
    console.log(`\n  ${GREEN}Invite code regenerated:${RESET} ${BOLD}${code}${RESET}`);
    console.log(`  ${DIM}Expires: ${new Date(expiresAt).toLocaleDateString()}${RESET}\n`);
  },

  async delete_household(args) {
    const id = args[0] || selectedHouseholdId;
    if (!id) { console.log(`${RED}Usage: delete-household <id>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Household not found: ${id}${RESET}`); return; }
    const h = snap.data();
    console.log(`\n  ${RED}${BOLD}WARNING: This permanently deletes household ${shortId(id)} ("${h.name || "unnamed"}") and ALL its cards.${RESET}`);
    const confirmed = await confirmPrompt(`Type "y" to confirm permanent deletion:`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }

    // Delete all cards in the subcollection first
    const cards = await db.collection(`households/${id}/cards`).get();
    const batch = db.batch();
    cards.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.doc(`households/${id}`));
    await batch.commit();

    console.log(`  ${RED}✗${RESET} Deleted ${cards.size} cards`);
    console.log(`  ${RED}✗${RESET} Deleted household ${id}\n`);
    if (selectedHouseholdId === id) selectedHouseholdId = null;
  },

  // ── Firestore: User commands ────────────────────────────────────────────────

  async users() {
    const db = getDb();
    const snap = await db.collection("users").orderBy("createdAt", "desc").limit(50).get();
    if (snap.empty) { console.log("\n  No users found in Firestore.\n"); return; }

    console.log(`\n  ${BOLD}  ClerkUserId        Email                          Display name        Role     Household${RESET}`);
    console.log(`  ${DIM}${"─".repeat(100)}${RESET}`);
    snap.docs.forEach((d) => {
      const u = d.data();
      const roleColor = u.role === "owner" ? GOLD : DIM;
      console.log(`  ${shortId(d.id).padEnd(20)} ${(u.email || "").substring(0, 30).padEnd(31)} ${(u.displayName || "").substring(0, 18).padEnd(19)} ${roleColor}${(u.role || "").padEnd(8)}${RESET} ${shortId(u.householdId || "")}`);
    });
    console.log(`\n  ${DIM}Total: ${snap.size}${RESET}\n`);
  },

  async user(args) {
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: user <clerkUserId>${RESET}`); return; }
    const snap = await getDb().doc(`users/${id}`).get();
    if (!snap.exists) { console.log(`${RED}User not found: ${id}${RESET}`); return; }
    const u = snap.data();
    console.log();
    console.log(`  ${BOLD}ClerkUserId:${RESET}  ${id}`);
    console.log(`  ${BOLD}Email:${RESET}        ${u.email || "—"}`);
    console.log(`  ${BOLD}Display name:${RESET} ${u.displayName || "—"}`);
    console.log(`  ${BOLD}Role:${RESET}         ${u.role === "owner" ? `${GOLD}owner${RESET}` : u.role || "—"}`);
    console.log(`  ${BOLD}Household:${RESET}    ${u.householdId || "—"}`);
    console.log(`  ${BOLD}Created:${RESET}      ${u.createdAt || "—"}`);
    console.log(`  ${BOLD}Updated:${RESET}      ${u.updatedAt || "—"}`);
    console.log();
  },

  async delete_user(args) {
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: delete-user <clerkUserId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`users/${id}`).get();
    if (!snap.exists) { console.log(`${RED}User not found: ${id}${RESET}`); return; }
    const u = snap.data();
    console.log(`\n  ${RED}${BOLD}WARNING: Deletes user ${id} (${u.email || "unknown email"})${RESET}`);
    console.log(`  ${DIM}The user's household and cards are NOT deleted — kick them first if needed.${RESET}`);
    const confirmed = await confirmPrompt(`Confirm delete user ${id}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    // Remove from household memberIds if present
    if (u.householdId) {
      const hSnap = await db.doc(`households/${u.householdId}`).get();
      if (hSnap.exists) {
        const h = hSnap.data();
        const newMembers = (h.memberIds || []).filter((mid) => mid !== id);
        await db.doc(`households/${u.householdId}`).update({ memberIds: newMembers, updatedAt: new Date().toISOString() });
      }
    }
    await db.doc(`users/${id}`).delete();
    console.log(`\n  ${RED}✗${RESET} Deleted user ${id}\n`);
  },

  // ── Firestore: Card commands ────────────────────────────────────────────────

  async cards() {
    if (!requireHousehold()) return;
    const db = getDb();
    const snap = await db.collection(`households/${selectedHouseholdId}/cards`).get();
    if (snap.empty) { console.log("\n  No cards found for this household.\n"); return; }

    const active = snap.docs.filter((d) => !d.data().deletedAt);
    const deleted = snap.docs.filter((d) => d.data().deletedAt);

    console.log(`\n  ${BOLD}  ID              Issuer      Card name             Status         Annual fee  Open date${RESET}`);
    console.log(`  ${DIM}${"─".repeat(90)}${RESET}`);
    for (const d of active) {
      const c = d.data();
      const fee = c.annualFee ? `$${(c.annualFee / 100).toFixed(0)}` : "none";
      const opened = c.openDate ? new Date(c.openDate).toLocaleDateString() : "—";
      console.log(`  ${shortId(d.id).padEnd(16)} ${(c.issuerId || "").padEnd(10)} ${(c.cardName || "").substring(0, 20).padEnd(21)} ${(c.status || "").padEnd(14)} ${fee.padEnd(11)} ${opened}`);
    }
    if (deleted.length > 0) {
      console.log(`\n  ${DIM}Soft-deleted (${deleted.length}):${RESET}`);
      for (const d of deleted) {
        const c = d.data();
        console.log(`  ${DIM}${shortId(d.id).padEnd(16)} ${(c.issuerId || "").padEnd(10)} ${(c.cardName || "")} — deleted ${c.deletedAt ? new Date(c.deletedAt).toLocaleDateString() : "?"}${RESET}`);
      }
    }
    console.log(`\n  ${DIM}Active: ${active.length}, Deleted: ${deleted.length}, Total: ${snap.size}${RESET}\n`);
  },

  async card(args) {
    if (!requireHousehold()) return;
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: card <cardId>${RESET}`); return; }
    const snap = await getDb().doc(`households/${selectedHouseholdId}/cards/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Card not found: ${id}${RESET}`); return; }
    const c = snap.data();
    const deleted = c.deletedAt ? `${RED} [DELETED ${new Date(c.deletedAt).toLocaleDateString()}]${RESET}` : "";
    const closed = c.closedAt ? ` ${DIM}[closed ${new Date(c.closedAt).toLocaleDateString()}]${RESET}` : "";
    console.log();
    console.log(`  ${BOLD}Card ID:${RESET}      ${id}${deleted}`);
    console.log(`  ${BOLD}Issuer:${RESET}       ${c.issuerId || "—"}`);
    console.log(`  ${BOLD}Name:${RESET}         ${c.cardName || "—"}${closed}`);
    console.log(`  ${BOLD}Status:${RESET}       ${c.status || "—"}`);
    console.log(`  ${BOLD}Credit limit:${RESET} $${c.creditLimit ? (c.creditLimit / 100).toLocaleString() : "—"}`);
    console.log(`  ${BOLD}Annual fee:${RESET}   ${c.annualFee ? `$${(c.annualFee / 100).toFixed(0)}` : "none"}${c.annualFeeDate ? `  (due ${new Date(c.annualFeeDate).toLocaleDateString()})` : ""}`);
    console.log(`  ${BOLD}Open date:${RESET}    ${c.openDate ? new Date(c.openDate).toLocaleDateString() : "—"}`);
    if (c.signUpBonus) {
      console.log(`  ${BOLD}Sign-up bonus:${RESET} ${JSON.stringify(c.signUpBonus)}`);
    }
    console.log(`  ${BOLD}Notes:${RESET}        ${c.notes || "—"}`);
    console.log(`  ${BOLD}Household:${RESET}    ${c.householdId || "—"}`);
    console.log(`  ${BOLD}Created:${RESET}      ${c.createdAt || "—"}`);
    console.log(`  ${BOLD}Updated:${RESET}      ${c.updatedAt || "—"}`);
    console.log();
  },

  async delete_card(args) {
    if (!requireHousehold()) return;
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: delete-card <cardId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}/cards/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Card not found: ${id}${RESET}`); return; }
    const c = snap.data();
    if (c.deletedAt) { console.log(`${GOLD}Card already soft-deleted.${RESET} Use restore-card to undo, or expunge-card to permanently remove.`); return; }
    await db.doc(`households/${selectedHouseholdId}/cards/${id}`).update({
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`\n  ${RED}Soft-deleted:${RESET} ${c.cardName || id}  ${DIM}(use restore-card ${id} to undo)${RESET}\n`);
  },

  async restore_card(args) {
    if (!requireHousehold()) return;
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: restore-card <cardId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}/cards/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Card not found: ${id}${RESET}`); return; }
    const c = snap.data();
    if (!c.deletedAt) { console.log(`${DIM}Card is not soft-deleted — nothing to restore.${RESET}`); return; }
    await db.doc(`households/${selectedHouseholdId}/cards/${id}`).update({
      deletedAt: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`\n  ${GREEN}Restored:${RESET} ${c.cardName || id}\n`);
  },

  async expunge_card(args) {
    if (!requireHousehold()) return;
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: expunge-card <cardId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}/cards/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Card not found: ${id}${RESET}`); return; }
    const c = snap.data();
    console.log(`\n  ${RED}${BOLD}WARNING: Permanently deletes "${c.cardName || id}" — cannot be undone.${RESET}`);
    const confirmed = await confirmPrompt(`Confirm expunge card ${id}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    await db.doc(`households/${selectedHouseholdId}/cards/${id}`).delete();
    console.log(`\n  ${RED}✗${RESET} Permanently deleted card ${id}\n`);
  },

  async card_count() {
    if (!requireHousehold()) return;
    const snap = await getDb().collection(`households/${selectedHouseholdId}/cards`).get();
    const active = snap.docs.filter((d) => !d.data().deletedAt).length;
    const deleted = snap.docs.filter((d) => !!d.data().deletedAt).length;
    console.log(`\n  ${BOLD}Card count for ${shortId(selectedHouseholdId)}:${RESET}`);
    console.log(`  ${GREEN}Active:${RESET}  ${active}`);
    console.log(`  ${RED}Deleted:${RESET} ${deleted}`);
    console.log(`  ${BOLD}Total:${RESET}   ${snap.size}\n`);
  },

  help() {
    if (selectedFp) {
      console.log(`
  ${BOLD}Selected:${RESET} ${GOLD}${shortFp(selectedFp)}${RESET}
  ${DIM}${"─".repeat(50)}${RESET}

  ${CYAN}status${RESET}                 Show trial details
  ${CYAN}set <days>${RESET}             Set remaining days (e.g., "set 5")
  ${CYAN}shift <days>${RESET}           Shift start date (e.g., "shift -25")
  ${CYAN}reset${RESET}                  Fresh 30-day trial
  ${CYAN}expire${RESET}                 Instantly expire
  ${CYAN}convert${RESET} / ${CYAN}unconvert${RESET}    Toggle paid conversion
  ${CYAN}flush-entitlement${RESET}       Clear Redis entitlement cache
  ${CYAN}nuke${RESET}                   Wipe everything: Stripe + Redis
  ${CYAN}delete${RESET}                 Delete trial from Redis
  ${CYAN}list${RESET}                   Switch trial     ${CYAN}quit${RESET}  Exit
`);
    } else {
      console.log(`
  ${BOLD}No trial selected${RESET} — start here:
  ${DIM}${"─".repeat(50)}${RESET}

  ${CYAN}list${RESET}                          List all trials (pick by number)
  ${CYAN}use <N|fingerprint>${RESET}           Select a trial
  ${CYAN}create <fingerprint>${RESET}           Create a new trial
  ${CYAN}identity${RESET}                      How to find your fingerprint

  ${BOLD}Redis / Stripe${RESET}
  ${CYAN}keys${RESET}                          All Redis key prefixes
  ${CYAN}entitlements${RESET}                   Stripe entitlement cache
  ${CYAN}stripe-customers${RESET}              Stripe customers
  ${CYAN}stripe-subs${RESET}                   Stripe subscriptions
  ${CYAN}delete-customer <cus_xxx>${RESET}      Delete Stripe customer
  ${CYAN}cancel-sub <sub_xxx>${RESET}           Cancel subscription
  ${CYAN}reconnect${RESET}                     Reconnect port-forward

  ${BOLD}Firestore — Households${RESET}
  ${CYAN}households${RESET}                    List all households (paginated, 50)
  ${CYAN}household [id]${RESET}                Show household details
  ${CYAN}use-household <N|id>${RESET}          Select a household
  ${CYAN}kick <userId>${RESET}                 Remove member from selected household
  ${CYAN}transfer-owner <userId>${RESET}       Transfer ownership
  ${CYAN}set-tier <free|karl>${RESET}          Change subscription tier
  ${CYAN}regen-invite${RESET}                  Regenerate invite code
  ${CYAN}delete-household [id]${RESET}         Permanently delete household + cards

  ${BOLD}Firestore — Users${RESET}
  ${CYAN}users${RESET}                         List all users (paginated, 50)
  ${CYAN}user <clerkUserId>${RESET}            Show user details
  ${CYAN}delete-user <clerkUserId>${RESET}     Delete user document

  ${BOLD}Firestore — Cards${RESET}  ${DIM}(requires use-household first)${RESET}
  ${CYAN}cards${RESET}                         List cards for selected household
  ${CYAN}card <cardId>${RESET}                 Show card details
  ${CYAN}card-count${RESET}                    Count active/deleted cards
  ${CYAN}delete-card <cardId>${RESET}          Soft-delete a card (sets deletedAt)
  ${CYAN}restore-card <cardId>${RESET}         Restore a soft-deleted card
  ${CYAN}expunge-card <cardId>${RESET}         Permanently delete a card

  ${CYAN}quit${RESET}                          Exit
`);
    }
  },
};

// ── Tab completion ───────────────────────────────────────────────────────────

const ALL_COMMANDS = [
  // Trial / Redis
  "list", "use", "status", "set", "shift", "reset", "expire",
  "convert", "unconvert", "create", "delete",
  "stripe-customers", "stripe-subs", "delete-customer", "cancel-sub",
  "flush-entitlement", "nuke",
  "keys", "entitlements", "identity", "reconnect",
  // Firestore — Household
  "households", "household", "use-household", "select-household",
  "kick", "transfer-owner", "set-tier", "regen-invite", "delete-household",
  // Firestore — User
  "users", "user", "delete-user",
  // Firestore — Card
  "cards", "card", "delete-card", "restore-card", "expunge-card", "card-count",
  // Meta
  "help", "quit", "exit",
];

function completer(line) {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || "";

  // If typing the first word, complete command names
  if (parts.length <= 1) {
    const hits = ALL_COMMANDS.filter((c) => c.startsWith(cmd));
    return [hits.length ? hits : ALL_COMMANDS, cmd];
  }

  // For "use", complete with trial index numbers
  if (cmd === "use" && trialIndex.length > 0) {
    const arg = parts[1] || "";
    const nums = trialIndex.map((_, i) => String(i + 1));
    const hits = nums.filter((n) => n.startsWith(arg));
    return [hits, arg];
  }

  // For "use-household" / "select-household", complete with household index numbers
  if ((cmd === "use-household" || cmd === "select-household") && householdIndex.length > 0) {
    const arg = parts[1] || "";
    const nums = householdIndex.map((_, i) => String(i + 1));
    const hits = nums.filter((n) => n.startsWith(arg));
    return [hits, arg];
  }

  return [[], line];
}

// ── REPL ─────────────────────────────────────────────────────────────────────

function prompt() {
  const sel = selectedFp ? ` ${GOLD}${shortFp(selectedFp)}${RESET}` : "";
  const hh = selectedHouseholdId ? ` ${CYAN}hh:${shortId(selectedHouseholdId)}${RESET}` : "";
  return `${BOLD}spear${RESET}${sel}${hh}${BOLD}>${RESET} `;
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: prompt(),
  terminal: true,
  completer,
});

console.log(`\n  ${BOLD}${GOLD}Fenrir Ledger — Odin's Spear${RESET}`);
console.log(`  ${DIM}Type "help" for commands, "list" to see all trials. Tab to complete.${RESET}\n`);
rl.prompt();

rl.on("line", async (line) => {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  if (!cmd) {
    rl.setPrompt(prompt());
    rl.prompt();
    return;
  }

  if (cmd === "quit" || cmd === "exit" || cmd === "q") {
    console.log(`${DIM}Disconnecting...${RESET}`);
    await redis.quit();
    cleanupPortForward();
    process.exit(0);
  }

  // Normalize: "delete" → "delete_trial", hyphens → underscores for method lookup
  let cmdKey = cmd === "delete" ? "delete_trial" : cmd.replace(/-/g, "_");
  const handler = commands[cmdKey];

  if (!handler) {
    console.log(`${RED}Unknown command: ${cmd}${RESET}. Type ${CYAN}help${RESET} for available commands.`);
    rl.setPrompt(prompt());
    rl.prompt();
    return;
  }

  try {
    await handler(args);
  } catch (err) {
    console.error(`${RED}Error: ${err.message}${RESET}`);
  }

  rl.setPrompt(prompt());
  rl.prompt();
});

rl.on("close", async () => {
  console.log(`\n${DIM}Disconnecting...${RESET}`);
  await redis.quit();
  cleanupPortForward();
  process.exit(0);
});
