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
import { parseArgs } from "node:util";
import { execSync, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import React, { useState, useEffect, useCallback } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";

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
/** Phase boundary mirrors TrialDay15Modal NUDGE_DAY — do not hardcode elsewhere. */
const TRIAL_NUDGE_DAY = 15;
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

/**
 * Route port-forward / Redis async log messages to TUI once it's running,
 * or fall through to console before render() is called.
 * SpearApp registers _tuiLog on mount and clears it on unmount.
 */
let _tuiLog = null;
function pfLog(msg, isError = false) {
  if (_tuiLog) { _tuiLog(msg); return; }
  if (isError) console.error(msg); else console.log(msg);
}

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
      pfLog(`Port-forward exited with code ${code}`, true);
      if (stderrBuf.trim()) pfLog(stderrBuf.trim(), true);
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
      pfLog(`Port-forward established (localhost:${PF_LOCAL_PORT} → ${PF_SERVICE})`);
      return true;
    }
  }

  pfLog("Port-forward timed out after 10s", true);
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
    pfLog(`Port-forward dropped — reconnecting (attempt ${attempt}/${MAX_ATTEMPTS})...`);
    await new Promise((r) => setTimeout(r, delays[attempt - 1]));

    const ok = await startPortForward();
    if (ok) {
      reconnecting = false;
      return;
    }
  }

  reconnecting = false;
  pfLog(`Port-forward reconnect failed after ${MAX_ATTEMPTS} attempts. Use / → reconnect to retry.`, true);
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
      pfLog(`Redis: reconnect failed after ${times} attempts — port-forward may have dropped`, true);
      return null; // stop retrying
    }
    return Math.min(times * 500, 2000);
  },
});

