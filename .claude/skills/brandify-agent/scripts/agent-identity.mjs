/**
 * agent-identity.mjs — Canonical source of truth for Fenrir Ledger agent identity.
 *
 * Imported by:
 *   - generate-agent-report.mjs (brandify HTML/MDX rendering)
 *
 * Kept in sync with:
 *   - development/monitor-ui/src/lib/constants.ts (TypeScript mirror — update both)
 *
 * Per-agent data: name, title, rune name (Elder Futhark), rune title, signoff quote,
 * decree verdict label, and callback quote (for agent-callback footer).
 */

/** Display names keyed by lowercase slug */
export const AGENT_NAMES = {
  firemandecko: "FiremanDecko",
  loki:         "Loki",
  luna:         "Luna",
  freya:        "Freya",
  heimdall:     "Heimdall",
  odin:         "Odin",
};

/** Role titles */
export const AGENT_TITLES = {
  firemandecko: "Principal Engineer",
  loki:         "QA Tester",
  luna:         "UX Designer",
  freya:        "Product Owner",
  heimdall:     "Security Specialist",
  odin:         "All-Father",
};

/** Elder Futhark rune name glyphs */
export const AGENT_RUNE_NAMES = {
  firemandecko: "ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ",
  loki:         "ᛚᛟᚲᛁ",
  luna:         "ᛚᚢᚾᚨ",
  freya:        "ᚠᚱᛖᛃᚨ",
  heimdall:     "ᚺᛖᛁᛗᛞᚨᛚᛚ",
  odin:         "ᛟᛞᛁᚾ",
  _fallback:    "ᚨᛊᚷᚨᚱᛞ",
};

/** Rune titles (runic script) */
export const AGENT_RUNE_TITLES = {
  firemandecko: "ᛈᚱᛁᚾᚲᛁᛈᚨᛚ ᛖᚾᚷᛁᚾᛖᛖᚱ",
  loki:         "ᛩᚨ ᛏᛖᛊᛏᛖᚱ",
  luna:         "ᚢᛉ ᛞᛖᛊᛁᚷᚾᛖᚱ",
  freya:        "ᛈᚱᛟᛞᚢᚲᛏ ᛟᚹᚾᛖᚱ",
  heimdall:     "ᛊᛖᚲᚢᚱᛁᛏᛃ ᛊᛈᛖᚲᛁᚨᛚᛁᛊᛏ",
};

/**
 * Per-agent signoff quote — short phrase used in decree seal and callback footer.
 * These are the canonical signoffs referenced in issue #1077.
 */
export const AGENT_SIGNOFFS = {
  FiremanDecko: "Forged in fire, tempered by craft",
  Loki:         "Tested by chaos, proven by order",
  Luna:         "Woven from moonlight, anchored in structure",
  Freya:        "Guarded by wisdom, driven by purpose",
  Heimdall:     "Watched from the rainbow bridge",
  _fallback:    "Sealed by the pack",
};

/**
 * Per-agent verdict label used in the DECREE COMPLETE block.
 * Each agent has a distinct label reflecting their role.
 */
export const AGENT_VERDICTS = {
  FiremanDecko: "DONE",
  Loki:         "PASS",   // or FAIL — agent fills in actual
  Luna:         "DELIVERED",
  Freya:        "APPROVED",
  Heimdall:     "SECURED",
  _fallback:    "COMPLETE",
};

/**
 * Callback quote — declarative statement emitted in the agent-callback footer.
 */
export const AGENT_CALLBACK_QUOTES = {
  FiremanDecko: "The forge cools, the steel holds. What was broken has been reforged stronger than before.",
  Loki:         "Every seam tested, every thread pulled. The trickster finds no fault — and that itself is suspicious.",
  Luna:         "The branches of Yggdrasil have been shaped. What the eye sees, the hand shall build.",
  Freya:        "The vision is set, the path illuminated. Brisingamen's light guides the way forward.",
  Heimdall:     "The bridge holds. No shadow passes unseen, no weakness unguarded.",
  _fallback:    "The task is done. The wolf's chain holds another day.",
};

