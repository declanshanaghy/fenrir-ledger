/**
 * Dashboard Tabs — The Howl Tab Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Updated for Issue #279: Redesign card dashboard into tabs.
 * The HowlPanel sidebar has been replaced by a tab bar with two tabs:
 *   - "The Howl" tab — cards needing attention (fee_approaching, promo_expiring, overdue)
 *   - "Active" tab   — cards in good standing
 *
 * Each card appears in exactly one tab. No duplication across tabs.
 * The Howl tab is the default when it has cards.
 * Active tab is the default when The Howl is empty.
 *
 * Spec references:
 *   - development/frontend/src/components/dashboard/Dashboard.tsx
 *   - ux/wireframes/app/dashboard-tabs.html
 *   - Issue #279 acceptance criteria
 *
 * Viewport strategy:
 *   - Desktop (1280px wide): tab bar visible, both tabs clickable
 *   - Mobile (375px wide): tab bar horizontally scrollable, both tabs accessible
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeCard,
  makeUrgentCard,
  makePromoCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { URGENT_CARDS } from "../helpers/seed-data";

// ════════════════════════════════════════════════════════════════════════════
// Setup helpers
// ════════════════════════════════════════════════════════════════════════════

async function setup(
  page: Parameters<typeof clearAllStorage>[0],
  cards: Parameters<typeof seedCards>[2]
) {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  await page.reload({ waitUntil: "networkidle" });
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Tab bar visible when cards exist
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Tab bar visible with cards", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("tab bar renders with 'The Howl' and 'Active' tabs when cards exist", async ({
    page,
  }) => {
    await setup(page, [makeCard({ cardName: "Some Card" })]);

    const tabList = page.locator('[role="tablist"][aria-label="Card dashboard tabs"]');
    await expect(tabList).toBeVisible();

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await expect(howlTab).toBeVisible();
    await expect(activeTab).toBeVisible();
  });

  test("'The Howl' tab contains ᚲ Kenaz rune", async ({ page }) => {
    await setup(page, [makeUrgentCard({ cardName: "Urgent Test Card" })]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toContainText("ᚲ");
  });

  test("'The Howl' tab contains 'The Howl' label", async ({ page }) => {
    await setup(page, [makeUrgentCard({ cardName: "Urgent Test Card" })]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toContainText("The Howl");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Default tab selection
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Default tab selection", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("The Howl tab is default (aria-selected=true) when urgent cards exist", async ({
    page,
  }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Urgent Card" }),
      makeCard({ cardName: "Active Card" }),
    ]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toHaveAttribute("aria-selected", "true");

    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await expect(activeTab).toHaveAttribute("aria-selected", "false");
  });

  test("Active tab is default (aria-selected=true) when no urgent cards exist", async ({
    page,
  }) => {
    await setup(page, [
      makeCard({ cardName: "Active Card A" }),
      makeCard({ cardName: "Active Card B" }),
    ]);

    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await expect(activeTab).toHaveAttribute("aria-selected", "true");

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toHaveAttribute("aria-selected", "false");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Cards appear in correct tab (no duplication)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Card categorization", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("fee_approaching card appears in The Howl tab panel", async ({ page }) => {
    await setup(page, [makeUrgentCard({ cardName: "Fee Due Card" })]);

    // The Howl tab should be active by default (has urgent cards)
    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");
    await expect(howlPanel).toContainText("Fee Due Card");
  });

  test("promo_expiring card appears in The Howl tab panel", async ({ page }) => {
    await setup(page, [makePromoCard({ cardName: "Promo Expiring Card" })]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");
    await expect(howlPanel).toContainText("Promo Expiring Card");
  });

  test("active card appears in Active tab panel (not in Howl panel)", async ({ page }) => {
    await setup(page, [
      makeCard({ cardName: "Calm Active Card" }),
    ]);

    // No urgent cards → Active tab is default
    const activePanel = page.locator('[role="tabpanel"][id="panel-active"]');
    await expect(activePanel).not.toHaveAttribute("hidden");
    await expect(activePanel).toContainText("Calm Active Card");

    // Switch to Howl tab — active card should NOT be there
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await howlTab.click();
    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    const howlText = await howlPanel.textContent();
    expect(howlText).not.toContain("Calm Active Card");
  });

  test("mixed cards: fee_approaching in Howl, active in Active — no duplication", async ({
    page,
  }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Urgent Fee Card" }),
      makeCard({ cardName: "Normal Active Card" }),
    ]);

    // Howl tab is default (has urgent cards)
    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");
    await expect(howlPanel).toContainText("Urgent Fee Card");

    // Urgent card should NOT appear in Howl panel text as the Active card
    const howlText = await howlPanel.textContent();
    expect(howlText).not.toContain("Normal Active Card");

    // Switch to Active tab
    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await activeTab.click();
    const activePanel = page.locator('[role="tabpanel"][id="panel-active"]');
    const activeText = await activePanel.textContent();
    expect(activeText).toContain("Normal Active Card");
    expect(activeText).not.toContain("Urgent Fee Card");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Urgency bars in The Howl tab
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Urgency bars in Howl tab", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("cards in The Howl tab display urgency bars", async ({ page }) => {
    await setup(page, [makeUrgentCard({ cardName: "Urgent With Bar" })]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");

    // Urgency bar has data-testid="urgency-bar"
    const urgencyBar = howlPanel.locator('[data-testid="urgency-bar"]').first();
    await expect(urgencyBar).toBeVisible();
  });

  test("active cards in Active tab do NOT display urgency bars", async ({ page }) => {
    await setup(page, [makeCard({ cardName: "Normal Card" })]);

    // Switch to Active tab (which is default here)
    const activePanel = page.locator('[role="tabpanel"][id="panel-active"]');
    await expect(activePanel).not.toHaveAttribute("hidden");

    const urgencyBars = activePanel.locator('[data-testid="urgency-bar"]');
    await expect(urgencyBars).toHaveCount(0);
  });

  test("urgency bar shows 'FEE APPROACHING' label for fee_approaching cards", async ({
    page,
  }) => {
    await setup(page, [makeUrgentCard({ cardName: "Fee Bar Card" })]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    const urgencyBar = howlPanel.locator('[data-testid="urgency-bar"]').first();
    await expect(urgencyBar).toContainText("FEE APPROACHING");
  });

  test("urgency bar shows 'PROMO EXPIRING' label for promo_expiring cards", async ({
    page,
  }) => {
    await setup(page, [makePromoCard({ cardName: "Promo Bar Card" })]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    const urgencyBar = howlPanel.locator('[data-testid="urgency-bar"]').first();
    await expect(urgencyBar).toContainText("PROMO EXPIRING");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Tab badge counts
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Badge counts", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Howl tab badge shows count of urgent cards", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Fee A" }),
      makePromoCard({ cardName: "Promo B" }),
    ]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    // Badge is the span inside the tab with aria-label like "2 cards"
    const badge = howlTab.locator('span[aria-label*="cards"], span[aria-label*="card"]').first();
    await expect(badge).toContainText("2");
  });

  test("Active tab badge shows count of non-urgent cards", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Urgent One" }),
      makeCard({ cardName: "Active A" }),
      makeCard({ cardName: "Active B" }),
    ]);

    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    const badge = activeTab.locator('span[aria-label*="cards"], span[aria-label*="card"]').first();
    await expect(badge).toContainText("2");
  });

  test("Howl badge shows 0 at reduced opacity when no urgent cards", async ({ page }) => {
    await setup(page, [makeCard({ cardName: "Calm Card" })]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const badge = howlTab.locator('span').filter({ hasText: "0" }).first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("0");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Tab switching
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Tab switching", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("clicking Active tab switches panel content", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Urgent Card" }),
      makeCard({ cardName: "Calm Card" }),
    ]);

    // Howl tab is default
    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");

    // Click Active tab
    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await activeTab.click();

    // Active panel should now be visible, Calm Card visible
    const activePanel = page.locator('[role="tabpanel"][id="panel-active"]');
    await expect(activePanel).not.toHaveAttribute("hidden");
    await expect(activePanel).toContainText("Calm Card");

    // Howl panel should now be hidden
    await expect(howlPanel).toHaveAttribute("hidden", "");
  });

  test("clicking back to Howl tab restores Howl panel", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Urgent Card" }),
      makeCard({ cardName: "Calm Card" }),
    ]);

    // Click Active tab
    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await activeTab.click();

    // Click Howl tab
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await howlTab.click();

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");
    await expect(howlPanel).toContainText("Urgent Card");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Empty states
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Empty states", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Howl tab shows empty state ('The wolf is silent.') when no urgent cards and user clicks it", async ({
    page,
  }) => {
    await setup(page, [makeCard({ cardName: "Calm Only" })]);

    // Active tab is default (no urgent cards). Click The Howl tab to see empty state.
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await howlTab.click();

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");
    await expect(howlPanel).toContainText("The wolf is silent.");
  });

  test("Ragnarök mode: Howl tab shows 'Ragnarök Approaches' when ≥5 urgent cards", async ({
    page,
  }) => {
    // URGENT_CARDS has 5 cards → triggers Ragnarök threshold
    await setup(page, URGENT_CARDS);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toContainText("Ragnarök Approaches");
    await expect(howlTab).toContainText("ᚲ");
  });

  test("The old HowlPanel aside is NOT present in the DOM", async ({ page }) => {
    await setup(page, [makeUrgentCard({ cardName: "Some Urgent Card" })]);

    // Spec: HowlPanel sidebar has been replaced by tab bar.
    // The aside with aria-label="Urgent deadlines" must NOT exist.
    const oldPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(oldPanel).not.toBeAttached();
  });

  test("mobile bell button for Howl is NOT present (replaced by tab bar)", async ({
    page,
  }) => {
    await setup(page, [makeUrgentCard({ cardName: "Urgent Card" })]);

    // Spec: mobile bell button was removed — tabs replace the bottom drawer.
    const bellButton = page.locator('button[aria-label*="urgent card"]');
    await expect(bellButton).not.toBeAttached();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Sort order in Howl tab
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Sort order in Howl tab", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("card with fewer days remaining appears above card with more days remaining in Howl tab", async ({
    page,
  }) => {
    // Build two urgent cards with clearly different deadlines:
    //   Card A: 10 days (more urgent) — should appear FIRST
    //   Card B: 45 days (less urgent) — should appear SECOND
    // Spec: toUrgentRows sorts ascending by daysRemaining
    const urgentInTenDays = makeUrgentCard({
      cardName: "Urgent In Ten Days",
      annualFeeDate: new Date(
        Date.now() + 10 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
    const urgentInFortyFiveDays = makeUrgentCard({
      cardName: "Urgent In Forty Five Days",
      annualFeeDate: new Date(
        Date.now() + 45 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });

    await setup(page, [urgentInFortyFiveDays, urgentInTenDays]); // seeded in reverse order

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");

    const firstCardName = howlPanel.locator('text=Urgent In Ten Days').first();
    const secondCardName = howlPanel.locator('text=Urgent In Forty Five Days').first();

    await expect(firstCardName).toBeVisible();
    await expect(secondCardName).toBeVisible();

    const firstBox = await firstCardName.boundingBox();
    const secondBox = await secondCardName.boundingBox();

    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();

    // The 10-day card (more urgent) must appear above the 45-day card
    expect(firstBox!.y).toBeLessThan(secondBox!.y);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Mobile tab bar
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Mobile (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("tab bar is visible on mobile when cards exist", async ({ page }) => {
    await setup(page, [makeUrgentCard({ cardName: "Mobile Urgent Card" })]);

    const tabList = page.locator('[role="tablist"][aria-label="Card dashboard tabs"]');
    await expect(tabList).toBeVisible();
  });

  test("both tabs are accessible on mobile", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Mobile Urgent" }),
      makeCard({ cardName: "Mobile Active" }),
    ]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await expect(howlTab).toBeVisible();
    await expect(activeTab).toBeVisible();
  });

  test("The Howl tab is default on mobile when urgent cards exist", async ({ page }) => {
    await setup(page, [makeUrgentCard({ cardName: "Mobile Fee Card" })]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toHaveAttribute("aria-selected", "true");
  });

  test("cards in Howl tab show urgency bars on mobile", async ({ page }) => {
    await setup(page, [makeUrgentCard({ cardName: "Mobile Urgent Card" })]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");
    const urgencyBar = howlPanel.locator('[data-testid="urgency-bar"]').first();
    await expect(urgencyBar).toBeVisible();
  });
});
