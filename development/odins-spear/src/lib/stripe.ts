import { exec } from "child_process";
import { promisify } from "util";
import { log } from "@fenrir/logger";

const execAsync = promisify(exec);

let stripeKey: string | null = null;

export async function getStripeKey(): Promise<string | null> {
  log.debug("getStripeKey called");
  if (stripeKey) {
    log.debug("getStripeKey: returning cached key", { keyLength: stripeKey.length });
    return stripeKey;
  }

  if (process.env["STRIPE_SECRET_KEY"]) {
    stripeKey = process.env["STRIPE_SECRET_KEY"];
    log.debug("getStripeKey: loaded from env", { keyLength: stripeKey.length });
    return stripeKey;
  }

  try {
    const { stdout } = await execAsync(
      `kubectl get secret fenrir-app-secrets -n fenrir-app -o jsonpath='{.data.STRIPE_SECRET_KEY}' | base64 -d`
    );
    stripeKey = stdout.trim();
    log.debug("getStripeKey: loaded from kubectl", { keyLength: stripeKey.length });
    return stripeKey;
  } catch {
    log.debug("getStripeKey: kubectl failed, returning null");
    return null;
  }
}
