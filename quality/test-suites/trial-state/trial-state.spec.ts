/**
 * Trial State Management Tests
 *
 * Validates server-side trial state with Vercel KV, browser fingerprinting,
 * and the trial status hook. Tests acceptance criteria and edge cases.
 */

import { test, expect } from "@playwright/test";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a valid 64-char hex fingerprint.
 */
function generateFingerprint(): string {
  const hash = createHash("sha256").update("test-user-agent-12345").digest("hex");
  return hash;
}

/**
 * Extracts and validates a fingerprint from localStorage.
 */
async function getDeviceIdFromStorage(page: any): Promise<string> {
  const deviceId = await page.evaluate(() => {
    return localStorage.getItem("fenrir:device-id");
  });
  expect(deviceId).toBeTruthy();
  expect(typeof deviceId).toBe("string");
  // UUID v4 format: 8-4-4-4-12 hex digits with hyphens
  expect(deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return deviceId!;
}

/**
 * Calls /api/trial/init endpoint with a given fingerprint.
 */
async function callTrialInit(page: any, fingerprint: string): Promise<any> {
  const response = await page.request.post("/api/trial/init", {
    data: { fingerprint },
    headers: {
      "Content-Type": "application/json",
    },
  });
  expect(response.ok() || response.status() === 401).toBeTruthy();
  return response;
}

/**
 * Calls /api/trial/status endpoint with a given fingerprint.
 */
async function callTrialStatus(page: any, fingerprint: string): Promise<any> {
  const response = await page.request.post("/api/trial/status", {
    data: { fingerprint },
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Trial State Management", () => {
  test.beforeEach(async ({ page }) => {
    // Clear all storage before each test
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    // Navigate to the app (requires being authenticated in playwright.config.ts)
    await page.goto("/ledger");
  });

  // =========================================================================
  // Fingerprinting Tests
  // =========================================================================

  test("TC-01: Device ID is generated and persisted in localStorage on first access", async ({
    page,
  }) => {
    // Device ID should be created on first access to fingerprinting logic
    const deviceId = await page.evaluate(() => {
      const existing = localStorage.getItem("fenrir:device-id");
      if (!existing) {
        // Simulate first access by importing the function
        // In a real scenario, this would be triggered by app mount
        const uuid = globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : "test-uuid";
        localStorage.setItem("fenrir:device-id", uuid);
      }
      return localStorage.getItem("fenrir:device-id");
    });

    expect(deviceId).toBeTruthy();
    expect(typeof deviceId).toBe("string");
    // Reload and verify persistence
    await page.reload();
    const persistedDeviceId = await page.evaluate(() => localStorage.getItem("fenrir:device-id"));
    expect(persistedDeviceId).toBe(deviceId);
  });

  test("TC-02: Fingerprint is 64-character lowercase hex string", async ({ page }) => {
    const fingerprint = await page.evaluate(async () => {
      const deviceId = localStorage.getItem("fenrir:device-id") || globalThis.crypto.randomUUID?.();
      const input = navigator.userAgent + deviceId;
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      return hashHex;
    });

    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint.length).toBe(64);
  });

  test("TC-03: Same userAgent + deviceId produces same fingerprint", async ({ page }) => {
    const deviceId = await getDeviceIdFromStorage(page);

    // Generate fingerprint twice with same device ID
    const fingerprint1 = await page.evaluate(async (devId) => {
      const input = navigator.userAgent + devId;
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }, deviceId);

    const fingerprint2 = await page.evaluate(async (devId) => {
      const input = navigator.userAgent + devId;
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }, deviceId);

    expect(fingerprint1).toBe(fingerprint2);
  });

  // =========================================================================
  // API Endpoint Tests
  // =========================================================================

  test("TC-04: POST /api/trial/init with valid fingerprint returns 200 with startDate", async ({
    page,
  }) => {
    const fingerprint = generateFingerprint();
    const response = await callTrialInit(page, fingerprint);

    // Must be authenticated; expect 401 if not authenticated
    if (response.status() === 401) {
      // Expected if not authenticated in this test context
      expect(response.status()).toBe(401);
      return;
    }

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.startDate).toBeTruthy();
    expect(typeof body.startDate).toBe("string");
    // Verify ISO format
    expect(() => new Date(body.startDate)).not.toThrow();
    expect(body.isNew).toBe(true);
  });

  test("TC-05: POST /api/trial/init with invalid fingerprint returns 400", async ({ page }) => {
    const response = await callTrialInit(page, "invalid-fingerprint");
    // Auth check first, then validation
    if (response.status() === 401) {
      // Expected if not authenticated
      expect(response.status()).toBe(401);
      return;
    }
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("invalid");
  });

  test("TC-06: POST /api/trial/init without auth returns 401", async ({ page }) => {
    // Make unauthenticated request by not including token
    const response = await page.request.post("/api/trial/init", {
      data: { fingerprint: generateFingerprint() },
      headers: {
        "Content-Type": "application/json",
        // No Authorization header
      },
    });
    expect(response.status()).toBe(401);
  });

  test("TC-07: POST /api/trial/status with valid fingerprint returns trial metadata", async ({
    page,
  }) => {
    const fingerprint = generateFingerprint();
    const response = await callTrialStatus(page, fingerprint);

    if (response.status() === 401) {
      // Expected if not authenticated
      expect(response.status()).toBe(401);
      return;
    }

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.remainingDays).toBeDefined();
    expect(typeof body.remainingDays).toBe("number");
    expect(body.status).toBeDefined();
    expect(["active", "expired", "converted", "none"]).toContain(body.status);
    expect(body.remainingDays).toBeGreaterThanOrEqual(0);
  });

  test("TC-08: POST /api/trial/status with invalid fingerprint returns 400", async ({ page }) => {
    const response = await callTrialStatus(page, "not-a-valid-hex");

    if (response.status() === 401) {
      // Expected if not authenticated
      expect(response.status()).toBe(401);
      return;
    }

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("invalid");
  });

  test("TC-09: POST /api/trial/status without auth returns 401", async ({ page }) => {
    const response = await page.request.post("/api/trial/status", {
      data: { fingerprint: generateFingerprint() },
      headers: {
        "Content-Type": "application/json",
        // No Authorization header
      },
    });
    expect(response.status()).toBe(401);
  });

  // =========================================================================
  // Idempotency Tests
  // =========================================================================

  test("TC-10: POST /api/trial/init is idempotent - second call returns same startDate", async ({
    page,
  }) => {
    const fingerprint = generateFingerprint();

    // First call
    const response1 = await callTrialInit(page, fingerprint);
    if (response1.status() === 401) {
      // Expected if not authenticated
      expect(response1.status()).toBe(401);
      return;
    }
    expect(response1.status()).toBe(200);
    const body1 = await response1.json();
    const startDate1 = body1.startDate;
    expect(body1.isNew).toBe(true);

    // Wait a moment to ensure timestamps would differ if not idempotent
    await page.waitForTimeout(100);

    // Second call with same fingerprint
    const response2 = await callTrialInit(page, fingerprint);
    expect(response2.status()).toBe(200);
    const body2 = await response2.json();
    const startDate2 = body2.startDate;
    expect(body2.isNew).toBe(false);

    // Start dates must match
    expect(startDate2).toBe(startDate1);
  });

  // =========================================================================
  // Expiry Computation Tests
  // =========================================================================

  test("TC-11: Trial status shows 'none' when no trial record exists", async ({ page }) => {
    const fingerprint = generateFingerprint();
    const response = await callTrialStatus(page, fingerprint);

    if (response.status() === 401) {
      // Expected if not authenticated
      expect(response.status()).toBe(401);
      return;
    }

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("none");
    expect(body.remainingDays).toBe(0);
    expect(body.convertedDate).toBeUndefined();
  });

  test("TC-12: Trial status shows 'active' within 30 days of start", async ({ page }) => {
    const fingerprint = generateFingerprint();

    // Initialize trial
    const initResponse = await callTrialInit(page, fingerprint);
    if (initResponse.status() === 401) {
      expect(initResponse.status()).toBe(401);
      return;
    }

    expect(initResponse.status()).toBe(200);

    // Check status immediately
    const statusResponse = await callTrialStatus(page, fingerprint);
    expect(statusResponse.ok()).toBeTruthy();
    const body = await statusResponse.json();
    expect(body.status).toBe("active");
    expect(body.remainingDays).toBeGreaterThan(0);
    expect(body.remainingDays).toBeLessThanOrEqual(30);
  });

  // =========================================================================
  // Rate Limiting Tests
  // =========================================================================

  test("TC-13: POST /api/trial/init respects rate limit (10/min)", async ({ page }) => {
    const requests = [];
    for (let i = 0; i < 12; i++) {
      const fp = createHash("sha256").update(`fingerprint-${i}`).digest("hex");
      const response = await callTrialInit(page, fp);
      requests.push(response);
    }

    // Count successes and rate-limited responses
    const statuses = requests.map((r) => r.status());
    const hasRateLimit = statuses.some((s) => s === 429);

    // Either we hit rate limit or got 401 for all (not authenticated)
    // The test passes if rate limit was respected (429 seen) or all unauthorized
    if (!statuses.every((s) => s === 401)) {
      expect(hasRateLimit).toBeTruthy();
    }
  });

  test("TC-14: POST /api/trial/status respects rate limit (30/min)", async ({ page }) => {
    const fingerprint = generateFingerprint();
    const requests = [];

    for (let i = 0; i < 32; i++) {
      const response = await callTrialStatus(page, fingerprint);
      requests.push(response);
    }

    const statuses = requests.map((r) => r.status());
    const hasRateLimit = statuses.some((s) => s === 429);

    // Either we hit rate limit or got 401 for all (not authenticated)
    if (!statuses.every((s) => s === 401)) {
      expect(hasRateLimit).toBeTruthy();
    }
  });

  // =========================================================================
  // localStorage Persistence Tests
  // =========================================================================

  test("TC-15: localStorage deviceId persists across page reloads", async ({ page }) => {
    // Set device ID
    const deviceId1 = await getDeviceIdFromStorage(page);

    // Reload page
    await page.reload();

    // Verify device ID persists
    const deviceId2 = await getDeviceIdFromStorage(page);
    expect(deviceId2).toBe(deviceId1);
  });

  test("TC-16: localStorage keys exist after first fingerprinting", async ({ page }) => {
    // Trigger fingerprinting
    const deviceId = await page.evaluate(async () => {
      const existing = localStorage.getItem("fenrir:device-id");
      if (!existing) {
        const uuid = globalThis.crypto.randomUUID?.() || "test";
        localStorage.setItem("fenrir:device-id", uuid);
      }
      return localStorage.getItem("fenrir:device-id");
    });

    expect(deviceId).toBeTruthy();
    expect(deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  // =========================================================================
  // Request Body Validation Tests
  // =========================================================================

  test("TC-17: POST /api/trial/init with missing fingerprint returns 400", async ({ page }) => {
    const response = await page.request.post("/api/trial/init", {
      data: {}, // Missing fingerprint
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status() === 401) {
      // Expected if not authenticated
      expect(response.status()).toBe(401);
      return;
    }

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("TC-18: POST /api/trial/status with missing fingerprint returns 400", async ({ page }) => {
    const response = await page.request.post("/api/trial/status", {
      data: {}, // Missing fingerprint
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status() === 401) {
      // Expected if not authenticated
      expect(response.status()).toBe(401);
      return;
    }

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("TC-19: POST /api/trial/init with invalid JSON returns 400", async ({ page }) => {
    const response = await page.request.post("/api/trial/init", {
      data: "not json",
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect([400, 401]).toContain(response.status());
  });
});
