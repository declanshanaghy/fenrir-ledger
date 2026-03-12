/**
 * Delete Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the card delete flow against the design spec.
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
// Suite 1 — Delete Confirmation Dialog
// ════════════════════════════════════════════════════════════════════════════

test.describe("Delete Card — Confirmation Dialog", () => {
  test("clicking Delete card opens a confirmation dialog", async ({
    page,
  }) => {
    const card = makeCard({ cardName: "Dialog Delete Test" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

    await page.locator('button:has-text("Delete card")').first().click();

    await expect(page.locator("text=Delete this card?")).toBeVisible();
  });

  test("Cancel in delete dialog dismisses without deleting", async ({ page }) => {
    const card = makeCard({ cardName: "Cancel Delete Test" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    const dialogCancelBtn = page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first();
    await dialogCancelBtn.click();

    await expect(page.locator("text=Delete this card?")).not.toBeVisible();
    expect(page.url()).toContain(`/cards/${card.id}/edit`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Confirm Delete
// ════════════════════════════════════════════════════════════════════════════

test.describe("Delete Card — Confirm Action", () => {
  test("confirming delete redirects to dashboard", async ({ page }) => {
    const card = makeCard({ cardName: "Card To Delete" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    const confirmBtn = page
      .locator('[role="dialog"] button:has-text("Delete")')
      .last();
    await confirmBtn.click();

    await page.waitForURL("**/ledger", { timeout: 5000 });
    expect(page.url()).not.toContain("/ledger/cards/");
  });

  test("deleted card no longer appears on dashboard", async ({ page }) => {
    const card = makeCard({ cardName: "Permanently Gone Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    const confirmBtn = page
      .locator('[role="dialog"] button:has-text("Delete")')
      .last();
    await confirmBtn.click();

    await page.waitForURL("**/ledger", { timeout: 5000 });

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Permanently Gone Card");
  });

  test("deleting one card does not remove other cards", async ({ page }) => {
    const cardToDelete = makeCard({ cardName: "Delete This One" });
    const cardToKeep = makeCard({ cardName: "Keep This One" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [cardToDelete, cardToKeep]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${cardToDelete.id}/edit`, { waitUntil: "load" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    await page
      .locator('[role="dialog"] button:has-text("Delete")')
      .last()
      .click();

    await page.waitForURL("**/ledger", { timeout: 5000 });

    await expect(page.locator("text=Keep This One").first()).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Delete This One");
  });
});
