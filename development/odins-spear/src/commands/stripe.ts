import { registerCommand } from "./registry.js";
import { getStripeKey } from "../lib/stripe.js";
import { log } from "@fenrir/logger";

export function registerStripeCommands(): void {
  log.debug("registerStripeCommands called");

  registerCommand({
    name: "stripe-check-key",
    desc: "Verify Stripe secret key is available",
    subsystem: "stripe",
    tab: "all",
    execute: async (_ctx) => {
      log.debug("stripe-check-key execute called");
      const key = await getStripeKey();
      const hasKey = Boolean(key);
      log.debug("stripe-check-key execute returning", { hasKey });
      return [hasKey ? "Stripe key: present" : "Stripe key: NOT FOUND"];
    },
  });

  registerCommand({
    name: "stripe-list-customers",
    desc: "List recent Stripe customers (up to 10)",
    subsystem: "stripe",
    tab: "users",
    execute: async (_ctx) => {
      log.debug("stripe-list-customers execute called");
      const key = await getStripeKey();
      if (!key) {
        log.debug("stripe-list-customers execute: no key");
        return ["ERROR: Stripe key not configured"];
      }
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      const Stripe = (require("stripe") as { default: typeof import("stripe").default }).default;
      const stripe = new Stripe(key);
      const customers = await stripe.customers.list({ limit: 10 });
      log.debug("stripe-list-customers execute returning", { count: customers.data.length });
      if (customers.data.length === 0) return ["(no customers)"];
      return customers.data.map(
        (c) => `${c.id}  ${c.email ?? "(no email)"}  ${c.name ?? ""}`
      );
    },
  });

  registerCommand({
    name: "stripe-cancel-subscription",
    desc: "Cancel the selected Stripe subscription — destructive",
    subsystem: "stripe",
    tab: "users",
    requiresContext: "trial",
    destructive: true,
    execute: async (ctx) => {
      log.debug("stripe-cancel-subscription execute called", { hasSubId: Boolean(ctx.selectedSubId) });
      const key = await getStripeKey();
      if (!key) {
        log.debug("stripe-cancel-subscription execute: no key");
        return ["ERROR: Stripe key not configured"];
      }
      if (!ctx.selectedSubId) {
        log.debug("stripe-cancel-subscription execute: no sub selected");
        return ["ERROR: No subscription selected"];
      }
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      const Stripe = (require("stripe") as { default: typeof import("stripe").default }).default;
      const stripe = new Stripe(key);
      const sub = await stripe.subscriptions.cancel(ctx.selectedSubId);
      log.debug("stripe-cancel-subscription execute returning", { status: sub.status });
      return [`Cancelled subscription ${ctx.selectedSubId}: status=${sub.status}`];
    },
  });

  log.debug("registerStripeCommands returning");
}
