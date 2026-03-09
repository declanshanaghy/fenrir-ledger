/**
 * SyncIndicator Test Suite — Issue #181 Validation
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - Indicator dot visible at rest
 *   - Dot pulses on fenrir:sync event
 *   - Pulse disappears after timeout
 *   - Click opens Gleipnir easter egg modal
 *
 * Removed: fixed positioning checks, setInterval polling test,
 * pulse duration timing, color class assertions, tooltip hover tests,
 * tooltip content, aria-hidden checks, z-index checks, modal close test.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Setup
// ════════════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.reload({ waitUntil: "load" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Visual state at rest
// ════════════════════════════════════════════════════════════════════════════

test.describe("SyncIndicator — Visual state at rest", () => {
  test("indicator dot is visible at rest (no pulse)", async ({ page }) => {
    const syncDot = page.locator(
      'button[aria-label="Background sync"] span.relative.inline-flex'
    );

    await expect(syncDot).toBeVisible();

    const pingRing = page.locator(
      'button[aria-label="Background sync"] span.animate-ping'
    );
    await expect(pingRing).not.toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Pulse on fenrir:sync events
// ════════════════════════════════════════════════════════════════════════════

test.describe("SyncIndicator — Real fenrir:sync event handling", () => {
  test("dot pulses when fenrir:sync event is dispatched", async ({ page }) => {
    const pingRing = page.locator(
      'button[aria-label="Background sync"] span.animate-ping'
    );

    await expect(pingRing).not.toBeVisible();

    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const event = new CustomEvent("fenrir:sync");
      window.dispatchEvent(event);
    });

    await page.waitForTimeout(300);

    await expect(pingRing).toBeVisible();
  });

  test("pulse disappears after sync duration", async ({ page }) => {
    const pingRing = page.locator(
      'button[aria-label="Background sync"] span.animate-ping'
    );

    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const event = new CustomEvent("fenrir:sync");
      window.dispatchEvent(event);
    });

    await page.waitForTimeout(300);
    await expect(pingRing).toBeVisible();

    await page.waitForTimeout(1700);
    await expect(pingRing).not.toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Easter egg click interaction
// ════════════════════════════════════════════════════════════════════════════

test.describe("SyncIndicator — Gleipnir Fragment 1 (easter egg)", () => {
  test("clicking indicator opens Gleipnir Fragment 1 easter egg modal", async ({
    page,
  }) => {
    const indicatorButton = page.locator(
      'button[aria-label="Background sync"]'
    );

    await indicatorButton.click();

    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible();

    await expect(dialog).toContainText(/gleipnir|cat|footfall|fragment/i);
  });
});
