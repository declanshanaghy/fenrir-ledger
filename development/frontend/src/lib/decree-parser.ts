/**
 * decree-parser.ts — TypeScript implementation of the Decree Complete block parser.
 *
 * The Decree Complete block is structured output emitted by Fenrir Ledger agents at
 * the end of every session. It is rune-delimited and machine-parseable.
 *
 * Runtime source (brandify, Node.js ESM):
 *   .claude/skills/brandify-agent/scripts/agent-identity.mjs
 *
 * Keep the regex logic in sync between this file and agent-identity.mjs.
 */

/** Rune delimiter constants */
export const DECREE_DELIMITER_OPEN  = "᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭";
export const DECREE_DELIMITER_CLOSE = "᛭᛭᛭ END DECREE ᛭᛭᛭";

/** A parsed check entry from the CHECKS section */
export interface DecreeCheck {
  name: string;
  result: string;
}

/** Structured result of a parsed DECREE COMPLETE block */
export interface DecreeBlock {
  /** GitHub issue number (string, e.g. "1077") */
  issue: string | null;
  /** Agent verdict label, e.g. DONE, PASS, FAIL, DELIVERED */
  verdict: string | null;
  /** PR URL, or null if not present / N/A */
  pr: string | null;
  /** Summary bullet points */
  summary: string[];
  /** Parsed CHECKS entries */
  checks: DecreeCheck[];
  /** Agent name from SEAL line */
  sealAgent: string | null;
  /** Rune signature from SEAL line */
  sealRunes: string | null;
  /** Agent title from SEAL line */
  sealTitle: string | null;
  /** SIGNOFF quote */
  signoff: string | null;
  /** Format that was detected: "canonical" | "box-drawing" | "freeform" */
  format?: "canonical" | "box-drawing" | "freeform";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip emoji from a string */
function stripEmoji(s: string): string {
  return s
    .replace(/[❌✅🔴🟢⚠️🚫✔️❎]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .trim();
}

/** Normalise verdict: map legacy deviations to canonical values */
function normaliseVerdict(raw: string): string {
  const cleaned = stripEmoji(raw).toUpperCase().trim();
  if (cleaned === "COMPLETE" || cleaned === "SUCCESS") return "DONE";
  return cleaned;
}

/** Normalise a raw PR value — returns null for placeholder values */
function normalisePr(raw: string | null): string | null {
  if (!raw) return null;
  if (raw === "N/A" || raw === "none" || raw === "-") return null;
  return raw;
}

/** Extract summary bullets from the SUMMARY section of a canonical decree body */
function extractSummary(body: string): string[] {
  const summaryMatch = body.match(/^SUMMARY:\s*\n((?:\s*[-*]\s*.+\n?)+)/m);
  if (!summaryMatch?.[1]) return [];
  return summaryMatch[1]
    .split("\n")
    .map(l => l.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
}

/** Convert a single CHECKS line into a DecreeCheck entry */
function parseCheckLine(line: string): DecreeCheck {
  const cp = line.match(/^(.+?):\s*(.+)$/);
  if (cp) {
    return { name: cp[1]?.trim() ?? line, result: cp[2]?.trim() ?? "" };
  }
  return { name: line, result: "" };
}

/** Extract CHECKS entries from the CHECKS section of a canonical decree body */
function extractCanonicalChecks(body: string): DecreeCheck[] {
  const checksMatch = body.match(/^CHECKS:\s*\n([\s\S]*?)(?=^(?:SEAL|SIGNOFF):\s|᛭᛭᛭\s*END DECREE)/m);
  if (!checksMatch?.[1]) return [];
  return checksMatch[1]
    .split("\n")
    .map(l => l.replace(/^\s*[-*]?\s*/, "").trim())
    .filter(Boolean)
    .map(parseCheckLine);
}

/** Parse the SEAL line into its three parts */
function parseSealLine(sealLine: string | null): { sealAgent: string | null; sealRunes: string | null; sealTitle: string | null } {
  if (!sealLine) return { sealAgent: null, sealRunes: null, sealTitle: null };
  const parts = sealLine.split("·").map(p => p.trim());
  return {
    sealAgent: parts[0] ?? null,
    sealRunes: parts[1] ?? null,
    sealTitle: parts[2] ?? null,
  };
}

/** Extract checks from box-drawing or freeform content */
function extractFallbackChecks(text: string): DecreeCheck[] {
  const checks: DecreeCheck[] = [];
  // Pre-normalise: replace emoji with text equivalents, strip box-drawing chars
  const normalized = text
    .replace(/✅/g, "PASS")
    .replace(/❌/g, "FAIL")
    .replace(/[\u2500-\u257F║╔╗╚╝╠╣╦╩╬═]+/g, " ");
  // Match "checkname: VALUE" — capture only first non-space token as value
  const checkRe = /\b(tsc|build|vitest|playwright|owasp|requireauth|secrets|wireframes|interactions|accessibility|product-brief|acceptance-criteria|backlog)\b\s*:\s*(\S+)/gi;
  let m: RegExpExecArray | null;
  while ((m = checkRe.exec(normalized)) !== null) {
    const name = (m[1] ?? "").toLowerCase();
    const rawVal = (m[2] ?? "").trim();
    if (rawVal) checks.push({ name, result: rawVal });
  }
  return checks;
}

// ── Canonical parser (Format 1: rune-delimited) ───────────────────────────────

/**
 * Parse a DECREE COMPLETE block from raw agent text output.
 *
 * Returns null if no valid decree block is found.
 * A block is considered valid if it has at least one of: issue number or verdict.
 *
 * @param text - Raw text to scan (may span multiple lines)
 */
export function parseDecreeBlock(text: string | null | undefined): DecreeBlock | null {
  if (!text || typeof text !== "string") return null;

  // Try canonical rune-delimited block first (Format 1)
  const canonical = parseCanonicalDecreeBlock(text);
  if (canonical) return canonical;

  // Try box-drawing format (Format 2: ╔...╚)
  const boxDrawing = parseBoxDrawingDecreeBlock(text);
  if (boxDrawing) return boxDrawing;

  // Try freeform format (Format 3/4: plain text or markdown)
  const freeform = parseFreeformDecreeBlock(text);
  if (freeform) return freeform;

  return null;
}

/** Parse canonical rune-delimited decree (Format 1) */
function parseCanonicalDecreeBlock(text: string): DecreeBlock | null {
  // Match rune-delimited block (flexible whitespace/newlines around delimiters)
  const blockRe = /᛭᛭᛭\s*DECREE COMPLETE\s*᛭᛭᛭([\s\S]*?)᛭᛭᛭\s*END DECREE\s*᛭᛭᛭/;
  const match = text.match(blockRe);
  if (!match) return null;

  const body: string = match[1] ?? "";

  // ISSUE: #NNNN
  const issueMatch = body.match(/^ISSUE:\s*#?(\d+)/m);
  const issue: string | null = issueMatch?.[1] ?? null;

  // VERDICT: <label>
  const verdictMatch = body.match(/^VERDICT:\s*(.+)$/m);
  const verdict: string | null = verdictMatch ? (verdictMatch[1]?.trim() ?? null) : null;

  // PR: <url or N/A or none>
  const prMatch = body.match(/^PR:\s*(.+)$/m);
  const prRaw: string | null = prMatch ? (prMatch[1]?.trim() ?? null) : null;
  const pr = normalisePr(prRaw);

  // SUMMARY, CHECKS, SEAL, SIGNOFF — extracted via helpers
  const summary = extractSummary(body);
  const checks = extractCanonicalChecks(body);

  const sealMatch = body.match(/^SEAL:\s*(.+)$/m);
  const { sealAgent, sealRunes, sealTitle } = parseSealLine(sealMatch?.[1] ?? null);

  const signoffMatch = body.match(/^SIGNOFF:\s*(.+)$/m);
  const signoff: string | null = signoffMatch ? (signoffMatch[1]?.trim() ?? null) : null;

  // Require at least issue or verdict to be a valid decree
  if (!issue && !verdict) return null;

  return { issue, verdict, pr, summary, checks, sealAgent, sealRunes, sealTitle, signoff, format: "canonical" };
}

/**
 * Parse box-drawing format decree (Format 2: ╔...╚).
 * Extracts ISSUE, VERDICT, PR, and CHECKS where available.
 * Returns null if this does not look like a box-drawing decree.
 */
export function parseBoxDrawingDecreeBlock(text: string): DecreeBlock | null {
  if (!/╔/.test(text) || !/DECREE/i.test(text)) return null;

  // Issue
  const issueM = text.match(/Issue:?\s*#?(\d+)/i);
  const issue: string | null = issueM?.[1] ?? null;

  // Verdict — strip emoji, normalise
  const verdictM = text.match(/Verdict:?\s*([\w❌✅🔴🟢 ]+)/i);
  const verdict: string | null = verdictM?.[1] ? normaliseVerdict(verdictM[1]) : null;

  // PR
  const prM = text.match(/PR:?\s*(https:\/\/\S+|#\d+)/i);
  const pr: string | null = prM?.[1] ?? null;

  // Checks
  const checks = extractFallbackChecks(text);

  if (!issue && !verdict) return null;

  return {
    issue,
    verdict,
    pr,
    summary: [],
    checks,
    sealAgent: null,
    sealRunes: null,
    sealTitle: null,
    signoff: null,
    format: "box-drawing",
  };
}

/**
 * Parse freeform decree (Format 3: plain key-value, Format 4: markdown).
 * Returns null if this does not look like a freeform decree.
 */
export function parseFreeformDecreeBlock(text: string): DecreeBlock | null {
  // Skip if this looks like a partial canonical decree (has rune delimiter chars)
  if (/᛭/.test(text)) return null;
  if (!/(Decree|DECREE|AGENT)/i.test(text)) return null;
  if (!/(VERDICT|Verdict|ISSUE|Issue)/i.test(text)) return null;

  // Issue
  const issueM = text.match(/(?:ISSUE|Issue):?\s*#?(\d+)/i);
  const issue: string | null = issueM?.[1] ?? null;

  // Verdict — prefer explicit VERDICT: field; fall back to STATUS: only if absent
  const verdictExplicit = text.match(/(?:VERDICT|Verdict):?\s*\*{0,2}([\w❌✅🔴🟢 ]+)\*{0,2}/i);
  const verdictStatus   = text.match(/(?:STATUS|Status):?\s*\*{0,2}([\w❌✅🔴🟢 ]+)\*{0,2}/i);
  const verdictRaw = (verdictExplicit ?? verdictStatus)?.[1] ?? null;
  const verdict: string | null = verdictRaw ? normaliseVerdict(verdictRaw) : null;

  // PR
  const prM = text.match(/PR:?\s*(https:\/\/\S+|#\d+)/i);
  const pr: string | null = prM?.[1] ?? null;

  // Checks
  const checks = extractFallbackChecks(text);

  if (!issue && !verdict) return null;

  return {
    issue,
    verdict,
    pr,
    summary: [],
    checks,
    sealAgent: null,
    sealRunes: null,
    sealTitle: null,
    signoff: null,
    format: "freeform",
  };
}
