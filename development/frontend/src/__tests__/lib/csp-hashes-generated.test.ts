/**
 * csp-hashes-generated.test.ts — Issue #1144
 *
 * CSP determinism tests — critical for CDN caching.
 * The policy uses 'unsafe-inline' for scripts (nonce-based CSP is
 * incompatible with PPR + CDN caching).
 */

import { describe, it, expect } from "vitest";
import { buildCspDirectives } from "@/lib/csp-headers";

// ── CSP determinism (critical for CDN caching) ───────────────────────────────

describe("buildCspDirectives — determinism for CDN caching", () => {
  it("produces identical output on repeated calls (no per-request randomness)", () => {
    const first = buildCspDirectives().join("; ");
    const second = buildCspDirectives().join("; ");
    const third = buildCspDirectives().join("; ");
    expect(first).toBe(second);
    expect(second).toBe(third);
  });
});

// ── script-src structure integrity ───────────────────────────────────────────

describe("buildCspDirectives — script-src structure", () => {
  it("script-src directive is a single space-separated string (not an array)", () => {
    const scriptSrc = buildCspDirectives().find((d) => d.startsWith("script-src"))!;
    expect(typeof scriptSrc).toBe("string");
    expect(scriptSrc).not.toContain(",");
  });

  it("full CSP string uses semicolons as directive separators", () => {
    const csp = buildCspDirectives().join("; ");
    expect(csp).toContain("; ");
    expect(csp.split("; ").length).toBeGreaterThan(5);
  });

  it("script-src contains 'unsafe-inline' for PPR + CDN compatibility", () => {
    const scriptSrc = buildCspDirectives().find((d) => d.startsWith("script-src"))!;
    expect(scriptSrc).toContain("'unsafe-inline'");
  });
});
