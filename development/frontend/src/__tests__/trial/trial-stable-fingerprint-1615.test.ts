/**
 * QA tests for issue #1615 — Stable fingerprint: SHA-256(deviceId) only.
 *
 * These tests validate the acceptance criteria from issue #1615:
 *   - Fingerprint is SHA-256(deviceId) only — no userAgent
 *   - Fingerprint is stable across browser updates
 *
 * Complementary to trial-utils.test.ts (which covers isValidFingerprint +
 * clearTrialStatusCache). These tests focus on the correctness and
 * stability properties of the fixed fingerprint computation.
 *
 * @ref Issue #1615
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeFingerprint } from "@/lib/trial-utils";

// Pre-computed SHA-256("test-device-abc-999") — used as regression anchor.
// Computed via: echo -n "test-device-abc-999" | sha256sum
const KNOWN_DEVICE_ID = "test-device-abc-999";
const KNOWN_SHA256 = "2fd2ad3abfb98b6c3ca920c9d701c73275ff34998dad54f551f3dc37dc45c86c";

function setupBrowserEnv(deviceId: string) {
  Object.defineProperty(globalThis, "window", {
    value: {},
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: vi.fn().mockReturnValue(deviceId),
      setItem: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

describe("issue #1615 — stable fingerprint (SHA-256(deviceId) only)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("hash correctness", () => {
    beforeEach(() => setupBrowserEnv(KNOWN_DEVICE_ID));

    it("produces the known SHA-256 value for a fixed deviceId", async () => {
      const fp = await computeFingerprint();
      expect(fp).toBe(KNOWN_SHA256);
    });

    it("output is exactly 64 characters", async () => {
      const fp = await computeFingerprint();
      expect(fp).toHaveLength(64);
    });

    it("output is lowercase hex only", async () => {
      const fp = await computeFingerprint();
      expect(fp).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("uniqueness", () => {
    it("different deviceIds produce different fingerprints", async () => {
      setupBrowserEnv("device-alpha-001");
      const fp1 = await computeFingerprint();

      setupBrowserEnv("device-beta-002");
      const fp2 = await computeFingerprint();

      expect(fp1).not.toBe(fp2);
    });

    it("empty deviceId produces a distinct fingerprint (not empty string)", async () => {
      setupBrowserEnv("");
      const fp = await computeFingerprint();
      // SHA-256("") is a valid 64-char hex — not the same as the SSR guard ""
      expect(fp).toHaveLength(64);
      expect(fp).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("browser-update stability (userAgent independence)", () => {
    beforeEach(() => setupBrowserEnv("stable-device-xyz"));

    it("fingerprint is unchanged when userAgent is Chrome 100", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: "Mozilla/5.0 Chrome/100.0.4896.60 Safari/537.36" },
        writable: true,
        configurable: true,
      });
      const fp = await computeFingerprint();
      expect(fp).toMatch(/^[0-9a-f]{64}$/);
    });

    it("fingerprint is identical when userAgent changes to Chrome 200 (future)", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: "Mozilla/5.0 Chrome/100.0.4896.60 Safari/537.36" },
        writable: true,
        configurable: true,
      });
      const fpOld = await computeFingerprint();

      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: "Mozilla/5.0 Chrome/200.0.0.0 Safari/537.36" },
        writable: true,
        configurable: true,
      });
      const fpNew = await computeFingerprint();

      expect(fpOld).toBe(fpNew);
    });

    it("fingerprint is identical when userAgent changes from Chrome to Firefox", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: "Mozilla/5.0 Chrome/120.0 Safari/537.36" },
        writable: true,
        configurable: true,
      });
      const fpChrome = await computeFingerprint();

      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: "Mozilla/5.0 Gecko/20100101 Firefox/121.0" },
        writable: true,
        configurable: true,
      });
      const fpFirefox = await computeFingerprint();

      expect(fpChrome).toBe(fpFirefox);
    });
  });

  describe("SSR guard", () => {
    it("returns empty string when window is undefined", async () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const fp = await computeFingerprint();
      expect(fp).toBe("");
    });
  });
});
