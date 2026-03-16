/**
 * decree-parser.loki.test.ts — Loki QA augmentation tests for parseDecreeBlock()
 *
 * These tests cover gaps in FiremanDecko's existing suite (decree-parser.test.ts).
 * Focus: SEAL partial parts, bare check entries, issue-number formats,
 * additional verdict labels, empty sections, and whitespace handling.
 *
 * Issue: #1077 — Structured Decree Complete block
 */

import { describe, it, expect } from "vitest";
import { parseDecreeBlock } from "@/lib/decree-parser";

// ---------------------------------------------------------------------------
// SEAL line — partial parts
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ISSUE number format variants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// CHECKS — bare entries (no colon)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Additional verdict labels (full agent set)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// VERDICT whitespace handling
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SUMMARY — asterisk bullets (alternative to dash)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Return shape — all fields present on minimal valid decree
// ---------------------------------------------------------------------------

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
