/**
 * CSV Format Help Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the "How to export CSV" format help section added by PR #265 (Issue #132).
 * Slimmed to core interactive behavior: dialog opens, shows content, closes.
 */

import { test, expect } from "@playwright/test";
import {
  seedCards,
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { FEW_CARDS } from "../helpers/seed-data";

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTH_HOUSEHOLD_ID = ANONYMOUS_HOUSEHOLD_ID;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedFakeAuth(page: any): Promise<void> {
  await page.evaluate((householdId: string) => {
    const fakeSession = {
      access_token: "fake-access-token",
      id_token: "fake-id-token",
      expires_at: Date.now() + 3_600_000,
      user: {
        sub: householdId,
        email: "test@example.com",
        name: "Test User",
        picture: "",
      },
    };
    localStorage.setItem("fenrir:auth", JSON.stringify(fakeSession));
  }, AUTH_HOUSEHOLD_ID);
}

async function setupAuthenticatedWithCards(page: any): Promise<void> {
  await page.goto("/", { waitUntil: "load" });
  await seedFakeAuth(page);
  await seedHousehold(page, AUTH_HOUSEHOLD_ID);
  await seedCards(page, AUTH_HOUSEHOLD_ID, FEW_CARDS);
  await page.reload({ waitUntil: "load" });
  await page.getByRole("link", { name: "Add Card" }).waitFor({ state: "visible", timeout: 15000 });
}

async function openImportWizard(page: any): Promise<void> {
  const importButton = page.getByRole("button", { name: "Import" });
  await expect(importButton).toBeVisible();
  await importButton.click();
  await expect(page.locator('[aria-label="Import Wizard"]')).toBeVisible();
}

async function navigateToCsvUploadStep(page: any): Promise<void> {
  await page.getByText("Deliver a Rune-Stone").click();
  const dialog = page.locator('[aria-label="Import Wizard"]');
  await expect(dialog.getByRole("button", { name: "Upload spreadsheet file" })).toBeVisible();
}

// ─── Suite: CSV Format Help Section ───────────────────────────────────────────

test.describe("CSV Upload — Format Help Section (#132)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
    await navigateToCsvUploadStep(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  test("How to export CSV heading is visible in the CSV upload step", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    await expect(dialog.getByText("How to export CSV")).toBeVisible();
  });

  test("all three export instructions are visible together", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    await expect(dialog.getByText(/Google Sheets/)).toBeVisible();
    await expect(dialog.getByText(/Excel.*File/)).toBeVisible();
    await expect(dialog.getByText(/Numbers.*File/)).toBeVisible();
  });

  test("format help section does not appear on the method selection step", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    const backButton = dialog.getByRole("button", { name: "Back" });
    await expect(backButton).toBeVisible();
    await backButton.click();

    await expect(dialog.getByRole("listbox", { name: "Choose import method" })).toBeVisible();
    await expect(dialog.getByText("How to export CSV")).not.toBeVisible();
  });
});
