/**
 * isValidRedirectTarget + secureFetch — unit tests (issue #1891 / MEDIUM-002)
 *
 * Covers redirect-validation whitelist logic and secureFetch redirect handling
 * which were not tested by the FiremanDecko implementation tests.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { isValidRedirectTarget, secureFetch } from "@/lib/sheets/url-validation";

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── isValidRedirectTarget ─────────────────────────────────────────────────────

describe("isValidRedirectTarget — allowed domains", () => {
  it("allows docs.google.com", () => {
    expect(isValidRedirectTarget("https://docs.google.com/spreadsheets/d/abc")).toBe(true);
  });

  it("allows sheets.google.com", () => {
    expect(isValidRedirectTarget("https://sheets.google.com/")).toBe(true);
  });

  it("allows googleusercontent.com subdomain (CDN export)", () => {
    expect(isValidRedirectTarget("https://doc-export.googleusercontent.com/doc-export/export?id=abc")).toBe(true);
  });

  it("allows accounts.google.com", () => {
    expect(isValidRedirectTarget("https://accounts.google.com/o/oauth2/auth")).toBe(true);
  });

  it("allows ssl.gstatic.com", () => {
    expect(isValidRedirectTarget("https://ssl.gstatic.com/static.css")).toBe(true);
  });

  it("allows deep subdomain of docs.google.com", () => {
    expect(isValidRedirectTarget("https://sub.docs.google.com/")).toBe(true);
  });
});

describe("isValidRedirectTarget — rejected cases", () => {
  it("rejects http:// even for allowed domain", () => {
    expect(isValidRedirectTarget("http://docs.google.com/spreadsheets/d/abc")).toBe(false);
  });

  it("rejects an arbitrary public domain not in the whitelist", () => {
    expect(isValidRedirectTarget("https://example.com/data.csv")).toBe(false);
  });

  it("rejects a malicious domain that looks similar (google.com.evil.com)", () => {
    expect(isValidRedirectTarget("https://google.com.evil.com/redirect")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidRedirectTarget("")).toBe(false);
  });

  it("rejects an unparseable URL", () => {
    expect(isValidRedirectTarget("not-a-url")).toBe(false);
  });

  it("rejects private IP even if scheme is HTTPS", () => {
    expect(isValidRedirectTarget("https://169.254.169.254/computeMetadata/v1/")).toBe(false);
  });
});

// ── secureFetch — redirect validation ────────────────────────────────────────

describe("secureFetch — redirect validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns response directly for non-redirect status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("csv-data", { status: 200 }))
    );

    const result = await secureFetch("https://docs.google.com/spreadsheets/d/abc");
    expect(result.status).toBe(200);
  });

  it("follows a valid redirect to a whitelisted domain", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { location: "https://doc-export.googleusercontent.com/export?id=abc" },
          })
        )
        .mockResolvedValueOnce(new Response("csv-data", { status: 200 }))
    );

    const result = await secureFetch("https://docs.google.com/spreadsheets/d/abc/export?format=csv");
    expect(result.status).toBe(200);
  });

  it("throws when redirect Location header is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response(null, { status: 302 }))
    );

    await expect(
      secureFetch("https://docs.google.com/spreadsheets/d/abc")
    ).rejects.toThrow(/missing Location header/i);
  });

  it("throws when redirect points to a non-whitelisted domain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.com/steal-tokens" },
        })
      )
    );

    await expect(
      secureFetch("https://docs.google.com/spreadsheets/d/abc")
    ).rejects.toThrow(/Invalid redirect target/i);
  });

  it("throws when max redirects exceeded", async () => {
    // Both responses are redirects — exceeds default maxRedirects=1
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: "https://doc-export.googleusercontent.com/redirect-again" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(redirectResponse)
    );

    await expect(
      secureFetch("https://docs.google.com/spreadsheets/d/abc")
    ).rejects.toThrow(/Too many redirects/i);
  });
});
