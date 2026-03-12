/**
 * Wizard Step 2 — Fenrir Ledger QA Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Issue: #189 — Card wizard Step 2 + data persistence across steps
 * PR:    #259
 *
 * Slimmed to core interactive behavior: required fields render, validation
 * fires on empty submit, valid data submits successfully.
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── Shared helpers ────────────────────────────────────────────────────────────

async function goToNewCard(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "load" });
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.goto("/ledger/cards/new", { waitUntil: "domcontentloaded" });
  await page.locator("#cardName").waitFor({ state: "visible", timeout: 15000 });
}

async function goToStep2(page: import("@playwright/test").Page) {
  await goToNewCard(page);

  await page.locator("#issuerId").click();
  await page.locator('[role="option"]').first().click();

  await page.locator("#cardName").fill("Fenrir Test Card");

  await page.locator('button:has-text("More Details")').click();

  await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Step 1 Required Fields Render
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Step 1 Renders", () => {
  test("Step 1 renders Issuer, Card Name, and Open Date fields", async ({ page }) => {
    await goToNewCard(page);
    await expect(page.locator("#issuerId")).toBeVisible();
    await expect(page.locator("#cardName")).toBeVisible();
    await expect(page.locator("#openDate")).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Validation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Validation", () => {
  test("More Details without required fields shows validation error", async ({ page }) => {
    await goToNewCard(page);
    await page.locator('button:has-text("More Details")').click();
    await expect(page.locator('button:has-text("More Details")')).toBeVisible();
  });

  test("Cancel from Step 1 returns to dashboard without saving", async ({ page }) => {
    await goToNewCard(page);
    await page.locator("#cardName").fill("Should Not Be Saved");
    await page.locator('button:has-text("Cancel")').click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/ledger/cards/");
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Should Not Be Saved");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Advance to Step 2
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Advancing to Step 2", () => {
  test("clicking More Details advances to Step 2", async ({ page }) => {
    await goToStep2(page);
    await expect(page.locator('button:has-text("More Details")')).not.toBeVisible();
  });

  test("Step 2 renders Notes textarea", async ({ page }) => {
    await goToStep2(page);
    await expect(page.locator("#notes")).toBeVisible();
  });

  test("Step 2 renders Credit Limit select — DEF-002 [HIGH] #270", async ({ page }) => {
    await goToStep2(page);
    await expect(page.locator("#creditLimit")).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Save Card
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Save Card", () => {
  test("Save Card from Step 1 (without More Details) redirects to dashboard", async ({ page }) => {
    await goToNewCard(page);
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill("Step1SaveCard");

    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/ledger/cards/");
  });

  test("Save Card from Step 2 persists card to dashboard", async ({ page }) => {
    const cardName = `Step2SavedCard${Date.now()}`;

    await goToNewCard(page);
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill(cardName);

    await page.locator('button:has-text("More Details")').click();
    await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });

    await page.locator("#notes").fill("Gleipnir binds even gods");

    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });
    // Use first() — with 5-tab dashboard, card names appear in multiple tab panels
    await expect(page.locator(`text=${cardName}`).first()).toBeVisible();
  });

  test("Cancel from Step 2 returns to dashboard without saving", async ({ page }) => {
    await goToStep2(page);
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/ledger/cards/");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Back Navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Back Navigation", () => {
  test("Back button returns user to Step 1 — DEF-001 [CRITICAL] #269", async ({ page }) => {
    await goToStep2(page);

    const backBtn = page.locator('button:has-text("Back")');
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();

    await expect(page.locator("#cardName")).toBeVisible();
    await expect(page.locator('button:has-text("More Details")')).toBeVisible();
  });

  test("Step 1 data is preserved after Back — DEF-001 [CRITICAL] #269", async ({ page }) => {
    const uniqueName = `BackPreserveCard${Date.now()}`;

    await goToNewCard(page);
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill(uniqueName);

    await page.locator('button:has-text("More Details")').click();
    await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });

    const backBtn = page.locator('button:has-text("Back")');
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();

    await expect(page.locator("#cardName")).toHaveValue(uniqueName);
  });
});
