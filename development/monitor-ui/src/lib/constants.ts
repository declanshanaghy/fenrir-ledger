import type { Job } from "./types";

export const AGENT_NAMES: Record<string, string> = {
  firemandecko: "FiremanDecko",
  loki: "Loki",
  luna: "Luna",
  freya: "Freya",
  heimdall: "Heimdall",
};

export const AGENT_TITLES: Record<string, string> = {
  firemandecko: "Principal Engineer",
  loki: "QA Tester",
  luna: "UX Designer",
  freya: "Product Owner",
  heimdall: "Security Specialist",
};

export const AGENT_AVATARS: Record<string, string> = {
  firemandecko: "/agents/fireman-decko-dark.png",
  loki: "/agents/loki-dark.png",
  luna: "/agents/luna-dark.png",
  freya: "/agents/freya-dark.png",
  heimdall: "/agents/heimdall-dark.png",
};

export const AGENT_COLORS: Record<string, string> = {
  firemandecko: "#4ecdc4",
  loki: "#a78bfa",
  luna: "#6b8afd",
  freya: "#f0b429",
  heimdall: "#ef4444",
};

export const STATUS_ICONS: Record<Job["status"], string> = {
  running: "\u25CF",   // ● filled circle
  succeeded: "\u2713", // ✓ checkmark
  failed: "\u2717",    // ✗ cross
  pending: "\u29D7",   // ⧗ hourglass
};

export const STATUS_COLORS: Record<Job["status"], string> = {
  running: "#4ecdc4",
  succeeded: "#22c55e",
  failed: "#ef4444",
  pending: "#f0b429",
};

export const STATUS_LABELS: Record<Job["status"], string> = {
  running: "running",
  succeeded: "succeeded",
  failed: "FAILED",
  pending: "pending",
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
