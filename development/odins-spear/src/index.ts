/**
 * Odin's Spear — Ink-based Admin TUI
 * Issue #1496: Extract into standalone package
 *
 * Design reference: development/odins-spear/odins-spear.html
 *
 * Layout:
 *   TopBar  │ ODIN'S SPEAR ⚡  [Users]  [Households]  │  [/] Command  [^R] Reload  [?] Help
 *   Main    │ Left list (34 cols) │ Right detail (flex-grow)
 *   StatusBar│ ● Redis  ● Firestore  ● Stripe    │  <count>
 *
 * Auto-startup sequence:
 *   1. Check localhost:6379 → spawn kubectl port-forward if not open
 *   2. Connect Redis (ioredis)
 *   3. Authenticate Google ADC
 *   4. Connect Firestore (fenrir-ledger-prod)
 *   5. Load Stripe key
 *   6. Load initial counts (users, households)
 *   7. Render TUI
 */

import { createElement as h } from "react";
import { render } from "ink";
import { log } from "@fenrir/logger";
import { ensureRedisPortForward, connectRedis } from "./lib/redis.js";
import { ensureAuthenticated, connectFirestore, loadInitialCounts, firestoreClient } from "./lib/firestore.js";
import { getStripeKey } from "./lib/stripe.js";
import { registerRedisCommands } from "./commands/redis.js";
import { registerFirestoreCommands } from "./commands/firestore.js";
import { registerStripeCommands } from "./commands/stripe.js";
import { SpearApp, tuiLog } from "./app.js";

const initialCounts = { users: 0, households: 0 };
const initialConnStatus = { redis: false, firestore: false, stripe: false };

async function startup(): Promise<void> {
  log.debug("startup called");

  // 1. Redis port-forward + connect
  console.log("Connecting to Redis\u2026");
  try {
    await ensureRedisPortForward(tuiLog);
    await connectRedis(tuiLog);
    initialConnStatus.redis = true;
    log.debug("startup: Redis connected");
    console.log("Redis connected.");
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    log.debug("startup: Redis failed", { messageLength: msg.length });
    console.error(`Redis: ${msg} (continuing)`);
  }

  // 2. Google ADC
  console.log("Authenticating Google ADC\u2026");
  try {
    await ensureAuthenticated();
    log.debug("startup: Google ADC authenticated");
    console.log("Google ADC authenticated.");
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    log.debug("startup: ADC auth failed", { messageLength: msg.length });
    console.error(`ADC auth error: ${msg}`);
    process.exit(1);
  }

  // 3. Firestore
  console.log("Connecting to Firestore\u2026");
  try {
    await connectFirestore();
    initialConnStatus.firestore = true;
    log.debug("startup: Firestore connected");
    console.log("Firestore connected.");
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    log.debug("startup: Firestore failed", { messageLength: msg.length });
    console.error(`Firestore: ${msg} (continuing)`);
  }

  // 4. Stripe key
  try {
    const key = await getStripeKey();
    initialConnStatus.stripe = Boolean(key);
    log.debug("startup: Stripe key loaded", { hasKey: initialConnStatus.stripe });
  } catch {
    initialConnStatus.stripe = false;
    log.debug("startup: Stripe key failed");
  }

  // 5. Initial counts
  if (firestoreClient) {
    const counts = await loadInitialCounts(firestoreClient);
    initialCounts.users = counts.users;
    initialCounts.households = counts.households;
    log.debug("startup: initial counts loaded", { users: initialCounts.users, households: initialCounts.households });
  }

  // Register palette commands
  registerRedisCommands();
  registerFirestoreCommands();
  registerStripeCommands();

  log.debug("startup returning");
}

await startup();

render(
  h(SpearApp, {
    initialConnStatus,
    initialCounts,
  })
);
