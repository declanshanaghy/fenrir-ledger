/**
 * decree-parser.test.ts — Vitest unit tests for parseDecreeBlock()
 *
 * Tests: extraction of all fields, edge cases (missing fields, partial
 * delimiters, N/A PR, malformed input, multi-turn text).
 */

import { describe, it, expect } from "vitest";
import { parseDecreeBlock, DECREE_DELIMITER_OPEN, DECREE_DELIMITER_CLOSE } from "@/lib/decree-parser";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_FIREMAN_DECREE = `
᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: DONE
PR: https://github.com/declanshanaghy/fenrir-ledger/pull/99
SUMMARY:
- Added decree-complete template to all 5 agent system prompts
- Created agent-identity.mjs as canonical source
- Added decree parser to generate-agent-report.mjs
CHECKS:
- tsc: PASS
- build: PASS
SEAL: FiremanDecko · ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ · Principal Engineer
SIGNOFF: Forged in fire, tempered by craft
᛭᛭᛭ END DECREE ᛭᛭᛭
`;

const LOKI_FAIL_DECREE = `
᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: FAIL
PR: N/A
SUMMARY:
- Validation found 2 defects filed as issues
- tsc passed, but E2E test failure on decree render path
CHECKS:
- tsc: PASS
- build: PASS
- playwright: 3 tests written, 1 FAIL
SEAL: Loki · ᛚᛟᚲᛁ · QA Tester
SIGNOFF: Tested by chaos, proven by order
᛭᛭᛭ END DECREE ᛭᛭᛭
`;

const LUNA_MINIMAL_DECREE = `
᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: DELIVERED
PR: N/A
CHECKS:
- wireframes: COMPLETE
SEAL: Luna · ᛚᚢᚾᚨ · UX Designer
SIGNOFF: Woven from moonlight, anchored in structure
᛭᛭᛭ END DECREE ᛭᛭᛭
`;

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("parseDecreeBlock — full block", () => {
  it("returns non-null for a valid FiremanDecko decree", () => {
    expect(parseDecreeBlock(FULL_FIREMAN_DECREE)).not.toBeNull();
  });

  it("extracts issue number", () => {
    const d = parseDecreeBlock(FULL_FIREMAN_DECREE);
    expect(d?.issue).toBe("1077");
  });

  it("extracts verdict", () => {
    const d = parseDecreeBlock(FULL_FIREMAN_DECREE);
    expect(d?.verdict).toBe("DONE");
  });

  it("extracts PR url", () => {
    const d = parseDecreeBlock(FULL_FIREMAN_DECREE);
    expect(d?.pr).toBe("https://github.com/declanshanaghy/fenrir-ledger/pull/99");
  });

  it("extracts summary bullets", () => {
    const d = parseDecreeBlock(FULL_FIREMAN_DECREE);
    expect(d?.summary).toHaveLength(3);
    expect(d?.summary[0]).toBe("Added decree-complete template to all 5 agent system prompts");
  });

  it("extracts checks", () => {
    const d = parseDecreeBlock(FULL_FIREMAN_DECREE);
    expect(d?.checks).toHaveLength(2);
    expect(d?.checks[0]).toEqual({ name: "tsc", result: "PASS" });
    expect(d?.checks[1]).toEqual({ name: "build", result: "PASS" });
  });

  it("extracts seal fields", () => {
    const d = parseDecreeBlock(FULL_FIREMAN_DECREE);
    expect(d?.sealAgent).toBe("FiremanDecko");
    expect(d?.sealRunes).toBe("ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ");
    expect(d?.sealTitle).toBe("Principal Engineer");
  });

  it("extracts signoff", () => {
    const d = parseDecreeBlock(FULL_FIREMAN_DECREE);
    expect(d?.signoff).toBe("Forged in fire, tempered by craft");
  });
});

// ---------------------------------------------------------------------------
// Per-agent verdicts
// ---------------------------------------------------------------------------

describe("parseDecreeBlock — per-agent verdicts", () => {
  it("extracts FAIL verdict for Loki", () => {
    const d = parseDecreeBlock(LOKI_FAIL_DECREE);
    expect(d?.verdict).toBe("FAIL");
  });

  it("extracts DELIVERED verdict for Luna", () => {
    const d = parseDecreeBlock(LUNA_MINIMAL_DECREE);
    expect(d?.verdict).toBe("DELIVERED");
  });

  it("Loki seal has correct rune signature", () => {
    const d = parseDecreeBlock(LOKI_FAIL_DECREE);
    expect(d?.sealRunes).toBe("ᛚᛟᚲᛁ");
    expect(d?.sealAgent).toBe("Loki");
  });
});

