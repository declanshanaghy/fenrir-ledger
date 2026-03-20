/**
 * Odin's Spear — Ink-based Admin TUI
 * Issue #1496: Extract into standalone package
 *
 * Design reference: development/odins-spear/odins-spear.html
 *
 * Layout:
 *   TopBar  │ ODIN'S SPEAR ⚡  [Users]  [Households]  │  [/] Command  [^R] Reload  [?] Help
 *   Main    │ Left list (34 cols) │ Right detail (flex-grow)
 *   StatusBar│ ● Firestore  ● Stripe    │  <count>
 *
 * Auto-startup sequence:
 *   1. Authenticate Google ADC
 *   2. Connect Firestore (fenrir-ledger-prod)
 *   3. Load Stripe key
 *   4. Load initial counts (users, households)
 *   5. Render TUI
 */

import { createElement as h } from "react";
import { render } from "ink";
import { log } from "@fenrir/logger";
import { ensureAuthenticated, connectFirestore, loadInitialCounts, firestoreClient } from "./lib/firestore.js";
import { getStripeKey } from "./lib/stripe.js";
import { registerFirestoreCommands } from "./commands/firestore.js";
import { registerStripeCommands } from "./commands/stripe.js";
import { registerTrialCommands } from "./commands/trial.js";
import { SpearApp } from "./app.js";

const initialCounts = { users: 0, households: 0 };
const initialConnStatus = { firestore: false, stripe: false };

async function startup(): Promise<void> {
  log.debug("startup called");

  // 1. Google ADC
  log.info("Authenticating Google ADC…");
  try {
    await ensureAuthenticated();
    log.info("Google ADC authenticated");
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    log.fatal("ADC auth failed", { error: msg });
    process.exit(1);
  }

  // 2. Firestore
  log.info("Connecting to Firestore…");
  try {
    await connectFirestore();
    initialConnStatus.firestore = true;
    log.info("Firestore connected");
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    log.warn("Firestore failed, continuing", { error: msg });
  }

  // 3. Stripe key
  try {
    const key = await getStripeKey();
    initialConnStatus.stripe = Boolean(key);
    log.debug("startup: Stripe key loaded", { hasKey: initialConnStatus.stripe });
  } catch {
    initialConnStatus.stripe = false;
    log.debug("startup: Stripe key failed");
  }

  // 4. Initial counts
  if (firestoreClient) {
    const counts = await loadInitialCounts(firestoreClient);
    initialCounts.users = counts.users;
    initialCounts.households = counts.households;
    log.debug("startup: initial counts loaded", { users: initialCounts.users, households: initialCounts.households });
  }

  // Register palette commands
  registerFirestoreCommands();
  registerStripeCommands();
  registerTrialCommands();

  log.debug("startup returning");
}

await startup();

render(
  h(SpearApp, {
    initialConnStatus,
    initialCounts,
  })
);
