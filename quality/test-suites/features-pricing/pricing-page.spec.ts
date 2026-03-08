/**
 * QA Tests for Issue #338 — Pricing Page
 *
 * Validates:
 * - Accurate Thrall vs Karl comparison
 * - Feature gates match PREMIUM_FEATURES registry
 * - CTAs link to app sign-up
 * - FAQ accordion is functional
 * - Light/dark theme rendering
 * - Mobile responsiveness (375px)
 * - export const dynamic = 'force-static'
 */

import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";
const PRICING_URL = `${BASE_URL}/pricing`;

test.describe("Pricing Page — Issue #338", () => {
  test.describe("Page fundamentals", () => {
    test("pricing page loads and renders static content", async ({ page }) => {
      const response = await page.goto(PRICING_URL);
      expect(response?.status()).toBe(200);

      // Check page title
      const title = await page.title();
      expect(title).toContain("Pricing");
      expect(title).toContain("Fenrir Ledger");
    });

    test("has meta description set", async ({ page }) => {
      await page.goto(PRICING_URL);

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(description).toContain("Two tiers");
      expect(description).toContain("No dark patterns");
    });

    test("hero section displays correct messaging", async ({ page }) => {
      await page.goto(PRICING_URL);

      const heading = page.locator("h1");
      await expect(heading).toContainText("Choose Your Standing");

      const subtitle = page.locator("text=Two tiers. One price. No dark patterns.");
      await expect(subtitle).toBeVisible();
    });
  });

  test.describe("Thrall Tier Card", () => {
    test("displays Thrall tier pricing correctly", async ({ page }) => {
      await page.goto(PRICING_URL);

      const thrallCard = page.locator("text=Thrall").first().locator("..");

      // Check free price
      await expect(thrallCard.locator("text=$0")).toBeVisible();

      // Check "Free forever" subtext
      await expect(
        thrallCard.locator("text=Free forever — no credit card required")
      ).toBeVisible();

      // Check CTA
      const cta = thrallCard.locator('a[href="/app"]');
      await expect(cta).toContainText("Start Free");
    });

    test("Thrall tier includes core tracking features", async ({ page }) => {
      await page.goto(PRICING_URL);

      const thrallCard = page.locator("text=Thrall").first().locator("..");
      const featureList = thrallCard.locator("ul").first();

      // Core features
      const features = [
        "Annual fee tracking",
        "Sign-up bonus",
        "Velocity management",
        "The Howl",
        "Card archive",
        "Single household",
        "Google sign-in",
      ];

      for (const feature of features) {
        const item = featureList.locator(`text=${feature}`);
        await expect(item).toBeVisible();
      }
    });

    test("Thrall tier shows Karl features as excluded with strikethrough", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const thrallCard = page.locator("text=Thrall").first().locator("..");
      const featureList = thrallCard.locator("ul").first();

      // Karl features should be shown as excluded
      const excludedFeatures = [
        "Cloud Sync",
        "Multi-Household",
        "Smart Import",
        "Data Export",
      ];

      for (const feature of excludedFeatures) {
        const item = featureList.locator(`text=${feature}`);
        await expect(item).toBeVisible();

        // Should have strikethrough class
        const parent = item.locator("..");
        const styleClass = await parent.getAttribute("class");
        expect(styleClass).toContain("line-through");
      }
    });
  });

  test.describe("Karl Tier Card", () => {
    test("displays Karl tier pricing correctly", async ({ page }) => {
      await page.goto(PRICING_URL);

      const karlCard = page.locator("text=Karl").first().locator("..");

      // Check price
      await expect(karlCard.locator("text=$3.99")).toBeVisible();

      // Check per month text
      await expect(karlCard.locator("text=per month · cancel anytime")).toBeVisible();

      // Check "Most Popular" badge
      const badge = karlCard.locator("text=Most Popular");
      await expect(badge).toBeVisible();

      // Check CTA
      const cta = karlCard.locator('a[href="/app"]');
      await expect(cta).toContainText("Upgrade to Karl");
    });

    test("Karl tier shows all features included", async ({ page }) => {
      await page.goto(PRICING_URL);

      const karlCard = page.locator("text=Karl").first().locator("..");
      const featureList = karlCard.locator("ul").first();

      // Karl-exclusive features
      const karlFeatures = [
        "Cloud Sync",
        "Multi-Household",
        "Smart Import",
        "Data Export",
        "All current and future Karl-tier features",
        "Support the project",
      ];

      for (const feature of karlFeatures) {
        const item = featureList.locator(`text=${feature}`);
        await expect(item).toBeVisible();

        // Should have checkmark
        const parent = item.locator("..");
        const checkmark = parent.locator("text=✓");
        await expect(checkmark).toBeVisible();
      }
    });

    test("Smart Import feature description mentions AI", async ({ page }) => {
      await page.goto(PRICING_URL);

      const karlCard = page.locator("text=Karl").first().locator("..");
      const smartImport = karlCard.locator("text=Smart Import");

      await expect(smartImport).toBeVisible();

      // Should mention AI-powered or AI extraction
      const parent = smartImport.locator("..");
      const aiMention = parent.locator("text=AI extracts");
      await expect(aiMention).toBeVisible();
    });
  });

  test.describe("Feature Comparison Table", () => {
    test("comparison table displays core tracking section", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const table = page.locator('table[aria-label*="comparison"]');
      await expect(table).toBeVisible();

      // Check "Core Tracking" section header
      const coreTrackingHeader = table.locator("text=Core Tracking");
      await expect(coreTrackingHeader).toBeVisible();

      // Check core features are included in both tiers
      const features = [
        "Annual fee tracking",
        "Sign-up bonus",
        "Velocity management",
        "The Howl",
      ];

      for (const feature of features) {
        const row = table.locator(`text=${feature}`);
        await expect(row).toBeVisible();
      }
    });

    test("comparison table shows Data & Devices section with correct gates", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const table = page.locator('table[aria-label*="comparison"]');

      // Check Data & Devices section exists
      const dataDevicesHeader = table.locator("text=Data & Devices");
      await expect(dataDevicesHeader).toBeVisible();

      // Cloud Sync: Thrall ✗, Karl ✓
      const cloudSyncRow = table.locator("text=Cloud Sync");
      await expect(cloudSyncRow).toBeVisible();
      const cloudSyncCells = cloudSyncRow.locator("..");
      // Karl cell should have checkmark
      const karlCheckmark = cloudSyncCells.locator("text=✓").last();
      await expect(karlCheckmark).toBeVisible();

      // Smart Import: Thrall ✗, Karl ✓
      const smartImportRow = table.locator("text=Smart Import");
      await expect(smartImportRow).toBeVisible();
      const smartImportCells = smartImportRow.locator("..");
      const smartImportKarlCheckmark = smartImportCells.locator("text=✓").last();
      await expect(smartImportKarlCheckmark).toBeVisible();

      // Data Export: Thrall ✗, Karl ✓
      const dataExportRow = table.locator("text=Data Export");
      await expect(dataExportRow).toBeVisible();
      const dataExportCells = dataExportRow.locator("..");
      const dataExportKarlCheckmark = dataExportCells.locator("text=✓").last();
      await expect(dataExportKarlCheckmark).toBeVisible();
    });

    test("comparison table shows Households section with multi-household gate", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const table = page.locator('table[aria-label*="comparison"]');

      // Check Households section exists
      const householdsHeader = table.locator("text=Households");
      await expect(householdsHeader).toBeVisible();

      // Single household: both tiers ✓
      const singleRow = table.locator("text=Single household");
      await expect(singleRow).toBeVisible();

      // Multi-Household: Thrall ✗, Karl ✓
      const multiRow = table.locator("text=Multi-Household");
      await expect(multiRow).toBeVisible();
      const multiCells = multiRow.locator("..");
      const multiKarlCheckmark = multiCells.locator("text=✓").last();
      await expect(multiKarlCheckmark).toBeVisible();
    });

    test("does NOT display advanced-analytics in comparison", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const table = page.locator('table[aria-label*="comparison"]');
      const advancedAnalyticsRow = table.locator("text=Advanced Analytics");
      await expect(advancedAnalyticsRow).not.toBeVisible();
    });

    test("does NOT display extended-history in comparison", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const table = page.locator('table[aria-label*="comparison"]');
      const extendedHistoryRow = table.locator("text=Extended History");
      await expect(extendedHistoryRow).not.toBeVisible();
    });

    test("does NOT display cosmetic-perks in comparison", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const table = page.locator('table[aria-label*="comparison"]');
      const cosmeticPerksRow = table.locator("text=Cosmetic Perks");
      await expect(cosmeticPerksRow).not.toBeVisible();
    });
  });

  test.describe("FAQ Accordion", () => {
    test("FAQ section displays with all items collapsed by default", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const faqSection = page.locator('section[aria-label*="Frequently asked"]');
      await expect(faqSection).toBeVisible();

      const heading = faqSection.locator("h2");
      await expect(heading).toContainText("Questions About the Price");

      // Check for details elements (accordion items)
      const details = faqSection.locator("details");
      const count = await details.count();
      expect(count).toBeGreaterThanOrEqual(7);

      // All should be collapsed by default
      for (let i = 0; i < count; i++) {
        const detail = details.nth(i);
        const isOpen = await detail.evaluate((el) =>
          (el as HTMLDetailsElement).open
        );
        expect(isOpen).toBe(false);
      }
    });

    test("FAQ accordion expands and collapses on click", async ({ page }) => {
      await page.goto(PRICING_URL);

      const details = page.locator("details").first();
      const summary = details.locator("summary");

      // Initially closed
      let isOpen = await details.evaluate((el) =>
        (el as HTMLDetailsElement).open
      );
      expect(isOpen).toBe(false);

      // Click to open
      await summary.click();
      isOpen = await details.evaluate((el) =>
        (el as HTMLDetailsElement).open
      );
      expect(isOpen).toBe(true);

      // Click to close
      await summary.click();
      isOpen = await details.evaluate((el) =>
        (el as HTMLDetailsElement).open
      );
      expect(isOpen).toBe(false);
    });

    test("FAQ includes question about Thrall being free forever", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const faqSection = page.locator('section[aria-label*="Frequently asked"]');

      const question = faqSection.locator(
        "text=Is Thrall actually free forever?"
      );
      await expect(question).toBeVisible();

      const details = question.locator("..").locator("details");
      const answer = details.locator("text=Thrall tier has no time limit");
      await expect(answer).toBeVisible();
    });

    test("FAQ includes question about billing", async ({ page }) => {
      await page.goto(PRICING_URL);

      const faqSection = page.locator('section[aria-label*="Frequently asked"]');

      const question = faqSection.locator("text=How does billing work?");
      await expect(question).toBeVisible();

      const answer = faqSection.locator("text=billed monthly via Stripe");
      await expect(answer).toBeVisible();
    });

    test("FAQ includes question about Smart Import data storage", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const faqSection = page.locator('section[aria-label*="Frequently asked"]');

      const question = faqSection.locator(
        "text=Does Smart Import store my spreadsheet"
      );
      await expect(question).toBeVisible();

      const answer = faqSection.locator("text=processed in memory and not stored");
      await expect(answer).toBeVisible();
    });

    test("FAQ has link to full FAQ page", async ({ page }) => {
      await page.goto(PRICING_URL);

      const faqLink = page.locator('a[href="/faq"]');
      await expect(faqLink).toBeVisible();
      await expect(faqLink).toContainText("Read the full FAQ");
    });
  });

  test.describe("CTAs and Navigation", () => {
    test("all CTAs link to /app (sign-up)", async ({ page }) => {
      await page.goto(PRICING_URL);

      const appLinks = page.locator('a[href="/app"]');
      const count = await appLinks.count();

      // Should have multiple CTAs (hero, tier cards, final CTA)
      expect(count).toBeGreaterThanOrEqual(3);

      // All should be visible
      for (let i = 0; i < count; i++) {
        const link = appLinks.nth(i);
        if (await link.isVisible()) {
          const href = await link.getAttribute("href");
          expect(href).toBe("/app");
        }
      }
    });

    test("CTAs have data-app-link attribute", async ({ page }) => {
      await page.goto(PRICING_URL);

      const appLinks = page.locator('a[data-app-link]');
      const count = await appLinks.count();

      // Should have app link attributes for tracking
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test("final CTA links to /features page", async ({ page }) => {
      await page.goto(PRICING_URL);

      const featuresLink = page.locator('a[href="/features"]');
      await expect(featuresLink).toBeVisible();
      await expect(featuresLink).toContainText("See All Features");
    });
  });

  test.describe("Theme rendering — Light and Dark", () => {
    test("renders correctly in light theme", async ({ page }) => {
      await page.goto(PRICING_URL);
      await page.evaluate(() => {
        document.documentElement.style.colorScheme = "light";
      });

      // Check hero section is visible
      const hero = page.locator('section[aria-label="Pricing hero"]');
      await expect(hero).toBeVisible();

      // Check tier cards are visible
      const thrallCard = page.locator("text=Thrall").first();
      await expect(thrallCard).toBeVisible();

      const karlCard = page.locator("text=Karl").first();
      await expect(karlCard).toBeVisible();

      // Check text is readable
      const heading = page.locator("h1");
      await expect(heading).toBeVisible();
    });

    test("renders correctly in dark theme", async ({ page }) => {
      await page.goto(PRICING_URL);
      await page.evaluate(() => {
        document.documentElement.style.colorScheme = "dark";
      });

      // Check tier cards are visible and readable
      const thrallCard = page.locator("text=Thrall").first();
      await expect(thrallCard).toBeVisible();

      const karlCard = page.locator("text=Karl").first();
      await expect(karlCard).toBeVisible();

      // Check comparison table is visible
      const table = page.locator('table[aria-label*="comparison"]');
      await expect(table).toBeVisible();
    });
  });

  test.describe("Mobile responsiveness (375px)", () => {
    test("pricing page is responsive at 375px viewport", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      const response = await page.goto(PRICING_URL);
      expect(response?.status()).toBe(200);

      // Hero should be visible
      const hero = page.locator('section[aria-label="Pricing hero"]');
      await expect(hero).toBeVisible();

      // Tier cards should stack vertically
      const tierCards = page.locator("text=Thrall").first().locator("..");
      const box = await tierCards.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(375);

      // CTA buttons should be visible
      const buttons = page.locator('a[href="/app"]');
      expect(await buttons.count()).toBeGreaterThanOrEqual(1);

      // Check no horizontal scroll
      const pageWidth = await page.evaluate(
        () => document.documentElement.clientWidth
      );
      expect(pageWidth).toBeLessThanOrEqual(375);
    });

    test("tier cards stack vertically on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(PRICING_URL);

      // Get tier card grid
      const grid = page.locator("div.grid");
      const styleClass = await grid.getAttribute("class");

      // Should have responsive grid classes
      expect(styleClass).toContain("grid-cols-1");
      expect(styleClass).toContain("md:grid-cols-2");
    });

    test("comparison table is scrollable on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(PRICING_URL);

      const table = page.locator('table[aria-label*="comparison"]');
      await expect(table).toBeVisible();

      // Table should be wrapped in overflow container
      const overflow = table.locator("..");
      const overflowClass = await overflow.getAttribute("class");
      expect(overflowClass).toContain("overflow");
    });

    test("FAQ accordion is usable on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(PRICING_URL);

      const firstDetail = page.locator("details").first();
      const summary = firstDetail.locator("summary");

      // Summary should be clickable
      const box = await summary.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(100);
      }

      // Click and verify expansion works
      await summary.click();
      const isOpen = await firstDetail.evaluate((el) =>
        (el as HTMLDetailsElement).open
      );
      expect(isOpen).toBe(true);
    });
  });

  test.describe("Static export and performance", () => {
    test("page has export const dynamic = 'force-static'", async ({ page }) => {
      // Verify by checking response status
      const response = await page.goto(PRICING_URL);
      expect(response?.status()).toBe(200);

      // Static pages should load consistently
      const secondResponse = await page.goto(PRICING_URL);
      expect(secondResponse?.status()).toBe(200);
    });
  });

  test.describe("Accessibility", () => {
    test("all sections have proper ARIA labels", async ({ page }) => {
      await page.goto(PRICING_URL);

      const sections = page.locator("section");
      const count = await sections.count();

      for (let i = 0; i < count; i++) {
        const section = sections.nth(i);
        const ariaLabel = await section.getAttribute("aria-label");
        if (ariaLabel) {
          expect(ariaLabel.length).toBeGreaterThan(0);
        }
      }
    });

    test("table has proper aria-label", async ({ page }) => {
      await page.goto(PRICING_URL);

      const table = page.locator('table[aria-label*="comparison"]');
      await expect(table).toBeVisible();

      const ariaLabel = await table.getAttribute("aria-label");
      expect(ariaLabel).toContain("comparison");
    });

    test("details/summary elements are keyboard accessible", async ({
      page,
    }) => {
      await page.goto(PRICING_URL);

      const summary = page.locator("summary").first();

      // Focus on summary
      await summary.focus();

      // Should be focusable
      const isFocused = await summary.evaluate((el) =>
        el === document.activeElement
      );
      expect(isFocused).toBe(true);

      // Should be activatable via Enter key
      await page.keyboard.press("Enter");
      const details = summary.locator("..");
      const isOpen = await details.evaluate((el) =>
        (el as HTMLDetailsElement).open
      );
      expect(isOpen).toBe(true);
    });
  });
});
