import React, { useState } from "react";
import { AGENT_AVATARS, AGENT_LIGHT_AVATARS, AGENT_COLORS, AGENT_NAMES, AGENT_RUNE_NAMES, AGENT_TITLES } from "../lib/constants";
import { useTheme } from "../hooks/useTheme";

// ── Decree detection ──────────────────────────────────────────────────────────

const DECREE_START_RE = /᛭᛭᛭\s*DECREE COMPLETE\s*᛭᛭᛭/;
const DECREE_END_RE   = /᛭᛭᛭\s*END DECREE\s*᛭᛭᛭/;

/** Returns true if the text contains a canonical or fallback decree block */
export function isDecreeBlock(text: string): boolean {
  if (DECREE_START_RE.test(text) && DECREE_END_RE.test(text)) return true;
  // Box-drawing Format 2: has ╔ AND DECREE somewhere
  if (/╔/.test(text) && /DECREE/i.test(text)) return true;
  // Freeform Format 3/4: has (Decree or DECREE) AND (VERDICT or ISSUE)
  if (/(Decree|DECREE)/i.test(text) && /(VERDICT|Verdict|ISSUE|Issue)/i.test(text)) return true;
  return false;
}

// ── Parsing ───────────────────────────────────────────────────────────────────

interface ParsedDecree {
  issue: string;
  verdict: string;
  pr: string | null;
  summary: string[];
  checks: Array<{ name: string; value: string }>;
  seal: string;
  signoff: string;
  agentKey: string;
  format: "canonical" | "box-drawing" | "freeform";
}

/** Strip emoji from a verdict string */
function stripEmoji(s: string): string {
  return s
    .replace(/[❌✅🔴🟢⚠️🚫✔️❎]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .trim();
}

/** Normalise verdicts: map common deviations to canonical values */
function normaliseVerdict(raw: string): string {
  const cleaned = stripEmoji(raw).toUpperCase().trim();
  if (cleaned === "COMPLETE" || cleaned === "SUCCESS") return "DONE";
  return cleaned;
}

/** Extract agentKey from a box-drawing header line */
function extractAgentFromBoxTitle(text: string): string {
  const m = text.match(/(?:FIREMAN\s*DECKO|FIREMANDECKO)/i);
  if (m) return "firemandecko";
  if (/\bLOKI\b/i.test(text)) return "loki";
  if (/\bLUNA\b/i.test(text)) return "luna";
  if (/\bHEIMDALL\b/i.test(text)) return "heimdall";
  if (/\bFREYA\b/i.test(text)) return "freya";
  return "";
}

/** Parse checks from lines containing tool names followed by PASS/FAIL/emoji */
function parseCheckLines(text: string): Array<{ name: string; value: string }> {
  const checks: Array<{ name: string; value: string }> = [];
  const checkRe = /\b(tsc|build|vitest|playwright|owasp|requireauth|secrets|wireframes|interactions|accessibility|product-brief|acceptance-criteria|backlog)\b[:\s]+([^\n║╝╚╣]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = checkRe.exec(text)) !== null) {
    const name = m[1]!.toLowerCase();
    let rawVal = m[2]!.trim();
    // Strip trailing box chars
    rawVal = rawVal.replace(/[║╝╚╣═╗╔╠╬╩╦╟─│┌┐└┘├┤┬┴┼]+/g, "").trim();
    // Normalise emoji indicators to text
    rawVal = rawVal.replace(/✅/g, "PASS").replace(/❌/g, "FAIL").trim();
    if (rawVal) checks.push({ name, value: rawVal });
  }
  return checks;
}

