import { exec } from "child_process";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";
import { createRequire } from "module";
import { log } from "@fenrir/logger";

const require = createRequire(import.meta.url);
const execAsync = promisify(exec);

const ADC_PATH = join(
  homedir(),
  ".config",
  "gcloud",
  "application_default_credentials.json"
);

export let firestoreClient: import("@google-cloud/firestore").Firestore | null = null;

interface AdcJson {
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
}

function readAdcJson(): AdcJson | null {
  log.debug("readAdcJson called");
  try {
    if (!existsSync(ADC_PATH)) {
      log.debug("readAdcJson: ADC file not found");
      return null;
    }
    const result = JSON.parse(readFileSync(ADC_PATH, "utf8")) as AdcJson;
    log.debug("readAdcJson returning", { hasRefreshToken: Boolean(result.refresh_token) });
    return result;
  } catch {
    log.debug("readAdcJson: parse error");
    return null;
  }
}

async function tryExistingAdc(): Promise<void> {
  log.debug("tryExistingAdc called");
  const { GoogleAuth } = require("google-auth-library") as typeof import("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  await client.getAccessToken();
  log.debug("tryExistingAdc returning");
}

async function refreshWithToken(_clientId: string, _clientSecret: string, _refreshToken: string): Promise<string> {
  log.debug("refreshWithToken called");
  const { stdout } = await execAsync("gcloud auth application-default print-access-token");
  const token = stdout.trim();
  log.debug("refreshWithToken returning", { tokenLength: token.length });
  return token;
}

export async function ensureAuthenticated(): Promise<void> {
  log.debug("ensureAuthenticated called");
  try {
    await tryExistingAdc();
    log.debug("ensureAuthenticated: existing ADC valid");
    return;
  } catch {
    // fall through
  }

  const adc = readAdcJson();
  if (adc?.refresh_token && adc?.client_id && adc?.client_secret) {
    try {
      const token = await refreshWithToken(adc.client_id, adc.client_secret, adc.refresh_token);
      if (token) {
        log.debug("ensureAuthenticated: refreshed via token");
        return;
      }
    } catch {
      // fall through
    }
  }

  log.info("Opening browser for Google authentication…");
  const { execSync } = require("child_process") as typeof import("child_process");
  try {
    execSync("gcloud auth application-default login", { stdio: "inherit" });
    log.info("gcloud login complete");
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if (/gcloud/.test(msg) || /ENOENT/.test(msg) || /not found/.test(msg)) {
      log.fatal("gcloud CLI not found — install from https://cloud.google.com/sdk/docs/install");
    } else if (/cancelled|cancel|abort/i.test(msg)) {
      log.fatal("Authentication cancelled — Odin's Spear requires Google credentials for Firestore");
    } else {
      log.fatal("Authentication failed", { error: msg });
    }
    process.exit(1);
  }
}

export async function connectFirestore(): Promise<boolean> {
  log.debug("connectFirestore called");
  const { Firestore } = require("@google-cloud/firestore") as typeof import("@google-cloud/firestore");
  firestoreClient = new Firestore({ projectId: "fenrir-ledger-prod", databaseId: "fenrir-ledger-prod" });
  await firestoreClient.listCollections();
  log.debug("connectFirestore returning");
  return true;
}

export async function loadInitialCounts(firestore: import("@google-cloud/firestore").Firestore): Promise<{ users: number; households: number }> {
  log.debug("loadInitialCounts called");
  try {
    const usersRef = firestore.collection("users").count();
    const householdsRef = firestore.collection("households").count();
    const [uSnap, hSnap] = await Promise.all([usersRef.get(), householdsRef.get()]);
    const result = {
      users: uSnap.data().count,
      households: hSnap.data().count,
    };
    log.debug("loadInitialCounts returning", { users: result.users, households: result.households });
    return result;
  } catch {
    log.debug("loadInitialCounts: error, returning zeros");
    return { users: 0, households: 0 };
  }
}
