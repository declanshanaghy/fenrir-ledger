import { test, expect } from "@playwright/test";
import { seedCards } from "../../support/seed-cards";
import { createUser } from "../../support/create-user";
import { signIn } from "../../support/sign-in";

test.describe("Card count subtitle removal (#450)", () => {
  test.beforeEach(async ({ page }) => {
    // Create a test user and sign in
    const user = await createUser();
    await signIn(page, user);
  });

  test("should NOT display card count subtitle on dashboard", async ({
    page,
  }) => {
    // Seed some cards
    await seedCards(5);

    // Navigate to dashboard
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Check that the card count subtitle is NOT visible
    // The old subtitle had text like "5 cards" or "N cards"
    const cardCountPattern = /^\d+\s+cards?$/;
    const subtitleElements = await page.locator("div.text-muted-foreground")
      .all();

    for (const element of subtitleElements) {
      const text = await element.textContent();
      expect(text).not.toMatch(cardCountPattern);
    }

    // Verify no "needs attention" subtitle either
    const needsAttentionText = await page
      .locator('text=/need.*attention/')
      .count();
    expect(needsAttentionText).toBe(0);
  });

  test("should still display card counts in tab bar", async ({ page }) => {
    // Seed cards in different states
    await seedCards(3); // Defaults to "active" status

    // Navigate to dashboard
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Verify tab bar shows count badges
    // The "All" tab should show a count
    const allTabCount = await page
      .locator('button[role="tab"]')
      .filter({ hasText: /All/ })
      .locator("text=/\\d+/")
      .count();

    expect(allTabCount).toBeGreaterThan(0);
  });

  test("should handle empty state correctly (0 cards)", async ({ page }) => {
    // Create user with no cards (don't seed any)

    // Navigate to dashboard
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Verify no card count subtitle appears even in empty state
    const cardCountPattern = /^\d+\s+cards?$/;
    const subtitleElements = await page.locator("div.text-muted-foreground")
      .all();

    for (const element of subtitleElements) {
      const text = await element.textContent();
      if (text) {
        expect(text).not.toMatch(cardCountPattern);
      }
    }
  });
});
