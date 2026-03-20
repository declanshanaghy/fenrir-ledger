/**
 * Odin's Spear — Ink-based Admin TUI
 * Issue #1386: Foundation — Ink scaffold, auto-startup, tab shell
 *
 * Design reference: development/frontend/scripts/odins-spear.html
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

// ── ESM imports (Ink is ESM-first) ────────────────────────────────────────────
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import { createElement as h, useState, useEffect } from "react";
import { createRequire } from "module";
import { createConnection } from "net";
import { exec, spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";

const require = createRequire(import.meta.url);

// ── pfLog shim ─────────────────────────────────────────────────────────────────
// All async callbacks (port-forward exit, Redis error, reconnect) that may fire
// AFTER render() must go through pfLog. Never console.log after render() — it
// corrupts Ink's fullscreen buffer.

let _tuiLog = null; // set by SpearApp on mount, cleared on unmount

function pfLog(msg, isError = false) {
  if (_tuiLog) {
    _tuiLog(msg);
  } else {
    if (isError) {
      console.error(msg);
    } else {
      console.log(msg);
    }
  }
}

// ── Startup state (populated before render) ───────────────────────────────────

let initialCounts = { users: 0, households: 0 };
let initialConnStatus = { redis: false, firestore: false, stripe: false };

// ── Port-forward helpers ───────────────────────────────────────────────────────

function checkPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    setTimeout(() => { socket.destroy(); resolve(false); }, 1000);
  });
}

let _pfProc = null;

function spawnPortForward() {
  pfLog("[redis] spawning kubectl port-forward svc/redis 6379:6379 -n fenrir-app");
  _pfProc = spawn(
    "kubectl",
    ["port-forward", "svc/redis", "6379:6379", "-n", "fenrir-app"],
    { stdio: ["ignore", "pipe", "pipe"], detached: false }
  );
  _pfProc.stdout.on("data", (d) => pfLog(`[redis-pf] ${d.toString().trim()}`));
  _pfProc.stderr.on("data", (d) => pfLog(`[redis-pf] ${d.toString().trim()}`, true));
  _pfProc.on("exit", (code) => pfLog(`[redis-pf] exited (code ${code})`, code !== 0));
}

async function ensureRedisPortForward() {
  const open = await checkPortOpen("127.0.0.1", 6379);
  if (!open) {
    spawnPortForward();
    // give port-forward a moment to bind
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// ── Redis (ioredis — CJS) ──────────────────────────────────────────────────────

let _redis = null;

async function connectRedis() {
  const IORedis = require("ioredis");
  _redis = new IORedis({ host: "127.0.0.1", port: 6379, lazyConnect: true, enableOfflineQueue: false });
  _redis.on("error", (err) => pfLog(`[redis] error: ${err.message}`, true));
  _redis.on("reconnecting", () => pfLog("[redis] reconnecting…"));
  await _redis.connect();
  return true;
}

// ── Google ADC auth ────────────────────────────────────────────────────────────

const ADC_PATH = join(
  homedir(),
  ".config",
  "gcloud",
  "application_default_credentials.json"
);

function readAdcJson() {
  try {
    if (!existsSync(ADC_PATH)) return null;
    return JSON.parse(readFileSync(ADC_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function tryExistingAdc() {
  const { GoogleAuth } = require("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  await client.getAccessToken();
}

async function refreshWithToken(clientId, clientSecret, refreshToken) {
  const execAsync = promisify(exec);
  // Use gcloud to refresh — simpler than manual OAuth dance
  const { stdout } = await execAsync(
    `gcloud auth application-default print-access-token`
  );
  return stdout.trim();
}

async function ensureAuthenticated() {
  try {
    await tryExistingAdc();
    return;
  } catch {
    // fall through
  }

  const adc = readAdcJson();
  if (adc?.refresh_token && adc?.client_id && adc?.client_secret) {
    try {
      const token = await refreshWithToken(adc.client_id, adc.client_secret, adc.refresh_token);
      if (token) return;
    } catch {
      // fall through
    }
  }

  console.log("Opening browser for Google authentication...");
  const { execSync } = require("child_process");
  try {
    execSync("gcloud auth application-default login", { stdio: "inherit" });
  } catch (err) {
    const msg = err.message || String(err);
    if (/gcloud/.test(msg) || /ENOENT/.test(msg) || /not found/.test(msg)) {
      console.error("gcloud CLI not found. Install it from https://cloud.google.com/sdk/docs/install");
    } else if (/cancelled|cancel|abort/i.test(msg)) {
      console.error("Authentication cancelled. Odin's Spear requires Google credentials to access Firestore.");
    } else {
      console.error(`Authentication failed: ${msg}`);
    }
    process.exit(1);
  }
}

// ── Firestore ─────────────────────────────────────────────────────────────────

let _firestore = null;

async function connectFirestore() {
  const { Firestore } = require("@google-cloud/firestore");
  _firestore = new Firestore({ projectId: "fenrir-ledger-prod", databaseId: "fenrir-ledger-prod" });
  // ping it
  await _firestore.listCollections();
  return true;
}

// ── Stripe key ────────────────────────────────────────────────────────────────

let _stripeKey = null;

async function getStripeKey() {
  if (_stripeKey) return _stripeKey;
  // Try env first
  if (process.env.STRIPE_SECRET_KEY) {
    _stripeKey = process.env.STRIPE_SECRET_KEY;
    return _stripeKey;
  }
  // Try K8s secret via kubectl
  try {
    const execAsync = promisify(exec);
    const { stdout } = await execAsync(
      `kubectl get secret fenrir-secrets -n fenrir-app -o jsonpath='{.data.STRIPE_SECRET_KEY}' | base64 -d`
    );
    _stripeKey = stdout.trim();
    return _stripeKey;
  } catch {
    return null;
  }
}

// ── Initial counts from Firestore ─────────────────────────────────────────────

async function loadInitialCounts(firestore) {
  try {
    const usersRef = firestore.collection("users").count();
    const householdsRef = firestore.collection("households").count();
    const [uSnap, hSnap] = await Promise.all([usersRef.get(), householdsRef.get()]);
    return {
      users: uSnap.data().count,
      households: hSnap.data().count,
    };
  } catch {
    return { users: 0, households: 0 };
  }
}

// ── Auto-startup sequence ─────────────────────────────────────────────────────

async function startup() {
  // 1. Redis port-forward + connect
  console.log("Connecting to Redis…");
  try {
    await ensureRedisPortForward();
    await connectRedis();
    initialConnStatus.redis = true;
    console.log("Redis connected.");
  } catch (err) {
    console.error(`Redis: ${err.message} (continuing)`);
  }

  // 2. Google ADC
  console.log("Authenticating Google ADC…");
  try {
    await ensureAuthenticated();
    console.log("Google ADC authenticated.");
  } catch (err) {
    console.error(`ADC auth error: ${err.message}`);
    process.exit(1);
  }

  // 3. Firestore
  console.log("Connecting to Firestore…");
  try {
    await connectFirestore();
    initialConnStatus.firestore = true;
    console.log("Firestore connected.");
  } catch (err) {
    console.error(`Firestore: ${err.message} (continuing)`);
  }

  // 4. Stripe key
  try {
    const key = await getStripeKey();
    initialConnStatus.stripe = Boolean(key);
  } catch {
    initialConnStatus.stripe = false;
  }

  // 5. Initial counts
  if (_firestore) {
    initialCounts = await loadInitialCounts(_firestore);
  }
}

// ── TUI Components ─────────────────────────────────────────────────────────────

const TUI_TABS = ["Users", "Households"];
const GOLD = "#c9920a";
const GREEN = "#22c55e";
const RED = "#ef4444";
const GRAY = "#6b6b80";

/**
 * TopBar — brand + tab buttons + shortcut hints
 * Matches HTML .topbar layout
 */
