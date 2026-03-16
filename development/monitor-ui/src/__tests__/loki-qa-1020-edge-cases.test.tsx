/**
 * Loki QA edge-case tests for issue #1020 — All-Father's Decree Norse inscription.
 *
 * Covers handoff edge cases NOT addressed by decree-inscription-1020.test.tsx:
 *   EC-1: WIKI_LINKS terms inside backtick code spans must NOT be linkified
 *   EC-2: Keyboard Enter/Space on .decree-section-header toggles section open/closed
 *   EC-3: Keyboard Enter/Space on .norse-tablet-header toggles outer decree
 *   EC-4: Unknown agentKey → fallback first-rune (ᚨ) + #888 border
 *   EC-5: Prompt with no **Issue details** → no .decree-wide section rendered
 *   EC-6: Section body is hidden when section is collapsed (not defaultOpen)
 *   EC-7: DecreeSectionBody inline backtick → .decree-body-code (not linkified)
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import type { DisplayJob } from "../lib/types";
import type { LogEntry } from "../hooks/useLogStream";

afterEach(cleanup);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTaskEntry(text: string): LogEntry {
  return { id: "t1", type: "entrypoint-task", text } as LogEntry;
}

function makeJob(agentKey: string, agentName: string): DisplayJob {
  return {
    sessionId: `ec-1020-${agentKey}`,
    name: `agent-ec-1020-${agentKey}`,
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

const JOB_FD = makeJob("firemandecko", "FiremanDecko");
const JOB_UNKNOWN = makeJob("unknown-xyz", "UnknownAgent");

// ── EC-1: WIKI_LINKS inside backtick code spans NOT linkified ─────────────────

describe("EC-1: WIKI_LINKS inside backtick code spans are NOT linkified (issue #1020)", () => {
  it("Yggdrasil inside backticks renders as .decree-body-code, NOT as .decree-body-link", () => {
    // Issue Details section is defaultOpen — body is rendered immediately
    const promptWithCodeYgg = `You are FiremanDecko.
**Issue details:**
Use the \`Yggdrasil\` constant for the tree.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(promptWithCodeYgg)]} activeJob={JOB_FD} wsState="open" />
    );
    const wideBody = container.querySelector(".decree-section.decree-wide .decree-section-body");
    expect(wideBody, "decree-wide section body not found").not.toBeNull();

    // Should have code span containing Yggdrasil
    const codeSpans = Array.from(wideBody?.querySelectorAll(".decree-body-code") ?? []);
    const hasYggCode = codeSpans.some((el) => el.textContent?.includes("Yggdrasil"));
    expect(hasYggCode, "Yggdrasil should appear as .decree-body-code inside backticks").toBe(true);

    // Should NOT have a wiki-link for Yggdrasil since it was inside backticks
    const wikiLinks = Array.from(wideBody?.querySelectorAll(".decree-body-link") ?? []);
    const hasYggWikiLink = wikiLinks.some(
      (a) => a.getAttribute("href")?.includes("Yggdrasil") || a.textContent === "Yggdrasil"
    );
    expect(hasYggWikiLink, "Yggdrasil inside backticks should NOT be a wiki-link").toBe(false);
  });

  it("Bifröst inside backticks is NOT linkified", () => {
    const promptWithCodeBif = `You are FiremanDecko.
**Issue details:**
The \`Bifröst\` bridge is important.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(promptWithCodeBif)]} activeJob={JOB_FD} wsState="open" />
    );
    const wideBody = container.querySelector(".decree-section.decree-wide .decree-section-body");
    const codeSpans = Array.from(wideBody?.querySelectorAll(".decree-body-code") ?? []);
    const hasBifCode = codeSpans.some((el) => el.textContent?.includes("Bifröst"));
    expect(hasBifCode, "Bifröst should appear as .decree-body-code inside backticks").toBe(true);

    const wikiLinks = Array.from(wideBody?.querySelectorAll(".decree-body-link") ?? []);
    const hasBifWikiLink = wikiLinks.some((a) => a.textContent?.includes("Bifröst"));
    expect(hasBifWikiLink, "Bifröst inside backticks should NOT be a wiki-link").toBe(false);
  });

  it("Yggdrasil in prose (no backticks) IS linkified", () => {
    const promptWithProseYgg = `You are FiremanDecko.
**Issue details:**
This involves Yggdrasil directly in prose.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(promptWithProseYgg)]} activeJob={JOB_FD} wsState="open" />
    );
    const wideBody = container.querySelector(".decree-section.decree-wide .decree-section-body");
    const wikiLinks = Array.from(wideBody?.querySelectorAll(".decree-body-link") ?? []);
    const hasYggLink = wikiLinks.some(
      (a) => a.getAttribute("href")?.includes("Yggdrasil") || a.textContent === "Yggdrasil"
    );
    expect(hasYggLink, "Yggdrasil in plain prose should be a wiki-link").toBe(true);
  });
});

// ── EC-2: Keyboard interaction on .decree-section-header ─────────────────────

describe("EC-2: Keyboard Enter/Space on .decree-section-header toggles sections (issue #1020)", () => {
  it(".decree-section-header has tabIndex=0", () => {
    const { container } = render(
      <LogViewer
        entries={[makeTaskEntry(`You are FiremanDecko.\nTODO TRACKING (UNBREAKABLE):\nUse TodoWrite.`)]}
        activeJob={JOB_FD}
        wsState="open"
      />
    );
    const headers = container.querySelectorAll(".decree-section-header");
    for (const h of Array.from(headers)) {
      expect((h as HTMLElement).tabIndex).toBe(0);
    }
  });

  it(".decree-section-header has role=button", () => {
    const { container } = render(
      <LogViewer
        entries={[makeTaskEntry(`You are FiremanDecko.\nTODO TRACKING (UNBREAKABLE):\nUse TodoWrite.`)]}
        activeJob={JOB_FD}
        wsState="open"
      />
    );
    const headers = container.querySelectorAll(".decree-section-header");
    for (const h of Array.from(headers)) {
      expect(h.getAttribute("role")).toBe("button");
    }
  });

  it(".decree-section-header has aria-expanded attribute", () => {
    const { container } = render(
      <LogViewer
        entries={[makeTaskEntry(`You are FiremanDecko.\nTODO TRACKING (UNBREAKABLE):\nUse TodoWrite.`)]}
        activeJob={JOB_FD}
        wsState="open"
      />
    );
    const headers = container.querySelectorAll(".decree-section-header");
    for (const h of Array.from(headers)) {
      expect(h.getAttribute("aria-expanded")).not.toBeNull();
    }
  });

  it("pressing Enter on a collapsed .decree-section-header opens it", () => {
    // "TODO TRACKING" section is collapsed by default
    const { container } = render(
      <LogViewer
        entries={[makeTaskEntry(`You are FiremanDecko.\nTODO TRACKING (UNBREAKABLE):\nUse TodoWrite.`)]}
        activeJob={JOB_FD}
        wsState="open"
      />
    );
    // Find the Norns' Ledger section (TODO TRACKING) — should be collapsed
    const sections = Array.from(container.querySelectorAll(".decree-section"));
    const nornsSection = sections.find((s) => s.querySelector(".decree-section-title")?.textContent?.includes("Norns"));
    expect(nornsSection, "Norns section not found").not.toBeNull();
    expect(nornsSection!.classList.contains("open"), "Norns section should start collapsed").toBe(false);

    const header = nornsSection!.querySelector(".decree-section-header") as HTMLElement;
    fireEvent.keyDown(header, { key: "Enter" });
    expect(nornsSection!.classList.contains("open"), "Norns section should open after Enter").toBe(true);
  });

  it("pressing Space on a collapsed .decree-section-header opens it", () => {
    const { container } = render(
      <LogViewer
        entries={[makeTaskEntry(`You are FiremanDecko.\nTODO TRACKING (UNBREAKABLE):\nUse TodoWrite.`)]}
        activeJob={JOB_FD}
        wsState="open"
      />
    );
    const sections = Array.from(container.querySelectorAll(".decree-section"));
    const nornsSection = sections.find((s) => s.querySelector(".decree-section-title")?.textContent?.includes("Norns"));
    expect(nornsSection, "Norns section not found").not.toBeNull();

    const header = nornsSection!.querySelector(".decree-section-header") as HTMLElement;
    fireEvent.keyDown(header, { key: " " });
    expect(nornsSection!.classList.contains("open"), "Norns section should open after Space").toBe(true);
  });

  it("pressing Enter on an open section collapses it", () => {
    const decree = `You are FiremanDecko.\n**Issue details:**\nSome content here.\n`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(decree)]} activeJob={JOB_FD} wsState="open" />
    );
    // Issue Details section is open by default
    const wideSection = container.querySelector(".decree-section.decree-wide") as HTMLElement | null;
    expect(wideSection?.classList.contains("open"), "Wide section should start open").toBe(true);

    const header = wideSection!.querySelector(".decree-section-header") as HTMLElement;
    fireEvent.keyDown(header, { key: "Enter" });
    expect(wideSection!.classList.contains("open"), "Wide section should collapse after Enter").toBe(false);
  });
});

// ── EC-3: Keyboard interaction on .norse-tablet-header ───────────────────────

describe("EC-3: Keyboard Enter/Space on .norse-tablet-header toggles outer decree (issue #1020)", () => {
  it(".norse-tablet-header has tabIndex=0", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry("You are FiremanDecko.")]} activeJob={JOB_FD} wsState="open" />
    );
    const header = container.querySelector(".norse-tablet-header") as HTMLElement | null;
    expect(header?.tabIndex).toBe(0);
  });

  it(".norse-tablet-header has role=button", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry("You are FiremanDecko.")]} activeJob={JOB_FD} wsState="open" />
    );
    const header = container.querySelector(".norse-tablet-header");
    expect(header?.getAttribute("role")).toBe("button");
  });

  it("pressing Enter on .norse-tablet-header collapses the open decree", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry("You are FiremanDecko.")]} activeJob={JOB_FD} wsState="open" />
    );
    const tablet = container.querySelector(".norse-tablet") as HTMLElement | null;
    expect(tablet?.classList.contains("open"), "Tablet should start open").toBe(true);

    const header = container.querySelector(".norse-tablet-header") as HTMLElement;
    fireEvent.keyDown(header, { key: "Enter" });
    expect(tablet?.classList.contains("open"), "Tablet should collapse after Enter").toBe(false);
  });

  it("pressing Space on .norse-tablet-header collapses the open decree", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry("You are FiremanDecko.")]} activeJob={JOB_FD} wsState="open" />
    );
    const tablet = container.querySelector(".norse-tablet") as HTMLElement | null;
    const header = container.querySelector(".norse-tablet-header") as HTMLElement;
    fireEvent.keyDown(header, { key: " " });
    expect(tablet?.classList.contains("open"), "Tablet should collapse after Space").toBe(false);
  });

  it("pressing Enter again on a collapsed .norse-tablet-header re-opens it", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry("You are FiremanDecko.")]} activeJob={JOB_FD} wsState="open" />
    );
    const tablet = container.querySelector(".norse-tablet") as HTMLElement | null;
    const header = container.querySelector(".norse-tablet-header") as HTMLElement;
    // Collapse first
    fireEvent.keyDown(header, { key: "Enter" });
    expect(tablet?.classList.contains("open")).toBe(false);
    // Then re-open
    fireEvent.keyDown(header, { key: "Enter" });
    expect(tablet?.classList.contains("open"), "Tablet should re-open after second Enter").toBe(true);
  });
});

// ── EC-4: Unknown agentKey fallback ───────────────────────────────────────────

describe("EC-4: Unknown agentKey — fallback rune + border color (issue #1020)", () => {
  it("unknown agentKey renders a rune in .norse-tablet-rune (falls back to _fallback rune)", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry("You are UnknownAgent.")]} activeJob={JOB_UNKNOWN} wsState="open" />
    );
    const runes = container.querySelectorAll(".norse-tablet-rune");
    expect(runes.length).toBeGreaterThan(0);
    // _fallback rune string starts with ᚨ
    const runeText = Array.from(runes).map((r) => r.textContent ?? "").join("");
    expect(runeText).toContain("ᚨ");
  });

  it("unknown agentKey renders border with #888 fallback color", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry("You are UnknownAgent.")]} activeJob={JOB_UNKNOWN} wsState="open" />
    );
    const tablet = container.querySelector(".norse-tablet");
    const style = (tablet as HTMLElement | null)?.style.borderLeft ?? "";
    expect(style).toMatch(/#888|rgb\(136,\s*136,\s*136\)/i);
  });

  it("unknown agentKey still renders .decree-seal-medallion with ᛟ", () => {
    const { container } = render(
      <LogViewer entries={[makeTaskEntry("You are UnknownAgent.")]} activeJob={JOB_UNKNOWN} wsState="open" />
    );
    const medallion = container.querySelector(".decree-seal-medallion");
    expect(medallion?.textContent).toBe("ᛟ");
  });
});

// ── EC-5: Prompt without **Issue details** section ────────────────────────────

describe("EC-5: Prompt with no **Issue details** section (issue #1020)", () => {
  it("no .decree-wide class when prompt has no Issue details section", () => {
    const promptNoIssue = `You are FiremanDecko.
SANDBOX RULES (GKE Autopilot):
- REPO_ROOT is /workspace/repo
TODO TRACKING (UNBREAKABLE):
Use TodoWrite.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(promptNoIssue)]} activeJob={JOB_FD} wsState="open" />
    );
    expect(container.querySelector(".decree-section.decree-wide")).toBeNull();
  });

  it("other sections still render when Issue details is absent", () => {
    const promptNoIssue = `You are FiremanDecko.
SANDBOX RULES (GKE Autopilot):
- REPO_ROOT is /workspace/repo
TODO TRACKING (UNBREAKABLE):
Use TodoWrite.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(promptNoIssue)]} activeJob={JOB_FD} wsState="open" />
    );
    const sections = container.querySelectorAll(".decree-section");
    expect(sections.length).toBeGreaterThanOrEqual(2);
  });

  it("no defaultOpen sections when Issue details absent (all start collapsed)", () => {
    const promptNoIssue = `You are FiremanDecko.
SANDBOX RULES (GKE Autopilot):
- REPO_ROOT is /workspace/repo
TODO TRACKING (UNBREAKABLE):
Use TodoWrite.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(promptNoIssue)]} activeJob={JOB_FD} wsState="open" />
    );
    const openSections = container.querySelectorAll(".decree-section.open");
    // No section should be defaultOpen since Issue Details pattern is absent
    expect(openSections.length).toBe(0);
  });
});

// ── EC-6: Collapsed section body hidden ───────────────────────────────────────

describe("EC-6: Collapsed section body is not rendered (issue #1020)", () => {
  it("collapsed section has no .decree-section-body rendered", () => {
    const prompt = `You are FiremanDecko.
TODO TRACKING (UNBREAKABLE):
Use TodoWrite to plan.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(prompt)]} activeJob={JOB_FD} wsState="open" />
    );
    // Find the Norns' Ledger section (TODO TRACKING) — collapsed by default
    const sections = Array.from(container.querySelectorAll(".decree-section"));
    const nornsSection = sections.find((s) =>
      s.querySelector(".decree-section-title")?.textContent?.includes("Norns")
    );
    expect(nornsSection, "Norns section not found").not.toBeNull();
    expect(nornsSection!.classList.contains("open")).toBe(false);
    // Body should not be present when collapsed
    expect(nornsSection!.querySelector(".decree-section-body")).toBeNull();
  });

  it("section body appears after clicking collapsed section header", () => {
    const prompt = `You are FiremanDecko.
TODO TRACKING (UNBREAKABLE):
Use TodoWrite to plan.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(prompt)]} activeJob={JOB_FD} wsState="open" />
    );
    const sections = Array.from(container.querySelectorAll(".decree-section"));
    const nornsSection = sections.find((s) =>
      s.querySelector(".decree-section-title")?.textContent?.includes("Norns")
    );
    const header = nornsSection!.querySelector(".decree-section-header") as HTMLElement;
    fireEvent.click(header);
    expect(nornsSection!.querySelector(".decree-section-body"), "Body should appear after click").not.toBeNull();
  });
});

// ── EC-7: Inline backtick rendering ───────────────────────────────────────────

describe("EC-7: Inline backtick code span → .decree-body-code (issue #1020)", () => {
  it("backtick-wrapped text in Issue Details renders as .decree-body-code", () => {
    const prompt = `You are FiremanDecko.
**Issue details:**
Run \`git status\` to check state.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(prompt)]} activeJob={JOB_FD} wsState="open" />
    );
    const wideBody = container.querySelector(".decree-section.decree-wide .decree-section-body");
    const codeSpans = wideBody?.querySelectorAll(".decree-body-code");
    expect(codeSpans?.length, ".decree-body-code not found in Issue Details body").toBeGreaterThan(0);
    const found = Array.from(codeSpans ?? []).some((c) => c.textContent === "git status");
    expect(found, "git status should appear as .decree-body-code").toBe(true);
  });

  it("backtick code span content is NOT wrapped in a wiki-link", () => {
    const prompt = `You are FiremanDecko.
**Issue details:**
Use \`Fenrir\` as the constant name.
`;
    const { container } = render(
      <LogViewer entries={[makeTaskEntry(prompt)]} activeJob={JOB_FD} wsState="open" />
    );
    const wideBody = container.querySelector(".decree-section.decree-wide .decree-section-body");
    // Fenrir inside backticks → .decree-body-code, NOT .decree-body-link
    const wikiLinks = Array.from(wideBody?.querySelectorAll(".decree-body-link") ?? []);
    const fenrirLink = wikiLinks.find((a) => a.textContent?.includes("Fenrir"));
    expect(fenrirLink, "Fenrir inside backticks should NOT become a wiki-link").toBeUndefined();

    const codeSpans = Array.from(wideBody?.querySelectorAll(".decree-body-code") ?? []);
    const fenrirCode = codeSpans.find((c) => c.textContent === "Fenrir");
    expect(fenrirCode, "Fenrir inside backticks should be .decree-body-code").not.toBeUndefined();
  });
});
