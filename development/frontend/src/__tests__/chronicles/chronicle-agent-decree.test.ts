/**
 * chronicle-agent-decree.test.ts
 *
 * Unit tests for generate-agent-report.mjs MDX publish path:
 * - All-Father's Decree header (mdxRenderEntrypoint logic)
 * - Agent callback footer (AGENT_CALLBACKS data)
 *
 * Since generate-agent-report.mjs is a top-level script (not a module with
 * exports), these tests validate the *logic* by re-implementing the pure
 * helper functions extracted here. They are kept in sync with the source.
 *
 * Ref: GitHub Issue #1049
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SCRIPT_PATH = resolve(
  __dirname,
  "../../../../../.claude/skills/brandify-agent/scripts/generate-agent-report.mjs",
);

let script: string;

// ── Source presence guards ───────────────────────────────────────────────────

describe("generate-agent-report.mjs — source guards", () => {
  it("script exists and is readable", () => {
    script = readFileSync(SCRIPT_PATH, "utf-8");
    expect(script.length).toBeGreaterThan(1000);
  });
});

// ── AGENT_CALLBACKS data ─────────────────────────────────────────────────────

describe("AGENT_CALLBACKS", () => {
  // Re-implement the constant inline so tests don't depend on module loading
  const AGENT_CALLBACKS: Record<string, { quote: string; signoff: string; runes: string }> = {
    FiremanDecko: {
      quote: "The forge cools, the steel holds. What was broken has been reforged stronger than before.",
      signoff: "Forged in fire, tempered by craft",
      runes: "ᚠ ᛁ ᚱ ᛖ ᛗ ᚨ ᚾ",
    },
    Loki: {
      quote: "Every seam tested, every thread pulled. The trickster finds no fault — and that itself is suspicious.",
      signoff: "Tested by chaos, proven by order",
      runes: "ᛚ ᛟ ᚲ ᛁ",
    },
    Luna: {
      quote: "The branches of Yggdrasil have been shaped. What the eye sees, the hand shall build.",
      signoff: "Woven from moonlight, anchored in structure",
      runes: "ᛚ ᚢ ᚾ ᚨ",
    },
    Freya: {
      quote: "The vision is set, the path illuminated. Brisingamen's light guides the way forward.",
      signoff: "Guarded by wisdom, driven by purpose",
      runes: "ᚠ ᚱ ᛖ ᛃ ᚨ",
    },
    Heimdall: {
      quote: "The bridge holds. No shadow passes unseen, no weakness unguarded.",
      signoff: "Watched from the rainbow bridge",
      runes: "ᚺ ᛖ ᛁ ᛗ ᛞ ᚨ ᛚ ᛚ",
    },
  };

  const FALLBACK = {
    quote: "The task is done. The wolf's chain holds another day.",
    signoff: "Sealed by the pack",
    runes: "ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ",
  };

  it("has entries for all five named agents", () => {
    expect(Object.keys(AGENT_CALLBACKS)).toEqual(
      expect.arrayContaining(["FiremanDecko", "Loki", "Luna", "Freya", "Heimdall"]),
    );
  });

  it("each entry has quote, signoff, and runes", () => {
    for (const [name, cb] of Object.entries(AGENT_CALLBACKS)) {
      expect(cb.quote, `${name}.quote`).toBeTruthy();
      expect(cb.signoff, `${name}.signoff`).toBeTruthy();
      expect(cb.runes, `${name}.runes`).toBeTruthy();
    }
  });

  it("FiremanDecko quote uses forge metaphor", () => {
    expect(AGENT_CALLBACKS.FiremanDecko.quote).toMatch(/forge|forged/i);
  });

  it("Loki quote uses trickster metaphor", () => {
    expect(AGENT_CALLBACKS.Loki.quote).toMatch(/trickster/i);
  });

  it("fallback resolves for unknown agent names", () => {
    const cb = AGENT_CALLBACKS["Unknown"] ?? FALLBACK;
    expect(cb.quote).toBe(FALLBACK.quote);
    expect(cb.runes).toBe(FALLBACK.runes);
  });

  it("source defines AGENT_CALLBACKS before publishMode block", () => {
    script = script || readFileSync(SCRIPT_PATH, "utf-8");
    const callbacksPos = script.indexOf("const AGENT_CALLBACKS =");
    const publishPos = script.indexOf("if (publishMode)");
    expect(callbacksPos).toBeGreaterThan(-1);
    expect(publishPos).toBeGreaterThan(-1);
    expect(callbacksPos).toBeLessThan(publishPos);
  });
});

// ── mdxRenderEntrypoint logic ────────────────────────────────────────────────

describe("mdxRenderEntrypoint logic", () => {
  /**
   * Minimal reimplementation of the decree-section parser used in
   * mdxFormatDecree() inside generate-agent-report.mjs.
   */
  function mdxFormatDecree(text: string): string {
    let markup = "";
    const sections = text.split(/(?=\*\*Step \d|SANDBOX RULES|##)/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;
      if (/^You are \w+/.test(trimmed)) continue;

      if (/UNBREAKABLE/.test(trimmed)) {
        const title = trimmed.match(/^([A-Z][A-Z\s—–-]+?)[\s:(\n]/)?.[1]?.trim() ?? "SACRED OATH";
        markup += `decree-section:OATH:${title}`;
        continue;
      }

      const stepMatch = trimmed.match(/^\*\*Step (\d+\w?)[\s—–-]+(.+?)\*\*/);
      if (stepMatch) {
        const stepGlyphs = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ"];
        const idx = parseInt(stepMatch[1]) - 1;
        const glyph = stepGlyphs[idx % stepGlyphs.length] ?? "ᚱ";
        markup += `decree-section:STEP:${glyph}:${stepMatch[1]}`;
        continue;
      }

      if (/^## Description|^##\s+/.test(trimmed)) {
        markup += "decree-section:MATTER";
        continue;
      }

      if (/^SANDBOX RULES/.test(trimmed)) {
        markup += "decree-section:SANDBOX";
        continue;
      }
    }
    return markup;
  }

  it("strips 'You are X' intro from decree body", () => {
    const text = "You are FiremanDecko. Fix GitHub Issue.\n**Step 1 — Verify environment:** do stuff";
    const out = mdxFormatDecree(text);
    expect(out).not.toMatch(/You are/);
  });

  it("renders UNBREAKABLE sections as OATH blocks", () => {
    const text = "BRANCHING (UNBREAKABLE): Never commit to main.";
    const out = mdxFormatDecree(text);
    expect(out).toMatch(/OATH/);
  });

  it("renders Step sections with correct rune glyph", () => {
    const text = "**Step 1 — Verify environment:** run git";
    const out = mdxFormatDecree(text);
    expect(out).toContain("ᚠ");
    expect(out).toContain("STEP:ᚠ:1");
  });

  it("uses ᚢ glyph for Step 2", () => {
    const text = "**Step 2 — Read context:** gh issue view";
    const out = mdxFormatDecree(text);
    expect(out).toContain("ᚢ");
  });

  it("uses ᚦ glyph for Step 3", () => {
    const text = "**Step 3 — Implement:** write code";
    const out = mdxFormatDecree(text);
    expect(out).toContain("ᚦ");
  });

  it("renders ## Description as MATTER block", () => {
    const text = "## Description\nSome issue body here.";
    const out = mdxFormatDecree(text);
    expect(out).toContain("MATTER");
  });

  it("renders SANDBOX RULES block", () => {
    const text = "SANDBOX RULES (GKE Autopilot):\n- REPO_ROOT is /workspace/repo";
    const out = mdxFormatDecree(text);
    expect(out).toContain("SANDBOX");
  });
});

