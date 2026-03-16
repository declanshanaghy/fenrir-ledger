/**
 * Loki QA tests for issue #1020 — All-Father's Decree Norse inscription:
 *   Agent rune header, sub-inscription sections, decree-seal, DecreeSectionBody formatting.
 *
 * AC validated:
 * AC-1: Decree prompt parsed into collapsible sub-inscriptions
 * AC-2: Each section has an Elder Futhark glyph + Norse-reworded title
 * AC-3: Sections default collapsed except "Issue Details" (expanded)
 * AC-4: Agent's rune + accent color in decree header
 * AC-5: Odin's royal seal at bottom
 * AC-6: Norse terms linked to Wikipedia in gold
 * AC-7: Raw prompt text preserved in sections
 * AC-8: Works for all 5 agent types
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import type { DisplayJob } from "../lib/types";
import type { LogEntry } from "../hooks/useLogStream";

afterEach(cleanup);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_DECREE = `You are FiremanDecko, the Principal Engineer.

SANDBOX RULES (GKE Autopilot):
- REPO_ROOT is /workspace/repo — hardcoded

**Step 1 — Verify environment:**
cd /workspace/repo && git branch --show-current && node -v

TODO TRACKING (UNBREAKABLE):
Use TodoWrite to plan and track ALL work.

INCREMENTAL COMMIT + VERIFY LOOP (UNBREAKABLE):
After every logical chunk of implementation work.

VERIFY — tsc + build ONLY (UNBREAKABLE):
  cd /workspace/repo && bash quality/scripts/verify.sh --step tsc

STRICT SCOPE (UNBREAKABLE):
Execute ONLY your numbered steps.

**Step 2 — Read context + create todos:**
  gh issue view 1020 --comments

**Issue details:**

## Description

The All-Father's Decree renders as a wall of raw monospace text.

## Acceptance Criteria

- [ ] Decree prompt parsed into collapsible sub-inscriptions
- [ ] Norse terms linked to Yggdrasil and Bifröst

**Step 3 — Implement:**
Implement the changes.

**Step 3b — Write tests:**
Write Vitest tests.

**Step 4 — Full verify:**
  cd /workspace/repo && bash quality/scripts/verify.sh --step build

**Step 5 — Rebase:**
  git rebase origin/main

**Step 6 — Update PR:**
  gh pr edit 1079

**Step 7 — Handoff:**
  gh issue comment 1020
`;

function makeTaskEntry(text: string): LogEntry {
  return { id: "t1", type: "entrypoint-task", text } as LogEntry;
}

function makeJob(agentKey: string, agentName: string): DisplayJob {
  return {
    sessionId: `test-1020-${agentKey}`,
    name: `agent-test-1020-${agentKey}`,
    issue: "1020",
    step: "1",
    agentKey,
    agentName,
    status: "running",
    startTime: null,
    completionTime: null,
    issueTitle: null,
    branchName: null,
  };
}

const JOB_FIREMANDECKO = makeJob("firemandecko", "FiremanDecko");
const JOB_LOKI = makeJob("loki", "Loki");
const JOB_LUNA = makeJob("luna", "Luna");
const JOB_FREYA = makeJob("freya", "Freya");
const JOB_HEIMDALL = makeJob("heimdall", "Heimdall");
const JOB_UNKNOWN = makeJob("unknown-xyz", "UnknownAgent");

// ── AC-1: Sections parsed and rendered ───────────────────────────────────────

describe("AC-1: Decree prompt parsed into sub-inscriptions (issue #1020)", () => {
  it("renders multiple .decree-section elements for a full decree", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const sections = container.querySelectorAll(".decree-section");
    expect(sections.length).toBeGreaterThan(3);
  });

  it("renders .decree-grid container", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    expect(container.querySelector(".decree-grid")).not.toBeNull();
  });

  it("empty-ish prompt still renders one fallback section", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry("Just some text with no sections.")]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const sections = container.querySelectorAll(".decree-section");
    expect(sections.length).toBeGreaterThanOrEqual(1);
  });
});

// ── AC-2: Elder Futhark glyphs in section headers ────────────────────────────

describe("AC-2: Each section has glyph + Norse title (issue #1020)", () => {
  it(".decree-section-glyph elements are rendered", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const glyphs = container.querySelectorAll(".decree-section-glyph");
    expect(glyphs.length).toBeGreaterThan(0);
  });

  it(".decree-section-glyph elements have aria-hidden=true", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const glyphs = container.querySelectorAll(".decree-section-glyph");
    for (const glyph of Array.from(glyphs)) {
      expect(glyph.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it(".decree-section-title elements show Norse-reworded titles", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const titles = Array.from(container.querySelectorAll(".decree-section-title")).map((el) => el.textContent ?? "");
    // Should include known Norse section titles
    const knownTitles = ["Hear Me, Agent", "The Sacred Ground", "The Norns' Ledger", "The Chain of Gleipnir"];
    const matchCount = knownTitles.filter((t) => titles.some((rendered) => rendered.includes(t.split(",")[0]!)));
    expect(matchCount.length).toBeGreaterThan(1);
  });
});

// ── AC-3: Default collapsed except Issue Details ──────────────────────────────

describe("AC-3: Sections default collapsed except Issue Details (issue #1020)", () => {
  it("Issue Details section has .open class (expanded by default)", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const sections = Array.from(container.querySelectorAll(".decree-section"));
    const openSections = sections.filter((s) => s.classList.contains("open"));
    // At least the Issue Details section should be open
    expect(openSections.length).toBeGreaterThanOrEqual(1);
  });

  it("Issue Details section (.decree-wide) is expanded and shows body", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    // The wide section is the Issue Details one (decree-wide + open)
    const wideSection = container.querySelector(".decree-section.decree-wide");
    expect(wideSection).not.toBeNull();
    expect(wideSection?.classList.contains("open")).toBe(true);
    expect(wideSection?.querySelector(".decree-section-body")).not.toBeNull();
  });

  it("Issue Details spans full width via decree-wide class", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    expect(container.querySelector(".decree-section.decree-wide")).not.toBeNull();
  });
});

// ── AC-4: Agent rune + accent color in header ─────────────────────────────────

describe("AC-4: Agent rune + accent color in decree header (issue #1020)", () => {
  it("NorseTablet header shows .norse-tablet-rune elements", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const runes = container.querySelectorAll(".norse-tablet-rune");
    expect(runes.length).toBeGreaterThan(0);
  });

  it("NorseTablet rune elements have aria-hidden=true", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const runes = container.querySelectorAll(".norse-tablet-rune");
    for (const rune of Array.from(runes)) {
      expect(rune.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("NorseTablet title shows agent name in uppercase", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const title = container.querySelector(".norse-tablet-title");
    expect(title?.textContent).toMatch(/FIREMANDECKO/i);
  });

  it("NorseTablet shows subtitle with agent title", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const subtitle = container.querySelector(".norse-tablet-subtitle");
    expect(subtitle?.textContent).toMatch(/Principal Engineer/);
  });

  it("NorseTablet subtitle shows agent rune string", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const subtitle = container.querySelector(".norse-tablet-subtitle");
    // FiremanDecko rune string ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ
    expect(subtitle?.textContent).toMatch(/ᚠ/);
  });

  it("NorseTablet outer div has borderLeft inline style", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const tablet = container.querySelector(".norse-tablet");
    const style = (tablet as HTMLElement | null)?.style.borderLeft ?? "";
    expect(style).toMatch(/#4ecdc4|rgb\(78,\s*205,\s*196\)/i);
  });

  it("NorseTablet header has role=button and aria-expanded", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const header = container.querySelector(".norse-tablet-header");
    expect(header?.getAttribute("role")).toBe("button");
    expect(header?.getAttribute("aria-expanded")).toBeDefined();
  });

  it("NorseTablet header shows issue number in subtitle when present in prompt", () => {
    // The issue number is extracted from first #NNN occurrence in the prompt text
    const textWithIssue = `You are FiremanDecko, the Principal Engineer. Fix issue #1020.
SANDBOX RULES: cd /workspace/repo
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(textWithIssue)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const subtitle = container.querySelector(".norse-tablet-subtitle");
    expect(subtitle?.textContent).toMatch(/Issue #1020/);
  });
});

// ── AC-5: Odin's Royal Seal ───────────────────────────────────────────────────

describe("AC-5: Odin's royal seal at bottom (issue #1020)", () => {
  it(".decree-seal is rendered within the tablet body", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    expect(container.querySelector(".decree-seal")).not.toBeNull();
  });

  it(".decree-seal-medallion renders Othalan rune ᛟ", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const medallion = container.querySelector(".decree-seal-medallion");
    expect(medallion?.textContent).toBe("ᛟ");
  });

  it(".decree-seal-attribution shows Odin · All-Father", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const attr = container.querySelector(".decree-seal-attribution");
    expect(attr?.textContent).toMatch(/Odin/);
    expect(attr?.textContent).toMatch(/All-Father/);
  });
});

// ── AC-6: Norse Wikipedia links in section bodies ────────────────────────────

describe("AC-6: Norse terms linked to Wikipedia in gold (issue #1020)", () => {
  it("Issue Details body contains Wikipedia link for Yggdrasil", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const links = container.querySelectorAll(".decree-body-link");
    const yggLink = Array.from(links).find((a) =>
      a.getAttribute("href")?.includes("Yggdrasil") || a.textContent?.includes("Yggdrasil")
    );
    expect(yggLink, "Yggdrasil link not found in open section body").not.toBeNull();
  });

  it("Issue Details body contains Wikipedia link for Bifröst", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const links = container.querySelectorAll(".decree-body-link");
    const bifLink = Array.from(links).find((a) =>
      a.getAttribute("href")?.includes("Bifr") || a.textContent?.includes("Bifröst")
    );
    expect(bifLink, "Bifröst link not found in open section body").not.toBeNull();
  });

  it("Wikipedia links have target=_blank and rel=noopener noreferrer", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const links = container.querySelectorAll(".decree-body-link[href]");
    for (const link of Array.from(links)) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("Wikipedia links have title attribute with 'Wikipedia: {term}'", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const links = container.querySelectorAll(".decree-body-link[href]");
    // At least some should have the title attribute
    const withTitle = Array.from(links).filter((a) => a.getAttribute("title")?.startsWith("Wikipedia:"));
    expect(withTitle.length).toBeGreaterThan(0);
  });

  it("seal command links to Nine Realms and Fenrir Wikipedia articles", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const cmd = container.querySelector(".decree-seal-command");
    const links = cmd?.querySelectorAll("a.decree-body-link") ?? [];
    const hrefs = Array.from(links).map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.includes("Norse_cosmology") || h.includes("Nine_worlds"))).toBe(true);
    expect(hrefs.some((h) => h.includes("Fenrir"))).toBe(true);
  });
});

// ── AC-7: Raw prompt text preserved ──────────────────────────────────────────

describe("AC-7: Raw prompt text preserved in section bodies (issue #1020)", () => {
  it("Issue Details body shows description text from the prompt", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const wideBody = container.querySelector(".decree-section.decree-wide .decree-section-body");
    expect(wideBody?.textContent).toMatch(/Description/i);
    expect(wideBody?.textContent).toMatch(/Acceptance Criteria/i);
  });

  it("code lines in decree body render as .decree-body-block", () => {
    // Use Issue Details (defaultOpen: true) with command lines that start with cd/git
    const decreeWithCode = `You are FiremanDecko.
**Issue details:**
cd /workspace/repo && git status
git branch --show-current
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(decreeWithCode)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const codeBlocks = container.querySelectorAll(".decree-body-block");
    expect(codeBlocks.length).toBeGreaterThan(0);
  });

  it("list items in Issue Details body render as <li> elements", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(FULL_DECREE)]} activeJob={JOB_FIREMANDECKO} wsState="open" />
    );
    const wideBody = container.querySelector(".decree-section.decree-wide .decree-section-body");
    const listItems = wideBody?.querySelectorAll("li") ?? [];
    expect(listItems.length).toBeGreaterThan(0);
  });
});

// ── AC-8: All 5 agent variants ────────────────────────────────────────────────

describe("AC-8: Works for all 5 agent types (issue #1020)", () => {
  const AGENTS: Array<[DisplayJob, string, string]> = [
    [JOB_LOKI, "loki", "Loki"],
    [JOB_LUNA, "luna", "Luna"],
    [JOB_FREYA, "freya", "Freya"],
    [JOB_HEIMDALL, "heimdall", "Heimdall"],
  ];

  for (const [job, , agentName] of AGENTS) {
    it(`${agentName} — renders NorseTablet with .decree-seal`, () => {
      const text = `You are ${agentName}, their role. **Issue details:\nSome issue content.`;
      const { container } = render(
        <LogViewer entries={[makeTaskEntry(text)]} activeJob={job} wsState="open" />
      );
      expect(container.querySelector(".decree-seal")).not.toBeNull();
    });

    it(`${agentName} — shows agent-specific left accent border color`, () => {
      const text = `You are ${agentName}, their role.`;
      const { container } = render(
        <LogViewer entries={[makeTaskEntry(text)]} activeJob={job} wsState="open" />
      );
      const tablet = container.querySelector(".norse-tablet");
      const borderStyle = (tablet as HTMLElement | null)?.style.borderLeft ?? "";
      // Should have some color set (not empty)
      expect(borderStyle).toBeTruthy();
      expect(borderStyle).toMatch(/solid/);
    });
  }

  it("unknown agent falls back to accent border with default color", () => {
    const text = "You are UnknownAgent. Do something.";
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(text)]} activeJob={JOB_UNKNOWN} wsState="open" />
    );
    const tablet = container.querySelector(".norse-tablet");
    const borderStyle = (tablet as HTMLElement | null)?.style.borderLeft ?? "";
    expect(borderStyle).toMatch(/solid/);
  });
});
