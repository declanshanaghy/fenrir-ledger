/**
 * sign-in-url utility — unit tests for issue #1748 (Loki QA).
 *
 * validateReturnTo is security-critical (open-redirect prevention).
 * buildSignInUrl is used by AnonEmptyState to send users to sign-in
 * with the correct returnTo param.
 *
 * These tests cover pure logic — no DOM, no mocks needed.
 */

import { describe, it, expect } from "vitest";
import {
  validateReturnTo,
  buildSignInUrl,
} from "@/lib/auth/sign-in-url";

// ── validateReturnTo ─────────────────────────────────────────────────────────

describe("validateReturnTo #1748", () => {
  it("accepts a valid relative path", () => {
    expect(validateReturnTo("/ledger")).toBe("/ledger");
  });

  it("accepts a nested relative path", () => {
    expect(validateReturnTo("/ledger/cards/new")).toBe("/ledger/cards/new");
  });

  it("returns default for null input", () => {
    expect(validateReturnTo(null)).toBe("/ledger");
  });

  it("returns default for undefined input", () => {
    expect(validateReturnTo(undefined)).toBe("/ledger");
  });

  it("returns default for empty string", () => {
    expect(validateReturnTo("")).toBe("/ledger");
  });

  it("rejects absolute URL (http://)", () => {
    expect(validateReturnTo("http://evil.com")).toBe("/ledger");
  });

  it("rejects absolute URL (https://)", () => {
    expect(validateReturnTo("https://evil.com/steal")).toBe("/ledger");
  });

  it("rejects protocol-relative URL (//evil.com)", () => {
    expect(validateReturnTo("//evil.com")).toBe("/ledger");
  });

  it("rejects path with backslash (open redirect via \\\\evil.com)", () => {
    expect(validateReturnTo("/\\evil.com")).toBe("/ledger");
  });

  it("rejects path with encoded newline (%0a)", () => {
    expect(validateReturnTo("/ledger%0aevil")).toBe("/ledger");
  });

  it("rejects path with encoded carriage return (%0d)", () => {
    expect(validateReturnTo("/ledger%0dinjected")).toBe("/ledger");
  });

  it("rejects the sign-in page itself (loop prevention)", () => {
    expect(validateReturnTo("/ledger/sign-in")).toBe("/ledger");
  });

  it("rejects the sign-in page with query params (loop prevention)", () => {
    expect(validateReturnTo("/ledger/sign-in?returnTo=/ledger")).toBe("/ledger");
  });

  it("accepts paths with query strings", () => {
    expect(validateReturnTo("/ledger?tab=hunt")).toBe("/ledger?tab=hunt");
  });
});

// ── buildSignInUrl ───────────────────────────────────────────────────────────

describe("buildSignInUrl #1748", () => {
  it("returns /ledger/sign-in when no path provided", () => {
    expect(buildSignInUrl(undefined)).toBe("/ledger/sign-in");
  });

  it("returns /ledger/sign-in without returnTo when path is /ledger (default destination)", () => {
    // Returning to /ledger is already the default, so no query param needed.
    expect(buildSignInUrl("/ledger")).toBe("/ledger/sign-in");
  });

  it("includes encoded returnTo for non-default paths", () => {
    const url = buildSignInUrl("/ledger/cards/new");
    expect(url).toBe("/ledger/sign-in?returnTo=%2Fledger%2Fcards%2Fnew");
  });

  it("includes encoded returnTo for tab-parameterised paths", () => {
    const url = buildSignInUrl("/ledger?tab=hunt");
    expect(url).toContain("/ledger/sign-in?returnTo=");
    expect(url).toContain(encodeURIComponent("/ledger?tab=hunt"));
  });

  it("returns /ledger/sign-in for sign-in path (loop prevention)", () => {
    expect(buildSignInUrl("/ledger/sign-in")).toBe("/ledger/sign-in");
  });

  it("returns /ledger/sign-in for open-redirect attempt", () => {
    // buildSignInUrl delegates validation to validateReturnTo
    expect(buildSignInUrl("//evil.com")).toBe("/ledger/sign-in");
  });

  it("AnonEmptyState CTA target — /ledger path produces base sign-in URL", () => {
    // AnonEmptyState renders at /ledger. Clicking sign-in from /ledger should
    // go to /ledger/sign-in (no returnTo, as it matches the default).
    const url = buildSignInUrl("/ledger");
    expect(url).toBe("/ledger/sign-in");
  });
});
