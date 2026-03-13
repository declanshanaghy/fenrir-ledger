/**
 * Unit tests for pack-status data layer — detectType, detectPriority
 *
 * Tests the pure helper functions from the pack-status TypeScript module.
 * The main getPackStatus() function requires GitHub API access and is
 * tested via the API route integration test.
 *
 * @see src/lib/admin/pack-status.ts
 * @ref #654
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn() },
}));

import { detectType, detectPriority } from "@/lib/admin/pack-status";

describe("detectType", () => {
  it("returns 'bug' when labels include 'bug'", () => {
    expect(detectType(["bug", "high"])).toBe("bug");
  });

  it("returns 'security' when labels include 'security'", () => {
    expect(detectType(["security", "critical"])).toBe("security");
  });

  it("returns 'ux' when labels include 'ux'", () => {
    expect(detectType(["ux", "enhancement"])).toBe("ux");
  });

  it("returns 'enhancement' when labels include 'enhancement'", () => {
    expect(detectType(["enhancement", "normal"])).toBe("enhancement");
  });

  it("returns 'research' when labels include 'research'", () => {
    expect(detectType(["research"])).toBe("research");
  });

  it("returns 'unknown' for no recognized labels", () => {
    expect(detectType(["documentation"])).toBe("unknown");
  });

  it("returns 'unknown' for empty labels", () => {
    expect(detectType([])).toBe("unknown");
  });

  it("prioritizes bug over enhancement", () => {
    expect(detectType(["bug", "enhancement"])).toBe("bug");
  });
});

describe("detectPriority", () => {
  it("returns 'critical' when labels include 'critical'", () => {
    expect(detectPriority(["critical", "bug"])).toBe("critical");
  });

  it("returns 'high' when labels include 'high'", () => {
    expect(detectPriority(["high", "enhancement"])).toBe("high");
  });

  it("returns 'low' when labels include 'low'", () => {
    expect(detectPriority(["low"])).toBe("low");
  });

  it("returns 'normal' when no priority label", () => {
    expect(detectPriority(["bug"])).toBe("normal");
  });

  it("returns 'normal' for empty labels", () => {
    expect(detectPriority([])).toBe("normal");
  });

  it("prioritizes critical over high", () => {
    expect(detectPriority(["critical", "high"])).toBe("critical");
  });
});