function TopBar({ activeTab, onTabSwitch }) {
  return h(
    Box,
    {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingX: 2,
      borderStyle: "single",
      borderBottom: true,
      borderTop: false,
      borderLeft: false,
      borderRight: false,
      borderColor: "#1e1e2e",
    },
    // Left: brand + tabs
    h(
      Box,
      { flexDirection: "row", gap: 2 },
      h(Text, { bold: true, color: GOLD }, "ODIN'S SPEAR \u26A1"),
      h(
        Box,
        { flexDirection: "row", gap: 1 },
        TUI_TABS.map((tab, i) =>
          h(
            Box,
            {
              key: tab,
              paddingX: 1,
              backgroundColor: activeTab === i ? GOLD : undefined,
            },
            h(
              Text,
              {
                bold: activeTab === i,
                color: activeTab === i ? "#000000" : "#9b9baa",
              },
              tab
            )
          )
        )
      )
    ),
    // Right: shortcut hints
    h(
      Box,
      { flexDirection: "row", gap: 3 },
      h(Text, { color: GRAY }, "["),
      h(Text, { color: GOLD }, "/"),
      h(Text, { color: GRAY }, "] Command  ["),
      h(Text, { color: GOLD }, "^R"),
      h(Text, { color: GRAY }, "] Reload  ["),
      h(Text, { color: GOLD }, "?"),
      h(Text, { color: GRAY }, "] Help")
    )
  );
}

