/**
 * Vitest tests for issue #1003 — Norse tablet rune signatures & Wikipedia links
 *
 * AC tested:
 * - AGENT_RUNE_NAMES covers all 5 known agents + _fallback
 * - AGENT_RUNE_TITLES covers all 5 known agents
 * - AGENT_QUOTES covers all 5 known agents + _fallback
 * - ERROR_TABLET_SEALS covers both variants with correct shape
 * - WIKI_LINKS contains correct URLs for Yggdrasil and Bifröst
 * - Fallback key used when agentKey is undefined or unknown
 */

import { describe, it, expect } from "vitest";
import {
  AGENT_RUNE_NAMES,
  AGENT_RUNE_TITLES,
  AGENT_QUOTES,
  ERROR_TABLET_SEALS,
  WIKI_LINKS,
  AGENT_NAMES,
  AGENT_TITLES,
} from "../lib/constants";

const KNOWN_AGENTS = ["firemandecko", "loki", "luna", "freya", "heimdall"];

describe("AGENT_RUNE_NAMES", () => {
  it("contains rune entry for all 5 known agents", () => {
    for (const key of KNOWN_AGENTS) {
      expect(AGENT_RUNE_NAMES[key], `missing rune name for ${key}`).toBeTruthy();
    }
  });

  it("contains _fallback entry (ASGARD)", () => {
    expect(AGENT_RUNE_NAMES["_fallback"]).toBe("ᚨᛊᚷᚨᚱᛞ");
  });

  it("firemandecko rune name is Elder Futhark transliteration", () => {
    expect(AGENT_RUNE_NAMES["firemandecko"]).toBe("ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ");
  });

  it("loki rune name is correct", () => {
    expect(AGENT_RUNE_NAMES["loki"]).toBe("ᛚᛟᚲᛁ");
  });
});

describe("AGENT_RUNE_TITLES", () => {
  it("contains rune title for all 5 known agents", () => {
    for (const key of KNOWN_AGENTS) {
      expect(AGENT_RUNE_TITLES[key], `missing rune title for ${key}`).toBeTruthy();
    }
  });

  it("does not have a _fallback entry (fallback has no title)", () => {
    // The fallback renders without a title rune row per wireframe §4
    expect(AGENT_RUNE_TITLES["_fallback"]).toBeUndefined();
  });
});

describe("AGENT_QUOTES", () => {
  it("contains quote for all 5 known agents", () => {
    for (const key of KNOWN_AGENTS) {
      expect(AGENT_QUOTES[key], `missing quote for ${key}`).toBeTruthy();
    }
  });

  it("contains _fallback quote (Asgard decree)", () => {
    expect(AGENT_QUOTES["_fallback"]).toContain("Asgard");
  });

  it("firemandecko quote mentions fire and iron", () => {
    expect(AGENT_QUOTES["firemandecko"]).toMatch(/fire and iron/i);
  });

  it("heimdall quote mentions Bifröst", () => {
    expect(AGENT_QUOTES["heimdall"]).toContain("Bifröst");
  });
});

describe("ERROR_TABLET_SEALS", () => {
  it("contains ttl-expired seal", () => {
    const seal = ERROR_TABLET_SEALS["ttl-expired"]!;
    expect(seal).toBeDefined();
    expect(seal.runes).toBeTruthy();
    expect(seal.inscription).toBeTruthy();
    expect(seal.sub).toBeTruthy();
  });

  it("contains node-unreachable seal", () => {
    const seal = ERROR_TABLET_SEALS["node-unreachable"]!;
    expect(seal).toBeDefined();
    expect(seal.runes).toBeTruthy();
    expect(seal.inscription).toBeTruthy();
    expect(seal.sub).toBeTruthy();
  });

  it("ttl-expired inscription mentions Yggdrasil", () => {
    expect(ERROR_TABLET_SEALS["ttl-expired"]!.inscription).toContain("Yggdrasil");
  });

  it("node-unreachable inscription mentions bridge", () => {
    expect(ERROR_TABLET_SEALS["node-unreachable"]!.inscription).toMatch(/bridge/i);
  });

  it("ttl-expired rune row is ᛃᚷᚷᛞᚱᚨᛊᛁᛚ", () => {
    expect(ERROR_TABLET_SEALS["ttl-expired"]!.runes).toBe("ᛃᚷᚷᛞᚱᚨᛊᛁᛚ");
  });

  it("node-unreachable rune row is ᛒᛁᚠᚱᛟᛊᛏ", () => {
    expect(ERROR_TABLET_SEALS["node-unreachable"]!.runes).toBe("ᛒᛁᚠᚱᛟᛊᛏ");
  });
});

describe("WIKI_LINKS", () => {
  it("contains Yggdrasil Wikipedia URL", () => {
    expect(WIKI_LINKS["Yggdrasil"]).toBe("https://en.wikipedia.org/wiki/Yggdrasil");
  });

  it("contains Bifröst Wikipedia URL (percent-encoded ö)", () => {
    expect(WIKI_LINKS["Bifröst"]).toBe("https://en.wikipedia.org/wiki/Bifr%C3%B6st");
  });
});

describe("RuneSignatureBlock fallback logic", () => {
  // Test the same logic used in RuneSignatureBlock to pick key
  function pickKey(agentKey?: string): string {
    return agentKey && AGENT_RUNE_NAMES[agentKey] ? agentKey : "_fallback";
  }

  it("returns known agentKey when it exists in AGENT_RUNE_NAMES", () => {
    expect(pickKey("loki")).toBe("loki");
    expect(pickKey("luna")).toBe("luna");
    expect(pickKey("firemandecko")).toBe("firemandecko");
  });

  it("falls back to _fallback when agentKey is undefined", () => {
    expect(pickKey(undefined)).toBe("_fallback");
  });

  it("falls back to _fallback when agentKey is an unrecognised string", () => {
    expect(pickKey("unknown-agent-xyz")).toBe("_fallback");
    expect(pickKey("")).toBe("_fallback");
  });

  it("fallback key resolves to ASGARD name and generic quote", () => {
    const key = pickKey(undefined);
    expect(AGENT_RUNE_NAMES[key]).toBe("ᚨᛊᚷᚨᚱᛞ");
    expect(AGENT_QUOTES[key]).toContain("Asgard");
    // Human-readable name fallback (AGENT_NAMES["_fallback"] is undefined, component uses default)
    expect(AGENT_NAMES[key]).toBeUndefined();
  });

  it("all known agents resolve names and titles from AGENT_NAMES/AGENT_TITLES", () => {
    for (const key of KNOWN_AGENTS) {
      expect(AGENT_NAMES[key], `AGENT_NAMES missing ${key}`).toBeTruthy();
      expect(AGENT_TITLES[key], `AGENT_TITLES missing ${key}`).toBeTruthy();
    }
  });
});
