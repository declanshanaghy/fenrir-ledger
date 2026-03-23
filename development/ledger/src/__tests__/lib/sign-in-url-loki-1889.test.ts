/**
 * sign-in-url — Loki supplemental SEV-001 tests (issue #1889).
 *
 * Augments the 11 regression tests in sign-in-url-1889.test.ts and the
 * 21 baseline tests in sign-in-url-1748.test.ts with edge cases that
 * weren't covered: buildSignInUrl pipeline, mixed-case double-encoding,
 * non-http schemes, and whitespace handling.
 */

import { describe, it, expect } from "vitest";
import { validateReturnTo, buildSignInUrl } from "@/lib/auth/sign-in-url";

// ── buildSignInUrl SEV-001 pipeline ──────────────────────────────────────────

describe("buildSignInUrl SEV-001 — encoded bypass vectors are rejected end-to-end #1889", () => {
  it("returns /ledger/sign-in for /%2fevil.com input (no returnTo leaked)", () => {
    expect(buildSignInUrl("/%2fevil.com")).toBe("/ledger/sign-in");
  });

  it("returns /ledger/sign-in for /%5cevil.com input", () => {
    expect(buildSignInUrl("/%5cevil.com")).toBe("/ledger/sign-in");
  });

  it("returns /ledger/sign-in for double-encoded /%252fevil.com input", () => {
    expect(buildSignInUrl("/%252fevil.com")).toBe("/ledger/sign-in");
  });

  it("returns /ledger/sign-in for malformed percent encoding (/foo%gg)", () => {
    expect(buildSignInUrl("/foo%gg")).toBe("/ledger/sign-in");
  });
});

// ── non-http URI schemes ─────────────────────────────────────────────────────

describe("validateReturnTo — non-relative URI schemes are rejected #1889", () => {
  it("rejects javascript: URI", () => {
    expect(validateReturnTo("javascript:alert(1)")).toBe("/ledger");
  });

  it("rejects data: URI", () => {
    expect(validateReturnTo("data:text/html,<h1>evil</h1>")).toBe("/ledger");
  });

  it("rejects ftp: URI", () => {
    expect(validateReturnTo("ftp://evil.com/steal")).toBe("/ledger");
  });

  it("rejects vbscript: URI", () => {
    expect(validateReturnTo("vbscript:msgbox(1)")).toBe("/ledger");
  });
});

// ── whitespace handling ──────────────────────────────────────────────────────

describe("validateReturnTo — whitespace-padded inputs #1889", () => {
  it("accepts a path with surrounding whitespace (trims to valid path)", () => {
    expect(validateReturnTo("  /ledger/cards  ")).toBe("/ledger/cards");
  });

  it("rejects whitespace-padded protocol-relative URL (  //evil.com)", () => {
    expect(validateReturnTo("  //evil.com")).toBe("/ledger");
  });

  it("rejects whitespace-padded absolute URL (  https://evil.com)", () => {
    expect(validateReturnTo("  https://evil.com")).toBe("/ledger");
  });
});

// ── mixed-case double-encoded variants ───────────────────────────────────────

describe("validateReturnTo — mixed-case double-encoded bypass vectors #1889", () => {
  it("rejects /%252Fevil.com (double-encoded slash — uppercase F after re-encode)", () => {
    // /%252Fevil.com → decodes to /%2Fevil.com → caught by case-insensitive %2f check
    expect(validateReturnTo("/%252Fevil.com")).toBe("/ledger");
  });

  it("rejects /%255Cevil.com (double-encoded backslash — uppercase C)", () => {
    expect(validateReturnTo("/%255Cevil.com")).toBe("/ledger");
  });

  it("rejects /ok%2Fevil.com (encoded slash not preceded by another slash)", () => {
    // %2F in any position expands to / which can create protocol-relative URL on navigation
    expect(validateReturnTo("/ok%2Fevil.com")).toBe("/ledger");
  });
});

// ── %2f in query string ──────────────────────────────────────────────────────

describe("validateReturnTo — %2f in query string position #1889", () => {
  it("rejects path where %2f appears in query string value (conservative validation)", () => {
    // Current implementation rejects %2f anywhere in the string — even in query values.
    // This is intentional conservative behavior to prevent bypass via query injection.
    expect(validateReturnTo("/ledger?next=%2fevil.com")).toBe("/ledger");
  });

  it("accepts path with encoded space in query string (/ledger?q=hello%20world)", () => {
    // %20 (space) is not a redirect-enabling character — should be accepted.
    expect(validateReturnTo("/ledger?q=hello%20world")).toBe("/ledger?q=hello%20world");
  });
});
