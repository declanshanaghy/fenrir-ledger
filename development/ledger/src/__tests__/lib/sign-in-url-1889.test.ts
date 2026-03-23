/**
 * sign-in-url — SEV-001 open-redirect regression tests (issue #1889).
 *
 * Verifies that URL-encoded slash/backslash bypass vectors are rejected
 * by validateReturnTo. Browsers decode percent-encoded characters before
 * navigating, so /%2fevil.com navigates to //evil.com (open redirect).
 *
 * These tests extend the baseline coverage in sign-in-url-1748.test.ts.
 */

import { describe, it, expect } from "vitest";
import { validateReturnTo } from "@/lib/auth/sign-in-url";

describe("validateReturnTo SEV-001 — encoded bypass vectors #1889", () => {
  // ── single-encoded slash ────────────────────────────────────────────────────

  it("rejects URL-encoded slash bypass (/%2fevil.com)", () => {
    expect(validateReturnTo("/%2fevil.com")).toBe("/ledger");
  });

  it("rejects URL-encoded slash bypass — uppercase (%2F)", () => {
    expect(validateReturnTo("/%2Fevil.com")).toBe("/ledger");
  });

  it("rejects encoded slash buried after a path segment (/ok/%2fevil.com)", () => {
    // /%2f anywhere in the path is rejected — no assumption about position.
    expect(validateReturnTo("/ok/%2fevil.com")).toBe("/ledger");
  });

  // ── single-encoded backslash ────────────────────────────────────────────────

  it("rejects URL-encoded backslash bypass (/%5cevil.com)", () => {
    expect(validateReturnTo("/%5cevil.com")).toBe("/ledger");
  });

  it("rejects URL-encoded backslash bypass — uppercase (%5C)", () => {
    expect(validateReturnTo("/%5Cevil.com")).toBe("/ledger");
  });

  // ── double-encoded slash ────────────────────────────────────────────────────

  it("rejects double-encoded slash bypass (/%252fevil.com → /%2fevil.com after decode)", () => {
    expect(validateReturnTo("/%252fevil.com")).toBe("/ledger");
  });

  it("rejects double-encoded backslash bypass (/%255cevil.com)", () => {
    expect(validateReturnTo("/%255cevil.com")).toBe("/ledger");
  });

  // ── malformed encoding ──────────────────────────────────────────────────────

  it("rejects malformed percent-encoding (/foo%gg)", () => {
    expect(validateReturnTo("/foo%gg")).toBe("/ledger");
  });

  it("rejects truncated percent sequence (/foo%)", () => {
    expect(validateReturnTo("/foo%")).toBe("/ledger");
  });

  // ── valid paths with legitimate percent-encoding still work ────────────────

  it("accepts a path with encoded space (/ledger/path%20name)", () => {
    expect(validateReturnTo("/ledger/path%20name")).toBe("/ledger/path%20name");
  });

  it("accepts a path with encoded hash (/ledger/section%23anchor)", () => {
    expect(validateReturnTo("/ledger/section%23anchor")).toBe("/ledger/section%23anchor");
  });
});
