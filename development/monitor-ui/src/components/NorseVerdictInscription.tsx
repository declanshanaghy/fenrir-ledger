/**
 * NorseVerdictInscription — inline Norse tablet for agent handoff/QA verdict messages.
 *
 * Rendered in place of the normal AgentBubble when the last assistant text block
 * contains a level-1 or level-2 heading matching /^#{1,2}\s+(Handoff|QA Verdict)/m.
 *
 * Styling: Elder Futhark rune bands (double-row), agent glyph medallion, Cinzel
 * Decorative arch title, Source Serif 4 body, JetBrains Mono rune/code bands.
 * Carve-in animation with 5-phase stagger. Respects prefers-reduced-motion.
 * Theme-adaptive: uses --void / --agent-accent CSS custom properties.
 */

import React from "react";

// ── Elder Futhark rune rows (reuse from NorseErrorTablet aesthetic) ─────────
const RUNE_ROW_TOP = "ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ";
const RUNE_ROW_BTM = "ᛟ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛊ ᛉ ᛈ ᛇ ᛃ ᛁ ᚾ ᚺ ᚹ ᚷ ᚲ ᚱ ᚨ ᚦ ᚢ ᚠ";

// ── Agent key type ──────────────────────────────────────────────────────────
export type AgentKey = "fireman-decko" | "loki" | "luna" | "heimdall" | "freya" | "generic";
export type VerdictType = "handoff" | "qa-verdict";

interface AgentVerdictConfig {
  rune: string;
  runeName: string;
  runeMeaning: string;
  accentToken: string; // CSS var name e.g. var(--agent-accent-fireman)
  archTitle: string;
  roleLabel: string;
  pledge: string;
  pledgeLinks: Record<string, string>; // term → Wikipedia URL
}

// ── Single source of truth for all agent variants ──────────────────────────
const AGENT_VERDICT_CONFIG: Record<AgentKey, AgentVerdictConfig> = {
  "fireman-decko": {
    rune: "ᚲ",
    runeName: "Kenaz",
    runeMeaning: "The Forge",
    accentToken: "var(--agent-accent-fireman)",
    archTitle: "The Forge Has Spoken",
    roleLabel: "Principal Engineer",
    pledge:
      "The forge cools. What was broken is reforged. I lay this work before the All-Father\u2019s throne upon Hli\u00F0skj\u00E1lf.",
    pledgeLinks: {
      "Hli\u00F0skj\u00E1lf": "https://en.wikipedia.org/wiki/Hli%C3%B0skj%C3%A1lf",
    },
  },
  loki: {
    rune: "ᚾ",
    runeName: "Naudhiz",
    runeMeaning: "Need / Trickery",
    accentToken: "var(--agent-accent-loki)",
    archTitle: "The Trickster Finds No Flaw",
    roleLabel: "QA Tester",
    pledge:
      "Every thread tested, every seam inspected. The Trickster finds no flaw worthy of Ragnar\u00F6k. I present this verdict to Odin, Lord of Asgard.",
    pledgeLinks: {
      "Ragnar\u00F6k": "https://en.wikipedia.org/wiki/Ragnar%C3%B6k",
      Asgard: "https://en.wikipedia.org/wiki/Asgard",
    },
  },
  luna: {
    rune: "ᛚ",
    runeName: "Laguz",
    runeMeaning: "Water / Moon",
    accentToken: "var(--agent-accent-luna)",
    archTitle: "The Moonpath Is Drawn",
    roleLabel: "UX Designer",
    pledge:
      "By moonlight I have drawn the path through the branches of Yggdrasil. These wireframes carry the vision of Freyja\u2019s hall. Odin, receive this design.",
    pledgeLinks: {
      Yggdrasil: "https://en.wikipedia.org/wiki/Yggdrasil",
      Freyja: "https://en.wikipedia.org/wiki/Freyja",
    },
  },
  heimdall: {
    rune: "ᛏ",
    runeName: "Tiwaz",
    runeMeaning: "Justice / Watchman",
    accentToken: "var(--agent-accent-heimdall)",
    archTitle: "The Bifr\u00F6st Stands Unwavering",
    roleLabel: "Security Specialist",
    pledge:
      "From the Bifr\u00F6st I have watched. No shadow passes unchallenged. This audit is sworn before Odin\u2019s one remaining eye.",
    pledgeLinks: {
      "Bifr\u00F6st": "https://en.wikipedia.org/wiki/Bifr%C3%B6st",
    },
  },
  freya: {
    rune: "ᚠ",
    runeName: "Fehu",
    runeMeaning: "Abundance / Wisdom",
    accentToken: "var(--agent-accent-freya)",
    archTitle: "The V\u00F6lva Has Spoken",
    roleLabel: "Product Owner",
    pledge:
      "The V\u00F6lva has spoken. What was foretold is now revealed. I deliver this wisdom to the throne of Valhalla.",
    pledgeLinks: {
      "V\u00F6lva": "https://en.wikipedia.org/wiki/V%C3%B6lva",
      Valhalla: "https://en.wikipedia.org/wiki/Valhalla",
    },
  },
  generic: {
    rune: "ᛟ",
    runeName: "Othalan",
    runeMeaning: "Heritage / Estate",
    accentToken: "var(--gold)",
    archTitle: "The Inscription Is Complete",
    roleLabel: "Agent",
    pledge: "What was tasked is now complete. This work is laid before the All-Father. Let the runes bear witness.",
    pledgeLinks: {},
  },
};