// Suppress "Unhandled error event" noise from ioredis reconnect attempts
redis.on("error", (err) => {
  if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
    pfLog(`Redis connection error (${err.code} — port-forward may have dropped)`, true);
  } else {
    pfLog(`Redis error: ${err.message}`, true);
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
  // Pin GOOGLE_APPLICATION_CREDENTIALS to the ADC file gcloud just wrote so
  // all subsequent clients (e.g. Firestore's internal GoogleAuth) use the file
  // directly and skip the GCE metadata probe — which emits
  // MetadataLookupWarning: received unexpected error = All promises were
  // rejected when running outside GCP (issue #1259).
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
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

// ── TUI context refs — set by tab components when selections change ───────────
// These allow the command palette to know what is currently "in scope" without
// needing to lift all tab state up to SpearApp.

let selectedFp = null;           // trial fingerprint — set when Users tab loads a user with a trial
let selectedHouseholdId = null;  // Firestore household ID — set when Households tab selects a household
let _selectedUserId = null;      // Firestore user ID — set when Users tab selects a user
let _selectedUserEmail = null;   // email for display in confirm dialogs
let _selectedSubId = null;       // Stripe subscription ID — set when user detail loads

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

/**
 * Computes the target remaining days for "trial-progress".
 * Mirrors phase boundaries from TrialDay15Modal (TRIAL_NUDGE_DAY) and trial-utils (TRIAL_DURATION_DAYS).
 *
 * Phase boundaries:
 *   remaining > TRIAL_NUDGE_DAY  → advance to exactly TRIAL_NUDGE_DAY remaining
 *   remaining <= TRIAL_NUDGE_DAY and remaining > 0 → advance to 0 (expiry)
 *   remaining <= 0 → already expired, no phase to progress to
 *
 * @param {number} remainingDays - current remaining days
 * @returns {{ targetRemaining: number, label: string } | null} null if already expired
 */
function computeTrialProgressTarget(remainingDays) {
  if (remainingDays > TRIAL_NUDGE_DAY) {
    return { targetRemaining: TRIAL_NUDGE_DAY, label: `Day-${TRIAL_NUDGE_DAY} nudge boundary` };
  }
  if (remainingDays > 0) {
    return { targetRemaining: 0, label: "Expiry boundary (day 30)" };
  }
  return null; // already expired
}

/**
 * Computes the new startDate ISO string to achieve a desired remaining-days value.
 * @param {number} targetRemaining - desired remaining days
 * @returns {string} new startDate ISO string
 */
function startDateForRemaining(targetRemaining) {
  const daysAgo = TRIAL_DURATION_DAYS - targetRemaining;
  return new Date(Date.now() - daysAgo * 86400000).toISOString();
}

/**
 * Describes a trial state compactly for display in confirmation dialogs.
 * @param {{ status: string, remainingDays: number }} state
 * @returns {string}
 */
function describeTrialState(state) {
  if (state.status === "none") return "no trial";
  if (state.status === "converted") return "converted (Karl)";
  if (state.status === "expired") return "expired — 0 days remaining";
  return `${state.status} — ${state.remainingDays}d remaining`;
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

async function getTrial(fp) {
  const raw = await redis.get(`trial:${fp}`);
  return raw ? JSON.parse(raw) : null;
}

async function setTrial(fp, trial) {
  await redis.set(`trial:${fp}`, JSON.stringify(trial), "EX", TRIAL_TTL_SECONDS);
}

// ── TUI data operations — pure async, return data/status, never console.log ───

/** Returns lines[] for the ResultsOverlay — Stripe customers. */
async function fetchListCustomers() {
  const data = await stripe("GET", "/customers?limit=20");
  if (!data) return ["Stripe unavailable."];
  if (!data.data?.length) return ["No Stripe customers found."];
  return [
    `Customers (${data.data.length}):`,
    "─".repeat(60),
    ...data.data.map((c) => {
      const subs = c.subscriptions?.data?.length || 0;
      return `${c.id}  ${(c.email || "no email").padEnd(30)}  subs=${subs}`;
    }),
  ];
}

/** Returns lines[] for the ResultsOverlay — Stripe subscriptions. */
async function fetchListSubscriptions() {
  const data = await stripe("GET", "/subscriptions?limit=20&status=all");
  if (!data) return ["Stripe unavailable."];
  if (!data.data?.length) return ["No Stripe subscriptions found."];
  return [
    `Subscriptions (${data.data.length}):`,
    "─".repeat(60),
    ...data.data.map((s) => {
      const dot = s.status === "active" ? "●" : s.status === "canceled" ? "○" : "◑";
      return `${dot} ${s.id}  ${s.status.padEnd(12)}  customer=${s.customer}`;
    }),
  ];
}

/** Returns lines[] for the ResultsOverlay — Redis entitlement cache. */
async function fetchEntitlements() {
  const keys = await redis.keys("entitlement:*");
  if (!keys.length) return ["No entitlement keys found."];
  const lines = [`Entitlements (${keys.length}):`, "─".repeat(60)];
  for (const key of keys.sort()) {
    const raw = await redis.get(key);
    if (!raw) continue;
    const ent = JSON.parse(raw);
    const sub = key.replace("entitlement:", "");
    lines.push(`${ent.active ? "●" : "○"} ${shortFp(sub)}  tier=${ent.tier}  active=${ent.active}`);
  }
  return lines;
}

/** Returns lines[] for the ResultsOverlay — all Redis keys grouped by prefix. */
async function fetchRedisKeys() {
  const allKeys = await redis.keys("*");
  const grouped = {};
  for (const k of allKeys.sort()) {
    const prefix = k.split(":")[0];
    grouped[prefix] = (grouped[prefix] || 0) + 1;
  }
  const lines = [`Redis keys by prefix (total: ${allKeys.length}):`, "─".repeat(40)];
  for (const [prefix, count] of Object.entries(grouped).sort()) {
    lines.push(`  ${prefix.padEnd(25)} ${count}`);
  }
  return lines;
}

/** Reconnect port-forward. Returns a status string for display. */
async function doReconnect() {
  if (!isLocalhost) return "Not on localhost — port-forward not applicable.";
  if (await isPortOpen(PF_LOCAL_PORT)) return "Port is already open — connection looks healthy.";
  pfManagedByUs = true;
  await reconnectPortForward();
  return "Reconnect initiated.";
}

/** Flush Redis entitlement cache for the currently selected fingerprint. */
async function doDeleteEntitlement() {
  if (!selectedFp) return "No trial selected — select a user with a trial first.";
  const key = `entitlement:${selectedFp}`;
  const exists = await redis.get(key);
  if (!exists) return "No entitlement cache found for this fingerprint.";
  await redis.del(key);
  return `Entitlement cache flushed for ${shortFp(selectedFp)}. Will rebuild on next auth check.`;
}

/** Regenerate invite code for the currently selected household. Returns status string. */
async function doUpdateInvite() {
  if (!selectedHouseholdId) return "No household selected.";
  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await getDb().doc(`households/${selectedHouseholdId}`).update({
    inviteCode: code,
    inviteCodeExpiresAt: expiresAt,
    updatedAt: new Date().toISOString(),
  });
  return `Invite code regenerated: ${code}  (expires ${new Date(expiresAt).toLocaleDateString()})`;
}

/** Delete selected user from Firestore. Returns status string. */
async function doDeleteUser() {
  if (!_selectedUserId) return "No user selected.";
  const db = getDb();
  const snap = await db.doc(`users/${_selectedUserId}`).get();
  if (!snap.exists) return `User not found: ${_selectedUserId}`;
  const u = snap.data();
  if (u.householdId) {
    const hSnap = await db.doc(`households/${u.householdId}`).get();
    if (hSnap.exists) {
      const h = hSnap.data();
      await db.doc(`households/${u.householdId}`).update({
        memberIds: (h.memberIds || []).filter((id) => id !== _selectedUserId),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  await db.doc(`users/${_selectedUserId}`).delete();
  const email = _selectedUserEmail || _selectedUserId;
  _selectedUserId = null;
  _selectedUserEmail = null;
  return `Deleted user ${email}`;
}

/** Delete selected household and all its cards. Returns status string. */
async function doDeleteHousehold() {
  if (!selectedHouseholdId) return "No household selected.";
  const db = getDb();
  const snap = await db.doc(`households/${selectedHouseholdId}`).get();
  if (!snap.exists) return `Household not found: ${selectedHouseholdId}`;
  const cards = await db.collection(`households/${selectedHouseholdId}/cards`).get();
  const batch = db.batch();
  cards.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.doc(`households/${selectedHouseholdId}`));
  await batch.commit();
  const id = selectedHouseholdId;
  selectedHouseholdId = null;
  return `Deleted household ${shortId(id)} and ${cards.size} cards.`;
}

/** Cancel a Stripe subscription by ID. Returns status string. */
async function doDeleteSubscription(subId) {
  if (!subId) return "No subscription ID provided.";
  const sub = await stripe("GET", `/subscriptions/${subId}`);
  if (!sub) return `Subscription not found: ${subId}`;
  if (sub.status === "canceled") return `Subscription ${subId} is already canceled.`;
  const data = await stripe("DELETE", `/subscriptions/${subId}`);
  if (!data) return "Stripe request failed.";
  _selectedSubId = null;
  return `Canceled subscription ${subId} (status: ${data.status}).`;
}

/** Nuclear option: cancel Stripe sub + customer, delete trial + entitlement. */
async function doDeleteAll() {
  if (!selectedFp) return "No trial selected.";
  const lines = [`NUKE: removing all state for ${shortFp(selectedFp)}`];
  const trial = await getTrial(selectedFp);
  const entKey = `entitlement:${selectedFp}`;
  const entRaw = await redis.get(entKey);

  if (entRaw) {
    try {
      const ent = JSON.parse(entRaw);
      if (ent.customerId) {
        const cust = await stripe("GET", `/customers/${ent.customerId}?expand[]=subscriptions`);
        if (cust?.subscriptions?.data) {
          for (const sub of cust.subscriptions.data) {
            if (sub.status !== "canceled") {
              await stripe("DELETE", `/subscriptions/${sub.id}`);
              lines.push(`✗ Stripe: subscription ${sub.id} canceled`);
            }
          }
        }
        await stripe("DELETE", `/customers/${ent.customerId}`);
        lines.push(`✗ Stripe: customer ${ent.customerId} deleted`);
      }
    } catch { lines.push("○ Stripe cleanup failed (best effort)"); }
  } else {
    lines.push("○ No Stripe entitlement to clean up");
  }

  if (trial) { await redis.del(`trial:${selectedFp}`); lines.push("✗ Redis: trial deleted"); }
  else { lines.push("○ No trial to delete"); }

  if (entRaw) { await redis.del(entKey); lines.push("✗ Redis: entitlement cache flushed"); }
  else { lines.push("○ No entitlement cache to flush"); }

  selectedFp = null;
  lines.push("Done. User gets a fresh start on next visit.");
  return lines.join("\n");
}


// ── Load initial counts ──────────────────────────────────────────────────────

let initialCounts = { users: 0, households: 0 };
try {
  const [uSnap, hSnap] = await Promise.all([
    getDb().collection("users").count().get(),
    getDb().collection("households").count().get(),
  ]);
  initialCounts = {
    users: uSnap.data().count,
    households: hSnap.data().count,
  };
} catch { /* counts are informational — ignore on error */ }

// ── Users Tab — Data Loading ──────────────────────────────────────────────────

/** Fetch all users from Firestore, enriched with tier derived from households. */
async function loadUsersWithTiers() {
  const db = getDb();
  const [usersSnap, hhSnap] = await Promise.all([
    db.collection("users").orderBy("createdAt", "desc").limit(100).get(),
    db.collection("households").limit(200).get(),
  ]);

  const hhMap = new Map();
  hhSnap.docs.forEach((d) => {
    const h = d.data();
    hhMap.set(d.id, { tier: h.tier || "thrall", name: h.name || "" });
  });

  return usersSnap.docs.map((d) => {
    const u = d.data();
    const hh = u.householdId ? hhMap.get(u.householdId) : null;
    return {
      id: d.id,
      email: u.email || "",
      displayName: u.displayName || "",
      role: u.role || "",
      householdId: u.householdId || null,
      householdName: hh ? hh.name : null,
      tier: hh ? hh.tier : (u.tier || "thrall"),
      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null,
      // Optional Stripe/sync fields that may exist on user doc
      stripeCustomerId: u.stripeCustomerId || null,
      lastSyncAt: u.lastSyncAt || null,
      syncCount: u.syncCount != null ? u.syncCount : null,
      syncHealth: u.syncHealth || null,
    };
  });
}

/** Fetch full detail for a selected user: household, cards, Stripe, cloud sync, trial. */
async function loadUserDetailData(user) {
  const db = getDb();
  const result = {
    household: null,
    stripe: null,
    cloudSync: user.lastSyncAt != null ? {
      lastSync: user.lastSyncAt,
      totalSyncs: user.syncCount || 0,
      health: user.syncHealth || "unknown",
    } : null,
    cardCount: null,
    trial: null,      // { fingerprint, startDate, convertedDate?, remainingDays, status }
  };

  if (user.householdId) {
    try {
      const [hhSnap, cardSnap] = await Promise.all([
        db.doc(`households/${user.householdId}`).get(),
        db.collection(`households/${user.householdId}/cards`).get(),
      ]);
      if (hhSnap.exists) {
        const h = hhSnap.data();
        result.household = {
          id: user.householdId,
          name: h.name || "",
          tier: h.tier || "thrall",
          ownerId: h.ownerId || null,
        };
        // Cloud sync may be stored on the household doc
        if (!result.cloudSync && (h.lastSyncAt || h.syncCount != null)) {
          result.cloudSync = {
            lastSync: h.lastSyncAt || null,
            totalSyncs: h.syncCount || 0,
            health: h.syncHealth || "unknown",
          };
        }
      }
      const active = cardSnap.docs.filter((d) => !d.data().deletedAt).length;
      result.cardCount = { active, total: cardSnap.size };
    } catch { /* best effort */ }
  }

  // Fetch Stripe subscription if we have a customerId on the user doc
  const customerId = user.stripeCustomerId;
  if (customerId) {
    try {
      const data = await stripe("GET", `/customers/${customerId}?expand[]=subscriptions`);
      if (data && data.subscriptions) {
        const sub =
          data.subscriptions.data.find((s) => s.status !== "canceled") ||
          data.subscriptions.data[0];
        if (sub) {
          const item = sub.items?.data?.[0];
          const src = data.default_source;
          result.stripe = {
            subId: sub.id,
            customerId,
            status: sub.status,
            amount: item?.price?.unit_amount ?? null,
            currency: item?.price?.currency ?? "usd",
            interval: item?.price?.recurring?.interval ?? null,
            paymentMethod: src?.last4
              ? `${src.brand || "Card"} ending ${src.last4}`
              : null,
          };
        }
      }
    } catch { /* best effort */ }
  }

  // Fetch trial via reverse-lookup index: trial:user:{userId} → fingerprint
  try {
    const fp = await redis.get(`trial:user:${user.id}`);
    if (fp) {
      const raw = await redis.get(`trial:${fp}`);
      if (raw) {
        const t = JSON.parse(raw);
        const s = computeStatus(t);
        result.trial = { fingerprint: fp, startDate: t.startDate, convertedDate: t.convertedDate, ...s };
      }
    }
  } catch { /* best effort */ }

  // Update module-level context refs so the command palette knows what is in scope
  _selectedUserId = user.id;
  _selectedUserEmail = user.email || null;
  selectedFp = result.trial?.fingerprint ?? null;
  _selectedSubId = result.stripe?.subId ?? null;

  return result;
}

// ── Users Tab — Ink Components ────────────────────────────────────────────────

const TIER_STYLES = {
  karl:   { label: "KARL",   color: "black",  bg: "yellow",      bold: true  },
  trial:  { label: "TRIAL",  color: "black",  bg: "yellowBright", bold: false },
  thrall: { label: "THRALL", color: "gray",   bg: undefined,     bold: false },
};

/** Tier badge: Karl=gold bg, Trial=amber bg, Thrall=gray text. */
function TierBadge({ tier }) {
  const s = TIER_STYLES[tier] || TIER_STYLES.thrall;
  return h(Text, { backgroundColor: s.bg, color: s.color, bold: s.bold }, ` ${s.label} `);
}

/** Subscription status badge. */
function SubStatusBadge({ status }) {
  if (!status) return h(Text, { color: "gray", dimColor: true }, "none");
  const color =
    status === "active"    ? "green"  :
    status === "trialing"  ? "yellow" :
    status === "past_due"  ? "yellow" :
    status === "canceled"  ? "red"    : "gray";
  return h(Text, { color, bold: color !== "gray" }, status.replace(/_/g, " "));
}

/** Trial status badge. */
function TrialStatusBadge({ status, remainingDays }) {
  if (status === "none")      return h(Text, { color: "gray", dimColor: true }, "none");
  if (status === "converted") return h(Text, { color: "yellow", bold: true }, "★ converted");
  if (status === "expired")   return h(Text, { color: "red" }, "● expired");
  return h(Text, { color: "green", bold: true }, `● active — ${remainingDays}d left`);
}

/** Cloud sync health indicator. */
function SyncHealthBadge({ health }) {
  if (!health || health === "unknown") return h(Text, { color: "gray", dimColor: true }, "N/A");
  const color = health === "healthy" ? "green" : health === "degraded" ? "yellow" : "red";
  const dot = health === "healthy" ? "●" : health === "degraded" ? "◑" : "●";
  return h(Text, { color }, `${dot} ${health}`);
}

/** A label-value row in the detail panel. */
function DetailField({ label, children }) {
  return h(Box, { flexDirection: "row" },
    h(Text, { color: "gray", dimColor: true }, `  ${label.padEnd(18)}`),
    children
  );
}

/** Section heading. */
function SectionHeader({ title }) {
  return h(Box, { marginTop: 1 },
    h(Text, { color: "yellow", dimColor: true }, `── ${title} `)
  );
}

/**
 * Left-panel list row: email (truncated) + tier badge.
 * selected item shown with ▶ highlight.
 */
function UserListRow({ user, selected }) {
  const maxEmail = 22;
  const email = user.email.length > maxEmail
    ? user.email.slice(0, maxEmail - 1) + "…"
    : user.email;
  const bg = selected ? "blue" : undefined;
  const textColor = selected ? "white" : "white";
  return h(Box, { flexDirection: "row", alignItems: "center", paddingX: 1 },
    h(Text, { backgroundColor: bg, color: selected ? "yellow" : "gray", bold: selected }, selected ? "▶ " : "  "),
    h(Text, { backgroundColor: bg, color: textColor, bold: selected }, email.padEnd(maxEmail)),
    h(Box, { flexShrink: 0, marginLeft: 1 }, h(TierBadge, { tier: user.tier }))
  );
}

/**
 * Right-panel: full detail for selected user.
 * Shows identity, household, Stripe, cloud sync, card count, trial, and action shortcuts.
 */
function UserDetailPanel({ user, detail, detailLoading, mode, tierInput, statusMessage }) {
  const hh = detail?.household ?? null;
  const stripeData = detail?.stripe ?? null;
  const sync = detail?.cloudSync ?? null;
  const cards = detail?.cardCount ?? null;
  const trial = detail?.trial ?? null;

  // ── Action area ──
  let actionArea;
  if (mode === "confirm-delete") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1 },
      h(Text, { color: "red" }, `Delete ${user.email}? `),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[Esc] Cancel")
    );
  } else if (mode === "prompt-tier") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "yellow", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "yellow" }, "New tier (karl/trial/thrall): "),
      h(Text, { color: "white", bold: true }, tierInput),
      h(Text, { color: "gray" }, "█  [Enter] Confirm  [Esc] Cancel")
    );
  } else if (mode === "confirm-cancel-sub") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1 },
      h(Text, { color: "red" }, "Cancel subscription? "),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[Esc] Cancel")
    );
  } else if (mode === "confirm-trial-reset") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "yellow", paddingX: 1, marginTop: 1 },
      h(Text, { color: "yellow" }, "Reset trial to today? "),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[Esc] Cancel")
    );
  } else if (mode === "confirm-trial-expire") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1 },
      h(Text, { color: "red" }, "Force-expire trial now? "),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[Esc] Cancel")
    );
  } else if (mode === "confirm-trial-convert") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "yellow", paddingX: 1, marginTop: 1 },
      h(Text, { color: "yellow" }, "Mark trial as converted? "),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[Esc] Cancel")
    );
  } else if (mode === "confirm-trial-delete") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1 },
      h(Text, { color: "red" }, "Delete trial record entirely? "),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[Esc] Cancel")
    );
  } else {
    actionArea = h(Box, { flexDirection: "row", flexWrap: "wrap", borderStyle: "single", borderColor: "gray", paddingX: 1, marginTop: 1 },
      h(Text, { color: "red" }, "[d] Delete  "),
      h(Text, { color: "cyan" }, "[t] Tier  "),
      ...(stripeData ? [h(Text, { color: "red" }, "[s] Cancel Sub  ")] : []),
      ...(hh ? [h(Text, { color: "yellow" }, "[h] Household  ")] : []),
      ...(hh ? [h(Text, { color: "cyan" }, "[c] Cards  ")] : []),
      ...(trial ? [
        h(Text, { color: "green" }, "[R] Trial Reset  "),
        h(Text, { color: "red" }, "[E] Trial Expire  "),
        ...(trial.status !== "converted" ? [h(Text, { color: "yellow" }, "[K] Trial Convert  ")] : []),
        h(Text, { color: "red" }, "[X] Trial Delete  "),
      ] : []),
      h(Text, { color: "gray" }, "[Esc] Back")
    );
  }

  return h(Box, { flexDirection: "column", flexGrow: 1, paddingX: 2, paddingY: 1 },

    // ── Header ──
    h(Box, { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 1,
             borderStyle: "single", borderColor: "gray", paddingX: 1 },
      h(Text, { bold: true, color: "yellow" }, user.email),
      h(TierBadge, { tier: user.tier })
    ),

    // ── Identity ──
    h(SectionHeader, { title: "Identity" }),
    h(DetailField, { label: "User ID" },
      h(Text, { color: "cyan" }, user.id)   // never truncated
    ),
    h(DetailField, { label: "Email" },       h(Text, {}, user.email)),
    h(DetailField, { label: "Tier" },        h(TierBadge, { tier: user.tier })),
    h(DetailField, { label: "Role" },        h(Text, { color: user.role === "owner" ? "yellow" : "white" },
                                               user.role === "owner" ? "★ Owner" : user.role || "—")),
    h(DetailField, { label: "Joined" },      h(Text, {}, user.createdAt
      ? new Date(user.createdAt).toLocaleDateString()
      : "—"
    )),

    // ── Household ──
    h(SectionHeader, { title: "Household" }),
    detailLoading
      ? h(Text, { color: "gray", dimColor: true }, "  Loading…")
      : hh
        ? h(Box, { flexDirection: "column" },
            h(DetailField, { label: "Name" },
              h(Text, { color: "yellow" }, `${hh.name}  `)
            ),
            h(Text, { color: "gray", dimColor: true }, "                      [h] jump to household"),
            h(DetailField, { label: "Role" }, h(Text, {}, user.role === "owner" ? "★ Owner" : "Member"))
          )
        : h(Text, { color: "gray", dimColor: true }, "  No household (solo user)"),

    // ── Stripe Subscription ──
    ...(stripeData ? [
      h(SectionHeader, { title: "Stripe Subscription" }),
      h(DetailField, { label: "Sub ID" },     h(Text, { color: "cyan" }, stripeData.subId)),
      h(DetailField, { label: "Status" },     h(SubStatusBadge, { status: stripeData.status })),
      ...(stripeData.amount != null ? [
        h(DetailField, { label: "Amount" },
          h(Text, {}, `$${(stripeData.amount / 100).toFixed(2)} / ${stripeData.interval ?? "—"}`)
        ),
      ] : []),
      ...(stripeData.paymentMethod ? [
        h(DetailField, { label: "Payment" }, h(Text, {}, stripeData.paymentMethod)),
      ] : []),
    ] : []),

    // ── Cloud Sync ──
    h(SectionHeader, { title: "Cloud Sync" }),
    detailLoading
      ? h(Text, { color: "gray", dimColor: true }, "  Loading…")
      : sync
        ? h(Box, { flexDirection: "column" },
            h(DetailField, { label: "Last Sync" },
              h(Text, {}, sync.lastSync
                ? new Date(sync.lastSync).toLocaleString()
                : "never")
            ),
            h(DetailField, { label: "Total Syncs" }, h(Text, {}, String(sync.totalSyncs))),
            h(DetailField, { label: "Health" },      h(SyncHealthBadge, { health: sync.health }))
          )
        : h(Text, { color: "gray", dimColor: true }, "  N/A"),

    // ── Cards ──
    h(SectionHeader, { title: "Cards" }),
    detailLoading
      ? h(Text, { color: "gray", dimColor: true }, "  Loading…")
      : cards
        ? h(DetailField, { label: "Count" },
            h(Text, {},
              `${cards.active} active / ${cards.total} total`)
          )
        : h(Text, { color: "gray", dimColor: true }, "  N/A"),

    // ── Trial ──
    h(SectionHeader, { title: "Trial" }),
    detailLoading
      ? h(Text, { color: "gray", dimColor: true }, "  Loading…")
      : trial
        ? h(Box, { flexDirection: "column" },
            h(DetailField, { label: "Status" },
              h(TrialStatusBadge, { status: trial.status, remainingDays: trial.remainingDays })
            ),
            h(DetailField, { label: "Started" },
              h(Text, {}, new Date(trial.startDate).toLocaleDateString())
            ),
            ...(trial.convertedDate ? [
              h(DetailField, { label: "Converted" },
                h(Text, { color: "yellow" }, new Date(trial.convertedDate).toLocaleDateString())
              ),
            ] : []),
            h(DetailField, { label: "Fingerprint" },
              h(Text, { color: "cyan", dimColor: true },
                trial.fingerprint.slice(0, 8) + "…" + trial.fingerprint.slice(-8)
              )
            ),
          )
        : h(Text, { color: "gray", dimColor: true }, "  No trial found (not yet linked)"),

    // ── Actions ──
    actionArea,

    // ── Status message ──
    ...(statusMessage ? [
      h(Box, { marginTop: 1 },
        h(Text, { color: statusMessage.startsWith("Error") ? "red" : "green" }, statusMessage)
      ),
    ] : []),
  );
}