/** Parse a box-drawing format decree (Format 2: ╔...╚) */
function parseBoxDrawingDecree(text: string): ParsedDecree | null {
  if (!/╔/.test(text) || !/DECREE/i.test(text)) return null;

  let issue = "";
  let verdict = "";
  let pr: string | null = null;
  const summary: string[] = [];
  const seal = "";
  const signoff = "";

  // Issue
  const issueM = text.match(/Issue:?\s*#?(\d+)/i);
  if (issueM) issue = `#${issueM[1]}`;

  // Verdict — strip emoji, normalise
  const verdictM = text.match(/Verdict:?\s*([\w❌✅🔴🟢 ]+)/i);
  if (verdictM) verdict = normaliseVerdict(verdictM[1] ?? "");

  // PR
  const prM = text.match(/PR:?\s*(https:\/\/\S+|#\d+)/i);
  if (prM) pr = prM[1] ?? null;

  // Agent from box title
  const agentKey = extractAgentFromBoxTitle(text);

  // Checks
  const checks = parseCheckLines(text);

  if (!issue && !verdict) return null;
  return { issue, verdict, pr, summary, checks, seal, signoff, agentKey, format: "box-drawing" };
}

/** Parse a freeform decree (Format 3: plain key-value, Format 4: markdown) */
function parseFreeformDecree(text: string): ParsedDecree | null {
  if (!/(Decree|DECREE)/i.test(text)) return null;
  if (!/(VERDICT|Verdict|ISSUE|Issue)/i.test(text)) return null;

  let issue = "";
  let verdict = "";
  let pr: string | null = null;
  const summary: string[] = [];
  const seal = "";
  const signoff = "";

  // Issue
  const issueM = text.match(/(?:ISSUE|Issue):?\s*#?(\d+)/i);
  if (issueM) issue = `#${issueM[1]}`;

  // Verdict — handle bold markdown **PASS**, plain text, etc.
  const verdictM = text.match(/(?:VERDICT|Verdict|STATUS|Status):?\s*\*{0,2}([\w❌✅🔴🟢 ]+)\*{0,2}/i);
  if (verdictM) verdict = normaliseVerdict(verdictM[1] ?? "");

  // PR
  const prM = text.match(/PR:?\s*(https:\/\/\S+|#\d+)/i);
  if (prM) pr = prM[1] ?? null;

  // Agent
  const agentKey = extractAgentFromBoxTitle(text);

  // Checks
  const checks = parseCheckLines(text);

  if (!issue && !verdict) return null;
  return { issue, verdict, pr, summary, checks, seal, signoff, agentKey, format: "freeform" };
}

/** Parse canonical rune-delimited decree (Format 1) */
function parseCanonicalDecree(text: string): ParsedDecree | null {
  const startMatch = DECREE_START_RE.exec(text);
  const endMatch   = DECREE_END_RE.exec(text);
  if (!startMatch || !endMatch) return null;

  const content = text.slice(startMatch.index + startMatch[0].length, endMatch.index).trim();
  const lines = content.split("\n");
  let issue    = "";
  let verdict  = "";
  let pr: string | null = null;
  const summary: string[] = [];
  const checks: Array<{ name: string; value: string }> = [];
  let seal     = "";
  let signoff  = "";
  let inSection: "none" | "summary" | "checks" = "none";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("ISSUE:")) {
      issue = trimmed.replace(/^ISSUE:\s*/, "").trim();
      inSection = "none";
    } else if (trimmed.startsWith("VERDICT:")) {
      verdict = trimmed.replace(/^VERDICT:\s*/, "").trim();
      inSection = "none";
    } else if (trimmed.startsWith("PR:")) {
      const raw = trimmed.replace(/^PR:\s*/, "").trim();
      pr = raw === "N/A" || raw === "n/a" ? null : raw;
      inSection = "none";
    } else if (trimmed === "SUMMARY:") {
      inSection = "summary";
    } else if (trimmed === "CHECKS:") {
      inSection = "checks";
    } else if (trimmed.startsWith("SEAL:")) {
      seal = trimmed.replace(/^SEAL:\s*/, "").trim();
      inSection = "none";
    } else if (trimmed.startsWith("SIGNOFF:")) {
      signoff = trimmed.replace(/^SIGNOFF:\s*/, "").trim();
      inSection = "none";
    } else if (inSection === "summary" && trimmed.startsWith("-")) {
      summary.push(trimmed.replace(/^-\s*/, ""));
    } else if (inSection === "checks" && trimmed.startsWith("-")) {
      const checkLine = trimmed.replace(/^-\s*/, "");
      const colon = checkLine.indexOf(":");
      if (colon !== -1) {
        checks.push({ name: checkLine.slice(0, colon).trim(), value: checkLine.slice(colon + 1).trim() });
      } else {
        checks.push({ name: checkLine, value: "" });
      }
    }
  }

  // Derive agentKey from SEAL line: "FiremanDecko · … · Principal Engineer"
  const agentNameMatch = /^(\w+)/.exec(seal);
  const agentKey = agentNameMatch?.[1]?.toLowerCase() ?? "";

  return { issue, verdict, pr, summary, checks, seal, signoff, agentKey, format: "canonical" };
}

function parseDecree(text: string): ParsedDecree {
  // Try canonical first (Format 1)
  const canonical = parseCanonicalDecree(text);
  if (canonical) return canonical;

  // Try box-drawing (Format 2)
  const boxDrawing = parseBoxDrawingDecree(text);
  if (boxDrawing) return boxDrawing;

  // Try freeform (Format 3/4)
  const freeform = parseFreeformDecree(text);
  if (freeform) return freeform;

  // Fallback: empty decree
  return { issue: "", verdict: "", pr: null, summary: [], checks: [], seal: "", signoff: "", agentKey: "", format: "freeform" };
}

// ── Styling helpers ───────────────────────────────────────────────────────────

const keyframes = `
@keyframes decree-gold-glow {
  0%, 100% { box-shadow: 0 0 8px 0 rgba(201,146,10,0.30), 0 0 24px 0 rgba(201,146,10,0.12); }
  50%       { box-shadow: 0 0 16px 2px rgba(240,180,41,0.50), 0 0 40px 4px rgba(240,180,41,0.18); }
}
@keyframes decree-red-glow {
  0%, 100% { box-shadow: 0 0 8px 0 rgba(239,68,68,0.30), 0 0 24px 0 rgba(239,68,68,0.12); }
  50%       { box-shadow: 0 0 16px 2px rgba(239,68,68,0.55), 0 0 40px 4px rgba(239,68,68,0.20); }
}
@keyframes decree-shake {
  0%, 100% { transform: translateX(0); }
  15%       { transform: translateX(-4px); }
  30%       { transform: translateX(4px); }
  45%       { transform: translateX(-3px); }
  60%       { transform: translateX(3px); }
  75%       { transform: translateX(-2px); }
  90%       { transform: translateX(2px); }
}
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface DecreeBlockProps {
  text: string;
  /** agentKey from job context, used as fallback when SEAL parse fails */
  agentKey?: string;
  agentName?: string;
  onAvatarClick?: (agentKey: string) => void;
}

export function DecreeBlock({ text, agentKey: jobAgentKey, onAvatarClick }: DecreeBlockProps) {
  const { theme } = useTheme();
  const decree = parseDecree(text);
  const agentKey  = decree.agentKey || jobAgentKey || "";
  const agentName = AGENT_NAMES[agentKey] ?? decree.agentKey ?? "Agent";
  const agentTitle = AGENT_TITLES[agentKey] ?? "";
  const agentRunes = AGENT_RUNE_NAMES[agentKey] ?? "";
  const agentColor = AGENT_COLORS[agentKey] ?? "#c9920a";
  const avatarMap  = theme === "light" ? AGENT_LIGHT_AVATARS : AGENT_AVATARS;
  const avatar     = avatarMap[agentKey];

  const [summaryOpen, setSummaryOpen] = useState(true);
  const [checksOpen,  setChecksOpen]  = useState(true);

  // Verdict colouring
  const isPass = /^(PASS|DONE|DELIVERED|APPROVED|SECURED)$/i.test(decree.verdict);
  const isFail = /^FAIL$/i.test(decree.verdict);
  const verdictColor = isFail
    ? "var(--error-strong)"
    : isPass
      ? "var(--gold-bright)"
      : "var(--text-rune)";

  // Animation based on verdict
  const glowAnimation = isFail
    ? "decree-red-glow 2.5s ease-in-out infinite"
    : isPass
      ? "decree-gold-glow 3s ease-in-out infinite"
      : "none";

  const shakeAnimation = isFail ? "decree-shake 0.6s ease-out 0.1s 1" : "none";

  // Border color — thicker + glowing for decree cards
  const borderColor = isFail ? "var(--error-strong)" : agentColor;

  const isFallback = decree.format !== "canonical";

  return (
    <>
      <style>{keyframes}</style>
      <div
        className="decree-card"
        style={{
          borderLeftColor: borderColor,
          borderLeftWidth: "3px",
          animation: `${glowAnimation}, ${shakeAnimation}`,
          position: "relative",
        } as React.CSSProperties}
        aria-label={`Decree from ${agentName}: verdict ${decree.verdict}`}
      >
        {/* Format badge for non-canonical decrees */}
        {isFallback && (
          <div
            style={{
              position: "absolute",
              top: "6px",
              right: "8px",
              fontSize: "9px",
              color: "var(--text-void)",
              background: "rgba(42,42,62,0.6)",
              padding: "1px 5px",
              borderRadius: "3px",
              fontFamily: "monospace",
              letterSpacing: "0.5px",
            }}
            aria-label={`Decree format: ${decree.format} (fallback parsed)`}
          >
            {decree.format}
          </div>
        )}

        {/* ── Header ── */}
        <div className="decree-card-header">
          <div className="decree-card-identity">
            {avatar && (
              <button
                className="decree-card-avatar-btn"
                onClick={() => onAvatarClick?.(agentKey)}
                aria-label={`View ${agentName} profile`}
                title={`View ${agentName} profile`}
              >
                <img
                  className="decree-card-avatar"
                  src={avatar}
                  alt={agentName}
                  style={{ borderColor: agentColor }}
                />
              </button>
            )}
            <div className="decree-card-agent-info">
              <span className="decree-card-agent-name" style={{ color: agentColor }}>{agentName}</span>
              {agentTitle && <span className="decree-card-agent-title">{agentTitle}</span>}
              {agentRunes && (
                <span
                  className="decree-card-agent-runes"
                  aria-hidden="true"
                  style={{
                    fontSize: "11px",
                    color: agentColor,
                    opacity: 0.75,
                    letterSpacing: "2px",
                  }}
                >
                  {agentRunes}
                </span>
              )}
            </div>
          </div>
          <div className="decree-card-meta">
            <div className="decree-card-title">
              <span className="decree-card-rune-delim" aria-hidden="true">᛭᛭᛭</span>
              {" "}DECREE COMPLETE{" "}
              <span className="decree-card-rune-delim" aria-hidden="true">᛭᛭᛭</span>
            </div>
            {decree.issue && (
              <span className="decree-card-issue" aria-label={`Issue ${decree.issue}`}>
                Issue {decree.issue}
              </span>
            )}
          </div>
        </div>

        {/* ── Verdict row ── */}
        <div
          className="decree-card-verdict-row"
          aria-label={`Verdict: ${decree.verdict}`}
          style={{
            borderTop: `1px solid ${isFail ? "rgba(239,68,68,0.25)" : "rgba(201,146,10,0.20)"}`,
            borderBottom: `1px solid ${isFail ? "rgba(239,68,68,0.25)" : "rgba(201,146,10,0.20)"}`,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: isFail ? "rgba(239,68,68,0.06)" : "rgba(201,146,10,0.04)",
          }}
        >
          <span className="decree-card-verdict-label" style={{ fontSize: "10px", letterSpacing: "1.5px", color: "var(--text-void)", textTransform: "uppercase" }}>VERDICT</span>
          <span
            className="decree-card-verdict-value"
            style={{
              color: verdictColor,
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "2px",
              textShadow: isFail
                ? "0 0 12px rgba(239,68,68,0.6)"
                : isPass
                  ? "0 0 12px rgba(240,180,41,0.5)"
                  : "none",
            }}
          >
            {decree.verdict}
          </span>
          {decree.pr && (
            <a
              className="decree-card-pr-link"
              href={decree.pr}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Pull request: ${decree.pr}`}
              style={{ marginLeft: "auto" }}
            >
              PR ↗
            </a>
          )}
        </div>

        {/* ── Summary ── */}
        {decree.summary.length > 0 && (
          <div className={`decree-card-section${summaryOpen ? " open" : ""}`}>
            <button
              className="decree-card-section-header"
              onClick={() => setSummaryOpen((o) => !o)}
              aria-expanded={summaryOpen}
            >
              <span className="decree-card-section-glyph" aria-hidden="true">ᛊ</span>
              <span className="decree-card-section-title">SUMMARY</span>
              <span className="ep-group-chevron" aria-hidden="true">{"\u203A"}</span>
            </button>
            {summaryOpen && (
              <ul className="decree-card-list" aria-label="Decree summary">
                {decree.summary.map((item, i) => (
                  <li key={i} className="decree-card-list-item">{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Checks ── */}
        {decree.checks.length > 0 && (
          <div className={`decree-card-section${checksOpen ? " open" : ""}`}>
            <button
              className="decree-card-section-header"
              onClick={() => setChecksOpen((o) => !o)}
              aria-expanded={checksOpen}
            >
              <span className="decree-card-section-glyph" aria-hidden="true">ᛏ</span>
              <span className="decree-card-section-title">CHECKS</span>
              <span className="ep-group-chevron" aria-hidden="true">{"\u203A"}</span>
            </button>
            {checksOpen && (
              <ul className="decree-card-list decree-card-checks" aria-label="Decree checks">
                {decree.checks.map((check, i) => {
                  const isCheckPass = /^(PASS|COMPLETE|SECURED|DELIVERED|APPROVED|DONE)/i.test(check.value);
                  const isCheckFail = /^(FAIL|FINDINGS)/i.test(check.value);
                  const checkColor = isCheckFail
                    ? "var(--error-strong)"
                    : isCheckPass
                      ? "var(--success-strong)"
                      : "var(--text-rune)";
                  const badgeBg = isCheckFail
                    ? "rgba(239,68,68,0.15)"
                    : isCheckPass
                      ? "rgba(34,197,94,0.12)"
                      : "rgba(96,96,112,0.15)";
                  return (
                    <li key={i} className="decree-card-check-item">
                      <span className="decree-card-check-name" style={{ fontFamily: "monospace", fontSize: "12px" }}>{check.name}</span>
                      <span
                        className="decree-card-check-value"
                        style={{
                          color: checkColor,
                          background: badgeBg,
                          padding: "1px 7px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          letterSpacing: "0.8px",
                        }}
                      >
                        {check.value}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ── Seal + Signoff ── */}
        <div
          className="decree-card-footer"
          aria-label="Decree seal and signoff"
          style={{
            borderTop: `1px solid rgba(201,146,10,0.20)`,
            marginTop: "4px",
            paddingTop: "10px",
          }}
        >
          <div
            className="decree-card-seal-band"
            aria-hidden="true"
            style={{ color: agentColor, opacity: 0.5, letterSpacing: "4px", fontSize: "12px", textAlign: "center" }}
          >
            ᛭ · ᛭ · ᛭
          </div>
          {decree.seal && (
            <div
              className="decree-card-seal"
              style={{
                fontStyle: "italic",
                fontSize: "12px",
                color: "var(--gold-bright)",
                textAlign: "center",
                padding: "4px 0",
                letterSpacing: "0.5px",
              }}
            >
              {decree.seal}
            </div>
          )}
          {decree.signoff && (
            <div
              className="decree-card-signoff"
              style={{
                fontStyle: "italic",
                fontSize: "11px",
                color: "var(--text-rune)",
                textAlign: "center",
                padding: "2px 0 4px",
              }}
            >
              &ldquo;{decree.signoff}&rdquo;
            </div>
          )}
          <div
            className="decree-card-seal-band"
            aria-hidden="true"
            style={{ color: agentColor, opacity: 0.5, letterSpacing: "4px", fontSize: "12px", textAlign: "center" }}
          >
            ᛭ · ᛭ · ᛭
          </div>
        </div>
      </div>
    </>
  );
}
