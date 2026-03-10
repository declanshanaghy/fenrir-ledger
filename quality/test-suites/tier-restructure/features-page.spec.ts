import { test, expect } from "@playwright/test";

test.describe("Features Page — Tier Restructure (#523)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/features");
  });

  test.describe("Thrall Section (Free Features)", () => {
    test("should display 3 Thrall features in correct order", async ({ page }) => {
      // Get all feature section IDs in document order
      const featureSections = await page.locator('section[id]').all();
      const featureIds = await Promise.all(
        featureSections.map((el) => el.getAttribute("id"))
      );

      // First 3 should be Thrall features
      expect(featureIds.slice(0, 3)).toEqual([
        "add-your-cards",
        "the-dashboard",
        "card-notes",
      ]);
    });

    test("should show correct eyebrow text for Thrall features", async ({
      page,
    }) => {
      const eyebrows = await page
        .locator('section[id] .font-mono.text-\\[11px\\]')
        .allTextContents();

      // Should contain Thrall feature eyebrows (01-03)
      expect(eyebrows).toContain("Feature 01 · Add Your Cards");
      expect(eyebrows).toContain("Feature 02 · The Dashboard");
      expect(eyebrows).toContain("Feature 03 · Card Notes");
    });

    test("Add Your Cards should have correct details", async ({ page }) => {
      const section = page.locator('section[id="add-your-cards"]');
      await expect(section.locator("h2")).toContainText(
        "The Foundation of the Ledger"
      );

      // Verify tier badge
      const tierBadge = section.locator("span").filter({ hasText: /Thrall/i });
      await expect(tierBadge).toContainText("Thrall — Free");

      // Verify key details are present
      const details = await section.locator("li").allTextContents();
      expect(details.join(" ")).toContain("Add cards with name");
      expect(details.join(" ")).toContain("issuer");
      expect(details.join(" ")).toContain("open date");
    });

    test("The Dashboard should have correct details", async ({ page }) => {
      const section = page.locator('section[id="the-dashboard"]');
      await expect(section.locator("h2")).toContainText(
        "All Your Cards at a Glance"
      );

      const tierBadge = section.locator("span").filter({ hasText: /Thrall/i });
      await expect(tierBadge).toContainText("Thrall — Free");

      // Verify it has status badge details
      const details = await section.locator("li").allTextContents();
      expect(details.join(" ")).toContain("status");
      expect(details.join(" ")).toContain("sortable");
    });

    test("Card Notes should have correct details", async ({ page }) => {
      const section = page.locator('section[id="card-notes"]');
      await expect(section.locator("h2")).toContainText(
        "The Memory of Mimir"
      );

      const tierBadge = section.locator("span").filter({ hasText: /Thrall/i });
      await expect(tierBadge).toContainText("Thrall — Free");

      // Verify notes details
      const details = await section.locator("li").allTextContents();
      expect(details.join(" ")).toContain("free-text");
      expect(details.join(" ")).toContain("retention");
    });

    test("Thrall section heading should be present", async ({ page }) => {
      const heading = page.locator("h2").filter({ hasText: /What Every Thrall Commands/i });
      await expect(heading).toBeVisible();

      // Verify the description text
      const description = page.locator("text=No payment required").first();
      await expect(description).toBeVisible();
    });
  });

  test.describe("Karl Section (Paid Features)", () => {
    test("should have Sköll and Hati in Karl tier with correct numbering", async ({
      page,
    }) => {
      // Sköll should be Feature 04
      const skoll = page.locator('section[id="annual-fee-tracking"]');
      await expect(skoll).toContainText("Feature 04");
      await expect(skoll).toContainText("Sköll Watches the Fee");

      const skollBadge = skoll.locator("span").filter({ hasText: /Karl/i });
      await expect(skollBadge).toContainText("Karl — $3.99/mo");

      // Hati should be Feature 05
      const hati = page.locator('section[id="signup-bonus-tracking"]');
      await expect(hati).toContainText("Feature 05");
      await expect(hati).toContainText("Hati Watches the Deadline");

      const hatiBadge = hati.locator("span").filter({ hasText: /Karl/i });
      await expect(hatiBadge).toContainText("Karl — $3.99/mo");
    });

    test("Sköll should have 60-day fee warning details", async ({ page }) => {
      const section = page.locator('section[id="annual-fee-tracking"]');
      const details = await section.locator("li").allTextContents();
      expect(details.join(" ")).toContain("60-day");
      expect(details.join(" ")).toContain("fee");
    });

    test("Hati should have bonus deadline tracking details", async ({ page }) => {
      const section = page.locator('section[id="signup-bonus-tracking"]');
      const details = await section.locator("li").allTextContents();
      expect(details.join(" ")).toContain("minimum spend");
      expect(details.join(" ")).toContain("deadline");
    });

    test("The Howl should remain in Karl tier at Feature 06", async ({ page }) => {
      const section = page.locator('section[id="the-howl"]');
      await expect(section).toContainText("Feature 06");
      await expect(section).toContainText("Urgent Cards Dashboard");

      const badge = section.locator("span").filter({ hasText: /Karl/i });
      await expect(badge).toContainText("Karl — $3.99/mo");
    });

    test("should have 9 total Karl features after Sköll and Hati", async ({
      page,
    }) => {
      // All features after tier divider should be Karl
      const karlFeatures = [
        "annual-fee-tracking",
        "signup-bonus-tracking",
        "the-howl",
        "velocity-management",
        "valhalla",
        "cloud-sync",
        "multi-household",
        "smart-import",
        "data-export",
      ];

      for (const featureId of karlFeatures) {
        const section = page.locator(`section[id="${featureId}"]`);
        await expect(section).toBeVisible();
        const badge = section.locator("span").filter({ hasText: /Karl/i });
        await expect(badge).toBeVisible();
      }
    });
  });

  test.describe("Feature Numbering and Ordering", () => {
    test("features should be numbered 01-12 sequentially", async ({ page }) => {
      const eyebrows = await page
        .locator("p.font-mono.text-\\[11px\\]")
        .allTextContents();

      const featureNumbers = eyebrows.filter((text) =>
        text.match(/Feature \d+/)
      );

      // Should have features 01-12
      for (let i = 1; i <= 12; i++) {
        const padded = String(i).padStart(2, "0");
        expect(featureNumbers.some((text) => text.includes(`Feature ${padded}`))).toBeTruthy();
      }
    });

    test("should render in correct DOM order: Thrall 01-03, Karl 04-12", async ({
      page,
    }) => {
      const sections = await page.locator('section[id]').all();
      const ids = await Promise.all(sections.map((s) => s.getAttribute("id")));

      const expectedOrder = [
        "add-your-cards", // 01
        "the-dashboard", // 02
        "card-notes", // 03
        "annual-fee-tracking", // 04
        "signup-bonus-tracking", // 05
        "the-howl", // 06
        "velocity-management", // 07
        "valhalla", // 08
        "cloud-sync", // 09
        "multi-household", // 10
        "smart-import", // 11
        "data-export", // 12
      ];

      expect(ids).toEqual(expectedOrder);
    });
  });

  test.describe("Tier Divider and Section Headings", () => {
    test("should have Thrall section heading before features 01-03", async ({
      page,
    }) => {
      const heading = page.locator("h2").filter({
        hasText: /What Every Thrall Commands/i,
      });
      await expect(heading).toBeVisible();

      // Verify text below it
      const text = page.locator("text=No payment required").first();
      await expect(text).toBeVisible();
    });

    test("should have tier divider between Thrall and Karl sections", async ({
      page,
    }) => {
      const divider = page.locator('div[role="separator"]');
      await expect(divider).toBeVisible();
      await expect(divider).toContainText("Karl Tier");
      await expect(divider).toContainText("$3.99 / month");
    });

    test("tier divider should contain upgrade call-to-action link", async ({
      page,
    }) => {
      const divider = page.locator('div[role="separator"]');
      const link = divider.locator("a").filter({ hasText: /pricing/i });
      await expect(link).toBeVisible();
    });
  });

  test.describe("Image Assets and Theming", () => {
    test("should render dark and light mode images for all features", async ({
      page,
    }) => {
      // Check that images are present (they should be from /images/features/)
      // Images use hidden dark:block and block dark:hidden classes for theme switching
      const allImages = await page.locator("img").all();

      // Each feature should have both dark and light variants in the DOM
      // (though only one is visible at a time based on theme)
      expect(allImages.length).toBeGreaterThan(20); // 12 features × 2 images each
    });

    test("images should have correct alt text format", async ({ page }) => {
      const images = await page.locator("img").all();
      for (const img of images) {
        const alt = await img.getAttribute("alt");
        if (alt && alt.includes("Feature")) {
          // Alt should be "Title — Feature eyebrow"
          expect(alt).toContain("—");
        }
      }
    });
  });

  test.describe("Accessibility and Content Validation", () => {
    test("all features should have accessible section labels", async ({
      page,
    }) => {
      const sections = await page.locator('section[id][aria-label]').all();
      expect(sections.length).toBeGreaterThan(0);
    });

    test("tier badges should be present and correctly labeled", async ({
      page,
    }) => {
      const thrallBadges = await page
        .locator("span")
        .filter({ hasText: /Thrall — Free/i })
        .all();
      const karlBadges = await page
        .locator("span")
        .filter({ hasText: /Karl — \$3\.99\/mo/i })
        .all();

      // Should have 3 Thrall and 9 Karl badges
      expect(thrallBadges.length).toBe(3);
      expect(karlBadges.length).toBe(9);
    });

    test("each feature should have benefit and description text", async ({
      page,
    }) => {
      const sections = await page.locator('section[id]').all();
      for (const section of sections) {
        // Each section should have at least 2 paragraphs (benefit + description)
        const paragraphs = await section.locator("p").count();
        expect(paragraphs).toBeGreaterThanOrEqual(2);
      }
    });

    test("feature details lists should be present", async ({ page }) => {
      const sections = await page.locator('section[id]').all();
      for (const section of sections) {
        const list = section.locator('ul[aria-label="Feature details"]');
        await expect(list).toBeVisible();
        const items = await list.locator("li").count();
        expect(items).toBeGreaterThanOrEqual(3);
      }
    });
  });

  test.describe("Wiki Links for Norse Characters", () => {
    test("feature titles should link to Wikipedia", async ({ page }) => {
      const links = await page.locator('h2 a[target="_blank"]').all();
      expect(links.length).toBeGreaterThan(0);

      for (const link of links) {
        const href = await link.getAttribute("href");
        expect(href).toContain("wikipedia.org");
      }
    });
  });
});
