/**
 * Edit Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the /cards/[id]/edit page against the design spec.
 * Slimmed to core interactive behavior only.
 *
 * Data isolation: each test seeds its own card and clears storage first.
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
  await page.goto("/ledger");
  await clearAllStorage(page);
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Pre-populated Fields
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card — Pre-populated Fields", () => {
  test("card name input is pre-populated with the stored card name", async ({
    page,
  }) => {
    const card = makeCard({ cardName: "Freya's Folly" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toHaveValue("Freya's Folly");
  });

  test("unknown card ID redirects to dashboard", async ({ page }) => {
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "load" });

    await page.goto("/ledger/cards/nonexistent-id-that-does-not-exist/edit", {
      waitUntil: "load",
    });

    await page.waitForURL("**/ledger", { timeout: 5000 });
    expect(page.url()).not.toContain("/ledger/cards/");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Edit and Save
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card — Save Changes", () => {
  test("updating card name and saving redirects to dashboard", async ({
    page,
  }) => {
    const card = makeCard({ cardName: "Original Name" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

    await page.locator("#cardName").fill("Updated Name");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/ledger", { timeout: 5000 });
    expect(page.url()).not.toContain("/ledger/cards/");
  });

  test("updated card name is visible on dashboard after save", async ({
    page,
  }) => {
    const card = makeCard({ cardName: "Before Update" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

    const newName = `After Update ${Date.now()}`;
    await page.locator("#cardName").fill(newName);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/ledger", { timeout: 5000 });

    // Use first() — with 5-tab dashboard, card names appear in multiple tab panels
    await expect(page.locator(`text=${newName}`).first()).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Cancel Without Saving
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card — Cancel Without Saving", () => {
  test("Cancel button navigates to dashboard without saving changes", async ({
    page,
  }) => {
    const card = makeCard({ cardName: "Do Not Change Me" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

    await page.locator("#cardName").fill("Changed But Cancelled");

    const cancelBtn = page.locator('button:has-text("Cancel")');
    await cancelBtn.click();

    await page.waitForURL("**/ledger", { timeout: 5000 });

    // Use first() — with 5-tab dashboard, card names appear in multiple tab panels
    await expect(page.locator("text=Do Not Change Me").first()).toBeVisible();
  });

  test("unsaved edits do not persist after cancel", async ({ page }) => {
    const originalName = "PersistenceTest Original";
    const card = makeCard({ cardName: originalName });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

    await page.locator("#cardName").fill("This Should Not Save");
    await page.locator('button:has-text("Cancel")').click();

    await page.waitForURL("**/ledger", { timeout: 5000 });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });
    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toHaveValue(originalName);
  });
});