// ── Detection ───────────────────────────────────────────────────────────────
const VERDICT_HEADING_RE = /^#{1,2}\s+(Handoff|QA Verdict)/m;
const AGENT_NAME_RE = /(FiremanDecko|Loki|Luna|Heimdall|Freya)/i;

export function isVerdictMessage(text: string): boolean {
  return VERDICT_HEADING_RE.test(text);
}

export function normaliseAgentKey(raw: string): AgentKey {
  const k = raw.toLowerCase().replace(/[-_\s]/g, "");
  if (k === "firemandecko" || k === "fireman") return "fireman-decko";
  if (k === "loki") return "loki";
  if (k === "luna") return "luna";
  if (k === "heimdall") return "heimdall";
  if (k === "freya") return "freya";
  return "generic";
}

export function detectAgent(sessionAgentKey: string | undefined, headingText: string): AgentKey {
  if (sessionAgentKey) return normaliseAgentKey(sessionAgentKey);
  const match = AGENT_NAME_RE.exec(headingText);
  if (match?.[1]) return normaliseAgentKey(match[1]);
  return "generic";
}

export function detectVerdictType(headingText: string): VerdictType {
  return headingText.toLowerCase().includes("qa verdict") ? "qa-verdict" : "handoff";
}

function extractHeadingText(text: string): string {
  const match = VERDICT_HEADING_RE.exec(text);
  if (!match) return "";
  // Find the full heading line
  const lineStart = text.lastIndexOf("\n", match.index) + 1;
  const lineEnd = text.indexOf("\n", match.index);
  return text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).replace(/^#+\s*/, "");
}