// ---------------------------------------------------------------------------
// Edge cases: N/A PR
// ---------------------------------------------------------------------------

describe("parseDecreeBlock — PR field edge cases", () => {
  it("returns null PR when PR is N/A", () => {
    const d = parseDecreeBlock(LOKI_FAIL_DECREE);
    expect(d?.pr).toBeNull();
  });

  it("returns null PR when PR is 'none'", () => {
    const text = FULL_FIREMAN_DECREE.replace(
      "PR: https://github.com/declanshanaghy/fenrir-ledger/pull/99",
      "PR: none"
    );
    const d = parseDecreeBlock(text);
    expect(d?.pr).toBeNull();
  });

  it("returns null PR when PR is '-'", () => {
    const text = FULL_FIREMAN_DECREE.replace(
      "PR: https://github.com/declanshanaghy/fenrir-ledger/pull/99",
      "PR: -"
    );
    const d = parseDecreeBlock(text);
    expect(d?.pr).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge cases: missing optional fields
// ---------------------------------------------------------------------------

describe("parseDecreeBlock — missing optional fields", () => {
  it("handles missing PR line gracefully", () => {
    const text = FULL_FIREMAN_DECREE.replace(/^PR:.*\n/m, "");
    const d = parseDecreeBlock(text);
    expect(d).not.toBeNull();
    expect(d?.pr).toBeNull();
  });

  it("handles missing SUMMARY section (empty array)", () => {
    const d = parseDecreeBlock(LUNA_MINIMAL_DECREE);
    expect(d?.summary).toEqual([]);
  });

  it("handles missing SIGNOFF line (returns null)", () => {
    const text = FULL_FIREMAN_DECREE.replace(/^SIGNOFF:.*\n/m, "");
    const d = parseDecreeBlock(text);
    expect(d?.signoff).toBeNull();
  });

  it("handles missing SEAL line (all seal fields null)", () => {
    const text = FULL_FIREMAN_DECREE.replace(/^SEAL:.*\n/m, "");
    const d = parseDecreeBlock(text);
    expect(d?.sealAgent).toBeNull();
    expect(d?.sealRunes).toBeNull();
    expect(d?.sealTitle).toBeNull();
  });

  it("handles CHECKS with colon-value entries", () => {
    const d = parseDecreeBlock(LOKI_FAIL_DECREE);
    expect(d?.checks.find(c => c.name === "playwright")).toEqual({
      name: "playwright",
      result: "3 tests written, 1 FAIL",
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases: malformed / no block
// ---------------------------------------------------------------------------

describe("parseDecreeBlock — no decree block", () => {
  it("returns null for empty string", () => {
    expect(parseDecreeBlock("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseDecreeBlock(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseDecreeBlock(undefined)).toBeNull();
  });

  it("returns null for plain text without decree", () => {
    expect(parseDecreeBlock("All work done. Looks good. Ship it.")).toBeNull();
  });

  it("returns null for partial open delimiter only", () => {
    expect(parseDecreeBlock("᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭\nISSUE: #1\nVERDICT: DONE")).toBeNull();
  });

  it("returns null for partial close delimiter only", () => {
    expect(parseDecreeBlock("ISSUE: #1\nVERDICT: DONE\n᛭᛭᛭ END DECREE ᛭᛭᛭")).toBeNull();
  });

  it("returns null when issue and verdict are both absent inside block", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
SEAL: Loki · ᛚᛟᚲᛁ · QA Tester
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    expect(parseDecreeBlock(text)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge cases: block embedded in surrounding text
// ---------------------------------------------------------------------------

describe("parseDecreeBlock — block surrounded by text", () => {
  it("finds decree block when surrounded by other text", () => {
    const surrounding = `
Some preamble text about the session.

Here is what was done today.

${FULL_FIREMAN_DECREE}

This is a trailing note that should be ignored.
`;
    const d = parseDecreeBlock(surrounding);
    expect(d).not.toBeNull();
    expect(d?.verdict).toBe("DONE");
    expect(d?.issue).toBe("1077");
  });

  it("finds first decree block when multiple are present", () => {
    const combined = FULL_FIREMAN_DECREE + "\n\n" + LOKI_FAIL_DECREE;
    const d = parseDecreeBlock(combined);
    expect(d?.verdict).toBe("DONE"); // first one wins
  });
});

// ---------------------------------------------------------------------------
// Constants export check
// ---------------------------------------------------------------------------

describe("decree constants", () => {
  it("exports DECREE_DELIMITER_OPEN", () => {
    expect(DECREE_DELIMITER_OPEN).toBe("᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭");
  });

  it("exports DECREE_DELIMITER_CLOSE", () => {
    expect(DECREE_DELIMITER_CLOSE).toBe("᛭᛭᛭ END DECREE ᛭᛭᛭");
  });
});

// ---------------------------------------------------------------------------
// Fallback: box-drawing format (Format 2)
// ---------------------------------------------------------------------------

import { parseBoxDrawingDecreeBlock, parseFreeformDecreeBlock } from "@/lib/decree-parser";

const BOX_DRAWING_LOKI = `
╔══════════════════════════════════════════════════════════════════════╗
║                    LOKI QA DECREE — COMPLETE                         ║
╠══════════════════════════════════════════════════════════════════════╣
║  Issue:    #1398                                                     ║
║  Verdict:  ❌ FAIL                                                    ║
║  tsc:      ✅ PASS                                                    ║
║  build:    ✅ PASS                                                    ║
╚══════════════════════════════════════════════════════════════════════╝
`;

const BOX_DRAWING_FIREMAN = `
╔══════════════════════════════════╗
║  FIREMAN DECKO DECREE — COMPLETE ║
╠══════════════════════════════════╣
║  Issue:    #1387                 ║
║  Verdict:  COMPLETE              ║
╚══════════════════════════════════╝
`;

describe("parseBoxDrawingDecreeBlock — Format 2 detection", () => {
  it("returns non-null for a box-drawing decree", () => {
    expect(parseBoxDrawingDecreeBlock(BOX_DRAWING_LOKI)).not.toBeNull();
  });

  it("extracts issue number from box-drawing format", () => {
    const d = parseBoxDrawingDecreeBlock(BOX_DRAWING_LOKI);
    expect(d?.issue).toBe("1398");
  });

  it("strips emoji from FAIL verdict", () => {
    const d = parseBoxDrawingDecreeBlock(BOX_DRAWING_LOKI);
    expect(d?.verdict).toBe("FAIL");
  });

  it("normalises COMPLETE verdict to DONE", () => {
    const d = parseBoxDrawingDecreeBlock(BOX_DRAWING_FIREMAN);
    expect(d?.verdict).toBe("DONE");
  });

  it("extracts tsc and build checks from box-drawing", () => {
    const d = parseBoxDrawingDecreeBlock(BOX_DRAWING_LOKI);
    expect(d?.checks.some(c => c.name === "tsc" && c.result === "PASS")).toBe(true);
    expect(d?.checks.some(c => c.name === "build" && c.result === "PASS")).toBe(true);
  });

  it("sets format to box-drawing", () => {
    const d = parseBoxDrawingDecreeBlock(BOX_DRAWING_LOKI);
    expect(d?.format).toBe("box-drawing");
  });

  it("returns null for text without ╔ box chars", () => {
    expect(parseBoxDrawingDecreeBlock("DECREE\nIssue: #1\nVerdict: PASS")).toBeNull();
  });

  it("returns null when issue and verdict are both absent", () => {
    expect(parseBoxDrawingDecreeBlock("╔══╗\n║ DECREE ║\n╚══╝")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fallback: freeform format (Format 3 plain text, Format 4 markdown)
// ---------------------------------------------------------------------------

const FREEFORM_PLAIN = `
AGENT: FiremanDecko
ISSUE: #1409
STATUS: COMPLETE
VERDICT: PASS
tsc: PASS
build: PASS
`;

const FREEFORM_MARKDOWN = `
## FiremanDecko Decree — Issue #1367
**Verdict:** DONE
- Changed X
- Fixed Y
tsc: PASS
build: PASS
`;

describe("parseFreeformDecreeBlock — Format 3/4 detection", () => {
  it("returns non-null for plain text freeform", () => {
    expect(parseFreeformDecreeBlock(FREEFORM_PLAIN)).not.toBeNull();
  });

  it("extracts issue from plain text", () => {
    const d = parseFreeformDecreeBlock(FREEFORM_PLAIN);
    expect(d?.issue).toBe("1409");
  });

  it("extracts PASS verdict from plain text", () => {
    const d = parseFreeformDecreeBlock(FREEFORM_PLAIN);
    expect(d?.verdict).toBe("PASS");
  });

  it("returns non-null for markdown freeform", () => {
    expect(parseFreeformDecreeBlock(FREEFORM_MARKDOWN)).not.toBeNull();
  });

  it("extracts issue from markdown format", () => {
    const d = parseFreeformDecreeBlock(FREEFORM_MARKDOWN);
    expect(d?.issue).toBe("1367");
  });

  it("extracts bold verdict from markdown", () => {
    const d = parseFreeformDecreeBlock(FREEFORM_MARKDOWN);
    expect(d?.verdict).toBe("DONE");
  });

  it("extracts tsc check from markdown", () => {
    const d = parseFreeformDecreeBlock(FREEFORM_MARKDOWN);
    expect(d?.checks.some(c => c.name === "tsc" && c.result === "PASS")).toBe(true);
  });

  it("sets format to freeform", () => {
    const d = parseFreeformDecreeBlock(FREEFORM_PLAIN);
    expect(d?.format).toBe("freeform");
  });

  it("returns null when no DECREE keyword is present", () => {
    expect(parseFreeformDecreeBlock("ISSUE: #1\nVERDICT: PASS")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseDecreeBlock — fallback cascade
// ---------------------------------------------------------------------------

describe("parseDecreeBlock — fallback cascade", () => {
  it("returns canonical format for canonical input", () => {
    const d = parseDecreeBlock(FULL_FIREMAN_DECREE);
    expect(d?.format).toBe("canonical");
  });

  it("falls back to box-drawing for Format 2 input", () => {
    const d = parseDecreeBlock(BOX_DRAWING_LOKI);
    expect(d).not.toBeNull();
    expect(d?.format).toBe("box-drawing");
    expect(d?.verdict).toBe("FAIL");
  });

  it("falls back to freeform for Format 3 input", () => {
    const d = parseDecreeBlock(FREEFORM_PLAIN);
    expect(d).not.toBeNull();
    expect(d?.format).toBe("freeform");
  });

  it("falls back to freeform for Format 4 markdown input", () => {
    const d = parseDecreeBlock(FREEFORM_MARKDOWN);
    expect(d).not.toBeNull();
    expect(d?.format).toBe("freeform");
  });

  it("canonical still works after adding format field", () => {
    const d = parseDecreeBlock(FULL_FIREMAN_DECREE);
    expect(d?.verdict).toBe("DONE");
    expect(d?.issue).toBe("1077");
    expect(d?.sealAgent).toBe("FiremanDecko");
  });
});

// ---------------------------------------------------------------------------
// Loki augmentation tests (merged from decree-parser.loki.test.ts — issue #1077)
// ---------------------------------------------------------------------------

// ── SEAL line — partial parts ────────────────────────────────────────────────

describe("parseDecreeBlock — SEAL partial parts", () => {
  it("handles SEAL with 2 parts only (no title) — sealTitle is null", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: DONE
SEAL: FiremanDecko · ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d).not.toBeNull();
    expect(d?.sealAgent).toBe("FiremanDecko");
    expect(d?.sealRunes).toBe("ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ");
    expect(d?.sealTitle).toBeNull();
  });

  it("handles SEAL with 1 part only (just agent name) — runes and title are null", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: PASS
SEAL: Loki
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d).not.toBeNull();
    expect(d?.sealAgent).toBe("Loki");
    expect(d?.sealRunes).toBeNull();
    expect(d?.sealTitle).toBeNull();
  });

  it("handles SEAL with 4 parts — title is only 3rd part, 4th ignored", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: DONE
SEAL: Freya · ᚠᚱᛖᚤᚨ · Product Owner · Extra
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d?.sealAgent).toBe("Freya");
    expect(d?.sealRunes).toBe("ᚠᚱᛖᚤᚨ");
    expect(d?.sealTitle).toBe("Product Owner");
  });
});

// ── ISSUE number format variants ─────────────────────────────────────────────

describe("parseDecreeBlock — ISSUE field format variants", () => {
  it("parses issue number without # prefix", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: 1077
VERDICT: DONE
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d?.issue).toBe("1077");
  });

  it("parses large issue numbers correctly", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #99999
VERDICT: DONE
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d?.issue).toBe("99999");
  });

  it("returns null issue when ISSUE line is missing but verdict is present", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
VERDICT: DONE
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d).not.toBeNull(); // verdict satisfies minimum valid
    expect(d?.issue).toBeNull();
  });
});

// ── CHECKS — bare entries (no colon) ─────────────────────────────────────────

describe("parseDecreeBlock — CHECKS bare entries", () => {
  it("handles a bare check entry with no colon — result is empty string", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: DONE
CHECKS:
- manually verified
SEAL: Loki · ᛚᛟᚲᛁ · QA Tester
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d?.checks).toHaveLength(1);
    expect(d?.checks[0]).toEqual({ name: "manually verified", result: "" });
  });

  it("handles empty CHECKS section (no bullet entries) — returns empty array", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: DONE
CHECKS:
SEAL: Loki · ᛚᛟᚲᛁ · QA Tester
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d?.checks).toEqual([]);
  });
});

// ── Additional verdict labels (full agent set) ────────────────────────────────

describe("parseDecreeBlock — all agent verdict labels", () => {
  const makeDecree = (verdict: string) => `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: ${verdict}
᛭᛭᛭ END DECREE ᛭᛭᛭`;

  it("accepts APPROVED (Freya verdict)", () => {
    const d = parseDecreeBlock(makeDecree("APPROVED"));
    expect(d?.verdict).toBe("APPROVED");
  });

  it("accepts PUBLISHED (Freya alternate verdict)", () => {
    const d = parseDecreeBlock(makeDecree("PUBLISHED"));
    expect(d?.verdict).toBe("PUBLISHED");
  });

  it("accepts PASS (Loki verdict)", () => {
    const d = parseDecreeBlock(makeDecree("PASS"));
    expect(d?.verdict).toBe("PASS");
  });

  it("accepts SKETCHED (Luna verdict)", () => {
    const d = parseDecreeBlock(makeDecree("SKETCHED"));
    expect(d?.verdict).toBe("SKETCHED");
  });
});

// ── VERDICT whitespace handling ───────────────────────────────────────────────

describe("parseDecreeBlock — VERDICT whitespace", () => {
  it("trims trailing whitespace from verdict", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: DONE
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d?.verdict).toBe("DONE");
  });

  it("trims leading whitespace from signoff", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: DONE
SIGNOFF:   Tested by chaos, proven by order
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d?.signoff).toBe("Tested by chaos, proven by order");
  });
});

// ── SUMMARY — asterisk bullets (alternative to dash) ─────────────────────────

describe("parseDecreeBlock — SUMMARY with asterisk bullets", () => {
  it("parses summary with * bullets (not just -)", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1077
VERDICT: DONE
SUMMARY:
* First bullet point
* Second bullet point
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d?.summary).toHaveLength(2);
    expect(d?.summary[0]).toBe("First bullet point");
    expect(d?.summary[1]).toBe("Second bullet point");
  });
});

// ── Return shape — all fields present on minimal valid decree ─────────────────

describe("parseDecreeBlock — return shape completeness", () => {
  it("returns an object with all expected keys on a minimal valid decree", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1
VERDICT: DONE
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d).not.toBeNull();
    const keys = ["issue", "verdict", "pr", "summary", "checks", "sealAgent", "sealRunes", "sealTitle", "signoff"];
    for (const key of keys) {
      expect(d).toHaveProperty(key);
    }
  });

  it("minimal decree has correct null/empty defaults for missing fields", () => {
    const text = `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #1
VERDICT: DONE
᛭᛭᛭ END DECREE ᛭᛭᛭`;
    const d = parseDecreeBlock(text);
    expect(d?.pr).toBeNull();
    expect(d?.summary).toEqual([]);
    expect(d?.checks).toEqual([]);
    expect(d?.sealAgent).toBeNull();
    expect(d?.sealRunes).toBeNull();
    expect(d?.sealTitle).toBeNull();
    expect(d?.signoff).toBeNull();
  });
});
