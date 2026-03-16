/**
 * Loki QA tests for issue #1003 — Norse tablet enhancements:
 *   Wikipedia links, RuneSignatureBlock, and epic seals.
 *
 * AC validated:
 * AC-1: NorseErrorTablet subheadings link Norse terms to Wikipedia
 * AC-2: NorseTablet displays agent rune signature block
 * AC-3: NorseErrorTablet shows variant-aware epic seals
 * AC-4: Unknown agent keys fall back to "ASGARD" rune seal
 * AC-5: Rune glyphs have aria-hidden="true"
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { NorseErrorTablet } from "../components/NorseErrorTablet";
import { LogViewer } from "../components/LogViewer";
import type { DisplayJob } from "../lib/types";
import type { LogEntry } from "../hooks/useLogStream";

afterEach(cleanup);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TTL_MESSAGE =
  "Logs unavailable — pod TTL expired for session test-1003.";

const NODE_UNREACHABLE_MESSAGE =
  "Logs unavailable — node unreachable for session test-1003.";

const MOCK_JOB_LOKI: DisplayJob = {
  sessionId: "test-1003-loki",
  name: "agent-test-1003-loki",
  issue: "1003",
  step: "1",
  agentKey: "loki",
  agentName: "Loki",
  status: "running",
  startTime: null,
  completionTime: null, issueTitle: null, branchName: null,
};

const MOCK_JOB_UNKNOWN: DisplayJob = {
  sessionId: "test-1003-unknown",
  name: "agent-test-1003-unknown",
  issue: "1003",
  step: "1",
  agentKey: "unknown-agent-xyz",
  agentName: "UnknownAgent",
  status: "running",
  startTime: null,
  completionTime: null, issueTitle: null, branchName: null,
};

const MOCK_JOB_NO_KEY: DisplayJob = {
  sessionId: "test-1003-nokey",
  name: "agent-test-1003-nokey",
  issue: "1003",
  step: "1",
  agentKey: undefined,
  agentName: "SomeAgent",
  status: "running",
  startTime: null,
  completionTime: null, issueTitle: null, branchName: null,
};

// Helper to create a NorseTablet log entry
function makeTaskEntry(text: string): LogEntry {
  return { id: "t1", type: "entrypoint-task", text } as LogEntry;
}

// ── AC-1: Wikipedia links in NorseErrorTablet subheadings ────────────────────

describe("AC-1: NorseErrorTablet — Wikipedia links in subheadings (issue #1003)", () => {
  it("ttl-expired subheading contains a link to Yggdrasil Wikipedia", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const yggLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Yggdrasil")
    );
    expect(yggLink, "Yggdrasil wiki-link not found").not.toBeNull();
  });

  it("ttl-expired Yggdrasil link opens in a new tab", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const yggLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Yggdrasil")
    );
    expect(yggLink?.getAttribute("target")).toBe("_blank");
  });

  it("ttl-expired Yggdrasil link has rel=noopener noreferrer", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const yggLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Yggdrasil")
    );
    expect(yggLink?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("ttl-expired Yggdrasil link points to correct Wikipedia URL", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const yggLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Yggdrasil")
    );
    expect(yggLink?.getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Yggdrasil");
  });

  it("ttl-expired Yggdrasil link has accessible aria-label", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const yggLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Yggdrasil")
    );
    const ariaLabel = yggLink?.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toMatch(/Yggdrasil/i);
    expect(ariaLabel).toMatch(/Wikipedia/i);
  });

  it("node-unreachable subheading contains a link to Bifröst Wikipedia", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const bifLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Bifr")
    );
    expect(bifLink, "Bifröst wiki-link not found").not.toBeNull();
  });

  it("node-unreachable Bifröst link opens in a new tab", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const bifLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Bifr")
    );
    expect(bifLink?.getAttribute("target")).toBe("_blank");
  });

  it("node-unreachable Bifröst link has rel=noopener noreferrer", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const bifLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Bifr")
    );
    expect(bifLink?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("node-unreachable Bifröst link points to percent-encoded Wikipedia URL", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const bifLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Bifr")
    );
    expect(bifLink?.getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Bifr%C3%B6st");
  });

  it("node-unreachable Bifröst link has accessible aria-label", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    const links = container.querySelectorAll("a.wiki-link");
    const bifLink = Array.from(links as NodeListOf<Element>).find((a) =>
      a.getAttribute("href")?.includes("Bifr")
    );
    const ariaLabel = bifLink?.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toMatch(/Bifr/i);
    expect(ariaLabel).toMatch(/Wikipedia/i);
  });
});

// ── AC-3: Variant-aware epic seals in NorseErrorTablet ───────────────────────

describe("AC-3: NorseErrorTablet — variant-aware epic seals (issue #1003)", () => {
  it("ttl-expired renders .net-seal-epic element", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    expect(container.querySelector(".net-seal-epic")).not.toBeNull();
  });

  it("ttl-expired .net-seal-epic has aria-hidden=true", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const seal = container.querySelector(".net-seal-epic");
    expect(seal?.getAttribute("aria-hidden")).toBe("true");
  });

  it("ttl-expired renders .net-seal-rune-row with Yggdrasil runes", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const runeRow = container.querySelector(".net-seal-rune-row");
    expect(runeRow).not.toBeNull();
    expect(runeRow?.textContent).toBe("ᛃᚷᚷᛞᚱᚨᛊᛁᛚ");
  });

  it("ttl-expired renders .net-seal-inscription mentioning Yggdrasil", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const inscription = container.querySelector(".net-seal-inscription");
    expect(inscription?.textContent).toContain("Yggdrasil");
  });

  it("ttl-expired renders .net-seal-sub element", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    expect(container.querySelector(".net-seal-sub")).not.toBeNull();
  });

  it("node-unreachable renders .net-seal-epic element", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    expect(container.querySelector(".net-seal-epic")).not.toBeNull();
  });

  it("node-unreachable renders .net-seal-rune-row with Bifröst runes", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    const runeRow = container.querySelector(".net-seal-rune-row");
    expect(runeRow?.textContent).toBe("ᛒᛁᚠᚱᛟᛊᛏ");
  });

  it("node-unreachable rune row differs from ttl-expired rune row", () => {
    const { container: c1 } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const { container: c2 } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    const runes1 = c1.querySelector(".net-seal-rune-row")?.textContent;
    const runes2 = c2.querySelector(".net-seal-rune-row")?.textContent;
    expect(runes1).not.toBe(runes2);
  });

  it("node-unreachable inscription mentions bridge", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    const inscription = container.querySelector(".net-seal-inscription");
    expect(inscription?.textContent).toMatch(/bridge/i);
  });

  it("node-unreachable .net-seal-epic has aria-hidden=true", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s2" message={NODE_UNREACHABLE_MESSAGE} variant="node-unreachable" />
    );
    const seal = container.querySelector(".net-seal-epic");
    expect(seal?.getAttribute("aria-hidden")).toBe("true");
  });
});

// ── AC-2: Odin's Royal Seal in NorseTablet via LogViewer ────────────────────
// Updated in #1020: .nt-rune-sig replaced by .decree-seal (Odin's royal seal).

describe("AC-2: Odin's Royal Seal — rendered in NorseTablet (issue #1020)", () => {
  it("renders .decree-seal element for a known agentKey", () => {
    const taskEntry = makeTaskEntry("You are Loki, QA Tester. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_LOKI}
        wsState="open"
      />
    );
    expect(container.querySelector(".decree-seal")).not.toBeNull();
  });

  it(".decree-seal has role=complementary", () => {
    const taskEntry = makeTaskEntry("You are Loki, QA Tester. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_LOKI}
        wsState="open"
      />
    );
    const seal = container.querySelector(".decree-seal");
    expect(seal?.getAttribute("role")).toBe("complementary");
  });

  it(".decree-seal aria-label is \"Odin's royal seal\"", () => {
    const taskEntry = makeTaskEntry("You are Loki, QA Tester. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_LOKI}
        wsState="open"
      />
    );
    const seal = container.querySelector(".decree-seal");
    expect(seal?.getAttribute("aria-label")).toBe("Odin's royal seal");
  });

  it(".decree-seal-runic-band contains Odin runic band (ᛟ ᛞ ᛁ ᚾ)", () => {
    const taskEntry = makeTaskEntry("You are Loki, QA Tester. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_LOKI}
        wsState="open"
      />
    );
    const band = container.querySelector(".decree-seal-runic-band");
    expect(band).not.toBeNull();
    expect(band?.textContent).toMatch(/ᛟ/);
    expect(band?.getAttribute("aria-hidden")).toBe("true");
  });

  it(".decree-seal-medallion has role=img and aria-label", () => {
    const taskEntry = makeTaskEntry("You are Loki, QA Tester. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_LOKI}
        wsState="open"
      />
    );
    const medallion = container.querySelector(".decree-seal-medallion");
    expect(medallion?.getAttribute("role")).toBe("img");
    expect(medallion?.getAttribute("aria-label")).toMatch(/Odin/);
  });

  it(".decree-seal-divider has aria-hidden=true", () => {
    const taskEntry = makeTaskEntry("You are Loki, QA Tester. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_LOKI}
        wsState="open"
      />
    );
    const divEl = container.querySelector(".decree-seal-divider");
    expect(divEl?.getAttribute("aria-hidden")).toBe("true");
  });

  it(".decree-seal-command renders Odin's quote mentioning Nine Realms", () => {
    const taskEntry = makeTaskEntry("You are Loki, QA Tester. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_LOKI}
        wsState="open"
      />
    );
    const cmd = container.querySelector(".decree-seal-command");
    expect(cmd).not.toBeNull();
    expect(cmd?.textContent).toMatch(/Nine Realms/i);
    expect(cmd?.textContent).toMatch(/Fenrir/i);
  });

  it(".decree-seal-title-runes has aria-hidden=true", () => {
    const taskEntry = makeTaskEntry("You are Loki, QA Tester. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_LOKI}
        wsState="open"
      />
    );
    const titleRunes = container.querySelector(".decree-seal-title-runes");
    expect(titleRunes?.getAttribute("aria-hidden")).toBe("true");
  });
});

// ── AC-4: Unknown agent key — seal still renders ──────────────────────────────

describe("AC-4: Royal Seal — unknown agentKey falls back gracefully (issue #1020)", () => {
  it("unknown agentKey still renders .decree-seal", () => {
    const taskEntry = makeTaskEntry("You are UnknownAgent. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_UNKNOWN}
        wsState="open"
      />
    );
    expect(container.querySelector(".decree-seal")).not.toBeNull();
  });

  it("undefined agentKey still renders .decree-seal", () => {
    const taskEntry = makeTaskEntry("You are SomeAgent. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_NO_KEY}
        wsState="open"
      />
    );
    expect(container.querySelector(".decree-seal")).not.toBeNull();
  });

  it("fallback .decree-seal has role=complementary", () => {
    const taskEntry = makeTaskEntry("You are UnknownAgent. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_UNKNOWN}
        wsState="open"
      />
    );
    const seal = container.querySelector(".decree-seal");
    expect(seal?.getAttribute("role")).toBe("complementary");
  });

  it(".decree-seal-command always mentions Nine Realms regardless of agent", () => {
    const taskEntry = makeTaskEntry("You are UnknownAgent. Fix issue #1003.");
    const { container } = render(
      <LogViewer
        entries={[taskEntry]}
        activeJob={MOCK_JOB_UNKNOWN}
        wsState="open"
      />
    );
    const cmd = container.querySelector(".decree-seal-command");
    expect(cmd?.textContent).toMatch(/Nine Realms/i);
  });
});

// ── AC-5: Rune glyph aria-hidden across components ───────────────────────────

describe("AC-5: Accessibility — rune glyphs are aria-hidden (issue #1003)", () => {
  it("NorseErrorTablet rune borders are aria-hidden", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const runeBorders = container.querySelectorAll(".net-rune-border[aria-hidden='true']");
    expect(runeBorders.length).toBeGreaterThan(0);
  });

  it("NorseErrorTablet .net-glyph is aria-hidden", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const glyph = container.querySelector(".net-glyph");
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
  });

  it("NorseErrorTablet .net-divider is aria-hidden", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const divider = container.querySelector(".net-divider");
    expect(divider?.getAttribute("aria-hidden")).toBe("true");
  });

  it("NorseErrorTablet .net-seal-epic is aria-hidden (epic seal is decorative)", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="s1" message={TTL_MESSAGE} variant="ttl-expired" />
    );
    const seal = container.querySelector(".net-seal-epic");
    expect(seal?.getAttribute("aria-hidden")).toBe("true");
  });
});