/**
 * StatusBar — connection dots + item count
 * Matches HTML .statusbar layout
 */
function StatusBar({ connStatus, counts, activeTab }) {
  const countLabel =
    activeTab === 0
      ? `${counts.users} user${counts.users !== 1 ? "s" : ""}`
      : `${counts.households} household${counts.households !== 1 ? "s" : ""}`;

  function StatusDot({ connected, label }) {
    return h(
      Box,
      { flexDirection: "row", gap: 1 },
      h(Text, { color: connected ? GREEN : RED }, "\u25CF"),
      h(Text, { color: GRAY }, label)
    );
  }

  return h(
    Box,
    {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingX: 2,
      borderStyle: "single",
      borderTop: true,
      borderBottom: false,
      borderLeft: false,
      borderRight: false,
      borderColor: "#1e1e2e",
    },
    h(
      Box,
      { flexDirection: "row", gap: 3 },
      h(StatusDot, { connected: connStatus.redis, label: "Redis" }),
      h(StatusDot, { connected: connStatus.firestore, label: "Firestore" }),
      h(StatusDot, { connected: connStatus.stripe, label: "Stripe" })
    ),
    h(Text, { color: GRAY }, countLabel)
  );
}

/**
 * HelpOverlay — basic keyboard shortcut grid
 * Full content comes in #1495; this is the foundation placeholder
 */
function HelpOverlay() {
  const shortcuts = [
    ["Tab", "Switch Users / Households"],
    ["Up/Down", "Navigate list"],
    ["Enter", "Select item"],
    ["Esc", "Go back / close modal"],
    ["/", "Command palette"],
    ["?", "Show this help"],
    ["d", "Delete selected item"],
    ["t", "Update tier (users)"],
    ["s", "Cancel subscription"],
    ["h", "Go to household (users)"],
    ["q", "Quit"],
  ];

  return h(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: GOLD,
      paddingX: 3,
      paddingY: 1,
      marginX: 4,
      marginY: 1,
    },
    h(Text, { bold: true, color: GOLD }, "Keyboard Shortcuts"),
    h(Box, { height: 1 }),
    ...shortcuts.map(([key, desc]) =>
      h(
        Box,
        { key, flexDirection: "row", gap: 1 },
        h(Text, { color: GOLD, bold: true, minWidth: 12 }, key),
        h(Text, { color: "#9b9baa" }, desc)
      )
    ),
    h(Box, { height: 1 }),
    h(Text, { color: GRAY, dimColor: true }, "Press any key to close")
  );
}

/**
 * CommandPaletteOverlay — placeholder stub
 * Full implementation comes in #1495
 */
function CommandPaletteOverlay() {
  return h(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: GOLD,
      paddingX: 3,
      paddingY: 1,
      marginX: 4,
      marginY: 1,
    },
    h(Text, { color: GRAY }, "Type a command\u2026"),
    h(Box, { height: 1 }),
    h(Text, { color: "#3b3b4f", dimColor: true }, "(Command palette — full impl in #1495)"),
    h(Box, { height: 1 }),
    h(Text, { color: GRAY, dimColor: true }, "Press Esc to close")
  );
}

