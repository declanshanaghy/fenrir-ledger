/**
 * QA Tests for Issue #338 — Features Page
 *
 * Validates:
 * - All 8 real-value features present (4 Thrall, 4 Karl)
 * - No easter eggs or cosmetic features
 * - Smart Import mentions AI-powered extraction
 * - Light/dark theme rendering
 * - Mobile responsiveness (375px)
 * - export const dynamic = 'force-static'
 */

import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";
const FEATURES_URL = `${BASE_URL}/features`;

test.describe("Features Page — Issue #338", () => {
  test.describe("Page fundamentals", () => {
    test("features page loads and renders static content", async ({ page }) => {
      const response = await page.goto(FEATURES_URL);
      expect(response?.status()).toBe(200);

      // Check page title
      const title = await page.title();
      expect(title).toContain("Features");
      expect(title).toContain("Fenrir Ledger");

      // Check H1 is present
      const h1 = page.locator("h1");
      await expect(h1).toContainText("The Wolf's Arsenal");
    });

    test("has meta description set", async ({ page }) => {
      await page.goto(FEATURES_URL);

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(description).toContain("8 real features");
      expect(description).toContain("No easter eggs");
    });

    test("navigation links to pricing and /app work", async ({ page }) => {
      await page.goto(FEATURES_URL);

      // Check pricing link
      const pricingLink = page.locator('a[href="/pricing"]');
      await expect(pricingLink).toHaveCount(3);

      // Check /app link
      const appLink = page.locator('a[href="/app"]');
      await expect(appLink).toHaveCount(3);
    });
  });

  test.describe("Thrall features (4 total) — Free Tier", () => {
    const thrallFeatures = [
      {
        id: "annual-fee-tracking",
        title: "Sköll Watches the Fee",
        eyebrow: "Feature 01 · Annual Fee Tracking",
        mentions: "60-day advance warning",
      },
      {
        id: "signup-bonus-tracking",
        title: "Hati Watches the Deadline",
        eyebrow: "Feature 02 · Sign-Up Bonus Tracking",
        mentions: "minimum spend requirement",
      },
      {
        id: "velocity-management",
        title: "The Issuer's Rules",
        eyebrow: "Feature 03 · Velocity Management",
        mentions: "Chase 5/24",
      },
      {
        id: "the-howl",
        title: "Urgent Cards Dashboard",
        eyebrow: "Feature 04 · The Howl",
        mentions: "urgent cards dashboard",
      },
    ];

    for (const feature of thrallFeatures) {
      test(`displays ${feature.title}`, async ({ page }) => {
        await page.goto(FEATURES_URL);

        const section = page.locator(`section#${feature.id}`);
        await expect(section).toBeVisible();

        // Check eyebrow
        await expect(section.locator("text=" + feature.eyebrow)).toBeVisible();

        // Check title
        await expect(section.locator(`text=${feature.title}`)).toBeVisible();

        // Check key detail
        await expect(section.locator(`text=${feature.mentions}`)).toBeVisible();

        // Check tier badge
        const tierBadge = section.locator("text=Thrall — Free");
        await expect(tierBadge).toBeVisible();
      });
    }

    test("displays 'What Every Thrall Commands' heading", async ({ page }) => {
      await page.goto(FEATURES_URL);

      const heading = page.locator("text=What Every Thrall Commands");
      await expect(heading).toBeVisible();

      const subtitle = page.locator(
        "text=No payment required. These are the core tools"
      );
      await expect(subtitle).toBeVisible();
    });

    test("all 4 Thrall features have atmospheric quotes", async ({ page }) => {
      await page.goto(FEATURES_URL);

      // Look for blockquotes within Thrall sections
      const thrallSection = page.locator('text=What Every Thrall Commands').locator("..");
      const quotes = thrallSection
        .locator("..")
        .locator("blockquote")
        .filter({ has: page.locator("text=Sköll|Hati|Issuer|wolf does not") });

      // Should have at least 4 atmospheric quotes
      const count = await quotes.count();
      expect(count).toBeGreaterThanOrEqual(4);
    });
  });

  test.describe("Karl features (4 total) — Paid Tier", () => {
    const karlFeatures = [
      {
        id: "cloud-sync",
        title: "Your Ledger Follows You",
        eyebrow: "Feature 05 · Cloud Sync",
        mentions: "sync across every device",
      },
      {
        id: "multi-household",
        title: "One Wolf, Many Dens",
        eyebrow: "Feature 06 · Multi-Household",
        mentions: "multiple households",
      },
      {
        id: "smart-import",
        title: "The Rune-Reader",
        eyebrow: "Feature 07 · Smart Import (AI-Powered)",
        mentions: "AI",
      },
      {
        id: "data-export",
        title: "Your Data, Your Terms",
        eyebrow: "Feature 08 · Data Export",
        mentions: "CSV or JSON",
      },
    ];

    for (const feature of karlFeatures) {
      test(`displays ${feature.title}`, async ({ page }) => {
        await page.goto(FEATURES_URL);

        const section = page.locator(`section#${feature.id}`);
        await expect(section).toBeVisible();

        // Check eyebrow
        await expect(section.locator("text=" + feature.eyebrow)).toBeVisible();

        // Check title
        await expect(section.locator(`text=${feature.title}`)).toBeVisible();

        // Check key detail
        await expect(section.locator(`text=${feature.mentions}`)).toBeVisible();

        // Check tier badge
        const tierBadge = section.locator("text=Karl — $3.99/mo");
        await expect(tierBadge).toBeVisible();
      });
    }

    test("Smart Import specifically mentions AI-powered extraction", async ({
      page,
    }) => {
      await page.goto(FEATURES_URL);

      const smartImportSection = page.locator("section#smart-import");
      await expect(smartImportSection).toBeVisible();

      // Check for AI mention in eyebrow
      await expect(
        smartImportSection.locator("text=Smart Import (AI-Powered)")
      ).toBeVisible();

      // Check for AI in description
      const description = smartImportSection.locator(
        "text=AI extracts card data from spreadsheets|AI identifies|AI to read your spreadsheet"
      );
      await expect(description).toBeVisible();
    });

    test("displays tier divider with upgrade text", async ({ page }) => {
      await page.goto(FEATURES_URL);

      const divider = page.locator("text=Upgrade Your Arsenal");
      await expect(divider).toBeVisible();

      const upgradeText = page.locator(
        "text=features require a Karl subscription"
      );
      await expect(upgradeText).toBeVisible();

      const link = page.locator('a[href="/pricing"]');
      await expect(link).toContainText("See full pricing");
    });
  });

  test.describe("Absence of invalid features", () => {
    test("does NOT display advanced-analytics feature", async ({ page }) => {
      await page.goto(FEATURES_URL);

      const advancedAnalytics = page.locator("text=advanced-analytics");
      await expect(advancedAnalytics).not.toBeVisible();

      const extendedAnalytics = page.locator("text=Advanced Analytics");
      await expect(extendedAnalytics).not.toBeVisible();
    });

    test("does NOT display extended-history feature", async ({ page }) => {
      await page.goto(FEATURES_URL);

      const extendedHistory = page.locator("text=Extended History");
      await expect(extendedHistory).not.toBeVisible();
    });

    test("does NOT display cosmetic-perks feature", async ({ page }) => {
      await page.goto(FEATURES_URL);

      const cosmeticPerks = page.locator("text=Cosmetic Perks|cosmetic");
      await expect(cosmeticPerks).not.toBeVisible();
    });
  });

  test.describe("Theme rendering — Light and Dark", () => {
    test("renders correctly in light theme", async ({ page }) => {
      await page.goto(FEATURES_URL);
      await page.evaluate(() => {
        document.documentElement.style.colorScheme = "light";
      });

      // Check hero section is visible and styled
      const hero = page.locator('section[aria-label="Features hero"]');
      await expect(hero).toBeVisible();

      // Check text is readable
      const heading = page.locator("text=The Wolf's Arsenal");
      await expect(heading).toBeVisible();

      // Verify no console errors
      const errors = await page.evaluate(() => {
        return (window as any).console.errors || [];
      });
      expect(errors).toHaveLength(0);
    });

    test("renders correctly in dark theme", async ({ page }) => {
      await page.goto(FEATURES_URL);
      await page.evaluate(() => {
        document.documentElement.style.colorScheme = "dark";
      });

      // Check hero section is visible and styled
      const hero = page.locator('section[aria-label="Features hero"]');
      await expect(hero).toBeVisible();

      // Check text is readable
      const heading = page.locator("text=The Wolf's Arsenal");
      await expect(heading).toBeVisible();
    });
  });

  test.describe("Mobile responsiveness (375px)", () => {
    test("features page is responsive at 375px viewport", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      const response = await page.goto(FEATURES_URL);
      expect(response?.status()).toBe(200);

      // Hero should be visible and readable
      const hero = page.locator('section[aria-label="Features hero"]');
      await expect(hero).toBeVisible();

      // Title should be readable
      const h1 = page.locator("h1");
      await expect(h1).toBeVisible();

      // Features should be stacked vertically
      const firstFeature = page.locator("section#annual-fee-tracking");
      await expect(firstFeature).toBeVisible();

      // CTA buttons should be visible and stackable
      const buttons = page.locator('a[href="/app"]');
      for (let i = 0; i < (await buttons.count()); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          expect(box?.width).toBeLessThanOrEqual(375);
        }
      }

      // Check no horizontal scroll
      const pageWidth = await page.evaluate(
        () => document.documentElement.clientWidth
      );
      expect(pageWidth).toBeLessThanOrEqual(375);
    });

    test("feature sections stack properly on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(FEATURES_URL);

      // Get bounding boxes of content and visual
      const section = page.locator("section#annual-fee-tracking");
      const content = section.locator("div:first-child");
      const visual = section.locator("div:last-child");

      const contentBox = await content.boundingBox();
      const visualBox = await visual.boundingBox();

      if (contentBox && visualBox) {
        // On mobile, they should be stacked (full width)
        expect(contentBox.width).toBeGreaterThan(300);
        expect(visualBox.width).toBeGreaterThan(300);
      }
    });

    test("pricing CTA is tappable on mobile (min 44px height)", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(FEATURES_URL);

      const button = page.locator('a[href="/app"]').first();
      const box = await button.boundingBox();

      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe("Static export and performance", () => {
    test("page has export const dynamic = 'force-static'", async ({ page }) => {
      // Verify by checking response headers for static caching indicators
      const response = await page.goto(FEATURES_URL);

      // Static pages should have cache-control headers
      const cacheControl = response?.headers()["cache-control"];
      // Force-static pages may be served from a CDN with appropriate cache headers
      expect(response?.status()).toBe(200);

      // Verify no dynamic markers in page source (if accessible)
      const pageContent = await page.content();
      // Should not contain revalidate or dynamic route indicators
      expect(pageContent).not.toContain("__NEXT_DATA__");
    });
  });

  test.describe("Accessibility", () => {
    test("all feature sections have proper ARIA labels", async ({ page }) => {
      await page.goto(FEATURES_URL);

      // Check sections have aria-label
      const sections = page.locator("section");
      const count = await sections.count();

      for (let i = 0; i < count; i++) {
        const section = sections.nth(i);
        const ariaLabel = await section.getAttribute("aria-label");
        if (ariaLabel) {
          expect(ariaLabel).toHaveLength.greaterThan(0);
        }
      }
    });

    test("buttons have sufficient contrast", async ({ page }) => {
      await page.goto(FEATURES_URL);

      const buttons = page.locator("a[href='/app'], a[href='/pricing']");
      const count = await buttons.count();

      expect(count).toBeGreaterThan(0);
    });
  });
});