/**
 * Spaced rune display for callback footer (decorative, not the seal rune signature).
 */
export const AGENT_CALLBACK_RUNES = {
  FiremanDecko: "ᚠ ᛁ ᚱ ᛖ ᛗ ᚨ ᚾ",
  Loki:         "ᛚ ᛟ ᚲ ᛁ",
  Luna:         "ᛚ ᚢ ᚾ ᚨ",
  Freya:        "ᚠ ᚱ ᛖ ᛃ ᚨ",
  Heimdall:     "ᚺ ᛖ ᛁ ᛗ ᛞ ᚨ ᛚ ᛚ",
  _fallback:    "ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ",
};

/**
 * Rune delimiter for the DECREE COMPLETE block.
 * ᛭ = Runic Cross Mark (U+16ED)
 */
export const DECREE_DELIMITER_OPEN  = "᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭";
export const DECREE_DELIMITER_CLOSE = "᛭᛭᛭ END DECREE ᛭᛭᛭";

/**
 * Parse a DECREE COMPLETE block from raw agent text output.
 *
 * Returns null if no decree block is found.
 * Returns a structured object with extracted fields if found.
 *
 * @param {string} text - Full raw text to scan (may span multiple lines/turns)
 * @returns {{ issue: string, verdict: string, pr: string | null, summary: string[],
 *             checks: Array<{name:string,result:string}>, sealAgent: string,
 *             sealRunes: string, sealTitle: string, signoff: string } | null}
 */
export function parseDecreeBlock(text) {
  if (!text || typeof text !== "string") return null;

  // Match rune-delimited block (allow flexible whitespace/newlines)
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
  const pr = (prRaw && prRaw !== "N/A" && prRaw !== "none" && prRaw !== "-") ? prRaw : null;

  // SUMMARY: bullet list
  const summaryMatch = body.match(/^SUMMARY:\s*\n((?:\s*[-*]\s*.+\n?)+)/m);
  const summary = summaryMatch
    ? summaryMatch[1].split("\n")
        .map(l => l.replace(/^\s*[-*]\s*/, "").trim())
        .filter(Boolean)
    : [];

  // CHECKS: list of "name: PASS/FAIL/OK/ERROR/..." — stop at SEAL:, SIGNOFF:, or end delimiter
  const checksMatch = body.match(/^CHECKS:\s*\n([\s\S]*?)(?=^(?:SEAL|SIGNOFF):\s|᛭᛭᛭\s*END DECREE)/m);
  const checks = checksMatch
    ? checksMatch[1].split("\n")
        .map(l => l.replace(/^\s*[-*]?\s*/, "").trim())
        .filter(Boolean)
        .map(l => {
          const cp = l.match(/^(.+?):\s*(.+)$/);
          return cp ? { name: cp[1].trim(), result: cp[2].trim() } : { name: l, result: "" };
        })
    : [];

  // SEAL: Agent · RuneSignature · Title
  const sealMatch = body.match(/^SEAL:\s*(.+)$/m);
  let sealAgent = null, sealRunes = null, sealTitle = null;
  if (sealMatch) {
    const parts = sealMatch[1].split("·").map(p => p.trim());
    sealAgent = parts[0] || null;
    sealRunes = parts[1] || null;
    sealTitle = parts[2] || null;
  }

  // SIGNOFF: text
  const signoffMatch = body.match(/^SIGNOFF:\s*(.+)$/m);
  const signoff = signoffMatch ? signoffMatch[1].trim() : null;

  // Must have at least issue and verdict to be a valid decree
  if (!issue && !verdict) return null;

  return { issue, verdict, pr, summary, checks, sealAgent, sealRunes, sealTitle, signoff };
}
