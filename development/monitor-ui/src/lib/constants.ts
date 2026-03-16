/**
 * Agent identity constants for Fenrir Ledger monitor UI.
 *
 * Canonical source for agent identity data (names, runes, signoffs, verdicts):
 *   .claude/skills/brandify-agent/scripts/agent-identity.mjs
 *
 * Keep these in sync when adding or renaming agents.
 */
import type { Job } from "./types";

export const AGENT_NAMES: Record<string, string> = {
  firemandecko: "FiremanDecko",
  loki: "Loki",
  luna: "Luna",
  freya: "Freya",
  heimdall: "Heimdall",
  odin: "Odin",
};

export const AGENT_TITLES: Record<string, string> = {
  firemandecko: "Principal Engineer",
  loki: "QA Tester",
  luna: "UX Designer",
  freya: "Product Owner",
  heimdall: "Security Specialist",
  odin: "All-Father",
};

export const AGENT_AVATARS: Record<string, string> = {
  firemandecko: "/agents/fireman-decko-dark.png",
  loki: "/agents/loki-dark.png",
  luna: "/agents/luna-dark.png",
  freya: "/agents/freya-dark.png",
  heimdall: "/agents/heimdall-dark.png",
  odin: "/agents/odin-dark.png",
};

export const AGENT_LIGHT_AVATARS: Record<string, string> = {
  firemandecko: "/profiles/fireman-decko-light.png",
  loki: "/profiles/loki-light.png",
  luna: "/profiles/luna-light.png",
  freya: "/profiles/freya-light.png",
  heimdall: "/profiles/heimdall-light.png",
  odin: "/profiles/odin-light.png",
};

export const AGENT_COLORS: Record<string, string> = {
  firemandecko: "#4ecdc4",
  loki: "#a78bfa",
  luna: "#6b8afd",
  freya: "#f0b429",
  heimdall: "#ef4444",
  odin: "#c9920a",
};

export const AGENT_RUNE_NAMES: Record<string, string> = {
  firemandecko: "ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ",
  loki:         "ᛚᛟᚲᛁ",
  luna:         "ᛚᚢᚾᚨ",
  freya:        "ᚠᚱᛖᛃᚨ",
  heimdall:     "ᚺᛖᛁᛗᛞᚨᛚᛚ",
  odin:         "ᛟᛞᛁᚾ",
  _fallback:    "ᚨᛊᚷᚨᚱᛞ",
};

export const AGENT_RUNE_TITLES: Record<string, string> = {
  firemandecko: "ᛈᚱᛁᚾᚲᛁᛈᚨᛚ ᛖᚾᚷᛁᚾᛖᛖᚱ",
  loki:         "ᛩᚨ ᛏᛖᛊᛏᛖᚱ",
  luna:         "ᚢᛉ ᛞᛖᛊᛁᚷᚾᛖᚱ",
  freya:        "ᛈᚱᛟᛞᚢᚲᛏ ᛟᚹᚾᛖᚱ",
  heimdall:     "ᛊᛖᚲᚢᚱᛁᛏᛃ ᛊᛈᛖᚲᛁᚨᛚᛁᛊᛏ",
};

export const AGENT_QUOTES: Record<string, string> = {
  firemandecko: "Not with words but with fire and iron is the world built — strike true, forge deep, let no flaw survive the flame",
  loki:         "Every truth hides a lie, every build hides a flaw — I am the crack in the armor that saves you before battle",
  luna:         "By moonlight are the hidden paths revealed — that which cannot be seen cannot be walked",
  freya:        "I have walked the nine worlds in sorrow and in glory — I know what is worth building before the first stone is laid",
  heimdall:     "Nothing passes the Bifröst without my knowing — I neither sleep nor blink, and neither shall your secrets slip past me",
  odin:         "I hung on that windy tree for nine long nights, wounded by a spear, offered to myself — and from that sacrifice I drew the runes",
  _fallback:    "From Asgard this decree is issued — let it be fulfilled",
};