// ── Pledge renderer with pre-defined Norse term links ──────────────────────
function renderPledgeWithLinks(pledge: string, links: Record<string, string>): React.ReactNode {
  if (Object.keys(links).length === 0) return pledge;
  const terms = Object.keys(links).sort((a, b) => b.length - a.length);
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = pledge.split(regex);
  return parts.map((part, i) =>
    links[part] ? (
      <a
        key={i}
        href={links[part]}
        target="_blank"
        rel="noopener noreferrer"
        className="nvi-norse-link"
        aria-label={`${part} (opens Wikipedia in new tab)`}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

// ── Simple inline Markdown renderer (headings, bold, inline code) ───────────
function renderInline(text: string): React.ReactNode {
  // Split on **bold** and `inline code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="nvi-md-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ── Markdown block renderer ─────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Fenced code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      nodes.push(
        <pre key={`code-${i}`} className="nvi-md-code">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      i++; // skip closing ```
      continue;
    }

    // H1
    if (/^# /.test(line)) {
      nodes.push(
        <h1 key={`h1-${i}`} className="nvi-md-h1">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // H2
    if (/^## /.test(line)) {
      nodes.push(
        <h2 key={`h2-${i}`} className="nvi-md-h2">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (/^### /.test(line)) {
      nodes.push(
        <h3 key={`h3-${i}`} className="nvi-md-h3">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={`hr-${i}`} className="nvi-md-hr" aria-hidden="true" />);
      i++;
      continue;
    }

    // Unordered list — collect consecutive items
    if (/^[-*+] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*+] /, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="nvi-md-ul">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list — collect consecutive items
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="nvi-md-ol">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Checkbox list item (- [ ] or - [x])
    if (/^- \[[ xX]\] /.test(line)) {
      const items: Array<{ checked: boolean; text: string }> = [];
      while (i < lines.length && /^- \[[ xX]\] /.test(lines[i] ?? "")) {
        const l = lines[i] ?? "";
        const checked = /^- \[[xX]\] /.test(l);
        items.push({ checked, text: l.replace(/^- \[[ xX]\] /, "") });
        i++;
      }
      nodes.push(
        <ul key={`check-${i}`} className="nvi-md-ul nvi-md-checklist">
          {items.map(({ checked, text }, j) => (
            <li key={j} className={checked ? "nvi-md-checked" : "nvi-md-unchecked"}>
              {renderInline(text)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty line — skip
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^#{1,3} /.test(lines[i] ?? "") &&
      !((lines[i] ?? "").startsWith("```")) &&
      !/^[-*+] /.test(lines[i] ?? "") &&
      !/^\d+\. /.test(lines[i] ?? "") &&
      !/^---+$/.test((lines[i] ?? "").trim())
    ) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    if (paraLines.length > 0) {
      nodes.push(
        <p key={`p-${i}`} className="nvi-md-p">
          {renderInline(paraLines.join(" "))}
        </p>
      );
    }
  }

  return nodes;
}

// ── Props ───────────────────────────────────────────────────────────────────
interface NorseVerdictInscriptionProps {
  text: string;
  agentKey?: string;
  agentName?: string;
}

// ── Component ───────────────────────────────────────────────────────────────
export function NorseVerdictInscription({ text, agentKey, agentName }: NorseVerdictInscriptionProps) {
  const headingText = extractHeadingText(text);
  const resolvedAgentKey = detectAgent(agentKey ?? agentName, headingText);
  const verdictType = detectVerdictType(headingText);
  const config = AGENT_VERDICT_CONFIG[resolvedAgentKey];

  const subtitle =
    verdictType === "qa-verdict"
      ? `${config.roleLabel} \u2014 QA Verdict Delivered`
      : `${config.roleLabel} \u2014 Handoff Complete`;

  const bodyNodes = renderMarkdown(text);

  return (
    <article
      className="nvi-shell"
      role="article"
      aria-label={`Agent verdict: ${headingText}`}
      style={{ "--agent-accent": config.accentToken } as React.CSSProperties}
    >
      {/* Double rune band — top */}
      <div className="nvi-rune-band-top" aria-hidden="true">
        <div className="nvi-rune-row">{RUNE_ROW_TOP}</div>
        <div className="nvi-rune-row">{RUNE_ROW_BTM}</div>
      </div>

      {/* Triumph keystone */}
      <div className="nvi-agent-header">
        <div
          className="nvi-glyph"
          role="img"
          aria-label={`${config.runeName} rune — ${config.runeMeaning}`}
        >
          {config.rune}
        </div>
        <div className="nvi-agent-identity">
          <span className="nvi-agent-name">{config.runeName}</span>
          <span className="nvi-arch-title">{config.archTitle}</span>
          <span className="nvi-arch-subtitle">{subtitle}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="nvi-divider" aria-hidden="true">
        ᚠ ᚢ ᚦ ᛟ ᛞ ᛜ ᛚ ᛟ ᚦ ᚢ ᚠ
      </div>

      {/* Markdown body */}
      <div className="nvi-body">{bodyNodes}</div>

      {/* Pledge seal */}
      <div className="nvi-seal">
        <p className="nvi-seal-pledge" aria-label="Agent pledge">
          &ldquo;{renderPledgeWithLinks(config.pledge, config.pledgeLinks)}&rdquo;
        </p>
        <p className="nvi-seal-futhark" aria-hidden="true">
          ᚠᚢᚦ &mdash; {config.runeMeaning} &mdash; ᚦᚢᚠ
        </p>
      </div>

      {/* Double rune band — bottom */}
      <div className="nvi-rune-band-bottom" aria-hidden="true">
        <div className="nvi-rune-row">{RUNE_ROW_BTM}</div>
        <div className="nvi-rune-row">{RUNE_ROW_TOP}</div>
      </div>
    </article>
  );
}
