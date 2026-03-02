/**
 * SideNav (Sidebar) Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the SideNav component against the design spec:
 *   - "Cards" nav link: text "Cards" + href="/"
 *   - "Valhalla" nav link: text "Valhalla" + href="/valhalla" + ᛏ rune
 *   - Collapse button: aria-label "Collapse sidebar" exists and works
 *   - Active state: Cards link active on /, Valhalla link active on /valhalla
 *
 * Spec references:
 *   - development/frontend/src/components/layout/SideNav.tsx
 *   - NAV_ITEMS: Cards → /, Valhalla → /valhalla with ᛏ iconNode
 *   - Active link: bg-primary/10 text-gold border-l-2 border-gold
 *
 * All assertions derived from the design spec — not from observed code output.
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
  await page.reload({ waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Nav link presence
// ════════════════════════════════════════════════════════════════════════════

test.describe("SideNav — Nav links", () => {
  test("Cards nav link exists with correct href='/'", async ({ page }) => {
    // Spec: NAV_ITEMS[0] — label: "Cards", href: "/"
    const cardsLink = page.locator('nav a[href="/"]').first();
    await expect(cardsLink).toBeVisible();
    await expect(cardsLink).toContainText("Cards");
  });

  test("Valhalla nav link exists with href='/valhalla'", async ({ page }) => {
    // Spec: NAV_ITEMS[1] — label: "Valhalla", href: "/valhalla"
    const valhallaLink = page.locator('nav a[href="/valhalla"]').first();
    await expect(valhallaLink).toBeVisible();
    await expect(valhallaLink).toContainText("Valhalla");
  });

  test("Valhalla nav link contains the ᛏ (Tiwaz) rune", async ({ page }) => {
    // Spec: Valhalla nav item uses iconNode = <RuneIcon rune="ᛏ" />
    // The ᛏ rune spans aria-hidden and appears adjacent to the label
    const valhallaLink = page.locator('nav a[href="/valhalla"]').first();
    await expect(valhallaLink).toContainText("ᛏ");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Collapse button
// ════════════════════════════════════════════════════════════════════════════

test.describe("SideNav — Collapse toggle", () => {
  test("'Collapse sidebar' button exists in the sidebar", async ({ page }) => {
    // Spec: collapse button aria-label "Collapse sidebar" when expanded
    const collapseBtn = page.locator(
      'aside button[aria-label="Collapse sidebar"]'
    );
    await expect(collapseBtn).toBeVisible();
  });

  test("clicking Collapse changes the button to 'Expand sidebar'", async ({
    page,
  }) => {
    // Spec: after collapse, aria-label switches to "Expand sidebar"
    const collapseBtn = page.locator(
      'aside button[aria-label="Collapse sidebar"]'
    );
    await collapseBtn.click();

    const expandBtn = page.locator(
      'aside button[aria-label="Expand sidebar"]'
    );
    await expect(expandBtn).toBeVisible();
  });

  test("sidebar collapses to narrow width after clicking Collapse", async ({
    page,
  }) => {
    // Spec: collapsed state → w-14 (56px); expanded → w-56 (224px)
    const sidebar = page.locator("aside").first();

    const expandedBox = await sidebar.boundingBox();
    expect(expandedBox).not.toBeNull();

    const collapseBtn = page.locator(
      'aside button[aria-label="Collapse sidebar"]'
    );
    await collapseBtn.click();

    // Give Tailwind transition time (200ms per transition-all duration-200)
    await page.waitForTimeout(300);

    const collapsedBox = await sidebar.boundingBox();
    expect(collapsedBox).not.toBeNull();

    // Collapsed width (56px) must be less than expanded width (224px)
    expect(collapsedBox!.width).toBeLessThan(expandedBox!.width);
  });

  test("nav labels are hidden after collapse and restored on expand", async ({
    page,
  }) => {
    // Spec: when collapsed, !collapsed condition hides label spans
    const cardsLabel = page.locator('nav a[href="/"] span.font-body');

    // Initially visible (expanded state)
    await expect(cardsLabel).toBeVisible();

    // Collapse
    const collapseBtn = page.locator('aside button[aria-label="Collapse sidebar"]');
    await collapseBtn.click();
    await page.waitForTimeout(300);

    // Label span should not be rendered (not just hidden)
    await expect(cardsLabel).not.toBeAttached();

    // Expand again.
    // The Next.js dev-mode `<nextjs-portal>` element and open Radix overlay states
    // (from toast/dialog from preceding tests) intercept Playwright's pointer-event
    // click. page.evaluate() fires a direct DOM click bypassing all overlay barriers.
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        'aside button[aria-label="Expand sidebar"]'
      );
      if (btn) btn.click();
    });

    // Wait for the label to reappear — the sidebar re-renders and adds the span.
    await expect(cardsLabel).toBeVisible({ timeout: 3000 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Active link state
// ════════════════════════════════════════════════════════════════════════════

test.describe("SideNav — Active state", () => {
  test("Cards link has active styling on the dashboard (/)", async ({ page }) => {
    // Spec: isActive when pathname === href.
    // Active class: bg-primary/10 text-gold border-l-2 border-gold
    // We assert the link exists and has the gold text class applied.
    const cardsLink = page.locator('nav a[href="/"]').first();
    await expect(cardsLink).toBeVisible();

    // Active links have "text-gold" class per SideNav spec
    const classList = await cardsLink.getAttribute("class");
    expect(classList).not.toBeNull();
    expect(classList).toContain("text-gold");
  });

  test("Valhalla link does NOT have active styling on the dashboard (/)", async ({
    page,
  }) => {
    // Spec: Valhalla link is inactive on /; it should have border-transparent
    const valhallaLink = page.locator('nav a[href="/valhalla"]').first();
    const classList = await valhallaLink.getAttribute("class");
    expect(classList).not.toBeNull();
    // Inactive links use border-transparent per spec
    expect(classList).toContain("border-transparent");
  });

  test("Valhalla link has active styling on /valhalla", async ({ page }) => {
    // Spec: on /valhalla, pathname === "/valhalla" → isActive = true
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    const valhallaLink = page.locator('nav a[href="/valhalla"]').first();
    const classList = await valhallaLink.getAttribute("class");
    expect(classList).not.toBeNull();
    expect(classList).toContain("text-gold");
  });

  test("Cards link is NOT active on /valhalla", async ({ page }) => {
    // Spec: Cards link only active when pathname === "/"
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    const cardsLink = page.locator('nav a[href="/"]').first();
    const classList = await cardsLink.getAttribute("class");
    expect(classList).not.toBeNull();
    // Inactive → border-transparent not border-gold
    expect(classList).toContain("border-transparent");
  });
});
