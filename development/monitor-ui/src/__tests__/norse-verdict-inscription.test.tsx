/**
 * Vitest tests for issue #1019 — NorseVerdictInscription component.
 *
 * AC tested:
 * - isVerdictMessage() correctly detects verdict headings
 * - normaliseAgentKey() maps raw keys to canonical AgentKey values
 * - detectAgent() resolves agent from session key and heading text
 * - detectVerdictType() distinguishes handoff vs QA verdict
 * - NorseVerdictInscription renders with role="article" and aria-label
 * - All 5 agent variants + generic render correctly
 * - Component contains Elder Futhark rune decorations
 * - Glyph medallion has role="img" with meaningful aria-label
 * - Pledge seal renders with Norse term links
 * - Markdown content renders in .nvi-body
 * - LogViewer renders NorseVerdictInscription for the last assistant text if it is a verdict
 * - Mid-session handoff mentions do NOT trigger the verdict tablet
 * - Non-verdict assistant text renders as AgentBubble
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  NorseVerdictInscription,
  isVerdictMessage,
  normaliseAgentKey,
  detectAgent,
  detectVerdictType,
} from "../components/NorseVerdictInscription";
import { LogViewer } from "../components/LogViewer";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

afterEach(cleanup);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const HANDOFF_TEXT = `## FiremanDecko → Loki Handoff

**Branch:** \`ux/issue-1019-verdict-inscription\` | **PR:** https://github.com/org/repo/pull/1022

**What changed:**
- NorseVerdictInscription component
- CSS tablet styling
- LogViewer integration

**Build:** tsc + build PASS. Ready for QA.`;

const QA_VERDICT_TEXT = `## Loki QA Verdict — Issue #1019

**PASS** — All acceptance criteria met.

**Verified:**
- [ ] Verdict detection works
- [x] Norse tablet renders correctly
- [x] Mobile responsive at 375px`;

const MID_SESSION_TEXT = `Let me check the Handoff requirements from the issue.

Looking at the detection logic: the regex is /^#{1,2}\\s+(Handoff|QA Verdict)/m

This will only trigger on heading-level text.`;

const PLAIN_TEXT = "I'll start by reading the wireframe files to understand the design.";

const MOCK_JOB: DisplayJob = {
  sessionId: "issue-1019-step1-test",
  name: "agent-issue-1019-step1-test",
  issue: "1019",
  step: "1",
  agentKey: "firemandecko",
  agentName: "FiremanDecko",
  status: "succeeded",
  startTime: null,
  completionTime: null, issueTitle: null, branchName: null,
};

function makeEntry(id: string, text: string, detail?: string): LogEntry {
  return { id, type: "assistant-text", text, ...(detail ? { detail } : {}) };
}

// ── isVerdictMessage ──────────────────────────────────────────────────────────

describe("isVerdictMessage()", () => {
  it("detects H2 Handoff heading (agent name before 'Handoff')", () => {
    expect(isVerdictMessage(HANDOFF_TEXT)).toBe(true);
  });

  it("detects H2 QA Verdict heading (agent name before 'QA Verdict')", () => {
    expect(isVerdictMessage(QA_VERDICT_TEXT)).toBe(true);
  });

  it("detects H1 Handoff heading (word 'Handoff' at start)", () => {
    expect(isVerdictMessage("# Handoff Complete\n\nSome text")).toBe(true);
  });

  it("detects H1 QA Verdict heading (word 'QA Verdict' at start)", () => {
    expect(isVerdictMessage("# QA Verdict — PASS\n\nAll good.")).toBe(true);
  });

  it("detects H2 heading with agent → role pattern", () => {
    expect(isVerdictMessage("## Luna → FiremanDecko Handoff\n\nDesign complete.")).toBe(true);
  });

  it("does NOT trigger on mid-sentence 'Handoff' without heading marker", () => {
    expect(isVerdictMessage(MID_SESSION_TEXT)).toBe(false);
  });

  it("does NOT trigger on plain assistant text", () => {
    expect(isVerdictMessage(PLAIN_TEXT)).toBe(false);
  });

  it("does NOT trigger on H3 or deeper heading containing 'Handoff'", () => {
    expect(isVerdictMessage("### Sub-section Handoff Notes\n\nSome notes")).toBe(false);
  });
});

// ── normaliseAgentKey ─────────────────────────────────────────────────────────

describe("normaliseAgentKey()", () => {
  it("maps 'firemandecko' → 'fireman-decko'", () => {
    expect(normaliseAgentKey("firemandecko")).toBe("fireman-decko");
  });

  it("maps 'FiremanDecko' → 'fireman-decko'", () => {
    expect(normaliseAgentKey("FiremanDecko")).toBe("fireman-decko");
  });

  it("maps 'fireman-decko' → 'fireman-decko'", () => {
    expect(normaliseAgentKey("fireman-decko")).toBe("fireman-decko");
  });

  it("maps 'loki' → 'loki'", () => {
    expect(normaliseAgentKey("loki")).toBe("loki");
  });

  it("maps 'Loki' → 'loki'", () => {
    expect(normaliseAgentKey("Loki")).toBe("loki");
  });

  it("maps 'luna' → 'luna'", () => {
    expect(normaliseAgentKey("luna")).toBe("luna");
  });

  it("maps 'heimdall' → 'heimdall'", () => {
    expect(normaliseAgentKey("heimdall")).toBe("heimdall");
  });

  it("maps 'freya' → 'freya'", () => {
    expect(normaliseAgentKey("freya")).toBe("freya");
  });

  it("maps unknown value → 'generic'", () => {
    expect(normaliseAgentKey("unknown-agent")).toBe("generic");
  });
});

// ── detectAgent ───────────────────────────────────────────────────────────────

describe("detectAgent()", () => {
  it("uses session agentKey when available", () => {
    expect(detectAgent("firemandecko", "FiremanDecko → Loki Handoff")).toBe("fireman-decko");
  });

  it("falls back to heading text extraction when no session key", () => {
    expect(detectAgent(undefined, "FiremanDecko → Loki Handoff")).toBe("fireman-decko");
  });

  it("extracts Loki from heading text", () => {
    expect(detectAgent(undefined, "Loki QA Verdict — Issue #1019")).toBe("loki");
  });

  it("extracts Luna from heading text", () => {
    expect(detectAgent(undefined, "Luna → FiremanDecko Handoff")).toBe("luna");
  });

  it("extracts Heimdall from heading text", () => {
    expect(detectAgent(undefined, "Heimdall Security Audit Handoff")).toBe("heimdall");
  });

  it("extracts Freya from heading text", () => {
    expect(detectAgent(undefined, "Freya → FiremanDecko Handoff")).toBe("freya");
  });

  it("returns 'generic' when no agent is identifiable", () => {
    expect(detectAgent(undefined, "Task Complete Handoff")).toBe("generic");
  });
});

// ── detectVerdictType ─────────────────────────────────────────────────────────

describe("detectVerdictType()", () => {
  it("returns 'qa-verdict' for QA Verdict headings", () => {
    expect(detectVerdictType("Loki QA Verdict — Issue #1019")).toBe("qa-verdict");
  });

  it("returns 'handoff' for Handoff headings", () => {
    expect(detectVerdictType("FiremanDecko → Loki Handoff")).toBe("handoff");
  });

  it("returns 'handoff' for generic headings", () => {
    expect(detectVerdictType("Task Complete Handoff")).toBe("handoff");
  });
});

// ── NorseVerdictInscription rendering ─────────────────────────────────────────

describe("NorseVerdictInscription — rendering (issue #1019)", () => {
  it("renders with role='article'", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    expect(container.querySelector("[role='article']")).not.toBeNull();
  });

  it("has aria-label mentioning 'verdict'", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    const article = container.querySelector("[role='article']");
    expect(article?.getAttribute("aria-label")).toMatch(/verdict/i);
  });

  it("uses .nvi-shell root class", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    expect(container.querySelector(".nvi-shell")).not.toBeNull();
  });

  it("renders double rune bands (top and bottom)", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    expect(container.querySelector(".nvi-rune-band-top")).not.toBeNull();
    expect(container.querySelector(".nvi-rune-band-bottom")).not.toBeNull();
  });

  it("renders Elder Futhark runes in the bands", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    expect(container.textContent).toMatch(/[ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ]/);
  });

  it("glyph has role='img' with aria-label", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    const glyph = container.querySelector(".nvi-glyph");
    expect(glyph?.getAttribute("role")).toBe("img");
    expect(glyph?.getAttribute("aria-label")).toBeTruthy();
  });

  it("arch title is present", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    expect(container.querySelector(".nvi-arch-title")).not.toBeNull();
  });

  it("subtitle shows 'Handoff Complete' for handoff messages", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    expect(container.querySelector(".nvi-arch-subtitle")?.textContent).toMatch(/Handoff Complete/);
  });

  it("subtitle shows 'QA Verdict Delivered' for QA verdict messages", () => {
    const { container } = render(
      <NorseVerdictInscription text={QA_VERDICT_TEXT} agentKey="loki" />
    );
    expect(container.querySelector(".nvi-arch-subtitle")?.textContent).toMatch(/QA Verdict Delivered/);
  });

  it("renders .nvi-body with markdown content", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    expect(container.querySelector(".nvi-body")).not.toBeNull();
  });

  it("renders pledge seal", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    expect(container.querySelector(".nvi-seal")).not.toBeNull();
    expect(container.querySelector(".nvi-seal-pledge")).not.toBeNull();
  });

  it("pledge contains Norse term links for FiremanDecko", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    const links = container.querySelectorAll(".nvi-norse-link");
    expect(links.length).toBeGreaterThan(0);
    const link = links[0] as HTMLAnchorElement;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("sets --agent-accent inline style on .nvi-shell", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_TEXT} agentKey="firemandecko" />
    );
    const shell = container.querySelector(".nvi-shell") as HTMLElement;
    expect(shell?.style.getPropertyValue("--agent-accent")).toBeTruthy();
  });
});

// ── Agent variant rendering ───────────────────────────────────────────────────

describe("NorseVerdictInscription — agent variants", () => {
  const agents = [
    { key: "firemandecko", rune: "ᚲ", archTitle: "The Forge Has Spoken" },
    { key: "loki",         rune: "ᚾ", archTitle: "The Trickster Finds No Flaw" },
    { key: "luna",         rune: "ᛚ", archTitle: "The Moonpath Is Drawn" },
    { key: "heimdall",     rune: "ᛏ", archTitle: "The Bifröst Stands Unwavering" },
    { key: "freya",        rune: "ᚠ", archTitle: "The Völva Has Spoken" },
  ] as const;

  for (const { key, rune, archTitle } of agents) {
    it(`${key}: renders correct glyph rune (${rune})`, () => {
      const { container } = render(
        <NorseVerdictInscription text={HANDOFF_TEXT} agentKey={key} />
      );
      expect(container.querySelector(".nvi-glyph")?.textContent).toBe(rune);
    });

    it(`${key}: renders correct arch title`, () => {
      const { container } = render(
        <NorseVerdictInscription text={HANDOFF_TEXT} agentKey={key} />
      );
      expect(container.querySelector(".nvi-arch-title")?.textContent).toBe(archTitle);
    });
  }

  it("generic fallback: renders ᛟ Othalan glyph", () => {
    const { container } = render(
      <NorseVerdictInscription text="## Handoff\n\nTask complete." />
    );
    expect(container.querySelector(".nvi-glyph")?.textContent).toBe("ᛟ");
  });

  it("generic fallback: shows 'The Inscription Is Complete'", () => {
    const { container } = render(
      <NorseVerdictInscription text="## Handoff\n\nTask complete." />
    );
    expect(container.querySelector(".nvi-arch-title")?.textContent).toBe("The Inscription Is Complete");
  });
});

// ── Markdown rendering inside .nvi-body ───────────────────────────────────────

describe("NorseVerdictInscription — markdown content rendering", () => {
  it("renders H2 heading as .nvi-md-h2", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={"## FiremanDecko → Loki Handoff\n\n## Changes Made\n\nSome text"}
        agentKey="firemandecko"
      />
    );
    const h2s = container.querySelectorAll(".nvi-md-h2");
    // The first heading is the verdict heading; the second is "Changes Made"
    expect(h2s.length).toBeGreaterThanOrEqual(1);
  });

  it("renders unordered list as .nvi-md-ul", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={"## Handoff\n\n- Item one\n- Item two\n- Item three"}
        agentKey="firemandecko"
      />
    );
    expect(container.querySelector(".nvi-md-ul")).not.toBeNull();
    expect(container.querySelectorAll(".nvi-md-ul li").length).toBe(3);
  });

  it("renders bold text as <strong>", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={"## Handoff\n\n**Build:** tsc PASS"}
        agentKey="firemandecko"
      />
    );
    expect(container.querySelector("strong")).not.toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("Build:");
  });

  it("renders inline code as .nvi-md-inline-code", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={"## Handoff\n\nBranch: `ux/issue-1019`"}
        agentKey="firemandecko"
      />
    );
    expect(container.querySelector(".nvi-md-inline-code")).not.toBeNull();
    expect(container.querySelector(".nvi-md-inline-code")?.textContent).toBe("ux/issue-1019");
  });

  it("renders fenced code block as .nvi-md-code", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={"## Handoff\n\n```ts\nconst x = 1;\n```"}
        agentKey="firemandecko"
      />
    );
    expect(container.querySelector(".nvi-md-code")).not.toBeNull();
    expect(container.querySelector(".nvi-md-code code")?.textContent).toContain("const x = 1;");
  });

  it("renders paragraph as .nvi-md-p", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={"## Handoff\n\nThis is a paragraph of text."}
        agentKey="firemandecko"
      />
    );
    expect(container.querySelector(".nvi-md-p")).not.toBeNull();
  });

  it("renders checkbox list with .nvi-md-checklist", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={"## QA Verdict\n\n- [x] Passes tsc\n- [ ] Pending E2E"}
        agentKey="loki"
      />
    );
    expect(container.querySelector(".nvi-md-checklist")).not.toBeNull();
  });
});

// ── LogViewer integration ─────────────────────────────────────────────────────

describe("LogViewer — NorseVerdictInscription integration (issue #1019)", () => {
  it("renders NorseVerdictInscription for last assistant text when it is a verdict", () => {
    const entries: LogEntry[] = [
      makeEntry("e1", "Let me start implementing the feature."),
      makeEntry("e2", HANDOFF_TEXT),
    ];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    expect(container.querySelector(".nvi-shell")).not.toBeNull();
  });

  it("does NOT render NorseVerdictInscription for non-verdict last assistant text", () => {
    const entries: LogEntry[] = [
      makeEntry("e1", HANDOFF_TEXT),
      makeEntry("e2", PLAIN_TEXT),
    ];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    expect(container.querySelector(".nvi-shell")).toBeNull();
  });

  it("renders mid-session handoff text as AgentBubble (not verdict tablet)", () => {
    const entries: LogEntry[] = [
      makeEntry("e1", HANDOFF_TEXT),           // verdict text — but NOT last
      makeEntry("e2", "Continuing with implementation."),
    ];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    // The verdict tablet should NOT appear (it's not the last entry)
    expect(container.querySelector(".nvi-shell")).toBeNull();
    // The normal bubble should appear for the last entry
    expect(container.querySelector(".agent-bubble")).not.toBeNull();
  });

  it("thinking entries are not considered as 'last assistant text'", () => {
    const entries: LogEntry[] = [
      makeEntry("e1", HANDOFF_TEXT),
      makeEntry("e2", "some thinking...", "thinking"),
    ];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    // HANDOFF_TEXT is the last non-thinking assistant-text, so verdict tablet should render
    expect(container.querySelector(".nvi-shell")).not.toBeNull();
  });

  it("renders plain assistant text as agent-bubble (no verdict)", () => {
    const entries: LogEntry[] = [
      makeEntry("e1", PLAIN_TEXT),
    ];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    expect(container.querySelector(".agent-bubble")).not.toBeNull();
    expect(container.querySelector(".nvi-shell")).toBeNull();
  });

  it("renders QA verdict for Loki agent", () => {
    const lokiJob: DisplayJob = { ...MOCK_JOB, agentKey: "loki", agentName: "Loki" };
    const entries: LogEntry[] = [makeEntry("e1", QA_VERDICT_TEXT)];
    const { container } = render(
      <LogViewer entries={entries} activeJob={lokiJob} wsState="open" />
    );
    expect(container.querySelector(".nvi-shell")).not.toBeNull();
    expect(container.querySelector(".nvi-arch-subtitle")?.textContent).toMatch(/QA Verdict Delivered/);
  });
});
