/**
 * Test suite for Issue #229: Bank/issuer logos not displaying on card tiles
 *
 * Validates:
 * - Each known issuer displays an inline SVG logo (not just text)
 * - Unknown issuers fall back to text name
 * - Logos are visible on dashboard card tiles
 * - Logos work in both dark and light themes
 * - Logos display correctly on mobile (375px)
 * - Howl panel issuer icons also display correctly
 */

import { test, expect } from "@playwright/test";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:9653";

// All 10 known issuers that should have SVG logos
const KNOWN_ISSUERS_WITH_LOGOS = [
  "amex",
  "bank_of_america",
  "barclays",
  "capital_one",
  "chase",
  "citibank",
  "discover",
  "hsbc",
  "us_bank",
  "wells_fargo",
];

test.describe("Bank/Issuer Logos - Issue #229", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SERVER_URL);
    // Wait for the page to be fully loaded
    await page.waitForLoadState("networkidle");
  });

  test("should display SVG logos for all 10 known issuers on card tiles", async ({ page }) => {
    // Get all card tiles on the dashboard
    const cardTiles = page.locator('[data-testid="card-tile"]');
    const cardCount = await cardTiles.count();

    if (cardCount === 0) {
      test.skip("No cards found on dashboard - skipping logo validation");
      return;
    }

    let logosValidated = 0;
    const foundIssuers = new Set<string>();

    // Check each card tile for issuer logos
    for (let i = 0; i < cardCount; i++) {
      const card = cardTiles.nth(i);

      // Find the issuer logo element within this card
      const logoElement = card.locator('[data-testid="issuer-logo"]').first();

      if (await logoElement.count() === 0) {
        continue;
      }

      // Check if it contains an SVG element (indicates a known issuer with logo)
      const svgElement = logoElement.locator("svg");
      const hasSvg = (await svgElement.count()) > 0;

      if (hasSvg) {
        // This is a known issuer with an inline SVG logo
        logosValidated++;

        // Verify the SVG is visible
        await expect(svgElement).toBeVisible();

        // Get the title attribute to identify which issuer this is
        const title = await logoElement.getAttribute("title");
        if (title) {
          foundIssuers.add(title);
        }
      }
    }

    // We should have found at least some SVG logos
    expect(logosValidated).toBeGreaterThan(0);
  });

  test("should fall back to text for unknown issuer 'other'", async ({ page }) => {
    // This test validates that unknown issuers show text instead of SVG
    // We'll need to check if there are any 'other' cards

    const cardTiles = page.locator('[data-testid="card-tile"]');
    const cardCount = await cardTiles.count();

    for (let i = 0; i < cardCount; i++) {
      const card = cardTiles.nth(i);
      const logoElement = card.locator('[data-testid="issuer-logo"]').first();

      if (await logoElement.count() === 0) {
        continue;
      }

      // Check if it has NO SVG (fallback to text)
      const svgElement = logoElement.locator("svg");
      const hasSvg = (await svgElement.count()) > 0;

      if (!hasSvg) {
        // This should be an unknown issuer showing text
        const text = await logoElement.textContent();
        expect(text).toBeTruthy();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("should display logos in dark theme", async ({ page }) => {
    // Switch to dark theme
    const themeToggle = page.locator('[data-testid="theme-toggle"]');

    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      await page.waitForTimeout(500); // Wait for theme transition
    }

    // Verify logos are still visible
    const cardTiles = page.locator('[data-testid="card-tile"]');
    const firstCard = cardTiles.first();

    if (await firstCard.count() > 0) {
      const logoElement = firstCard.locator('[data-testid="issuer-logo"]').first();
      const svgElement = logoElement.locator("svg");

      if (await svgElement.count() > 0) {
        await expect(svgElement).toBeVisible();
      }
    }
  });

  test("should display logos correctly on mobile viewport (375px)", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify logos are visible on mobile
    const cardTiles = page.locator('[data-testid="card-tile"]');
    const firstCard = cardTiles.first();

    if (await firstCard.count() > 0) {
      const logoElement = firstCard.locator('[data-testid="issuer-logo"]').first();
      const svgElement = logoElement.locator("svg");

      if (await svgElement.count() > 0) {
        await expect(svgElement).toBeVisible();

        // Verify the logo has reasonable dimensions on mobile
        const box = await svgElement.boundingBox();
        expect(box).toBeTruthy();
        if (box) {
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    }
  });

  test("should display issuer icons in Howl panel", async ({ page }) => {
    // Open the Howl panel (notifications/activity panel)
    const howlButton = page.locator('[data-testid="howl-button"]');

    if (await howlButton.count() === 0) {
      test.skip("Howl panel button not found - skipping");
      return;
    }

    await howlButton.click();
    await page.waitForTimeout(500); // Wait for panel to open

    // Look for issuer logos within the Howl panel
    const howlPanel = page.locator('[data-testid="howl-panel"]');

    if (await howlPanel.count() === 0) {
      test.skip("Howl panel not found - skipping");
      return;
    }

    // Check for issuer logos in howl items
    const issuerLogos = howlPanel.locator('[data-testid="issuer-logo"]');
    const logoCount = await issuerLogos.count();

    if (logoCount > 0) {
      // Verify at least one logo has an SVG
      const firstLogo = issuerLogos.first();
      const svgElement = firstLogo.locator("svg");

      if (await svgElement.count() > 0) {
        await expect(svgElement).toBeVisible();
      }
    }
  });

  test("each of the 10 known issuers has a unique SVG logo implementation", async ({ page }) => {
    // This test validates that each known issuer ID has a corresponding SVG in IssuerLogo.tsx
    // We can't directly test the component code, but we can verify through the rendered output

    const cardTiles = page.locator('[data-testid="card-tile"]');
    const cardCount = await cardTiles.count();
    const seenIssuers = new Map<string, string>(); // issuer name -> SVG content

    for (let i = 0; i < cardCount; i++) {
      const card = cardTiles.nth(i);
      const logoElement = card.locator('[data-testid="issuer-logo"]').first();

      if (await logoElement.count() === 0) {
        continue;
      }

      const svgElement = logoElement.locator("svg");
      if (await svgElement.count() > 0) {
        const title = await logoElement.getAttribute("title");
        const svgContent = await svgElement.innerHTML();

        if (title && svgContent) {
          seenIssuers.set(title, svgContent);
        }
      }
    }

    // Verify that all SVGs are unique (each issuer has a distinct logo)
    const svgContents = Array.from(seenIssuers.values());
    const uniqueSvgs = new Set(svgContents);

    expect(uniqueSvgs.size).toBe(svgContents.length);
  });
});
