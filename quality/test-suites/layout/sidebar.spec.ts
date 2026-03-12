/**
 * SideNav (Sidebar) Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - Sidebar toggle (collapse/expand) works
 *   - Navigation links work
 *   - Nav labels hide/show on collapse/expand
 *
 * Removed: active-state CSS class assertions, rune content checks,
 * pixel measurements, visual appearance tests.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  seedCards,
  makeCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Setup
// ════════════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeCard({ cardName: "Test Card" })]);
  await page.reload({ waitUntil: "load" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Nav link presence and navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("SideNav — Nav links", () => {
  test("Cards nav link exists with correct href='/'", async ({ page }) => {
    const cardsLink = page.locator('nav a[href="/"]').first();
    await expect(cardsLink).toBeVisible();
    await expect(cardsLink).toContainText("Cards");
  });

  test("Valhalla button exists in sidebar", async ({ page }) => {
    const valhallaBtn = page.locator('nav button[aria-label="Open Valhalla tab"]').first();
    await expect(valhallaBtn).toBeVisible();
    await expect(valhallaBtn).toContainText("Valhalla");
  });

  test("clicking Valhalla button activates Valhalla tab", async ({ page }) => {
    const valhallaBtn = page.locator('nav button[aria-label="Open Valhalla tab"]').first();
    await valhallaBtn.click();
    // Valhalla tab should now be selected on the dashboard
    const valhallaTab = page.locator('button#tab-valhalla');
    await expect(valhallaTab).toHaveAttribute("aria-selected", "true");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Collapse toggle
// ════════════════════════════════════════════════════════════════════════════

test.describe("SideNav — Collapse toggle", () => {
  test("'Collapse sidebar' button exists in the sidebar", async ({ page }) => {
    const collapseBtn = page.locator(
      'aside button[aria-label="Collapse sidebar"]'
    );
    await expect(collapseBtn).toBeVisible();
  });

  test("clicking Collapse changes the button to 'Expand sidebar'", async ({
    page,
  }) => {
    const collapseBtn = page.locator(
      'aside button[aria-label="Collapse sidebar"]'
    );
    await collapseBtn.click();

    const expandBtn = page.locator(
      'aside button[aria-label="Expand sidebar"]'
    );
    await expect(expandBtn).toBeVisible();
  });

  test("nav labels are hidden after collapse and restored on expand", async ({
    page,
  }) => {
    const cardsLabel = page.locator('nav a[href="/"] span.font-body');

    // Initially visible (expanded state)
    await expect(cardsLabel).toBeVisible();

    // Collapse
    const collapseBtn = page.locator('aside button[aria-label="Collapse sidebar"]');
    await collapseBtn.click();

    // Label span should not be rendered (not just hidden)
    await expect(cardsLabel).not.toBeAttached();

    // Expand again.
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        'aside button[aria-label="Expand sidebar"]'
      );
      if (btn) btn.click();
    });

    // Wait for the label to reappear
    await expect(cardsLabel).toBeVisible({ timeout: 3000 });
  });
});
