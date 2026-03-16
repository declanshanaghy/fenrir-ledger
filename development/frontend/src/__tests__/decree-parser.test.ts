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