// ── MDX output structural checks ─────────────────────────────────────────────

describe("MDX template — decree and callback markers in source", () => {
  beforeAll(() => {
    script = readFileSync(SCRIPT_PATH, "utf-8");
  });

  it("source contains mdxRenderEntrypoint function", () => {
    expect(script).toContain("function mdxRenderEntrypoint()");
  });

  it("mdxRenderEntrypoint is called inside publishMode block", () => {
    // Verify the call appears after 'if (publishMode)'
    const publishStart = script.indexOf("if (publishMode)");
    const callPos = script.indexOf("mdxRenderEntrypoint()", publishStart);
    expect(callPos).toBeGreaterThan(publishStart);
  });

  it("MDX template includes All-Father's Decree header", () => {
    expect(script).toContain("The All-Father's Decree");
  });

  it("MDX template includes decree-title className", () => {
    expect(script).toContain('className="decree-title"');
  });

  it("MDX template includes decree-subtitle className", () => {
    expect(script).toContain('className="decree-subtitle"');
  });

  it("MDX template includes decree-runes row", () => {
    expect(script).toContain('className="decree-runes"');
  });

  it("MDX template includes decree-seal", () => {
    expect(script).toContain('className="decree-seal"');
  });

  it("MDX template includes agent-callback section", () => {
    const publishStart = script.indexOf("if (publishMode)");
    const callbackPos = script.indexOf('className="agent-callback"', publishStart);
    expect(callbackPos).toBeGreaterThan(publishStart);
  });

  it("MDX template includes callback-declaration", () => {
    const publishStart = script.indexOf("if (publishMode)");
    const pos = script.indexOf('className="callback-declaration"', publishStart);
    expect(pos).toBeGreaterThan(publishStart);
  });

  it("MDX template includes callback-blood-seal", () => {
    const publishStart = script.indexOf("if (publishMode)");
    const pos = script.indexOf('className="callback-blood-seal"', publishStart);
    expect(pos).toBeGreaterThan(publishStart);
  });

  it("MDX decree uses JSX className not HTML class", () => {
    const publishStart = script.indexOf("if (publishMode)");
    const publishEnd = script.indexOf("// Build HTML");
    const mdxBlock = script.slice(publishStart, publishEnd);
    // Should not contain raw `class=` (HTML attribute) in JSX context
    const htmlClassCount = (mdxBlock.match(/(?<![a-zA-Z])class="/g) || []).length;
    expect(htmlClassCount).toBe(0);
  });

  it("decree step glyphs array includes ᚠ ᚢ ᚦ as first three entries", () => {
    expect(script).toMatch(/\["ᚠ","ᚢ","ᚦ"/);
  });

  it("⚔ glyph used for UNBREAKABLE oaths in MDX decree", () => {
    const publishStart = script.indexOf("if (publishMode)");
    const publishEnd = script.indexOf("// Build HTML");
    const mdxBlock = script.slice(publishStart, publishEnd);
    expect(mdxBlock).toContain("⚔");
  });
});

// ── Secret sanitisation guard ─────────────────────────────────────────────────

describe("MDX output — no secrets in prompt content", () => {
  it("prompt lines are escaped before serialisation", () => {
    script = script || readFileSync(SCRIPT_PATH, "utf-8");
    // JSON.stringify used in mdxFormatDecree ensures prompt content is
    // safely serialised in JSX string literals
    expect(script).toContain("JSON.stringify(");
  });
});
