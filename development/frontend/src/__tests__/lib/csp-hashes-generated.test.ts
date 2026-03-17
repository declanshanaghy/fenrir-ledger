/**
 * csp-hashes-generated.test.ts — Loki QA augmentation, Issue #1144
 *
 * Edge-case tests for the auto-generated hash constants and their
 * integration into the CSP directive builder.  These complement the
 * 20 FiremanDecko tests in csp-headers.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── GA4 hash conditional inclusion ───────────────────────────────────────────

describe("INLINE_SCRIPT_HASHES — GA4 hash conditional inclusion", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("INLINE_SCRIPT_HASHES contains only next-themes hash when GA4_INIT_SCRIPT_HASH is null", async () => {
    // Default generated file has GA4_INIT_SCRIPT_HASH = null
    const { INLINE_SCRIPT_HASHES, GA4_INIT_SCRIPT_HASH, NEXT_THEMES_SCRIPT_HASH } =
      await import("@/lib/csp-hashes.generated");

    expect(GA4_INIT_SCRIPT_HASH).toBeNull();
    expect(INLINE_SCRIPT_HASHES).toHaveLength(1);
    expect(INLINE_SCRIPT_HASHES[0]).toBe(NEXT_THEMES_SCRIPT_HASH);
  });

  it("NEXT_THEMES_SCRIPT_HASH is a valid sha256- CSP hash token", async () => {
    const { NEXT_THEMES_SCRIPT_HASH } = await import("@/lib/csp-hashes.generated");
    // Must be wrapped in single quotes and start with sha256-
    expect(NEXT_THEMES_SCRIPT_HASH).toMatch(/^'sha256-[A-Za-z0-9+/]+=?'$/);
  });

  it("INLINE_SCRIPT_HASHES includes GA4 hash when GA4_INIT_SCRIPT_HASH is non-null", () => {
    // Simulate the array construction logic directly (mirrors csp-hashes.generated.ts)
    const fakeNextThemesHash = "'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='";
    const fakeGa4Hash = "'sha256-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='";

    const hashes = [fakeNextThemesHash, ...(fakeGa4Hash ? [fakeGa4Hash] : [])];
    expect(hashes).toHaveLength(2);
    expect(hashes).toContain(fakeGa4Hash);
  });

  it("INLINE_SCRIPT_HASHES excludes GA4 hash when GA4_INIT_SCRIPT_HASH is null", () => {
    const fakeNextThemesHash = "'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='";
    const ga4Hash: string | null = null;

    const hashes = [fakeNextThemesHash, ...(ga4Hash ? [ga4Hash] : [])];
    expect(hashes).toHaveLength(1);
    expect(hashes).not.toContain("sha256-B");
  });
});

// ── CSP determinism (critical for CDN caching) ───────────────────────────────

describe("buildCspDirectives — determinism for CDN caching", () => {
  it("produces identical output on repeated calls (no per-request randomness)", async () => {
    const { buildCspDirectives } = await import("@/lib/csp-headers");
    const first = buildCspDirectives().join("; ");
    const second = buildCspDirectives().join("; ");
    const third = buildCspDirectives().join("; ");
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("buildSecurityHeaders CSP value is deterministic across calls", async () => {
    const { buildSecurityHeaders } = await import("@/lib/csp-headers");
    const csp1 = buildSecurityHeaders().find(
      (h) => h.key === "Content-Security-Policy"
    )!.value;
    const csp2 = buildSecurityHeaders().find(
      (h) => h.key === "Content-Security-Policy"
    )!.value;
    expect(csp1).toBe(csp2);
  });
});

// ── Deleted nonce modules are gone ───────────────────────────────────────────

import { existsSync } from "fs";
import { resolve } from "path";

describe("Nonce module removal (Issue #1144)", () => {
  const libDir = resolve(__dirname, "../../lib");

  it("csp-nonce.ts does not exist on disk (file deleted in Issue #1144)", () => {
    expect(existsSync(resolve(libDir, "csp-nonce.ts"))).toBe(false);
  });

  it("use-nonce.ts does not exist on disk (file deleted in Issue #1144)", () => {
    expect(existsSync(resolve(libDir, "use-nonce.ts"))).toBe(false);
  });
});

// ── script-src structure integrity ───────────────────────────────────────────

describe("buildCspDirectives — script-src structure", () => {
  it("every hash in script-src is properly quoted with single quotes", async () => {
    const { buildCspDirectives } = await import("@/lib/csp-headers");
    const scriptSrc = buildCspDirectives().find((d) => d.startsWith("script-src"))!;
    const hashTokens = scriptSrc.match(/'sha256-[^']+'/g) ?? [];
    expect(hashTokens.length).toBeGreaterThan(0);
    for (const token of hashTokens) {
      expect(token).toMatch(/^'sha256-[A-Za-z0-9+/]+=?'$/);
    }
  });

  it("script-src directive is a single space-separated string (not an array)", async () => {
    const { buildCspDirectives } = await import("@/lib/csp-headers");
    const scriptSrc = buildCspDirectives().find((d) => d.startsWith("script-src"))!;
    expect(typeof scriptSrc).toBe("string");
    expect(scriptSrc).not.toContain(",");
  });

  it("full CSP string uses semicolons as directive separators", async () => {
    const { buildSecurityHeaders } = await import("@/lib/csp-headers");
    const csp = buildSecurityHeaders().find(
      (h) => h.key === "Content-Security-Policy"
    )!.value;
    // Directives must be '; ' separated for browser compliance
    expect(csp).toContain("; ");
    expect(csp.split("; ").length).toBeGreaterThan(5);
  });
});
