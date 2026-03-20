/**
 * Tests for fingerprint stability and correctness.
 *
 * Validates issue #1615 (userAgent independence) and the issue #1624
 * simplification: fingerprint is now the raw deviceId (UUID v4), not SHA-256.
 *
 * Key properties:
 *   - computeFingerprint() returns the raw deviceId directly (no hash)
 *   - Fingerprint is stable across browser updates (no userAgent involvement)
 *   - Fingerprint is synchronous
 *
 * @ref Issue #1615, #1624
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeFingerprint } from "@/lib/trial-utils";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const KNOWN_DEVICE_ID = "c7f1a823-45de-4b9c-a1f2-9e0d3c8b2a71";

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

describe("issue #1624 — fingerprint = raw deviceId (no SHA-256)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fingerprint identity", () => {
    beforeEach(() => setupBrowserEnv(KNOWN_DEVICE_ID));

    it("returns the exact deviceId (no transformation)", async () => {
      const fp = await computeFingerprint();
      expect(fp).toBe(KNOWN_DEVICE_ID);
    });

    it("output matches UUID v4 format", async () => {
      const fp = await computeFingerprint();
      expect(fp).toMatch(UUID_V4_RE);
    });

    it("output is 36 characters (UUID with dashes)", async () => {
      const fp = await computeFingerprint();
      expect(fp).toHaveLength(36);
    });
  });

  describe("uniqueness", () => {
    it("different deviceIds produce different fingerprints", async () => {
      setupBrowserEnv("device-alpha-0001-aaaa-bbbbbbbbbbbb".replace(/-/g, "").slice(0, 8) + "-0001-4000-8000-" + "a".repeat(12));
      // Use real UUIDs for this test
      const id1 = "11111111-1111-4111-8111-111111111111";
      const id2 = "22222222-2222-4222-8222-222222222222";

      setupBrowserEnv(id1);
      const fp1 = await computeFingerprint();

      setupBrowserEnv(id2);
      const fp2 = await computeFingerprint();

      expect(fp1).not.toBe(fp2);
    });
  });

  describe("browser-update stability (userAgent independence) — issue #1615", () => {
    beforeEach(() => setupBrowserEnv(KNOWN_DEVICE_ID));

    it("fingerprint is unchanged when userAgent is Chrome 100", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: "Mozilla/5.0 Chrome/100.0.4896.60 Safari/537.36" },
        writable: true,
        configurable: true,
      });
      const fp = await computeFingerprint();
      expect(fp).toBe(KNOWN_DEVICE_ID);
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