export const AGENT_DESCRIPTIONS: Record<string, string> = {
  firemandecko: "FiremanDecko is the Principal Engineer of Fenrir Ledger — architect, implementer, and keeper of the forge. He receives the Product Design Brief and produces architecture, technical specifications, and working code, owning the full technical lifecycle from design through implementation.",
  loki:         "Loki is the QA Tester of Fenrir Ledger — the trickster who finds every crack in the armour before the enemy does. He validates implementations, writes Playwright tests, and files defects with a devil\u2019s advocate mindset. Nothing ships without his blessing.",
  luna:         "Luna is the UX Designer of Fenrir Ledger — she illuminates the hidden paths so that users never stumble in the dark. She produces wireframes, interaction specs, accessibility guidelines, and component specs. She collaborates with Freya before handing designs to FiremanDecko.",
  freya:        "Freya is the Product Owner of Fenrir Ledger — she has walked the nine worlds and knows what is worth building before the first stone is laid. She owns the product vision, maintains the backlog, and produces the Product Design Brief that sets the team in motion.",
  heimdall:     "Heimdall is the Security Specialist of Fenrir Ledger — the ever-wakeful guardian of the Bifr\u00F6st. He audits code for OWASP Top 10 vulnerabilities, verifies authentication patterns, ensures secrets are masked, and owns all security architecture and threat modelling.",
  odin:         "Odin is the All-Father — he watches over all nine worlds from his throne Hlidskjalf. In Fenrir Ledger, Odin orchestrates the agents, preserves session memory, and ensures every dispatch returns from its quest. He neither sleeps nor blinks.",
};

export const ERROR_TABLET_SEALS: Record<string, { runes: string; inscription: string; sub: string }> = {
  "ttl-expired": {
    runes: "ᛃᚷᚷᛞᚱᚨᛊᛁᛚ",
    inscription: "From the roots of Yggdrasil, all things return to silence",
    sub: "ᚦ — So it is carved in the world-tree — ᚦ",
  },
  "node-unreachable": {
    runes: "ᛒᛁᚠᚱᛟᛊᛏ",
    inscription: "The bridge between worlds does not always hold — seek another path",
    sub: "ᚺ — Heimdall watches, but even gods cannot hold the severed — ᚺ",
  },
};

export const WIKI_LINKS: Record<string, string> = {
  Yggdrasil:     "https://en.wikipedia.org/wiki/Yggdrasil",
  "Bifröst":     "https://en.wikipedia.org/wiki/Bifr%C3%B6st",
  Valhalla:      "https://en.wikipedia.org/wiki/Valhalla",
  "Nine Worlds": "https://en.wikipedia.org/wiki/Norse_cosmology#Nine_worlds",
  "Nine Realms": "https://en.wikipedia.org/wiki/Norse_cosmology#Nine_worlds",
  Fenrir:        "https://en.wikipedia.org/wiki/Fenrir",
  Asgard:        "https://en.wikipedia.org/wiki/Asgard",
  Gleipnir:      "https://en.wikipedia.org/wiki/Gleipnir",
  "Mj\u00F6lnir": "https://en.wikipedia.org/wiki/Mj%C3%B6lnir",
  Gjallarhorn:   "https://en.wikipedia.org/wiki/Gjallarhorn",
  Norns:         "https://en.wikipedia.org/wiki/Norns",
  "Huginn and Muninn": "https://en.wikipedia.org/wiki/Huginn_and_Muninn",
};

export const STATUS_ICONS: Record<Job["status"], string> = {
  running: "\u25CF",   // ● filled circle
  succeeded: "\u2713", // ✓ checkmark
  failed: "\u2717",    // ✗ cross
  pending: "\u29D7",   // ⧗ hourglass
  purged: "\u25E6",    // ◦ small open circle (pod reaped, logs unavailable via kubectl)
  cached: "\uD83D\uDCCC", // 📌 pin — pinned to Odin's memory
};

export const STATUS_COLORS: Record<Job["status"], string> = {
  running: "#4ecdc4",
  succeeded: "#22c55e",
  failed: "#ef4444",
  pending: "#f0b429",
  purged: "#606070",   // gray — pod reaped by K8s GC
  cached: "#c9920a",   // gold — pinned in Odin's memory
};

export const STATUS_LABELS: Record<Job["status"], string> = {
  running: "running",
  succeeded: "succeeded",
  failed: "FAILED",
  pending: "pending",
  purged: "purged",    // pod reaped, JSONL logs still viewable
  cached: "pinned",    // preserved in localStorage after pod reap
};