/** Full Users tab: left list + right detail panel with keyboard navigation. */
function UsersTab({ isActive, onJumpToHousehold, setInputCaptured }) {
  const LIST_HEIGHT = 18;

  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(null);
  const [selectedIdx, setSelectedIdx]   = useState(-1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [detail, setDetail]             = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mode, setMode]                 = useState("browse"); // browse | confirm-delete | prompt-tier | confirm-cancel-sub | confirm-trial-reset | confirm-trial-expire | confirm-trial-convert | confirm-trial-delete
  const [tierInput, setTierInput]       = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [cardView, setCardView]         = useState(false); // true = show CardDrilldownView
  const [cardContext, setCardContext]   = useState(null);  // { householdId, filterUserId, ownerEmail }

  // Load users on mount
  React.useEffect(() => {
    loadUsersWithTiers()
      .then((list) => { setUsers(list); })
      .catch((err) => setLoadError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);

  // Load detail when selection changes
  React.useEffect(() => {
    if (selectedIdx < 0 || !users[selectedIdx]) {
      setDetail(null);
      return;
    }
    const user = users[selectedIdx];
    setDetailLoading(true);
    setDetail(null);
    loadUserDetailData(user)
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  }, [selectedIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clear status message after 3s
  React.useEffect(() => {
    if (!statusMessage) return;
    const tid = setTimeout(() => setStatusMessage(""), 3000);
    return () => clearTimeout(tid);
  }, [statusMessage]);

  // ── Action helpers ──

  function doDeleteUser() {
    const user = users[selectedIdx];
    if (!user) return;
    (async () => {
      try {
        const db = getDb();
        if (user.householdId) {
          const hhSnap = await db.doc(`households/${user.householdId}`).get();
          if (hhSnap.exists) {
            const h = hhSnap.data();
            const newMembers = (h.memberIds || []).filter((id) => id !== user.id);
            await db.doc(`households/${user.householdId}`).update({
              memberIds: newMembers,
              updatedAt: new Date().toISOString(),
            });
          }
        }
        await db.doc(`users/${user.id}`).delete();
        setUsers((prev) => prev.filter((_, i) => i !== selectedIdx));
        setSelectedIdx(-1);
        setDetail(null);
        setStatusMessage(`Deleted ${user.email}`);
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  function doUpdateTier(newTier) {
    const user = users[selectedIdx];
    if (!user) return;
    if (!user.householdId) {
      setStatusMessage("Cannot update tier: user has no household");
      return;
    }
    (async () => {
      try {
        await getDb().doc(`households/${user.householdId}`).update({
          tier: newTier,
          updatedAt: new Date().toISOString(),
        });
        setUsers((prev) =>
          prev.map((u, i) => i === selectedIdx ? { ...u, tier: newTier } : u)
        );
        setStatusMessage(`Tier updated to ${newTier}`);
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  function doCancelSub() {
    const subId = detail?.stripe?.subId;
    if (!subId) return;
    (async () => {
      try {
        const result = await stripe("DELETE", `/subscriptions/${subId}`);
        if (result) {
          setDetail((d) => d ? { ...d, stripe: { ...d.stripe, status: "canceled" } } : d);
          setStatusMessage("Subscription cancelled");
        }
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  function doTrialReset() {
    const fp = detail?.trial?.fingerprint;
    if (!fp) return;
    (async () => {
      try {
        const updated = { startDate: new Date().toISOString() };
        await redis.set(`trial:${fp}`, JSON.stringify(updated), "EX", TRIAL_TTL_SECONDS);
        const s = computeStatus(updated);
        setDetail((d) => d ? { ...d, trial: { ...d.trial, ...updated, ...s } } : d);
        setStatusMessage(`Trial reset — ${TRIAL_DURATION_DAYS}d remaining`);
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  function doTrialExpire() {
    const fp = detail?.trial?.fingerprint;
    if (!fp) return;
    (async () => {
      try {
        const expired = new Date(Date.now() - 31 * 86400000).toISOString();
        const raw = await redis.get(`trial:${fp}`);
        const existing = raw ? JSON.parse(raw) : {};
        const updated = { ...existing, startDate: expired };
        delete updated.convertedDate;
        await redis.set(`trial:${fp}`, JSON.stringify(updated), "EX", TRIAL_TTL_SECONDS);
        const s = computeStatus(updated);
        setDetail((d) => d ? { ...d, trial: { ...d.trial, ...updated, ...s } } : d);
        setStatusMessage("Trial force-expired");
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  function doTrialConvert() {
    const fp = detail?.trial?.fingerprint;
    if (!fp) return;
    (async () => {
      try {
        const raw = await redis.get(`trial:${fp}`);
        const existing = raw ? JSON.parse(raw) : {};
        const updated = { ...existing, convertedDate: new Date().toISOString() };
        await redis.set(`trial:${fp}`, JSON.stringify(updated), "EX", TRIAL_TTL_SECONDS);
        const s = computeStatus(updated);
        setDetail((d) => d ? { ...d, trial: { ...d.trial, ...updated, ...s } } : d);
        setStatusMessage("Trial marked as converted");
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  function doTrialDelete() {
    const fp = detail?.trial?.fingerprint;
    if (!fp) return;
    (async () => {
      try {
        await redis.del(`trial:${fp}`);
        setDetail((d) => d ? { ...d, trial: null } : d);
        setStatusMessage("Trial deleted");
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  // ── Keyboard input ──

  useInput((input, key) => {
    // ── Text input mode (tier prompt) ──
    if (mode === "prompt-tier") {
      if (key.return) {
        const tier = tierInput.trim().toLowerCase();
        if (["karl", "trial", "thrall"].includes(tier)) {
          doUpdateTier(tier);
        } else {
          setStatusMessage("Invalid tier. Must be: karl, trial, or thrall");
        }
        setTierInput("");
        setMode("browse");
        setInputCaptured(false);
      } else if (key.escape) {
        setTierInput("");
        setMode("browse");
        setInputCaptured(false);
        setStatusMessage("Tier update cancelled");
      } else if (key.backspace || key.delete) {
        setTierInput((t) => t.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && input.length === 1) {
        setTierInput((t) => t + input);
      }
      return;
    }

    // ── Confirmation modes ──
    if (mode === "confirm-delete") {
      if (input === "y" || input === "Y") {
        doDeleteUser();
      } else {
        setStatusMessage("Delete cancelled");
      }
      setMode("browse");
      return;
    }
    if (mode === "confirm-cancel-sub") {
      if (input === "y" || input === "Y") {
        doCancelSub();
      } else {
        setStatusMessage("Cancelled");
      }
      setMode("browse");
      return;
    }
    if (mode === "confirm-trial-reset") {
      if (input === "y" || input === "Y") doTrialReset(); else setStatusMessage("Cancelled");
      setMode("browse");
      return;
    }
    if (mode === "confirm-trial-expire") {
      if (input === "y" || input === "Y") doTrialExpire(); else setStatusMessage("Cancelled");
      setMode("browse");
      return;
    }
    if (mode === "confirm-trial-convert") {
      if (input === "y" || input === "Y") doTrialConvert(); else setStatusMessage("Cancelled");
      setMode("browse");
      return;
    }
    if (mode === "confirm-trial-delete") {
      if (input === "y" || input === "Y") doTrialDelete(); else setStatusMessage("Cancelled");
      setMode("browse");
      return;
    }

    // ── Browse mode navigation ──
    if (key.upArrow) {
      const newIdx = Math.max(0, selectedIdx <= 0 ? 0 : selectedIdx - 1);
      setSelectedIdx(newIdx);
      if (newIdx < scrollOffset) setScrollOffset(newIdx);
      return;
    }
    if (key.downArrow) {
      const maxIdx = users.length - 1;
      const newIdx = selectedIdx < 0 ? 0 : Math.min(maxIdx, selectedIdx + 1);
      setSelectedIdx(newIdx);
      if (newIdx >= scrollOffset + LIST_HEIGHT) setScrollOffset(newIdx - LIST_HEIGHT + 1);
      return;
    }
    if (key.return) {
      if (selectedIdx < 0 && users.length > 0) setSelectedIdx(0);
      return;
    }
    if (key.escape) {
      setSelectedIdx(-1);
      setMode("browse");
      return;
    }

    // ── Action shortcuts (only when a user is selected) ──
    if (selectedIdx < 0) return;

    if (input === "d") {
      setMode("confirm-delete");
      return;
    }
    if (input === "t") {
      setMode("prompt-tier");
      setInputCaptured(true);
      return;
    }
    if (input === "s" && detail?.stripe) {
      setMode("confirm-cancel-sub");
      return;
    }
    if (input === "h" && detail?.household) {
      onJumpToHousehold(detail.household.id);
      return;
    }
    if (input === "c" && detail?.household) {
      const u = users[selectedIdx];
      setCardContext({ householdId: u.householdId, filterUserId: u.id, ownerEmail: u.email });
      setCardView(true);
      return;
    }
    if ((input === "R") && detail?.trial) {
      setMode("confirm-trial-reset");
      return;
    }
    if ((input === "E") && detail?.trial) {
      setMode("confirm-trial-expire");
      return;
    }
    if ((input === "K") && detail?.trial && detail.trial.status !== "converted") {
      setMode("confirm-trial-convert");
      return;
    }
    if ((input === "X") && detail?.trial) {
      setMode("confirm-trial-delete");
      return;
    }
  }, { isActive });

  // ── Render ──

  // Card drill-down takes over when active
  if (cardView && cardContext) {
    return h(CardDrilldownView, {
      householdId: cardContext.householdId,
      filterUserId: cardContext.filterUserId,
      ownerEmail: cardContext.ownerEmail,
      onBack: () => setCardView(false),
      setInputCaptured,
    });
  }

  const selectedUser = selectedIdx >= 0 ? users[selectedIdx] : null;
  const visibleUsers = users.slice(scrollOffset, scrollOffset + LIST_HEIGHT);
  const canScrollUp   = scrollOffset > 0;
  const canScrollDown = scrollOffset + LIST_HEIGHT < users.length;

  return h(Box, { flexDirection: "row", flexGrow: 1 },

    // ── Left panel: user list ──
    h(Box, {
      flexDirection: "column",
      width: 36,
      borderStyle: "single",
      borderColor: selectedIdx >= 0 ? "gray" : "yellow",
      flexShrink: 0,
    },
      h(Box, { paddingX: 1, borderStyle: "single", borderColor: "gray" },
        h(Text, { bold: true, color: "yellow" },
          loading ? "Users (loading…)" :
          loadError ? "Users (error)" :
          `Users (${users.length})`
        )
      ),
      canScrollUp && h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "↑ more"),
      loading
        ? h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "Loading…")
        : loadError
          ? h(Text, { color: "red", paddingX: 2 }, `Error: ${loadError}`)
          : users.length === 0
            ? h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "No users found")
            : visibleUsers.map((u, i) =>
                h(UserListRow, {
                  key: u.id,
                  user: u,
                  selected: scrollOffset + i === selectedIdx,
                })
              ),
      canScrollDown && h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "↓ more"),
      h(Box, { flexGrow: 1 }),
      h(Text, { color: "gray", dimColor: true, paddingX: 1 },
        "↑/↓ nav  Enter select  Esc back"
      )
    ),

    // ── Right panel: user detail or empty state ──
    selectedUser
      ? h(UserDetailPanel, {
          user: selectedUser,
          detail,
          detailLoading,
          mode,
          tierInput,
          statusMessage,
        })
      : h(Box, {
          flexGrow: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        },
          h(Text, { color: "yellow", dimColor: true }, "ᚱ"),
          h(Text, { color: "gray" }, "Select a user from the list"),
          h(Text, { color: "gray", dimColor: true }, "↑/↓ navigate   Enter select")
        )
  );
}

// ── Ink TUI ──────────────────────────────────────────────────────────────────

const TUI_TABS = ["Users", "Households"];

// ── Households Tab helpers ────────────────────────────────────────────────────

/** Derive entitlements from tier. */
function getEntitlements(tier) {
  return {
    cloudSync: tier === "karl" || tier === "trial",
    priorityHowl: tier === "karl",
    analytics: tier === "karl",
    hiddenRunes: tier === "karl",
  };
}

/** Format a date string short (Month D, YYYY). */
function fmtDateShort(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return String(d); }
}

/** Format a datetime (Mon D HH:MM). */
function fmtDatetimeShort(d) {
  if (!d) return "never";
  try {
    const dt = new Date(d);
    return (
      dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " +
      dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  } catch { return String(d); }
}

// ── HouseholdsTab ─────────────────────────────────────────────────────────────

/**
 * Renders a labelled detail row: "Label:          value"
 */
function HDetailRow({ label, value, valueColor }) {
  return h(Box, { flexDirection: "row" },
    h(Text, { color: "gray" }, (label + ":").padEnd(18)),
    h(Text, { color: valueColor || "white" }, value ?? "—")
  );
}

/**
 * A section heading with a dim separator line.
 */
function HSectionTitle({ children }) {
  return h(Box, { marginTop: 1 },
    h(Text, { color: "yellow", bold: true, dimColor: true }, `── ${children} `)
  );
}

/**
 * Renders the full household detail inside the right panel.
 */
function HouseholdDetailView({ detail, confirmState }) {
  const { hh, members, cardCounts } = detail;
  const ownerId = hh.ownerId || "";
  const ent = getEntitlements(hh.tier);
  const tierLabel = hh.tier === "karl" ? "karl ★" : hh.tier === "trial" ? "trial" : "free";
  const tierColor = hh.tier === "karl" ? "yellow" : hh.tier === "trial" ? "cyan" : "gray";
  const inviteExpired = hh.inviteCodeExpiresAt && new Date(hh.inviteCodeExpiresAt) < new Date();

  return h(Box, { flexDirection: "column", flexGrow: 1 },
    // ── Header ──
    h(Box, { flexDirection: "row", marginBottom: 1 },
      h(Text, { color: "yellow", bold: true }, (hh.name || "unnamed").substring(0, 40)),
      h(Text, null, "  "),
      h(Text, { color: tierColor, bold: true }, `[${tierLabel}]`)
    ),

    // ── Household Info ──
    h(HSectionTitle, null, "Household Info"),
    h(HDetailRow, { label: "ID", value: shortId(hh.id || ""), valueColor: "cyan" }),
    h(Box, { flexDirection: "row" },
      h(Text, { color: "gray" }, "Invite Code:      "),
      h(Text, { color: inviteExpired ? "red" : "green" }, hh.inviteCode || "—"),
      h(Text, { color: "gray" }, inviteExpired ? " (expired)" : " (valid)")
    ),
    h(Box, { flexDirection: "row" },
      h(Text, { color: "gray" }, "Owner:            "),
      h(Text, { color: "yellow" }, "★ "),
      h(Text, null, members.find(m => m.id === ownerId)?.email || shortId(ownerId || "—"))
    ),
    h(HDetailRow, { label: "Tier", value: tierLabel, valueColor: tierColor }),

    // ── Members ──
    h(HSectionTitle, null, `Members (${members.length})`),
    h(Box, { flexDirection: "row" },
      h(Text, { color: "gray" }, "   "),
      h(Text, { color: "gray" }, "Email".padEnd(32)),
      h(Text, { color: "gray" }, "Role".padEnd(10)),
      h(Text, { color: "gray" }, "Cards".padEnd(6)),
      h(Text, { color: "gray" }, "Joined")
    ),
    ...members.map(m =>
      h(Box, { key: m.id, flexDirection: "row" },
        h(Text, { color: "yellow" }, m.id === ownerId ? "★  " : "   "),
        h(Text, null, (m.email || shortId(m.id)).substring(0, 31).padEnd(32)),
        h(Text, { color: "gray" }, (m.role || "member").padEnd(10)),
        h(Text, null, String(m.cardCount || 0).padEnd(6)),
        h(Text, { color: "gray" }, m.joinedDate ? fmtDateShort(m.joinedDate) : fmtDateShort(m.createdAt))
      )
    ),

    // ── Entitlements ──
    h(HSectionTitle, null, "Entitlements"),
    h(Box, { flexDirection: "row" },
      h(Text, { color: ent.cloudSync ? "green" : "gray" }, (ent.cloudSync ? "✓" : "✗") + " Cloud Sync       "),
      h(Text, { color: ent.priorityHowl ? "green" : "gray" }, (ent.priorityHowl ? "✓" : "✗") + " Priority Howl")
    ),
    h(Box, { flexDirection: "row" },
      h(Text, { color: ent.analytics ? "green" : "gray" }, (ent.analytics ? "✓" : "✗") + " Analytics        "),
      h(Text, { color: ent.hiddenRunes ? "green" : "gray" }, (ent.hiddenRunes ? "✓" : "✗") + " Hidden Runes")
    ),

    // ── Stripe Subscription (karl only) ──
    ...(hh.tier === "karl" ? [
      h(HSectionTitle, null, "Stripe Subscription"),
      h(HDetailRow, { label: "Sub ID", value: hh.stripeSubId ? shortId(hh.stripeSubId) : "—", valueColor: "cyan" }),
      h(HDetailRow, { label: "Status",
        value: hh.subStatus || "—",
        valueColor: hh.subStatus === "active" ? "green" : hh.subStatus === "past_due" ? "yellow" : "red",
      }),
      ...(hh.subAmount ? [h(HDetailRow, { label: "Amount", value: `$${(hh.subAmount / 100).toFixed(2)} / ${hh.subPeriod || "mo"}` })] : []),
    ] : []),

    // ── Cloud Sync ──
    h(HSectionTitle, null, "Cloud Sync"),
    h(HDetailRow, { label: "Last Sync", value: fmtDatetimeShort(hh.lastSync) }),
    h(HDetailRow, { label: "Sync Count", value: String(hh.syncCount != null ? hh.syncCount : "—") }),
    h(HDetailRow, {
      label: "Health",
      value: hh.syncHealth || "N/A",
      valueColor: hh.syncHealth === "healthy" ? "green" : hh.syncHealth === "degraded" ? "yellow" : "gray",
    }),

    // ── Card Summary ──
    h(HSectionTitle, null, "Card Summary"),
    h(Box, { flexDirection: "row" },
      h(Text, null, `Total: ${cardCounts.total}  `),
      h(Text, { color: "green" }, `Active: ${cardCounts.active}  `),
      h(Text, { color: "yellow" }, `Attention: ${cardCounts.feeApproaching + cardCounts.promo}  `),
      h(Text, { color: "gray" }, `Closed: ${cardCounts.closed}`)
    ),

    // ── Action shortcuts ──
    h(Box, { marginTop: 1, flexDirection: "row" },
      h(Text, { color: "cyan" }, "[k]"), h(Text, { color: "gray" }, " Kick  "),
      h(Text, { color: "cyan" }, "[o]"), h(Text, { color: "gray" }, " Xfer owner  "),
      h(Text, { color: "cyan" }, "[i]"), h(Text, { color: "gray" }, " Regen invite  "),
      h(Text, { color: "cyan" }, "[c]"), h(Text, { color: "gray" }, " Cards  "),
      ...(hh.tier === "karl" ? [
        h(Text, { color: "cyan" }, "[s]"), h(Text, { color: "gray" }, " Cancel sub  "),
      ] : []),
      h(Text, { color: "red" }, "[x]"), h(Text, { color: "gray" }, " Delete HH")
    ),

    // ── Confirmation bar ──
    ...(confirmState ? [
      h(Box, { marginTop: 1, borderStyle: "single", borderColor: "yellow", paddingX: 1, flexDirection: "row" },
        h(Text, { color: "yellow" }, "⚠  "),
        h(Text, { color: "white" }, confirmState.message),
        h(Text, { color: "cyan" },
          confirmState.onConfirm != null ? "  [y] Confirm  [n/Esc] Cancel" : "  [n/Esc] Close"
        )
      ),
    ] : [])
  );
}

/**
 * Full Households master-detail tab.
 * Manages its own async state (list + detail) and keyboard input.
 */
function HouseholdsTab({ setInputCaptured = () => {} }) {
  const [listState, setListState] = useState({ items: [], loading: false, loaded: false, error: null });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [detail, setDetail] = useState({ data: null, loading: false, error: null });
  const [confirmState, setConfirmState] = useState(null);
  const [cardView, setCardView]       = useState(false);
  const [cardContext, setCardContext] = useState(null); // { householdId, filterUserId, ownerEmail }

  // ── Load household list ──
  useEffect(() => {
    if (listState.loaded || listState.loading) return;
    setListState(s => ({ ...s, loading: true }));
    getDb()
      .collection("households")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get()
      .then(snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setListState({ items, loading: false, loaded: true, error: null });
      })
      .catch(err => {
        setListState({ items: [], loading: false, loaded: true, error: err.message });
      });
  }, [listState.loaded, listState.loading]);

  // ── Load detail when selectedIdx changes ──
  useEffect(() => {
    if (!listState.loaded || listState.items.length === 0) return;
    const hh = listState.items[selectedIdx];
    if (!hh) return;
    setDetail({ data: null, loading: true, error: null });
    const db = getDb();
    Promise.all([
      db.doc(`households/${hh.id}`).get(),
      db.collection(`households/${hh.id}/cards`).get(),
    ])
      .then(async ([hhSnap, cardsSnap]) => {
        if (!hhSnap.exists) throw new Error("Household not found");
        const hhData = { id: hhSnap.id, ...hhSnap.data() };
        const memberIds = hhData.memberIds || [];

        // Load member user docs in parallel
        const memberDocs = await Promise.all(
          memberIds.map(uid => db.doc(`users/${uid}`).get().catch(() => null))
        );
        const members = memberDocs
          .filter(Boolean)
          .map(snap => (snap.exists ? { id: snap.id, ...snap.data() } : null))
          .filter(Boolean);

        // Card counts by status (non-deleted)
        const cards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const live = cards.filter(c => !c.deletedAt);

        // Per-member card counts (if cards have userId field)
        const cardsByUser = {};
        for (const c of live) {
          if (c.userId) cardsByUser[c.userId] = (cardsByUser[c.userId] || 0) + 1;
        }
        const membersWithCards = members.map(m => ({
          ...m,
          cardCount: cardsByUser[m.id] != null ? cardsByUser[m.id] : null,
        }));

        setDetail({
          data: {
            hh: hhData,
            members: membersWithCards,
            cardCounts: {
              total: live.length,
              active: live.filter(c => c.status === "active").length,
              feeApproaching: live.filter(c => c.status === "fee_approaching").length,
              promo: live.filter(c => c.status === "promo_expiring").length,
              closed: live.filter(c => c.status === "closed").length,
            },
          },
          loading: false,
          error: null,
        });
      })
      .catch(err => {
        setDetail({ data: null, loading: false, error: err.message });
      });
  }, [selectedIdx, listState.loaded, listState.items]);

  // ── Keyboard input ──
  useInput(useCallback((input, key) => {
    // Confirmation flow: y confirms, n/Escape cancels
    if (confirmState) {
      if (input === "y" || input === "Y") {
        const fn = confirmState.onConfirm;
        setConfirmState(null);
        if (fn) fn();
      } else if (input === "n" || input === "N" || key.escape) {
        setConfirmState(null);
      }
      return;
    }

    // ^R — reload list
    if (key.ctrl && input === "r") {
      setListState({ items: [], loading: false, loaded: false, error: null });
      setDetail({ data: null, loading: false, error: null });
      return;
    }

    // List navigation
    if (key.upArrow) {
      setSelectedIdx(i => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIdx(i => Math.min(listState.items.length - 1, i + 1));
      return;
    }

    // Action shortcuts — only when detail is loaded
    if (!detail.data) return;
    const hh = detail.data.hh;
    const members = detail.data.members;

    if (input === "i") {
      // Regen invite code
      setConfirmState({
        message: `Regen invite code for "${hh.name || "this household"}"?`,
        onConfirm: () => {
          const code = generateInviteCode();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          getDb().doc(`households/${hh.id}`).update({
            inviteCode: code,
            inviteCodeExpiresAt: expiresAt,
            updatedAt: new Date().toISOString(),
          }).then(() => {
            // Reload detail
            setListState(s => ({ ...s, loaded: false }));
          }).catch(() => {});
        },
      });
      return;
    }

    if (input === "s" && hh.tier === "karl") {
      // Cancel Stripe subscription
      const subId = hh.stripeSubId;
      if (!subId) return;
      setConfirmState({
        message: `Cancel Stripe sub ${shortId(subId)} for "${hh.name}"?`,
        onConfirm: () => {
          stripe("DELETE", `/subscriptions/${subId}`).catch(() => {});
        },
      });
      return;
    }

    if (input === "x") {
      // Delete household
      setConfirmState({
        message: `DELETE household "${hh.name}" + all cards? PERMANENT.`,
        onConfirm: () => {
          const db = getDb();
          db.collection(`households/${hh.id}/cards`).get().then(snap => {
            const batch = db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            batch.delete(db.doc(`households/${hh.id}`));
            return batch.commit();
          }).then(() => {
            setListState({ items: [], loading: false, loaded: false, error: null });
            setDetail({ data: null, loading: false, error: null });
            setSelectedIdx(0);
          }).catch(() => {});
        },
      });
      return;
    }

    if (input === "k") {
      // Kick member — member selection not yet in TUI; prompt REPL fallback
      const memberList = members
        .filter(m => m.id !== hh.ownerId)
        .map(m => m.email || shortId(m.id))
        .join(", ") || "(no non-owner members)";
      setConfirmState({
        message: `Kick member: ${memberList}. Use REPL delete-member for now.`,
        onConfirm: null,
      });
      return;
    }

    if (input === "o") {
      // Transfer owner — member selection not yet in TUI; prompt REPL fallback
      const memberList = members
        .filter(m => m.id !== hh.ownerId)
        .map(m => m.email || shortId(m.id))
        .join(", ") || "(no other members)";
      setConfirmState({
        message: `Transfer owner. Candidates: ${memberList}. Use REPL update-owner for now.`,
        onConfirm: null,
      });
      return;
    }

    if (input === "c") {
      setCardContext({ householdId: hh.id, filterUserId: null, ownerEmail: hh.name || shortId(hh.id) });
      setCardView(true);
      return;
    }
  }, [confirmState, listState.items, detail.data]));

  // ── Render ──

  // Card drill-down takes over when active
  if (cardView && cardContext) {
    return h(CardDrilldownView, {
      householdId: cardContext.householdId,
      filterUserId: cardContext.filterUserId,
      ownerEmail: cardContext.ownerEmail,
      onBack: () => setCardView(false),
      setInputCaptured,
    });
  }

  const { items, loading: listLoading, loaded, error: listError } = listState;

  // Scrollable window for the list
  const LIST_WINDOW = 20;
  const winStart = Math.max(0, Math.min(selectedIdx - Math.floor(LIST_WINDOW / 2), items.length - LIST_WINDOW));
  const visibleItems = items.slice(winStart, winStart + LIST_WINDOW);

  return h(Box, { flexDirection: "row", flexGrow: 1 },
    // ── Left panel: household list ──
    h(Box, {
      flexDirection: "column",
      width: 34,
      borderStyle: "single",
      borderColor: "gray",
      flexShrink: 0,
      paddingX: 1,
      paddingY: 1,
    },
      h(Text, { bold: true, color: "yellow" }, "Households"),
      loaded && !listError
        ? h(Text, { color: "gray", dimColor: true }, `${items.length} total`)
        : null,
      h(Box, { flexDirection: "column", marginTop: 1 },
        listLoading
          ? h(Text, { color: "gray", dimColor: true }, "Loading…")
          : listError
          ? h(Text, { color: "red" }, `Error: ${listError}`)
          : items.length === 0
          ? h(Text, { color: "gray", dimColor: true }, "No households found")
          : visibleItems.map((hh, vi) => {
              const idx = winStart + vi;
              const isSel = idx === selectedIdx;
              const memberCount = (hh.memberIds || []).length;
              const tierColor = hh.tier === "karl" ? "yellow" : hh.tier === "trial" ? "cyan" : "gray";
              return h(Box, {
                key: hh.id,
                flexDirection: "column",
                backgroundColor: isSel ? "gray" : undefined,
                paddingX: isSel ? 1 : 0,
                marginBottom: 0,
              },
                h(Box, { flexDirection: "row" },
                  h(Text, {
                    color: isSel ? "black" : "white",
                    bold: isSel,
                  }, (hh.name || "unnamed").substring(0, 19)),
                  h(Box, { flexGrow: 1 }),
                  h(Text, { color: isSel ? "black" : tierColor, bold: true },
                    hh.tier === "karl" ? "K" : hh.tier === "trial" ? "T" : "F"
                  )
                ),
                h(Text, {
                  color: isSel ? "black" : "gray",
                  dimColor: !isSel,
                }, `${memberCount} member${memberCount !== 1 ? "s" : ""}`)
              );
            })
      )
    ),

    // ── Right panel: detail ──
    h(Box, {
      flexDirection: "column",
      flexGrow: 1,
      borderStyle: "single",
      borderColor: "gray",
      paddingX: 2,
      paddingY: 1,
      overflow: "hidden",
    },
      detail.loading
        ? h(Box, { flexGrow: 1, justifyContent: "center", alignItems: "center" },
            h(Text, { color: "gray", dimColor: true }, "Loading household…")
          )
        : detail.error
        ? h(Box, { flexGrow: 1, justifyContent: "center", alignItems: "center" },
            h(Text, { color: "red" }, `Error: ${detail.error}`)
          )
        : !detail.data
        ? h(Box, { flexGrow: 1, justifyContent: "center", alignItems: "center", flexDirection: "column" },
            h(Text, { color: "gray", dimColor: true }, "Select a household ↑↓"),
            h(Text, { color: "gray", dimColor: true }, "Enter to drill down")
          )
        : h(HouseholdDetailView, { detail: detail.data, confirmState })
    )
  );
}

// ── Card drill-down helpers ───────────────────────────────────────────────────

/** Status dot + color for each card status value. */
const CARD_STATUS_DOT = {
  active:          { dot: "●", color: "green"  },
  fee_approaching: { dot: "◐", color: "yellow" },
  promo_expiring:  { dot: "◐", color: "yellow" },
  closed:          { dot: "○", color: "gray"   },
};

/** Norse realm name mapped from card status. */
const CARD_STATUS_REALM = {
  active:          "Midgard",
  fee_approaching: "Muspelheim",
  promo_expiring:  "Niflheim",
  closed:          "Helheim",
};

/** Fetch all cards for a household (including soft-deleted). */
async function loadCardsForHousehold(householdId) {
  const snap = await getDb().collection(`households/${householdId}/cards`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** ASCII spend-progress bar. */
function SpendProgressBar({ spend, goal }) {
  const raw = goal > 0 ? Math.min(1, (spend || 0) / goal) : 0;
  const BAR_WIDTH = 28;
  const filled = Math.round(raw * BAR_WIDTH);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const color = raw >= 1 ? "green" : raw >= 0.5 ? "yellow" : "white";
  return h(Box, { flexDirection: "column", paddingLeft: 2 },
    h(Box, { flexDirection: "row" },
      h(Text, { color }, bar),
      h(Text, { color: "gray" }, `  ${Math.round(raw * 100)}%`)
    ),
    h(Text, { color: "gray", dimColor: true },
      `$${(spend || 0).toLocaleString()} / $${(goal || 0).toLocaleString()}`
    )
  );
}

/** A single row in the card list left-panel. */
function CardListRow({ card, selected }) {
  const s = CARD_STATUS_DOT[card.status] || { dot: "○", color: "gray" };
  const isDeleted = !!card.deletedAt;
  return h(Box, {
    flexDirection: "row",
    paddingX: 1,
    backgroundColor: selected ? "gray" : undefined,
  },
    h(Text, { color: selected ? "black" : s.color }, `${s.dot} `),
    h(Text, {
      color: selected ? "black" : isDeleted ? "gray" : "white",
      dimColor: isDeleted && !selected,
    }, (card.name || "Unknown").substring(0, 22).padEnd(22)),
    ...(isDeleted ? [
      h(Text, { color: selected ? "black" : "gray", dimColor: !selected }, " DEL"),
    ] : [])
  );
}

/** Card detail right-panel. Shows all card fields and action shortcuts. */
function CardDetailPanel({ card, householdId, ownerEmail, onBack, onCardUpdated, setInputCaptured }) {
  const [mode, setMode]                 = useState("browse");
  const [expungeInput, setExpungeInput] = useState("");
  const [statusMsg, setStatusMsg]       = useState("");

  React.useEffect(() => {
    if (!statusMsg) return;
    const tid = setTimeout(() => setStatusMsg(""), 3000);
    return () => clearTimeout(tid);
  }, [statusMsg]);

  useInput((input, key) => {
    // ── Type 'delete' to confirm expunge ──
    if (mode === "expunge-input") {
      if (key.return) {
        if (expungeInput === "delete") {
          doExpunge();
        } else {
          setStatusMsg("Aborted: must type exactly 'delete'");
        }
        setExpungeInput("");
        setMode("browse");
        setInputCaptured?.(false);
      } else if (key.escape) {
        setExpungeInput("");
        setMode("browse");
        setInputCaptured?.(false);
        setStatusMsg("Expunge cancelled");
      } else if (key.backspace || key.delete) {
        setExpungeInput((t) => t.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && input.length === 1) {
        setExpungeInput((t) => t + input);
      }
      return;
    }
    // ── y/n confirmation modes ──
    if (mode === "confirm-delete") {
      if (input === "y" || input === "Y") doDelete();
      else setStatusMsg("Delete cancelled");
      setMode("browse");
      return;
    }
    if (mode === "confirm-restore") {
      if (input === "y" || input === "Y") doRestore();
      else setStatusMsg("Restore cancelled");
      setMode("browse");
      return;
    }
    if (mode === "confirm-expunge") {
      if (input === "y" || input === "Y") {
        setMode("expunge-input");
        setInputCaptured?.(true);
      } else {
        setStatusMsg("Expunge cancelled");
        setMode("browse");
      }
      return;
    }
    // ── Browse mode ──
    if (key.escape) { onBack(); return; }
    if (input === "d" && !card.deletedAt) { setMode("confirm-delete"); return; }
    if (input === "r" && card.deletedAt)  { setMode("confirm-restore"); return; }
    if (input === "x")                    { setMode("confirm-expunge"); return; }
  });

  function doDelete() {
    (async () => {
      try {
        await getDb().doc(`households/${householdId}/cards/${card.id}`).update({
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setStatusMsg(`Deleted: ${card.name}`);
        onCardUpdated();
      } catch (err) { setStatusMsg(`Error: ${err.message}`); }
    })();
  }

  function doRestore() {
    (async () => {
      try {
        await getDb().doc(`households/${householdId}/cards/${card.id}`).update({
          deletedAt: FieldValue.delete(),
          status: "active",
          updatedAt: new Date().toISOString(),
        });
        setStatusMsg(`Restored: ${card.name}`);
        onCardUpdated();
      } catch (err) { setStatusMsg(`Error: ${err.message}`); }
    })();
  }

  function doExpunge() {
    (async () => {
      try {
        await getDb().doc(`households/${householdId}/cards/${card.id}`).delete();
        setStatusMsg(`Expunged: ${card.name}`);
        onCardUpdated();
      } catch (err) { setStatusMsg(`Error: ${err.message}`); }
    })();
  }

  const status    = card.status || "active";
  const statusDot = CARD_STATUS_DOT[status] || { dot: "○", color: "gray" };
  const realm     = CARD_STATUS_REALM[status] || "Unknown";
  const isDeleted = !!card.deletedAt;
  const spend     = card.spend ?? card.spendAmount ?? 0;
  const spendGoal = card.spendGoal ?? card.bonusSpendGoal ?? 0;

  // ── Action bar ──
  let actionArea;
  if (mode === "confirm-delete") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "red" }, `Delete "${card.name}"? `),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[any] Cancel")
    );
  } else if (mode === "confirm-restore") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "yellow", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "yellow" }, `Restore "${card.name}" to active? `),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[any] Cancel")
    );
  } else if (mode === "confirm-expunge") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "red", bold: true }, "EXPUNGE permanently? "),
      h(Text, { color: "yellow" }, "[y] Type confirm  "),
      h(Text, { color: "gray" }, "[any] Cancel")
    );
  } else if (mode === "expunge-input") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "red" }, "Type 'delete' to confirm expunge: "),
      h(Text, { color: "white", bold: true }, expungeInput),
      h(Text, { color: "gray" }, "█  [Enter] Confirm  [Esc] Cancel")
    );
  } else {
    actionArea = h(Box, {
      flexDirection: "row", flexWrap: "wrap",
      borderStyle: "single", borderColor: "gray",
      paddingX: 1, marginTop: 1,
    },
      ...(!isDeleted ? [h(Text, { color: "red" }, "[d] Delete  ")] : []),
      ...(isDeleted  ? [h(Text, { color: "yellow" }, "[r] Restore  ")] : []),
      h(Text, { color: "red" }, "[x] Expunge  "),
      h(Text, { color: "gray" }, "[Esc] Back")
    );
  }

  return h(Box, { flexDirection: "column", flexGrow: 1, paddingX: 2, paddingY: 1 },
    // ── Breadcrumb ──
    h(Box, { flexDirection: "row", marginBottom: 1 },
      h(Text, { color: "gray", dimColor: true }, "← "),
      h(Text, { color: "cyan" }, ownerEmail || "User"),
      h(Text, { color: "gray", dimColor: true }, " / Cards / "),
      h(Text, { color: "yellow" }, card.name || "Card")
    ),
    // ── Header ──
    h(Box, { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 1,
             borderStyle: "single", borderColor: "gray", paddingX: 1 },
      h(Text, { bold: true, color: "yellow" }, card.name || "Unknown Card"),
      h(Text, { color: statusDot.color }, `  ${statusDot.dot}`),
      ...(isDeleted ? [h(Text, { color: "red" }, " [DELETED]")] : [])
    ),
    // ── Card Info ──
    h(SectionHeader, { title: "Card Info" }),
    h(DetailField, { label: "Issuer" },
      h(Text, {}, card.issuer || "—")
    ),
    h(DetailField, { label: "Credit Limit" },
      h(Text, { color: "cyan" }, card.creditLimit ? `$${Number(card.creditLimit).toLocaleString()}` : "—")
    ),
    h(DetailField, { label: "Annual Fee" },
      h(Text, {}, card.annualFee ? `$${card.annualFee}` : "None")
    ),
    h(DetailField, { label: "Fee Due" },
      h(Text, { color: card.feeDue ? "yellow" : "gray" }, fmtDateShort(card.feeDue))
    ),
    h(DetailField, { label: "Opened" },
      h(Text, {}, fmtDateShort(card.openedDate ?? card.opened))
    ),
    h(DetailField, { label: "Status" },
      h(Box, { flexDirection: "row" },
        h(Text, { color: statusDot.color }, `${statusDot.dot} `),
        h(Text, {}, status.replace(/_/g, " ")),
        h(Text, { color: "yellow" }, `  — ${realm}`)
      )
    ),
    // ── Bonus ──
    h(SectionHeader, { title: "Bonus" }),
    h(DetailField, { label: "Status" },
      card.bonusMet !== undefined
        ? h(Text, { color: card.bonusMet ? "green" : "yellow" }, card.bonusMet ? "✓ Met" : "◎ In Progress")
        : h(Text, { color: "gray", dimColor: true }, "—")
    ),
    ...(card.bonusAmount ? [
      h(DetailField, { label: "Bonus Amount" },
        h(Text, { color: "yellow" }, `$${Number(card.bonusAmount).toLocaleString()}`)
      ),
    ] : []),
    ...(card.bonusDeadline ? [
      h(DetailField, { label: "Deadline" },
        h(Text, { color: "yellow" }, fmtDateShort(card.bonusDeadline))
      ),
    ] : []),
    // ── Spend Progress ──
    ...(spendGoal > 0 ? [
      h(SectionHeader, { title: "Spend Progress" }),
      h(SpendProgressBar, { spend, goal: spendGoal }),
    ] : []),
    // ── Notes ──
    ...(card.notes ? [
      h(SectionHeader, { title: "Notes" }),
      h(Box, { paddingX: 2 },
        h(Text, { color: "gray" }, card.notes)
      ),
    ] : []),
    // ── Owner ──
    h(SectionHeader, { title: "Owner" }),
    h(DetailField, { label: "User" },
      h(Text, { color: "cyan" }, ownerEmail || "—")
    ),
    h(DetailField, { label: "Card ID" },
      h(Text, { color: "gray", dimColor: true }, card.id)
    ),
    // ── Actions ──
    actionArea,
    // ── Status message ──
    ...(statusMsg ? [
      h(Box, { marginTop: 1 },
        h(Text, { color: statusMsg.startsWith("Error") ? "red" : "green" }, statusMsg)
      ),
    ] : [])
  );
}

/**
 * Full card drill-down view: left=scrollable card list, right=card detail.
 * Manages its own async state and keyboard navigation.
 *
 * @param {Object}   props
 * @param {string}   props.householdId
 * @param {string|null} props.filterUserId  null = show all household cards
 * @param {string}   props.ownerEmail       shown in breadcrumbs
 * @param {Function} props.onBack           called on Esc from list view
 * @param {Function} [props.setInputCaptured]
 */
function CardDrilldownView({ householdId, filterUserId, ownerEmail, onBack, setInputCaptured }) {
  const LIST_HEIGHT = 18;

  const [cards, setCards]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(null);
  const [selectedIdx, setSelectedIdx]   = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [detailOpen, setDetailOpen]     = useState(false);

  function sortCards(arr) {
    const ORDER = { active: 0, fee_approaching: 1, promo_expiring: 2, closed: 3 };
    return [...arr].sort((a, b) => {
      const ao = a.deletedAt ? 99 : (ORDER[a.status] ?? 4);
      const bo = b.deletedAt ? 99 : (ORDER[b.status] ?? 4);
      return ao !== bo ? ao - bo : (a.name || "").localeCompare(b.name || "");
    });
  }

  function fetchCards() {
    setLoading(true);
    loadCardsForHousehold(householdId)
      .then((all) => {
        const filtered = filterUserId ? all.filter((c) => c.userId === filterUserId) : all;
        setCards(sortCards(filtered));
      })
      .catch((err) => setLoadError(err.message || String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(fetchCards, []); // eslint-disable-line react-hooks/exhaustive-deps

  // List navigation — inactive when detail panel is open (detail handles own input)
  useInput((input, key) => {
    if (key.escape) { onBack(); return; }
    if (key.upArrow) {
      const ni = Math.max(0, selectedIdx - 1);
      setSelectedIdx(ni);
      if (ni < scrollOffset) setScrollOffset(ni);
      return;
    }
    if (key.downArrow) {
      const ni = Math.min(cards.length - 1, selectedIdx + 1);
      setSelectedIdx(ni);
      if (ni >= scrollOffset + LIST_HEIGHT) setScrollOffset(ni - LIST_HEIGHT + 1);
      return;
    }
    if (key.return && cards[selectedIdx]) {
      setDetailOpen(true);
      return;
    }
  }, { isActive: !detailOpen });

  const visibleCards  = cards.slice(scrollOffset, scrollOffset + LIST_HEIGHT);
  const canScrollUp   = scrollOffset > 0;
  const canScrollDown = scrollOffset + LIST_HEIGHT < cards.length;
  const selectedCard  = cards[selectedIdx] ?? null;

  // ── Left panel (shared between list + detail modes) ──
  const leftPanel = h(Box, {
    flexDirection: "column",
    width: 32,
    borderStyle: "single",
    borderColor: detailOpen ? "gray" : "yellow",
    flexShrink: 0,
  },
    h(Box, { paddingX: 1, borderStyle: "single", borderColor: "gray" },
      h(Text, { bold: true, color: "yellow" },
        loading ? "Cards (loading…)" :
        loadError ? "Cards (error)" :
        `Cards (${cards.length})`
      )
    ),
    canScrollUp && h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "↑ more"),
    loading
      ? h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "Loading…")
      : loadError
        ? h(Text, { color: "red", paddingX: 2 }, `Error: ${loadError}`)
        : cards.length === 0
          ? h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "No cards found")
          : visibleCards.map((c, i) =>
              h(CardListRow, {
                key: c.id,
                card: c,
                selected: scrollOffset + i === selectedIdx,
              })
            ),
    canScrollDown && h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "↓ more"),
    h(Box, { flexGrow: 1 }),
    h(Text, { color: "gray", dimColor: true, paddingX: 1 },
      detailOpen ? "Esc back to list" : "↑/↓ Enter  Esc back"
    )
  );

  // ── Detail mode: left list + right detail panel ──
  if (detailOpen && selectedCard) {
    return h(Box, { flexDirection: "row", flexGrow: 1 },
      leftPanel,
      h(CardDetailPanel, {
        card: selectedCard,
        householdId,
        ownerEmail,
        onBack: () => setDetailOpen(false),
        onCardUpdated: () => { fetchCards(); setDetailOpen(false); },
        setInputCaptured,
      })
    );
  }

  // ── List mode: left list + right preview ──
  return h(Box, { flexDirection: "row", flexGrow: 1 },
    leftPanel,
    selectedCard
      ? h(Box, {
          flexDirection: "column",
          flexGrow: 1,
          paddingX: 2,
          paddingY: 1,
          borderStyle: "single",
          borderColor: "gray",
        },
          // breadcrumb
          h(Box, { flexDirection: "row", marginBottom: 1 },
            h(Text, { color: "gray", dimColor: true }, "← "),
            h(Text, { color: "cyan" }, ownerEmail || "User"),
            h(Text, { color: "gray", dimColor: true }, " / Cards")
          ),
          // card header
          h(Box, { flexDirection: "row", alignItems: "center", marginBottom: 1,
                   borderStyle: "single", borderColor: "gray", paddingX: 1 },
            h(Text, { bold: true, color: "yellow" }, selectedCard.name || "Unknown Card"),
            h(Text, { color: (CARD_STATUS_DOT[selectedCard.status] || { color: "gray" }).color },
              `  ${(CARD_STATUS_DOT[selectedCard.status] || { dot: "○" }).dot}  `),
            h(Text, { color: "gray" }, (selectedCard.status || "active").replace(/_/g, " "))
          ),
          h(DetailField, { label: "Issuer" },
            h(Text, {}, selectedCard.issuer || "—")
          ),
          h(DetailField, { label: "Credit Limit" },
            h(Text, { color: "cyan" }, selectedCard.creditLimit
              ? `$${Number(selectedCard.creditLimit).toLocaleString()}` : "—")
          ),
          h(DetailField, { label: "Annual Fee" },
            h(Text, {}, selectedCard.annualFee ? `$${selectedCard.annualFee}` : "None")
          ),
          h(DetailField, { label: "Opened" },
            h(Text, {}, fmtDateShort(selectedCard.openedDate ?? selectedCard.opened))
          ),
          h(Box, { marginTop: 1 },
            h(Text, { color: "gray", dimColor: true }, "Enter to view full detail")
          )
        )
      : h(Box, {
          flexGrow: 1,
          borderStyle: "single",
          borderColor: "gray",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        },
          h(Text, { color: "yellow", dimColor: true }, "ᚱ"),
          h(Text, { color: "gray" }, "Select a card"),
          h(Text, { color: "gray", dimColor: true }, "↑/↓ navigate   Enter drill down")
        )
  );
}

// h — shorthand for React.createElement (no JSX needed in an .mjs script)
const h = React.createElement;

// ── Command Palette — commands registry ───────────────────────────────────────

const PALETTE_COMMANDS = [
  // ── Users ──
  { name: "delete-user",         desc: "Delete selected user from Firestore",               category: "Users",      destructive: true,  requiresContext: "user"      },
  // ── Households ──
  { name: "update-invite",       desc: "Regenerate invite code for selected household",     category: "Households", destructive: false, requiresContext: "household"  },
  { name: "delete-household",    desc: "Delete selected household and all its cards",        category: "Households", destructive: true,  requiresContext: "household"  },
  // ── Billing ──
  { name: "list-subscriptions",  desc: "List all Stripe subscriptions",                     category: "Billing",    destructive: false, requiresContext: null         },
  { name: "list-customers",      desc: "List all Stripe customers",                         category: "Billing",    destructive: false, requiresContext: null         },
  { name: "delete-subscription", desc: "Cancel Stripe subscription for selected user",      category: "Billing",    destructive: true,  requiresContext: "user"       },
  { name: "delete-entitlement",  desc: "Flush Redis entitlement cache for selected trial",  category: "Billing",    destructive: true,  requiresContext: "trial"      },
  // ── Trial ──
  { name: "trial-adjust",        desc: "Shift trial start date by +N / -N days",            category: "Trial",      destructive: false, requiresContext: "trial"      },
  { name: "trial-complete",      desc: `Force-expire trial (sets start ${TRIAL_DURATION_DAYS + 1} days ago)`, category: "Trial", destructive: false, requiresContext: "trial" },
  { name: "trial-progress",      desc: `Advance to next phase boundary (day ${TRIAL_NUDGE_DAY} or expiry)`, category: "Trial", destructive: false, requiresContext: "trial" },
  // ── Redis ──
  { name: "entitlements",        desc: "Show Redis entitlement cache",                      category: "Redis",      destructive: false, requiresContext: null         },
  { name: "keys",                desc: "Show all Redis keys grouped by prefix",              category: "Redis",      destructive: false, requiresContext: null         },
  // ── Danger ──
  { name: "delete-all",          desc: "Nuke all data for selected trial: Stripe + Redis",  category: "Danger",     destructive: true,  requiresContext: "trial"      },
  // ── System ──
  { name: "reconnect",           desc: "Reconnect Redis port-forward",                      category: "System",     destructive: false, requiresContext: null         },
];

/** Filter PALETTE_COMMANDS by a search query string. */
function filterPaletteCommands(query) {
  const q = query.toLowerCase().trim();
  if (!q) return PALETTE_COMMANDS;
  return PALETTE_COMMANDS.filter(
    (c) => c.name.includes(q) || c.desc.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
  );
}

// ── CommandPalette ────────────────────────────────────────────────────────────

/**
 * Command palette overlay. Rendered inside SpearApp when `isOpen` is true.
 * Provides real-time search, category grouping, arrow-key navigation, Enter to execute.
 */

function CommandPalette({ isOpen, query, highlight, onClose, onQueryChange, onHighlightChange, onExecute }) {
  const allFiltered = filterPaletteCommands(query);

  /** Returns true if this command's required context is currently satisfied. */
  function isAvailable(cmd) {
    if (cmd.requiresContext === "trial")     return !!selectedFp;
    if (cmd.requiresContext === "household") return !!selectedHouseholdId;
    if (cmd.requiresContext === "user")      return !!_selectedUserId;
    return true;
  }

  // Only show commands whose required context is currently active
  const filtered = allFiltered.filter(isAvailable);

  useInput((input, key) => {
    if (key.escape) { onClose(); return; }
    if (key.upArrow) {
      onHighlightChange(Math.max(0, highlight - 1));
      return;
    }
    if (key.downArrow) {
      onHighlightChange(Math.min(filtered.length - 1, highlight + 1));
      return;
    }
    if (key.return) {
      if (filtered[highlight]) onExecute(filtered[highlight]);
      return;
    }
    if (key.backspace || key.delete) {
      onQueryChange(query.slice(0, -1));
      onHighlightChange(0);
      return;
    }
    if (input && !key.ctrl && !key.meta && input.length === 1) {
      onQueryChange(query + input);
      onHighlightChange(0);
    }
  }, { isActive: isOpen });

  if (!isOpen) return null;

  // Group by category for rendering
  let lastCat = "";
  const rows = [];
  filtered.forEach((cmd, i) => {
    if (cmd.category !== lastCat) {
      lastCat = cmd.category;
      rows.push(
        h(Box, { key: `cat-${cmd.category}`, paddingLeft: 2, marginTop: rows.length === 0 ? 0 : 1 },
          h(Text, { color: "yellow", dimColor: true, bold: false }, cmd.category.toUpperCase())
        )
      );
    }
    const isHighlighted = i === highlight;
    rows.push(
      h(Box, {
        key: cmd.name,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingX: 2,
        backgroundColor: isHighlighted ? "gray" : undefined,
      },
        h(Box, { flexDirection: "row", gap: 1 },
          h(Text, {
            bold: isHighlighted,
            color: isHighlighted ? "black" : cmd.destructive ? "red" : "white",
          }, cmd.name),
        ),
        h(Text, {
          color: isHighlighted ? "black" : "gray",
          dimColor: !isHighlighted,
        }, cmd.desc)
      )
    );
  });

  if (filtered.length === 0) {
    rows.push(
      h(Box, { key: "empty", paddingX: 2, paddingY: 1 },
        h(Text, { color: "gray", dimColor: true }, "No matching commands")
      )
    );
  }

  return h(Box, {
    flexDirection: "column",
    flexGrow: 1,
    borderStyle: "round",
    borderColor: "yellow",
    paddingY: 0,
  },
    // Search input header
    h(Box, { paddingX: 2, paddingY: 0, borderStyle: "single", borderColor: "gray" },
      h(Text, { color: "gray", dimColor: true }, "> "),
      h(Text, { color: "white" }, query || ""),
      h(Text, { color: "gray", dimColor: true }, query ? "" : "Type to search commands…"),
      h(Text, { color: "gray", dimColor: true }, "█")
    ),
    // Command list
    h(Box, { flexDirection: "column", flexGrow: 1, paddingY: 1 },
      ...rows
    ),
    // Footer
    h(Box, { paddingX: 2, borderStyle: "single", borderColor: "gray" },
      h(Text, { color: "gray", dimColor: true }, "↑↓ navigate   Enter execute   Esc close")
    )
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

/**
 * Inline confirmation dialog for destructive commands.
 * Requires the user to type "delete" before the confirm button enables.
 */
function ConfirmDialog({ dialog, deleteInput, onDeleteInputChange, onConfirm, onCancel }) {
  const canConfirm = deleteInput.toLowerCase() === "delete";

  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.return && canConfirm) { onConfirm(); return; }
    if (key.backspace || key.delete) {
      onDeleteInputChange(deleteInput.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta && input.length === 1) {
      onDeleteInputChange(deleteInput + input);
    }
  }, { isActive: !!dialog });

  if (!dialog) return null;

  return h(Box, {
    flexDirection: "column",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
    h(Box, {
      flexDirection: "column",
      borderStyle: "double",
      borderColor: "red",
      paddingX: 4,
      paddingY: 2,
    },
      // Warning icon + title
      h(Box, { flexDirection: "row", marginBottom: 1 },
        h(Text, { color: "red", bold: true }, "⚠  Confirm: "),
        h(Text, { color: "red", bold: true }, dialog.action)
      ),
      // Description
      h(Box, { marginBottom: 2 },
        h(Text, { color: "gray" }, dialog.desc)
      ),
      // Type-to-confirm prompt
      h(Box, { flexDirection: "row", marginBottom: 1 },
        h(Text, { color: "gray" }, "Type "),
        h(Text, { color: "red", bold: true }, "delete"),
        h(Text, { color: "gray" }, " to confirm:  "),
        h(Text, { color: "white", bold: true }, deleteInput),
        h(Text, { color: "gray" }, "█")
      ),
      // Input bar
      h(Box, { flexDirection: "row", marginTop: 1, gap: 2 },
        h(Text, { color: "gray" }, "[Esc] Cancel  "),
        h(Text, {
          color: canConfirm ? "red" : "gray",
          bold: canConfirm,
          dimColor: !canConfirm,
        }, canConfirm ? "[Enter] CONFIRM" : "[Enter] (type delete first)")
      )
    )
  );
}

// ── TrialDialog ───────────────────────────────────────────────────────────────

/**
 * Two-phase dialog for trial manipulation commands.
 *
 * Phase "input"  (trial-adjust only): collects +N/-N day value from user.
 * Phase "confirm" (all commands): shows old → new trial state, user presses Enter or Esc.
 *
 * Props:
 *   dialog   — { action, phase, dayInput, oldDesc, newDesc, applyFn }
 *   onConfirm — () => void
 *   onCancel  — () => void
 *   onPhaseNext — (dayInput: string) => void  — called when input phase advances
 *   onDayInputChange — (val: string) => void
 */
function TrialDialog({ dialog, onConfirm, onCancel, onPhaseNext, onDayInputChange }) {
  useInput((input, key) => {
    if (!dialog) return;
    if (key.escape) { onCancel(); return; }

    if (dialog.phase === "input") {
      // Collect day-shift input (allow digits, +, -)
      if (key.return) {
        const n = parseInt(dialog.dayInput, 10);
        if (!isNaN(n) && n !== 0) {
          onPhaseNext(dialog.dayInput);
        }
        return;
      }
      if (key.backspace || key.delete) {
        onDayInputChange(dialog.dayInput.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta && /^[0-9+\-]$/.test(input)) {
        onDayInputChange(dialog.dayInput + input);
      }
      return;
    }

    // Phase "confirm"
    if (key.return) { onConfirm(); return; }
  }, { isActive: !!dialog });

  if (!dialog) return null;

  if (dialog.phase === "input") {
    const n = parseInt(dialog.dayInput, 10);
    const valid = !isNaN(n) && n !== 0;
    return h(Box, {
      flexDirection: "column",
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
    },
      h(Box, {
        flexDirection: "column",
        borderStyle: "round",
        borderColor: "cyan",
        paddingX: 4,
        paddingY: 2,
      },
        h(Box, { marginBottom: 1 },
          h(Text, { color: "cyan", bold: true }, "Trial Day Adjustment")
        ),
        h(Box, { marginBottom: 2 },
          h(Text, { color: "gray" }, "Enter days to shift (e.g. +5 or -3). Positive = older start = fewer days remaining.")
        ),
        h(Box, { flexDirection: "row", marginBottom: 1 },
          h(Text, { color: "gray" }, "Days:  "),
          h(Text, { color: "white", bold: true }, dialog.dayInput || ""),
          h(Text, { color: "gray" }, "█")
        ),
        h(Box, { flexDirection: "row", marginTop: 1, gap: 2 },
          h(Text, { color: "gray" }, "[Esc] Cancel  "),
          h(Text, {
            color: valid ? "cyan" : "gray",
            bold: valid,
            dimColor: !valid,
          }, valid ? "[Enter] Preview" : "[Enter] (enter a non-zero number first)")
        )
      )
    );
  }

  // Phase "confirm" — show old → new state
  return h(Box, {
    flexDirection: "column",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
    h(Box, {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 4,
      paddingY: 2,
    },
      h(Box, { marginBottom: 1 },
        h(Text, { color: "cyan", bold: true }, `Confirm: ${dialog.action}`)
      ),
      h(Box, { flexDirection: "row", marginBottom: 1 },
        h(Text, { color: "gray" }, "Before: "),
        h(Text, { color: "yellow" }, dialog.oldDesc)
      ),
      h(Box, { flexDirection: "row", marginBottom: 2 },
        h(Text, { color: "gray" }, "After:  "),
        h(Text, { color: "green", bold: true }, dialog.newDesc)
      ),
      h(Box, { flexDirection: "row", marginTop: 1, gap: 2 },
        h(Text, { color: "gray" }, "[Esc] Cancel  "),
        h(Text, { color: "cyan", bold: true }, "[Enter] Apply")
      )
    )
  );
}

// ── ResultsOverlay ────────────────────────────────────────────────────────────

/**
 * Full-screen overlay for displaying read-only text results from palette commands
 * (list-customers, list-subscriptions, entitlements, keys).
 * Supports arrow-key scrolling. Press Esc or q to close.
 */
function ResultsOverlay({ lines, title, onClose }) {
  const [offset, setOffset] = useState(0);
  const { stdout } = useStdout();
  const visibleRows = Math.max(5, (stdout?.rows ?? process.stdout.rows ?? 24) - 6);

  useInput((input, key) => {
    if (key.escape || input === "q") { onClose(); return; }
    if (key.upArrow)   setOffset((o) => Math.max(0, o - 1));
    if (key.downArrow) setOffset((o) => Math.min(Math.max(0, lines.length - visibleRows), o + 1));
    if (key.pageDown)  setOffset((o) => Math.min(Math.max(0, lines.length - visibleRows), o + visibleRows));
    if (key.pageUp)    setOffset((o) => Math.max(0, o - visibleRows));
  });

  const visible = lines.slice(offset, offset + visibleRows);
  const canScrollUp   = offset > 0;
  const canScrollDown = offset + visibleRows < lines.length;

  return h(Box, {
    flexDirection: "column", flexGrow: 1,
    borderStyle: "round", borderColor: "cyan", paddingX: 2, paddingY: 1,
  },
    h(Box, { flexDirection: "row", marginBottom: 1 },
      h(Text, { bold: true, color: "cyan" }, title),
      h(Box, { flexGrow: 1 }),
      h(Text, { color: "gray", dimColor: true }, `${offset + 1}–${Math.min(offset + visibleRows, lines.length)} of ${lines.length}`),
    ),
    canScrollUp && h(Text, { color: "gray", dimColor: true }, "  ↑ more"),
    ...visible.map((line, i) =>
      h(Text, { key: i, color: line.startsWith("─") ? "gray" : "white", dimColor: line.startsWith("─") }, line)
    ),
    canScrollDown && h(Text, { color: "gray", dimColor: true }, "  ↓ more"),
    h(Box, { flexGrow: 1 }),
    h(Box, { borderStyle: "single", borderColor: "gray", paddingX: 1, marginTop: 1 },
      h(Text, { color: "gray", dimColor: true }, "↑/↓ scroll   PgUp/PgDn page   Esc close")
    )
  );
}

/** Top bar: branding, tab buttons, shortcut hints. */
function TopBar({ activeTab, onTabChange }) {
  return h(Box, { flexDirection: "row", alignItems: "center", paddingX: 1, borderStyle: "single", borderColor: "yellow" },
    h(Text, { color: "yellow", bold: true }, "ODIN'S SPEAR ⚡  "),
    ...TUI_TABS.map((tab, i) =>
      h(Text, {
        key: tab,
        backgroundColor: activeTab === i ? "yellow" : undefined,
        color: activeTab === i ? "black" : "gray",
        bold: activeTab === i,
      }, ` [${tab}] `)
    ),
    h(Box, { flexGrow: 1 }),
    h(Text, { dimColor: true, color: "gray" }, "  [/] Command  [^R] Reload  [?] Help")
  );
}

/** Status bar: connection indicators + item count. */
function StatusBar({ connections, counts }) {
  return h(Box, { flexDirection: "row", alignItems: "center", paddingX: 1, borderStyle: "single", borderColor: "gray" },
    h(Text, { color: "gray" }, "Redis "),
    h(Text, { color: connections.redis ? "green" : "red" }, "●"),
    h(Text, { color: "gray" }, "  Firestore "),
    h(Text, { color: connections.firestore ? "green" : "red" }, "●"),
    h(Text, { color: "gray" }, "  Stripe "),
    h(Text, { color: connections.stripe ? "green" : "red" }, "●"),
    h(Box, { flexGrow: 1 }),
    h(Text, { color: "gray" }, `${counts.users} users  ${counts.households} households`)
  );
}

/** Help overlay shown on `?`. Press Esc or ? to close. */
function HelpOverlay() {
  const row = (key, desc) =>
    h(Box, { key, flexDirection: "row" },
      h(Text, { color: "cyan", bold: true }, key.padEnd(10)),
      h(Text, { color: "gray" }, desc)
    );
  const section = (title) =>
    h(Box, { key: title, marginTop: 1 },
      h(Text, { color: "yellow", dimColor: true }, `── ${title} `)
    );
  return h(Box, {
    flexDirection: "column",
    borderStyle: "round",
    borderColor: "yellow",
    paddingX: 3,
    paddingY: 1,
    flexGrow: 1,
  },
    h(Text, { bold: true, color: "yellow" }, "Keyboard Shortcuts  —  Odin's Spear"),
    section("Global"),
    row("/",       "Open command palette"),
    row("?",       "Show / hide this help"),
    row("Tab",     "Switch between Users / Households"),
    row("^R",      "Reload current view"),
    row("q",       "Quit"),
    section("Navigation"),
    row("↑ / ↓",   "Navigate list items"),
    row("Enter",   "Select / drill into item"),
    row("Esc",     "Go back one level / close modal"),
    section("User actions  (user selected)"),
    row("d",       "Delete selected user"),
    row("t",       "Update tier (prompt)"),
    row("s",       "Cancel Stripe subscription"),
    row("h",       "Jump to user's household"),
    row("c",       "Drill into user's cards"),
    section("Household actions  (household selected)"),
    row("i",       "Regenerate invite code"),
    row("o",       "Transfer household ownership"),
    row("k",       "Kick / remove a member"),
    row("s",       "Cancel Stripe subscription"),
    row("c",       "Browse household cards"),
    row("x",       "Delete household"),
    section("Card actions  (card selected)"),
    row("d",       "Soft-delete card"),
    row("r",       "Restore soft-deleted card"),
    row("x",       "Expunge card permanently"),
    h(Box, { marginTop: 1 },
      h(Text, { color: "gray", dimColor: true }, "Press Esc or ? to close")
    )
  );
}

/** Main content area: routes to the correct tab component. */
function MainContent({ activeTab, onJumpToHousehold, setInputCaptured }) {
  if (activeTab === 0) {
    return h(UsersTab, {
      isActive: true,
      onJumpToHousehold,
      setInputCaptured,
    });
  }
  if (activeTab === 1) {
    return h(HouseholdsTab, { setInputCaptured });
  }
  // Other tabs: placeholder
  const tabLabel = TUI_TABS[activeTab];
  return h(Box, { flexDirection: "row", flexGrow: 1 },
    h(Box, {
      flexDirection: "column",
      width: 32,
      borderStyle: "single",
      borderColor: "gray",
      flexShrink: 0,
      paddingX: 1,
      paddingY: 1,
    },
      h(Text, { bold: true, color: "yellow" }, tabLabel),
      h(Text, { color: "gray", dimColor: true }, "(coming soon — issue #1388)")
    ),
    h(Box, {
      flexDirection: "column",
      flexGrow: 1,
      borderStyle: "single",
      borderColor: "gray",
      paddingX: 2,
      paddingY: 1,
    },
      h(Text, { color: "gray", dimColor: true }, `${tabLabel} tab — select an item from the list`)
    )
  );
}

/** Root TUI application. */
function SpearApp({ connectionStatus, counts }) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Track terminal dimensions and reflow on resize
  const [termSize, setTermSize] = useState({
    columns: stdout?.columns ?? process.stdout.columns ?? 80,
    rows:    stdout?.rows    ?? process.stdout.rows    ?? 24,
  });
  useEffect(() => {
    function onResize() {
      setTermSize({
        columns: stdout?.columns ?? process.stdout.columns ?? 80,
        rows:    stdout?.rows    ?? process.stdout.rows    ?? 24,
      });
    }
    process.stdout.on("resize", onResize);
    return () => process.stdout.off("resize", onResize);
  }, [stdout]);

  const [activeTab, setActiveTab]         = useState(0);
  const [showHelp, setShowHelp]           = useState(false);
  const [inputCaptured, setInputCaptured] = useState(false); // true when a tab holds input (e.g. text prompt)

  // ── Command palette state ──
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [cmdQuery, setCmdQuery]             = useState("");
  const [cmdHighlight, setCmdHighlight]     = useState(0);

  // ── Confirmation dialog state ──
  const [confirmDialog, setConfirmDialog] = useState(null); // { action, desc } | null
  const [deleteInput, setDeleteInput]     = useState("");
  const [cmdStatusMsg, setCmdStatusMsg]   = useState("");

  // ── Results overlay state — for read-only palette command output ──
  const [resultsOverlay, setResultsOverlay] = useState(null); // { title, lines } | null

  // ── Trial dialog state ──
  // { action, phase: "input"|"confirm", dayInput, oldDesc, newDesc, applyFn } | null
  const [trialDialog, setTrialDialog] = useState(null);

  // Register TUI log sink so port-forward/Redis async callbacks don't write to stdout
  React.useEffect(() => {
    _tuiLog = (msg) => setCmdStatusMsg(msg);
    return () => { _tuiLog = null; };
  }, []);

  // Auto-clear status messages
  React.useEffect(() => {
    if (!cmdStatusMsg) return;
    const tid = setTimeout(() => setCmdStatusMsg(""), 5000);
    return () => clearTimeout(tid);
  }, [cmdStatusMsg]);

  /** Switch to Households tab — called by UsersTab when user presses [h]. */
  function onJumpToHousehold(_householdId) {
    setActiveTab(1);
  }

  function openCommandPalette() {
    setShowCmdPalette(true);
    setCmdQuery("");
    setCmdHighlight(0);
  }

  function closeCommandPalette() {
    setShowCmdPalette(false);
  }

  function closeCmdPaletteAndConfirm() {
    setShowCmdPalette(false);
    setConfirmDialog(null);
    setDeleteInput("");
  }

  /** Show lines in the ResultsOverlay. */
  function showResults(title, lines) {
    setResultsOverlay({ title, lines });
  }

  /** Called when user executes a command from the palette. */
  function handleCmdExecute(cmd) {
    closeCommandPalette();

    // ── Trial commands — open TrialDialog ──
    if (cmd.name === "trial-adjust") {
      if (!selectedFp) { setCmdStatusMsg("No trial in scope — select a user with a linked trial first"); return; }
      setTrialDialog({ action: "trial-adjust", phase: "input", dayInput: "", oldDesc: "", newDesc: "", applyFn: null });
      return;
    }
    if (cmd.name === "trial-complete" || cmd.name === "trial-progress") {
      if (!selectedFp) { setCmdStatusMsg("No trial in scope — select a user with a linked trial first"); return; }
      getTrial(selectedFp).then((trial) => {
        const currentStatus = computeStatus(trial);
        const oldDesc = describeTrialState(currentStatus);
        let newDesc, applyFn;
        if (cmd.name === "trial-complete") {
          const expiredStart = new Date(Date.now() - (TRIAL_DURATION_DAYS + 1) * 86400000).toISOString();
          newDesc = "expired — 0 days remaining";
          applyFn = async () => {
            const existing = await getTrial(selectedFp);
            const updated = { ...(existing || {}), startDate: expiredStart };
            delete updated.convertedDate;
            await setTrial(selectedFp, updated);
          };
        } else {
          const target = computeTrialProgressTarget(currentStatus.remainingDays);
          if (!target) { setCmdStatusMsg("Trial already expired — nothing to progress"); return; }
          const newStart = startDateForRemaining(target.targetRemaining);
          newDesc = target.targetRemaining === 0
            ? "expired — 0 days remaining"
            : `active — ${target.targetRemaining}d remaining (${target.label})`;
          applyFn = async () => {
            const existing = await getTrial(selectedFp);
            const updated = { ...(existing || {}), startDate: newStart };
            delete updated.convertedDate;
            await setTrial(selectedFp, updated);
          };
        }
        setTrialDialog({ action: cmd.name, phase: "confirm", dayInput: "", oldDesc, newDesc, applyFn });
      }).catch(() => setCmdStatusMsg("Error: failed to read trial state"));
      return;
    }

    // ── Read-only commands — fetch data and show in ResultsOverlay ──
    if (cmd.name === "list-customers") {
      fetchListCustomers().then((lines) => showResults("Stripe Customers", lines)).catch(() => setCmdStatusMsg("Stripe request failed"));
      return;
    }
    if (cmd.name === "list-subscriptions") {
      fetchListSubscriptions().then((lines) => showResults("Stripe Subscriptions", lines)).catch(() => setCmdStatusMsg("Stripe request failed"));
      return;
    }
    if (cmd.name === "entitlements") {
      fetchEntitlements().then((lines) => showResults("Redis Entitlements", lines)).catch(() => setCmdStatusMsg("Redis request failed"));
      return;
    }
    if (cmd.name === "keys") {
      fetchRedisKeys().then((lines) => showResults("Redis Keys", lines)).catch(() => setCmdStatusMsg("Redis request failed"));
      return;
    }
    if (cmd.name === "reconnect") {
      doReconnect().then((msg) => setCmdStatusMsg(msg)).catch(() => setCmdStatusMsg("Reconnect failed"));
      return;
    }
    if (cmd.name === "update-invite") {
      doUpdateInvite().then((msg) => setCmdStatusMsg(msg)).catch((err) => setCmdStatusMsg(`Error: ${err?.message}`));
      return;
    }

    // ── Destructive commands — require typed confirmation ──
    if (cmd.destructive) {
      setDeleteInput("");
      setConfirmDialog({ action: cmd.name, desc: cmd.desc });
      return;
    }

    setCmdStatusMsg(`Unknown command: ${cmd.name}`);
  }

  /** Called when user confirms a destructive action (typed "delete" and hit Enter). */
  function handleConfirm() {
    if (!confirmDialog) return;
    const action = confirmDialog.action;
    setConfirmDialog(null);
    setDeleteInput("");

    const run = async () => {
      switch (action) {
        case "delete-user":        return doDeleteUser();
        case "delete-household":   return doDeleteHousehold();
        case "delete-all":         return doDeleteAll();
        case "delete-entitlement": return doDeleteEntitlement();
        case "delete-subscription": return doDeleteSubscription(_selectedSubId);
        default: return `Unknown destructive action: ${action}`;
      }
    };

    run()
      .then((msg) => setCmdStatusMsg(msg || `${action} executed`))
      .catch((err) => setCmdStatusMsg(`Error: ${err?.message ?? action + " failed"}`));
  }

  function handleCancelConfirm() {
    setConfirmDialog(null);
    setDeleteInput("");
    setCmdStatusMsg("Cancelled");
  }

  /** Called when trial-adjust input phase advances (user entered a valid day count). */
  function handleTrialInputNext(dayInput) {
    if (!selectedFp) {
      setTrialDialog(null);
      setCmdStatusMsg("Error: no trial selected — use list + use <N> first");
      return;
    }
    const days = parseInt(dayInput, 10);
    getTrial(selectedFp).then((trial) => {
      const currentStatus = computeStatus(trial);
      const oldDesc = describeTrialState(currentStatus);
      // User enters +N = "age by N days" → subtract N from startDate (moves it into the past → fewer remaining)
      // User enters -N = "restore N days" → add N to startDate (moves it toward present → more remaining)
      const newStart = new Date(new Date(trial?.startDate ?? Date.now()).getTime() - days * 86400000).toISOString();
      const newTrial = { ...(trial || {}), startDate: newStart };
      delete newTrial.convertedDate;
      const newStatus = computeStatus(newTrial);
      const newDesc = describeTrialState(newStatus);
      const applyFn = async () => {
        const existing = await getTrial(selectedFp);
        const updated = { ...(existing || {}), startDate: newStart };
        delete updated.convertedDate;
        await setTrial(selectedFp, updated);
      };
      setTrialDialog((prev) => ({
        ...prev,
        phase: "confirm",
        dayInput,
        oldDesc,
        newDesc,
        applyFn,
      }));
    }).catch(() => {
      setTrialDialog(null);
      setCmdStatusMsg("Error: failed to read trial state");
    });
  }

  /** Called when TrialDialog confirm is accepted. */
  function handleTrialConfirm() {
    if (!trialDialog?.applyFn) return;
    const action = trialDialog.action;
    setTrialDialog(null);
    trialDialog.applyFn().then(() => {
      setCmdStatusMsg(`${action} applied`);
    }).catch((err) => {
      setCmdStatusMsg(`Error: ${err?.message ?? "mutation failed"}`);
    });
  }

  function handleTrialCancel() {
    setTrialDialog(null);
    setCmdStatusMsg("Cancelled");
  }

  useInput((input, key) => {
    // Let the active tab consume input when it has captured focus (e.g. tier prompt)
    if (inputCaptured) return;

    // Overlays handle their own input via useInput({ isActive })
    if (showCmdPalette || confirmDialog || trialDialog || resultsOverlay) return;

    // q — quit
    if (input === "q") {
      redis.quit().catch(() => {}).finally(() => {
        cleanupPortForward();
        exit();
      });
      return;
    }
    // / — open command palette
    if (input === "/") {
      openCommandPalette();
      return;
    }
    // ? — toggle help
    if (input === "?") {
      setShowHelp((v) => !v);
      return;
    }
    // Esc — close help overlay
    if (key.escape && showHelp) {
      setShowHelp(false);
      return;
    }
    // Tab — switch tabs
    if (key.tab) {
      setActiveTab((t) => (t + 1) % TUI_TABS.length);
      return;
    }
    // ^R — reload (placeholder)
    if (key.ctrl && input === "r") {
      return;
    }
    // Any key closes help overlay
    if (showHelp) {
      setShowHelp(false);
    }
  });

  // Determine which content to render in the main area
  // Priority: resultsOverlay > confirmDialog > trialDialog > showCmdPalette > showHelp > MainContent
  let mainArea;
  if (resultsOverlay) {
    mainArea = h(ResultsOverlay, {
      title: resultsOverlay.title,
      lines: resultsOverlay.lines,
      onClose: () => setResultsOverlay(null),
    });
  } else if (confirmDialog) {
    mainArea = h(ConfirmDialog, {
      dialog: confirmDialog,
      deleteInput,
      onDeleteInputChange: setDeleteInput,
      onConfirm: handleConfirm,
      onCancel: handleCancelConfirm,
    });
  } else if (trialDialog) {
    mainArea = h(TrialDialog, {
      dialog: trialDialog,
      onConfirm: handleTrialConfirm,
      onCancel: handleTrialCancel,
      onPhaseNext: handleTrialInputNext,
      onDayInputChange: (val) => setTrialDialog((prev) => prev ? { ...prev, dayInput: val } : prev),
    });
  } else if (showCmdPalette) {
    mainArea = h(CommandPalette, {
      isOpen: showCmdPalette,
      query: cmdQuery,
      highlight: cmdHighlight,
      onClose: closeCommandPalette,
      onQueryChange: setCmdQuery,
      onHighlightChange: setCmdHighlight,
      onExecute: handleCmdExecute,
    });
  } else if (showHelp) {
    mainArea = h(HelpOverlay, null);
  } else {
    mainArea = h(MainContent, { activeTab, onJumpToHousehold, setInputCaptured });
  }

  return h(Box, { flexDirection: "column", width: termSize.columns, height: termSize.rows },
    h(TopBar, { activeTab, onTabChange: setActiveTab }),
    mainArea,
    ...(cmdStatusMsg ? [
      h(Box, { paddingX: 2 },
        h(Text, { color: cmdStatusMsg.includes("Error") || cmdStatusMsg.startsWith("Cancelled") ? "yellow" : "green" },
          cmdStatusMsg
        )
      ),
    ] : []),
    h(StatusBar, { connections: connectionStatus, counts })
  );
}

// ── Start TUI ────────────────────────────────────────────────────────────────

const connectionStatus = {
  redis: true,      // reached this point means Redis connected
  firestore: true,  // ensureAuthenticated succeeded
  stripe: await getStripeKey().then(Boolean).catch(() => false),
};

const { waitUntilExit } = render(h(SpearApp, { connectionStatus, counts: initialCounts }), { fullscreen: true });
await waitUntilExit();
cleanupPortForward();
await redis.quit().catch(() => {});
process.exit(0);
