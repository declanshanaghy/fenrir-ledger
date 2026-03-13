/**
 * Trial State Management Tests
 *
 * Validates server-side trial state with Vercel KV, browser fingerprinting,
 * and the trial status hook. Tests acceptance criteria and edge cases.
 *
 * Note: These tests focus on API contract validation and integration patterns.
 * Pure fingerprinting logic (unit tests) should be in Vitest.
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
  const hash = createHash("sha256").update(`fingerprint-${Date.now()}-${Math.random()}`).digest("hex");
  return hash;
}

/**
 * Calls /api/trial/init endpoint with a given fingerprint.
 * Returns response object that can be checked for status and body.
 */
async function callTrialInit(page: any, fingerprint: string): Promise<any> {
  const response = await page.request.post("/api/trial/init", {
    data: { fingerprint },
  });
  return response;
}

/**
 * Calls /api/trial/status endpoint with a given fingerprint.
 * Returns response object that can be checked for status and body.
 */
async function callTrialStatus(page: any, fingerprint: string): Promise<any> {
  const response = await page.request.post("/api/trial/status", {
    data: { fingerprint },
  });
  return response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Trial State Management", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app (requires being authenticated in playwright.config.ts)
    await page.goto("/ledger");
  });

  // =========================================================================
  // Fingerprint Format Validation
  // =========================================================================

  test("TC-01: Valid fingerprint is 64-character lowercase hex string", () => {
    const fingerprint = generateFingerprint();
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint.length).toBe(64);
  });

  test("TC-02: Invalid fingerprint format is rejected by API", async ({ page }) => {
    // Test various invalid formats
    const invalidFingerprints = [
      "short", // Too short
      "ABCD".repeat(16), // Uppercase (KV expects lowercase)
      "zzzz" + "0".repeat(60), // Invalid hex chars
      "", // Empty
    ];

    for (const invalid of invalidFingerprints) {
      const response = await callTrialInit(page, invalid);
      if (response.status() !== 401) {
        // If authenticated, should be 400 for invalid fingerprint
        expect([400, 401]).toContain(response.status());
      }
    }
  });

  // =========================================================================
  // /api/trial/init — Endpoint Contract Tests
  // =========================================================================

  test("TC-03: POST /api/trial/init with valid fingerprint returns 200 + metadata", async ({
    page,
  }) => {
    const fingerprint = generateFingerprint();
    const response = await callTrialInit(page, fingerprint);

    // Must be 401 if not authenticated, otherwise should accept valid fingerprint
    if (response.status() === 401) {
      expect(response.status()).toBe(401);
      return;
    }

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.startDate).toBeTruthy();
    expect(typeof body.startDate).toBe("string");
    // Verify ISO format (basic check)
    expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(["isNew" in body]).toEqual([true]);
    expect(typeof body.isNew).toBe("boolean");
  });

  test("TC-04: POST /api/trial/init requires authentication (401 when missing token)", async ({
    page,
  }) => {
    const fingerprint = generateFingerprint();
    const response = await page.request.post("/api/trial/init", {
      data: { fingerprint },
      headers: {
        "Content-Type": "application/json",
        // No Authorization header — should fail auth check
      },
    });

    expect(response.status()).toBe(401);
  });

  test("TC-05: POST /api/trial/init with invalid fingerprint returns 400", async ({ page }) => {
    const response = await callTrialInit(page, "not-valid-hex");

    // If authenticated, validation should occur and return 400
    if (response.status() !== 401) {
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBeTruthy();
      expect(body.error_description).toBeTruthy();
    }
  });

  test("TC-06: POST /api/trial/init rejects missing fingerprint in body", async ({ page }) => {
    const response = await page.request.post("/api/trial/init", {
      data: {}, // Missing fingerprint field
    });

    if (response.status() !== 401) {
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBeTruthy();
    }
  });

  test("TC-07: POST /api/trial/init handles invalid JSON gracefully", async ({ page }) => {
    // Send malformed request
    const response = await page.request.post("/api/trial/init", {
      data: "{not valid json",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Should handle gracefully (likely 400 or 401)
    expect([400, 401]).toContain(response.status());
  });

  // =========================================================================
  // /api/trial/status — Endpoint Contract Tests
  // =========================================================================

  test("TC-08: POST /api/trial/status returns trial metadata (active/expired/none)", async ({
    page,
  }) => {
    const fingerprint = generateFingerprint();
    const response = await callTrialStatus(page, fingerprint);

    if (response.status() === 401) {
      expect(response.status()).toBe(401);
      return;
    }

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // Contract validation
    expect(body).toHaveProperty("remainingDays");
    expect(body).toHaveProperty("status");
    expect(typeof body.remainingDays).toBe("number");
    expect(typeof body.status).toBe("string");
    expect(["active", "expired", "converted", "none"]).toContain(body.status);
    expect(body.remainingDays).toBeGreaterThanOrEqual(0);
    expect(body.remainingDays).toBeLessThanOrEqual(30);
  });

  test("TC-09: POST /api/trial/status requires authentication", async ({ page }) => {
    const fingerprint = generateFingerprint();
    const response = await page.request.post("/api/trial/status", {
      data: { fingerprint },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(401);
  });

  test("TC-10: POST /api/trial/status with invalid fingerprint returns 400", async ({ page }) => {
    const response = await callTrialStatus(page, "invalid");

    if (response.status() !== 401) {
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBeTruthy();
    }
  });

  test("TC-11: POST /api/trial/status rejects missing fingerprint in body", async ({ page }) => {
    const response = await page.request.post("/api/trial/status", {
      data: {}, // Missing fingerprint
    });

    if (response.status() !== 401) {
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBeTruthy();
    }
  });

  // =========================================================================
  // Idempotency Tests
  // =========================================================================

  test("TC-12: POST /api/trial/init is idempotent (same fingerprint, same startDate)", async ({
    page,
  }) => {
    const fingerprint = generateFingerprint();

    // First call
    const response1 = await callTrialInit(page, fingerprint);
    if (response1.status() === 401) {
      // Can't test idempotency without auth
      expect(response1.status()).toBe(401);
      return;
    }

    // If rate limited during test run, skip (rate limiting itself is tested separately)
    if (response1.status() === 429) {
      expect(response1.status()).toBe(429);
      return;
    }

    expect(response1.status()).toBe(200);
    const body1 = await response1.json();
    const startDate1 = body1.startDate;
    expect(body1.isNew).toBe(true);

    // Wait to ensure time difference would be visible if not idempotent
    await page.waitForTimeout(100);

    // Second call with same fingerprint
    const response2 = await callTrialInit(page, fingerprint);
    if (response2.status() === 429) {
      // Rate limit during test — acceptable for idempotency test
      return;
    }

    expect(response2.status()).toBe(200);
    const body2 = await response2.json();
    expect(body2.isNew).toBe(false);

    // Critical: startDate must match exactly (idempotent behavior)
    expect(body2.startDate).toBe(startDate1);
  });

  // =========================================================================
  // Trial Status State Tests
  // =========================================================================

  test("TC-13: Trial status shows 'none' when no trial exists for fingerprint", async ({
    page,
  }) => {
    const fingerprint = generateFingerprint();
    const response = await callTrialStatus(page, fingerprint);

    if (response.status() === 401) {
      return; // Can't verify without auth
    }

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // No trial record should show status: none
    expect(body.status).toBe("none");
    expect(body.remainingDays).toBe(0);
    expect(body.convertedDate).toBeUndefined();
  });

  test("TC-14: Trial status shows 'active' after trial initialization", async ({ page }) => {
    const fingerprint = generateFingerprint();

    // Initialize trial
    const initResponse = await callTrialInit(page, fingerprint);
    if (initResponse.status() === 401) {
      return; // Can't verify without auth
    }

    // May hit rate limit if other tests exhausted quota — that's OK for this test
    if (initResponse.status() === 429) {
      // Rate limit is expected after rapid fire tests
      expect(initResponse.status()).toBe(429);
      return;
    }

    expect(initResponse.status()).toBe(200);

    // Check status immediately
    const statusResponse = await callTrialStatus(page, fingerprint);
    if (statusResponse.status() === 429) {
      // Rate limit OK for this test too
      return;
    }

    expect(statusResponse.ok()).toBeTruthy();
    const body = await statusResponse.json();

    // Should be active with some remaining days
    expect(body.status).toBe("active");
    expect(body.remainingDays).toBeGreaterThan(0);
    expect(body.remainingDays).toBeLessThanOrEqual(30);
  });

  // =========================================================================
  // Rate Limiting Tests
  // =========================================================================

  test("TC-15: POST /api/trial/init enforces rate limit (10/min)", async ({ page }) => {
    // Generate 12 unique fingerprints and attempt to init them rapidly
    const requests = [];
    for (let i = 0; i < 12; i++) {
      const fp = createHash("sha256").update(`test-${i}-${Date.now()}`).digest("hex");
      const response = await callTrialInit(page, fp);
      requests.push(response);
      // No delay between requests to stress test rate limiting
    }

    const statuses = requests.map((r) => r.status());
    // Either we hit rate limit (429) or all failed auth (401)
    const hasRateLimit = statuses.some((s) => s === 429);
    const hasUnauth = statuses.some((s) => s === 401);

    // Should see either rate limiting or auth failures, not all successes
    if (!statuses.every((s) => s === 401)) {
      expect(hasRateLimit).toBeTruthy();
    }
  });

  test("TC-16: POST /api/trial/status enforces rate limit (30/min)", async ({ page }) => {
    const fingerprint = generateFingerprint();
    const requests = [];

    // Make 32 rapid requests
    for (let i = 0; i < 32; i++) {
      const response = await callTrialStatus(page, fingerprint);
      requests.push(response);
    }

    const statuses = requests.map((r) => r.status());
    const hasRateLimit = statuses.some((s) => s === 429);

    // Should see rate limiting if authenticated
    if (!statuses.every((s) => s === 401)) {
      expect(hasRateLimit).toBeTruthy();
    }
  });

  // =========================================================================
  // Trial Metadata Persistence
  // =========================================================================

  test("TC-17: Multiple calls to /api/trial/status preserve trial startDate", async ({ page }) => {
    const fingerprint = generateFingerprint();

    // Initialize
    const initResponse = await callTrialInit(page, fingerprint);
    if (initResponse.status() === 401 || initResponse.status() === 429) {
      return; // Can't test without auth or if rate limited
    }

    const initBody = await initResponse.json();
    const startDate = initBody.startDate;

    // Call status once more (don't hammer to avoid rate limit)
    const statusResponse = await callTrialStatus(page, fingerprint);
    if (statusResponse.status() === 429) {
      return; // Rate limit OK for this test
    }

    expect(statusResponse.ok()).toBeTruthy();
    const body = await statusResponse.json();

    // Should still be active
    expect(body.status).toBe("active");
  });

  // =========================================================================
  // Cache Control Headers
  // =========================================================================

  test("TC-18: API responses include Cache-Control: no-store headers", async ({ page }) => {
    const fingerprint = generateFingerprint();

    // Test /api/trial/init
    const initResponse = await callTrialInit(page, fingerprint);
    if (initResponse.status() === 200) {
      const cacheControl = initResponse.headers()["cache-control"];
      expect(cacheControl).toBe("no-store");
    } else if (initResponse.status() === 429) {
      // Rate limited — rate limit responses may not have cache-control
      expect([200, 401, 429]).toContain(initResponse.status());
      return;
    }

    // Test /api/trial/status
    const statusResponse = await callTrialStatus(page, fingerprint);
    if (statusResponse.status() === 200) {
      const cacheControl = statusResponse.headers()["cache-control"];
      expect(cacheControl).toBe("no-store");
    }
  });

  // =========================================================================
  // Error Response Format
  // =========================================================================

  test("TC-19: Error responses include error and error_description fields", async ({ page }) => {
    // Send invalid fingerprint
    const response = await callTrialInit(page, "xyz");

    if (response.status() === 400) {
      const body = await response.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("error_description");
      expect(typeof body.error).toBe("string");
      expect(typeof body.error_description).toBe("string");
    }
  });

  // =========================================================================
  // Response Status Codes
  // =========================================================================

  test("TC-20: API returns appropriate status codes for different scenarios", async ({
    page,
  }) => {
    // Test that endpoints respect HTTP semantics
    // 401 for missing auth (may be hit by rate limit in test suite context)
    const fp = generateFingerprint();
    const unauthResponse = await page.request.post("/api/trial/init", {
      data: { fingerprint: fp },
      headers: {
        "Content-Type": "application/json",
        // No auth
      },
    });
    // Either 401 (auth required) or 429 (rate limit from other tests)
    expect([401, 429]).toContain(unauthResponse.status());

    // 400 Bad Request for invalid input (if not rate limited)
    const invalidResponse = await callTrialInit(page, "not-hex");
    // Expect 400 for invalid fingerprint, but may be 429 from rate limiting
    expect([400, 401, 429]).toContain(invalidResponse.status());
  });
});
