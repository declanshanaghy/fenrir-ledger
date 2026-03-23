/**
 * Unit tests for admin auth — isAdmin()
 *
 * Tests the ADMIN_EMAILS whitelist check.
 *
 * @see src/lib/admin/auth.ts
 * @ref #654
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock logger before importing
vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn() },
}));

import { isAdmin } from "@/lib/admin/auth";

describe("isAdmin", () => {
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN_EMAILS not set
  // ═══════════════════════════════════════════════════════════════════════

  it("returns false when ADMIN_EMAILS is not set", () => {
    expect(isAdmin("odin@fenrir.dev")).toBe(false);
  });

  it("returns false when ADMIN_EMAILS is empty string", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAdmin("odin@fenrir.dev")).toBe(false);
  });

  it("returns false when ADMIN_EMAILS is whitespace only", () => {
    process.env.ADMIN_EMAILS = "   ";
    expect(isAdmin("odin@fenrir.dev")).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Valid admin
  // ═══════════════════════════════════════════════════════════════════════

  it("returns true for email in whitelist", () => {
    process.env.ADMIN_EMAILS = "odin@fenrir.dev,freya@fenrir.dev";
    expect(isAdmin("odin@fenrir.dev")).toBe(true);
  });

  it("is case-insensitive", () => {
    process.env.ADMIN_EMAILS = "Odin@Fenrir.Dev";
    expect(isAdmin("odin@fenrir.dev")).toBe(true);
  });

  it("handles whitespace around emails", () => {
    process.env.ADMIN_EMAILS = " odin@fenrir.dev , freya@fenrir.dev ";
    expect(isAdmin("odin@fenrir.dev")).toBe(true);
    expect(isAdmin("freya@fenrir.dev")).toBe(true);
  });

  it("works with single email in whitelist", () => {
    process.env.ADMIN_EMAILS = "odin@fenrir.dev";
    expect(isAdmin("odin@fenrir.dev")).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Non-admin
  // ═══════════════════════════════════════════════════════════════════════

  it("returns false for email not in whitelist", () => {
    process.env.ADMIN_EMAILS = "odin@fenrir.dev,freya@fenrir.dev";
    expect(isAdmin("loki@fenrir.dev")).toBe(false);
  });

  it("returns false for partial match", () => {
    process.env.ADMIN_EMAILS = "odin@fenrir.dev";
    expect(isAdmin("odin@fenrir")).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════════

  it("handles trailing comma in ADMIN_EMAILS", () => {
    process.env.ADMIN_EMAILS = "odin@fenrir.dev,";
    expect(isAdmin("odin@fenrir.dev")).toBe(true);
  });

  it("handles empty entries between commas", () => {
    process.env.ADMIN_EMAILS = "odin@fenrir.dev,,freya@fenrir.dev";
    expect(isAdmin("odin@fenrir.dev")).toBe(true);
    expect(isAdmin("freya@fenrir.dev")).toBe(true);
  });
});
