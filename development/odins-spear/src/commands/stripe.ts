import { registerCommand } from "./registry.js";
import { getStripeKey } from "../lib/stripe.js";
import { log } from "@fenrir/logger";

export function registerStripeCommands(): void {
  log.debug("registerStripeCommands called");

  registerCommand({
    id: "stripe:check-key",
    label: "Stripe: Check Key",
    description: "Verify Stripe secret key is available",
    action: async () => {
      log.debug("stripe:check-key action called");
      const key = await getStripeKey();
      log.debug("stripe:check-key returning", { hasKey: Boolean(key) });
    },
  });

  log.debug("registerStripeCommands returning");
}