export const ODIN_QUOTES = [
  "I hung on that windy tree for nine long nights. What\u2019s a failed build to that?",
  "I gave my eye for wisdom. You lot better not waste it on sloppy commits.",
  "The wolves are always hungry. Ship or be devoured.",
  "I see all nine worlds from Hlidskjalf. I can certainly see your merge conflicts.",
  "Even Ragnarok has a sprint deadline.",
  "The All-Father watches. The All-Father judges. The All-Father merges.",
  "Every rune I carved cost blood. Every PR you ship better be worth it.",
  "Fenrir breaks chains. We break annual fees. Same energy.",
  "My spear Gungnir never misses its mark. Your tests should aspire to the same.",
] as const;

export function randomQuote(): string {
  return ODIN_QUOTES[Math.floor(Math.random() * ODIN_QUOTES.length)] ?? ODIN_QUOTES[0];
}

export function toolBadgeClass(name: string): string {
  const n = name.toLowerCase();
  if (n === "bash") return "bash";
  if (n === "read" || n === "grep" || n === "glob") return "read";
  if (n === "edit" || n === "multiedit") return "edit";
  if (n === "write") return "write";
  if (n === "agent") return "agent";
  return "";
}

/** Categorize a tool call by what it's doing for batch summaries */
export function toolCategory(name: string, input?: Record<string, unknown>): string {
  const cmd = String(input?.command ?? "");
  const path = String(input?.file_path ?? input?.pattern ?? "");

  if (name === "TodoWrite" || name === "TodoUpdate") return "tracking";
  if (name === "Read" || name === "Grep" || name === "Glob") return "reading";
  if (name === "Edit" || name === "MultiEdit") return "editing";
  if (name === "Write") return "writing";
  if (name === "Agent") return "delegating";

  if (name === "Bash") {
    if (/git\s+(add|commit|push)/.test(cmd)) return "committing";
    if (/git\s+(fetch|rebase|pull|merge)/.test(cmd)) return "syncing";
    if (/git\s+(log|diff|status|branch)/.test(cmd)) return "inspecting";
    if (/verify\.sh|tsc|--noEmit/.test(cmd)) return "verifying";
    if (/vitest|playwright|jest/.test(cmd)) return "testing";
    if (/next\s+build|npm\s+run\s+build/.test(cmd)) return "building";
    if (/gh\s+issue/.test(cmd)) return "issue ops";
    if (/gh\s+pr/.test(cmd)) return "PR ops";
    if (/npm\s+(ci|install)|npx/.test(cmd)) return "installing";
    if (/curl|wget/.test(cmd)) return "fetching";
    if (/kubectl|helm/.test(cmd)) return "k8s ops";
    if (/rm\s+-rf|mkdir/.test(cmd)) return "cleanup";
  }

  return path ? `${name.toLowerCase()} ${path.split("/").pop() ?? ""}` : name.toLowerCase();
}

/** Build a smart summary for a batch of tools */
export function batchSummary(tools: Array<{ toolName?: string; toolInput?: string }>): string {
  const categories: Record<string, number> = {};
  for (const t of tools) {
    let parsed: Record<string, unknown> | undefined;
    try { parsed = t.toolInput ? JSON.parse(t.toolInput) : undefined; } catch { /* */ }
    const cat = toolCategory(t.toolName ?? "", parsed);
    categories[cat] = (categories[cat] ?? 0) + 1;
  }
  const parts = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => count > 1 ? `${count} ${cat}` : cat);
  return parts.join(", ");
}

export function toolPreview(name: string, input?: Record<string, unknown>): string {
  if (!input) return "";
  if (name === "Bash" && input.command) return String(input.command).slice(0, 120);
  if ((name === "Read" || name === "Edit" || name === "Write") && input.file_path)
    return String(input.file_path);
  if ((name === "Grep" || name === "Glob") && input.pattern)
    return String(input.pattern);
  const keys = Object.keys(input);
  const firstKey = keys[0];
  if (firstKey !== undefined) return String(input[firstKey]).slice(0, 80);
  return "";
}