/**
 * MainContent — master-detail split
 * Left panel ~34 cols, right panel flex-grow
 * Tab content placeholders — real content in #1387/#1388
 */
function MainContent({ activeTab, cmdStatus }) {
  const tabName = TUI_TABS[activeTab];

  return h(
    Box,
    { flexDirection: "row", flexGrow: 1 },
    // Left panel
    h(
      Box,
      {
        flexDirection: "column",
        width: 34,
        borderStyle: "single",
        borderRight: true,
        borderLeft: false,
        borderTop: false,
        borderBottom: false,
        borderColor: "#1e1e2e",
      },
      // Search placeholder
      h(
        Box,
        {
          paddingX: 1,
          paddingY: 0,
          borderStyle: "single",
          borderBottom: true,
          borderTop: false,
          borderLeft: false,
          borderRight: false,
          borderColor: "#1e1e2e",
        },
        h(Text, { color: GRAY }, "Search\u2026 (/ for commands)")
      ),
      // List placeholder
      h(
        Box,
        { flexDirection: "column", flexGrow: 1, paddingX: 1, paddingY: 1 },
        h(Text, { color: GRAY, dimColor: true }, `\u2014 ${tabName} list coming in`),
        h(Text, { color: GRAY, dimColor: true }, `  #1387/${1388} \u2014`)
      )
    ),
    // Right panel
    h(
      Box,
      {
        flexDirection: "column",
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingX: 2,
      },
      h(Text, { color: "#8a6408", bold: true }, "\u16C5"), // ᛅ rune
      h(Box, { height: 1 }),
      h(Text, { color: GRAY }, `Select a ${tabName.slice(0, -1).toLowerCase()} from the list`),
      h(Text, { color: "#3b3b4f", dimColor: true }, "Use arrow keys to navigate"),
      cmdStatus ? h(Box, { marginTop: 1 }, h(Text, { color: "#9b9baa" }, cmdStatus)) : null
    )
  );
}

/**
 * SpearApp — root component
 */
function SpearApp({ initialConnStatus: connStatus, initialCounts: counts }) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [activeTab, setActiveTab] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [cmdStatus, setCmdStatusMsg] = useState(null);
  const [connState, setConnState] = useState(connStatus);
  const [countState, setCountState] = useState(counts);

  // Register pfLog handler so async callbacks (Redis, port-forward) can surface
  // messages without writing to stdout after render
  useEffect(() => {
    _tuiLog = (msg) => setCmdStatusMsg(String(msg).slice(0, 120));
    return () => {
      _tuiLog = null;
    };
  }, []);

  useInput((input, key) => {
    // Palette open: only Esc closes it
    if (showPalette) {
      if (key.escape) setShowPalette(false);
      return;
    }

    // Help open: any key closes
    if (showHelp) {
      setShowHelp(false);
      return;
    }

    if (input === "q") {
      // Clean single-press quit
      if (_pfProc) {
        try { _pfProc.kill(); } catch { /* ignore */ }
      }
      exit();
      return;
    }

    if (input === "?") {
      setShowHelp((v) => !v);
      return;
    }

    if (input === "/") {
      setShowPalette(true);
      return;
    }

    if (key.tab) {
      setActiveTab((t) => (t + 1) % TUI_TABS.length);
      return;
    }

    if (key.ctrl && input === "r") {
      // ^R reload — stub (full impl in later stories)
      setCmdStatusMsg("Reload triggered\u2026");
      return;
    }
  });

  const termWidth = stdout?.columns ?? 80;
  const termHeight = stdout?.rows ?? 24;

  return h(
    Box,
    {
      flexDirection: "column",
      width: termWidth,
      height: termHeight,
    },
    h(TopBar, { activeTab, onTabSwitch: setActiveTab }),
    showHelp
      ? h(HelpOverlay)
      : showPalette
      ? h(CommandPaletteOverlay)
      : h(MainContent, { activeTab, cmdStatus }),
    h(StatusBar, { connStatus: connState, counts: countState, activeTab })
  );
}

// ── Entry point ────────────────────────────────────────────────────────────────

await startup();

render(
  h(SpearApp, {
    initialConnStatus,
    initialCounts,
  }),
  { fullscreen: true }
);
