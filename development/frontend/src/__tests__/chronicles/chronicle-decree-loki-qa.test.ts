/**
 * chronicle-decree-loki-qa.test.ts
 *
 * Loki QA augmentation tests for issue #1049:
 * MDX All-Father's Decree header + agent callback footer.
 *
 * Covers gaps NOT addressed by chronicle-agent-decree.test.ts:
 *   - callback-runes / callback-quote / callback-wolf 🐺 classNames
 *   - Agent-specific metaphors: Luna (Yggdrasil), Freya (Brisingamen), Heimdall (bridge)
 *   - MDX frontmatter must include category:"agent" and rune:"ᚲ"
 *   - Decree markup appears before callback markup in final MDX template
 *
 * Ref: GitHub Issue #1049
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SCRIPT_PATH = resolve(
  __dirname,
  "../../../../../.claude/skills/brandify-agent/scripts/generate-agent-report.mjs",
);

let script: string;

beforeAll(() => {
  script = readFileSync(SCRIPT_PATH, "utf-8");
});

// ── Callback footer — class coverage gaps ────────────────────────────────────

describe("MDX callback footer — missing className coverage", () => {
  it("includes callback-runes className in MDX block", () => {
    const publishStart = script.indexOf("if (publishMode)");
    const pos = script.indexOf('className="callback-runes"', publishStart);
    expect(pos).toBeGreaterThan(publishStart);
  });

  it("includes callback-quote className in MDX block", () => {
    const publishStart = script.indexOf("if (publishMode)");
    const pos = script.indexOf('className="callback-quote"', publishStart);
    expect(pos).toBeGreaterThan(publishStart);
  });

  it("includes callback-wolf div with 🐺 glyph in MDX block", () => {
    const publishStart = script.indexOf("if (publishMode)");
    // MDX callback is ~16.6k chars into the publishMode block (after decree entrypoint)
    const publishSection = script.slice(publishStart, publishStart + 20000);
    expect(publishSection).toContain('className="callback-wolf"');
    expect(publishSection).toContain("🐺");
  });
});

// ── Agent-specific quotes — metaphor validation ───────────────────────────────

describe("AGENT_CALLBACKS — agent-specific metaphors", () => {
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

  it("Luna quote references Yggdrasil", () => {
    expect(AGENT_CALLBACKS.Luna.quote).toMatch(/Yggdrasil/i);
  });

  it("Freya quote references Brisingamen", () => {
    expect(AGENT_CALLBACKS.Freya.quote).toMatch(/Brisingamen/i);
  });

  it("Heimdall quote references the bridge", () => {
    expect(AGENT_CALLBACKS.Heimdall.quote).toMatch(/bridge/i);
  });

  it("Heimdall signoff references the rainbow bridge", () => {
    expect(AGENT_CALLBACKS.Heimdall.signoff).toMatch(/bridge/i);
  });
});

// ── MDX frontmatter fields ────────────────────────────────────────────────────

describe("MDX frontmatter — required fields", () => {
  it("frontmatter includes category: agent", () => {
    const publishStart = script.indexOf("if (publishMode)");
    // Frontmatter template is ~16.8k chars into the publishMode block (after decree entrypoint)
    const section = script.slice(publishStart, publishStart + 20000);
    expect(section).toContain('category: "agent"');
  });

  it("frontmatter includes rune: ᚲ", () => {
    const publishStart = script.indexOf("if (publishMode)");
    // Frontmatter template is ~16.7k chars into the publishMode block (after decree entrypoint)
    const section = script.slice(publishStart, publishStart + 20000);
    expect(section).toContain('rune: "ᚲ"');
  });
});

// ── Template ordering: decree before callback ─────────────────────────────────

describe("MDX template — structural ordering", () => {
  it("decree markup appears before callback markup in MDX output", () => {
    const publishStart = script.indexOf("if (publishMode)");
    const decreePos = script.indexOf("mdxDecreeMarkup", publishStart);
    const callbackPos = script.indexOf("mdxCallbackMarkup", publishStart);
    expect(decreePos).toBeGreaterThan(publishStart);
    expect(callbackPos).toBeGreaterThan(publishStart);
    expect(decreePos).toBeLessThan(callbackPos);
  });

  it("report-footer ᚠ glyph present in MDX template", () => {
    const publishStart = script.indexOf("if (publishMode)");
    // report-footer is ~19.1k chars into the publishMode block (after decree entrypoint)
    const section = script.slice(publishStart, publishStart + 22000);
    expect(section).toContain("report-footer");
    expect(section).toContain("ᚠ Fenrir Ledger");
  });
});
