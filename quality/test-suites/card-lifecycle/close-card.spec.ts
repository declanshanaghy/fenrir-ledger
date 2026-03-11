/**
 * Close Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the card close flow against the design spec.
 * Slimmed to core interactive behavior only.
 *
 * Data isolation: each test seeds its own card and clears storage.
 */

import { test, expect } from "@playwright/test";
import {
  makeCard,
  seedCards,
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Close Confirmation Dialog
// ════════════════════════════════════════════════════════════════════════════

test.describe("Close Card — Confirmation Dialog", () => {
  test("clicking Close Card opens a confirmation dialog", async ({
    page,
  }) => {
    const card = makeCard({ cardName: "Dialog Test Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();

    await expect(page.locator("text=Close this card?")).toBeVisible();
  });

  test("close dialog Cancel button dismisses without action", async ({
    page,
  }) => {
    const card = makeCard({ cardName: "Cancel Close Test" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();
    await expect(page.locator("text=Close this card?")).toBeVisible();

    const dialogCancelBtn = page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first();
    await dialogCancelBtn.click();

    await expect(page.locator("text=Close this card?")).not.toBeVisible();
    expect(page.url()).toContain(`/cards/${card.id}/edit`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Confirm Close
// ════════════════════════════════════════════════════════════════════════════

test.describe("Close Card — Confirm Action", () => {
  test("confirming close redirects to dashboard", async ({ page }) => {
    const card = makeCard({ cardName: "Card To Close" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();
    await expect(page.locator("text=Close this card?")).toBeVisible();

    const confirmBtn = page
      .locator('[role="dialog"] button:has-text("Close Card")')
      .last();
    await confirmBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/ledger/cards/");
  });

  test("closed card no longer appears in active dashboard grid", async ({
    page,
  }) => {
    const card = makeCard({ cardName: "Soon To Be Closed" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();
    await expect(page.locator("text=Close this card?")).toBeVisible();

    const confirmBtn = page
      .locator('[role="dialog"] button:has-text("Close Card")')
      .last();
    await confirmBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Soon To Be Closed");
  });
});
