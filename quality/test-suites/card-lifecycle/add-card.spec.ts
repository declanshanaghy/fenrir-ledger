/**
 * Add Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the /cards/new flow against the design spec, not the implementation.
 * Slimmed to core interactive behavior only.
 *
 * Data isolation: clearAllStorage() is called before each test. seedHousehold()
 * ensures the app has a valid householdId before the form loads.
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.goto("/cards/new", { waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Validation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Add Card — Validation Errors", () => {
  test("submitting empty form shows issuer validation error", async ({
    page,
  }) => {
    await page.locator("#openDate").fill("");
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    const issuerError = page.locator("#issuerId ~ p.text-destructive, #issuerId + p.text-destructive").first();
    await expect(issuerError).toBeVisible();
  });

  test("submitting empty form shows 'Card name is required' error", async ({
    page,
  }) => {
    await page.locator("#openDate").fill("");
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await expect(page.locator("text=Card name is required")).toBeVisible();
  });

  test("providing issuer, name, and date clears all required-field errors", async ({
    page,
  }) => {
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Test Validation Card");
    await page.locator("#openDate").fill("2024-01-15");

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/new");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Successful Card Creation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Add Card — Successful Creation", () => {
  test("saving a valid card redirects to dashboard (/)", async ({ page }) => {
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Saga Test Card");
    await page.locator("#openDate").fill("2024-06-01");

    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/new");
  });

  test("new card appears on dashboard after creation", async ({ page }) => {
    const uniqueName = `QA Card ${Date.now()}`;

    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill(uniqueName);
    await page.locator("#openDate").fill("2024-06-01");

    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });

    await expect(page.locator(`text=${uniqueName}`)).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Cancel Navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Add Card — Cancel Navigation", () => {
  test("Cancel button navigates back to dashboard", async ({ page }) => {
    const cancelBtn = page.locator('button:has-text("Cancel")');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/new");
  });
});
