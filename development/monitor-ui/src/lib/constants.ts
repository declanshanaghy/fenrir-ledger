import type { Job } from "./types";

export const AGENT_NAMES: Record<string, string> = {
  firemandecko: "FiremanDecko",
  loki: "Loki",
  luna: "Luna",
  freya: "Freya",
  heimdall: "Heimdall",
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
