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
}

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

  // Match rune-delimited block (flexible whitespace/newlines around delimiters)
  const blockRe = /᛭᛭᛭\s*DECREE COMPLETE\s*᛭᛭᛭([\s\S]*?)᛭᛭᛭\s*END DECREE\s*᛭᛭᛭/;
  const match = text.match(blockRe);
  if (!match) return null;

  const body = match[1];

  // ISSUE: #NNNN
  const issueMatch = body.match(/^ISSUE:\s*#?(\d+)/m);
  const issue = issueMatch ? issueMatch[1] : null;

  // VERDICT: <label>
  const verdictMatch = body.match(/^VERDICT:\s*(.+)$/m);
  const verdict = verdictMatch ? verdictMatch[1].trim() : null;

  // PR: <url or N/A or none>
  const prMatch = body.match(/^PR:\s*(.+)$/m);
  const prRaw = prMatch ? prMatch[1].trim() : null;
  const pr =
    prRaw && prRaw !== "N/A" && prRaw !== "none" && prRaw !== "-"
      ? prRaw
      : null;

  // SUMMARY: bullet list (lines starting with - or *)
  const summaryMatch = body.match(/^SUMMARY:\s*\n((?:\s*[-*]\s*.+\n?)+)/m);
  const summary: string[] = summaryMatch
    ? summaryMatch[1]
        .split("\n")
        .map(l => l.replace(/^\s*[-*]\s*/, "").trim())
        .filter(Boolean)
    : [];

  // CHECKS: list of "name: result" entries — stop at SEAL:, SIGNOFF:, or end delimiter
  const checksMatch = body.match(/^CHECKS:\s*\n([\s\S]*?)(?=^(?:SEAL|SIGNOFF):\s|᛭᛭᛭\s*END DECREE)/m);
  const checks: DecreeCheck[] = checksMatch
    ? checksMatch[1]
        .split("\n")
        .map(l => l.replace(/^\s*[-*]?\s*/, "").trim())
        .filter(Boolean)
        .map(l => {
          const cp = l.match(/^(.+?):\s*(.+)$/);
          return cp
            ? { name: cp[1].trim(), result: cp[2].trim() }
            : { name: l, result: "" };
        })
    : [];

  // SEAL: Agent · RuneSignature · Title
  const sealMatch = body.match(/^SEAL:\s*(.+)$/m);
  let sealAgent: string | null = null;
  let sealRunes: string | null = null;
  let sealTitle: string | null = null;
  if (sealMatch) {
    const parts = sealMatch[1].split("·").map(p => p.trim());
    sealAgent = parts[0] ?? null;
    sealRunes = parts[1] ?? null;
    sealTitle = parts[2] ?? null;
  }

  // SIGNOFF: text
  const signoffMatch = body.match(/^SIGNOFF:\s*(.+)$/m);
  const signoff = signoffMatch ? signoffMatch[1].trim() : null;

  // Require at least issue or verdict to be a valid decree
  if (!issue && !verdict) return null;

  return { issue, verdict, pr, summary, checks, sealAgent, sealRunes, sealTitle, signoff };
}
