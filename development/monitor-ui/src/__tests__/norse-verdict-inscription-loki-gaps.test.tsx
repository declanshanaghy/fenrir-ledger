/**
 * Loki QA gap-coverage tests for issue #1019 — NorseVerdictInscription.
 *
 * FiremanDecko wrote 65 tests in norse-verdict-inscription.test.tsx covering the
 * primary happy paths. These tests target spec-defined behaviour that was NOT
 * covered in that suite (devil's advocate: test what is missing, not what is
 * already proven).
 *
 * Gaps addressed here:
 * - Ordered list renders .nvi-md-ol (renderMarkdown ol branch)
 * - H3 heading renders .nvi-md-h3 (renderMarkdown h3 branch)
 * - Horizontal rule renders .nvi-md-hr (renderMarkdown hr branch)
 * - Checkbox items carry .nvi-md-checked / .nvi-md-unchecked classes
 * - .nvi-divider decorative band is present
 * - .nvi-agent-name shows the rune name (e.g. "Kenaz" for fireman-decko)
 * - Generic fallback produces zero Norse term links (empty pledgeLinks)
 * - agentName prop (without agentKey) drives agent detection fallback
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { NorseVerdictInscription } from "../components/NorseVerdictInscription";

afterEach(cleanup);

// ── Shared fixtures ──────────────────────────────────────────────────────────

const HANDOFF_BASE = "## FiremanDecko → Loki Handoff\n\n";

// ── Markdown rendering — uncovered branches ──────────────────────────────────

describe("NorseVerdictInscription — Loki gap: markdown branch coverage", () => {
  it("renders ordered list as .nvi-md-ol", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={HANDOFF_BASE + "1. First step\n2. Second step\n3. Third step"}
        agentKey="firemandecko"
      />
    );
    expect(container.querySelector(".nvi-md-ol")).not.toBeNull();
    expect(container.querySelectorAll(".nvi-md-ol li").length).toBe(3);
  });

  it("renders H3 heading as .nvi-md-h3", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={HANDOFF_BASE + "### Deep Section\n\nSome text"}
        agentKey="firemandecko"
      />
    );
    expect(container.querySelector(".nvi-md-h3")).not.toBeNull();
    expect(container.querySelector(".nvi-md-h3")?.textContent).toContain("Deep Section");
  });

  it("renders horizontal rule as .nvi-md-hr", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={HANDOFF_BASE + "Some text\n\n---\n\nMore text"}
        agentKey="firemandecko"
      />
    );
    expect(container.querySelector(".nvi-md-hr")).not.toBeNull();
    expect(container.querySelector(".nvi-md-hr")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("checked checkbox item has .nvi-md-checked class", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={HANDOFF_BASE + "- [x] Completed task\n- [ ] Pending task"}
        agentKey="loki"
      />
    );
    expect(container.querySelector(".nvi-md-checked")).not.toBeNull();
    expect(container.querySelector(".nvi-md-checked")?.textContent).toContain("Completed task");
  });

  it("unchecked checkbox item has .nvi-md-unchecked class", () => {
    const { container } = render(
      <NorseVerdictInscription
        text={HANDOFF_BASE + "- [x] Done\n- [ ] Not done"}
        agentKey="loki"
      />
    );
    expect(container.querySelector(".nvi-md-unchecked")).not.toBeNull();
    expect(container.querySelector(".nvi-md-unchecked")?.textContent).toContain("Not done");
  });
});

// ── Structural elements ──────────────────────────────────────────────────────

describe("NorseVerdictInscription — Loki gap: structural elements", () => {
  it("renders .nvi-divider decorative band", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_BASE + "Content."} agentKey="firemandecko" />
    );
    expect(container.querySelector(".nvi-divider")).not.toBeNull();
  });

  it("renders .nvi-agent-name with the correct rune name for fireman-decko (Kenaz)", () => {
    const { container } = render(
      <NorseVerdictInscription text={HANDOFF_BASE + "Content."} agentKey="firemandecko" />
    );
    expect(container.querySelector(".nvi-agent-name")?.textContent).toBe("Kenaz");
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("NorseVerdictInscription — Loki gap: edge cases", () => {
  it("generic fallback produces zero Norse term links (empty pledgeLinks)", () => {
    const { container } = render(
      <NorseVerdictInscription
        text="## Handoff\n\nTask complete."
        // no agentKey → resolves to generic
      />
    );
    const links = container.querySelectorAll(".nvi-norse-link");
    expect(links.length).toBe(0);
  });

  it("agentName prop (without agentKey) drives agent detection — Loki gets ᚾ Naudhiz rune", () => {
    const { container } = render(
      <NorseVerdictInscription
        text="## Loki QA Verdict — Issue #1019\n\nAll tests pass."
        agentName="Loki"
        // no agentKey
      />
    );
    expect(container.querySelector(".nvi-glyph")?.textContent).toBe("ᚾ");
    expect(container.querySelector(".nvi-agent-name")?.textContent).toBe("Naudhiz");
  });
});
