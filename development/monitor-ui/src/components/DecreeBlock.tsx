import React, { useState } from "react";
import { AGENT_AVATARS, AGENT_COLORS, AGENT_NAMES, AGENT_RUNE_NAMES, AGENT_TITLES } from "../lib/constants";

// ── Decree detection ──────────────────────────────────────────────────────────

const DECREE_START_RE = /᛭᛭᛭\s*DECREE COMPLETE\s*᛭᛭᛭/;
const DECREE_END_RE   = /᛭᛭᛭\s*END DECREE\s*᛭᛭᛭/;

/** Returns true if the text contains a full ᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭ … ᛭᛭᛭ END DECREE ᛭᛭᛭ block */
export function isDecreeBlock(text: string): boolean {
  return DECREE_START_RE.test(text) && DECREE_END_RE.test(text);
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
}

function parseDecree(text: string): ParsedDecree {
  // Extract content between delimiters
  const startMatch = DECREE_START_RE.exec(text);
  const endMatch   = DECREE_END_RE.exec(text);
  const content = (startMatch && endMatch)
    ? text.slice(startMatch.index + startMatch[0].length, endMatch.index).trim()
    : text;

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
  const agentKey = agentNameMatch ? agentNameMatch[1].toLowerCase() : "";

  return { issue, verdict, pr, summary, checks, seal, signoff, agentKey };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DecreeBlockProps {
  text: string;
  /** agentKey from job context, used as fallback when SEAL parse fails */
  agentKey?: string;
  agentName?: string;
  onAvatarClick?: (agentKey: string) => void;
}

export function DecreeBlock({ text, agentKey: jobAgentKey, onAvatarClick }: DecreeBlockProps) {
  const decree = parseDecree(text);
  const agentKey  = decree.agentKey || jobAgentKey || "";
  const agentName = AGENT_NAMES[agentKey] ?? decree.agentKey ?? "Agent";
  const agentTitle = AGENT_TITLES[agentKey] ?? "";
  const agentRunes = AGENT_RUNE_NAMES[agentKey] ?? "";
  const agentColor = AGENT_COLORS[agentKey] ?? "#c9920a";
  const avatar     = AGENT_AVATARS[agentKey];

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

  return (
    <div
      className="decree-card"
      style={{ borderLeftColor: agentColor } as React.CSSProperties}
      aria-label={`Decree from ${agentName}: verdict ${decree.verdict}`}
    >
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
            {agentRunes && <span className="decree-card-agent-runes" aria-hidden="true">{agentRunes}</span>}
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
      <div className="decree-card-verdict-row" aria-label={`Verdict: ${decree.verdict}`}>
        <span className="decree-card-verdict-label">VERDICT</span>
        <span className="decree-card-verdict-value" style={{ color: verdictColor }}>
          {decree.verdict}
        </span>
        {decree.pr && (
          <a
            className="decree-card-pr-link"
            href={decree.pr}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Pull request: ${decree.pr}`}
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
                return (
                  <li key={i} className="decree-card-check-item">
                    <span className="decree-card-check-name">{check.name}</span>
                    <span className="decree-card-check-value" style={{ color: checkColor }}>{check.value}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Seal + Signoff ── */}
      <div className="decree-card-footer" aria-label="Decree seal and signoff">
        <div className="decree-card-seal-band" aria-hidden="true">᛭ · ᛭ · ᛭</div>
        {decree.seal && <div className="decree-card-seal">{decree.seal}</div>}
        {decree.signoff && <div className="decree-card-signoff">&ldquo;{decree.signoff}&rdquo;</div>}
        <div className="decree-card-seal-band" aria-hidden="true">᛭ · ᛭ · ᛭</div>
      </div>
    </div>
  );
}
