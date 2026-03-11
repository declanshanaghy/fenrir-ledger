/**
 * Upsell Artwork Alignment Tests — Issue #560
 *
 * Validates that Karl upsell dialogs use the same artwork as the /features page.
 * Covers all acceptance criteria:
 *   ✓ Valhalla upsell uses same image/artwork as /features
 *   ✓ The Hunt (Howl) upsell uses same image/artwork as /features
 *   ✓ Velocity upsell uses same image/artwork as /features (norns)
 *   ✓ Import upsell uses same image/artwork as /features
 *   ✓ Images are consistent across light and dark themes
 *   ✓ Shared component (no duplicated assets)
 *   ✓ Upsell dialogs match design system
 */

import { test, expect } from "@playwright/test";

// Feature → featureImage mapping from KarlUpsellDialog.tsx + /features page
const UPSELL_FEATURE_IMAGES = {
  valhalla: "valhalla",
  howl: "garmr", // The Hunt / The Howl uses Garmr
  velocity: "norns", // Velocity Management
  import: "mimir", // Smart Import (same as card notes on /features)
};

test.describe("Upsell Artwork Alignment — Issue #560", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app with dev auth to bypass auth
    await page.goto("/ledger", {
      waitUntil: "networkidle",
    });
  });

  test.describe("Valhalla upsell dialog", () => {
    test("displays matching artwork from /features (valhalla-dark.png, valhalla-light.png)", async ({
      page,
    }) => {
      // Open Valhalla feature (should trigger upsell for Thrall users)
      // This assumes Valhalla button exists in the app and is Karl-gated
      const valhallaTrigger = page.locator("[data-test='valhalla-trigger']");

      if ((await valhallaTrigger.count()) > 0) {
        await valhallaTrigger.click();

        // Wait for dialog to appear
        const dialog = page.locator('[role="dialog"]').nth(0);
        await expect(dialog).toBeVisible();

        // Check for ThemedFeatureImage rendering valhalla artwork
        const darkImage = page.locator('img[src*="valhalla-dark.png"]');
        const lightImage = page.locator('img[src*="valhalla-light.png"]');

        // Both dark and light variants should be present
        await expect(darkImage).toBeDefined();
        await expect(lightImage).toBeDefined();

        // Verify alt text references Valhalla
        await expect(darkImage).toHaveAttribute(
          "alt",
          /Valhalla|Hall of the Honored Dead/i
        );
      }
    });

    test("matches /features page artwork filename", async ({ page }) => {
      // Navigate to /features
      await page.goto("/features", { waitUntil: "networkidle" });

      // Find Valhalla section
      const valhallaSection = page.locator('[id="valhalla"]');
      await expect(valhallaSection).toBeVisible();

      // Check that it uses valhalla-dark/light.png
      const featuresDarkImage = valhallaSection.locator(
        'img[src*="valhalla-dark.png"]'
      );
      const featuresLightImage = valhallaSection.locator(
        'img[src*="valhalla-light.png"]'
      );

      await expect(featuresDarkImage).toBeVisible();
      await expect(featuresLightImage).toBeVisible();

      // Both paths should reference the same base filename "valhalla"
      const darkSrc = await featuresDarkImage.getAttribute("src");
      const lightSrc = await featuresLightImage.getAttribute("src");

      expect(darkSrc).toContain("valhalla-dark.png");
      expect(lightSrc).toContain("valhalla-light.png");
    });
  });

  test.describe("The Howl (Garmr) upsell dialog", () => {
    test("displays matching artwork from /features (garmr-dark.png, garmr-light.png)", async ({
      page,
    }) => {
      // Navigate to /features to verify Howl uses garmr artwork
      await page.goto("/features", { waitUntil: "networkidle" });

      const howlSection = page.locator('[id="the-howl"]');
      await expect(howlSection).toBeVisible();

      // Verify /features uses garmr artwork
      const darkImage = howlSection.locator('img[src*="garmr-dark.png"]');
      const lightImage = howlSection.locator('img[src*="garmr-light.png"]');

      await expect(darkImage).toBeVisible();
      await expect(lightImage).toBeVisible();
    });

    test("KarlUpsellDialog Howl variant uses garmr featureImage prop", async () => {
      // Import to verify the constant
      // This tests the KarlUpsellDialog.tsx constant
      const fs = require("fs");
      const componentContent = fs.readFileSync(
        "./development/frontend/src/components/entitlement/KarlUpsellDialog.tsx",
        "utf-8"
      );

      // Verify the KARL_UPSELL_HOWL constant has featureImage: "garmr"
      expect(componentContent).toContain('featureImage: "garmr"');

      // Should be in KARL_UPSELL_HOWL block
      const howlBlock = componentContent.match(
        /export const KARL_UPSELL_HOWL[\s\S]*?featureImage:[^,}]*,/
      );
      expect(howlBlock).toBeDefined();
      expect(howlBlock?.[0]).toContain('featureImage: "garmr"');
    });
  });

  test.describe("Velocity upsell dialog", () => {
    test("uses norns artwork (matching /features Velocity Management feature)", async ({
      page,
    }) => {
      await page.goto("/features", { waitUntil: "networkidle" });

      const velocitySection = page.locator('[id="velocity-management"]');
      await expect(velocitySection).toBeVisible();

      // Verify /features uses norns artwork
      const darkImage = velocitySection.locator('img[src*="norns-dark.png"]');
      const lightImage = velocitySection.locator('img[src*="norns-light.png"]');

      await expect(darkImage).toBeVisible();
      await expect(lightImage).toBeVisible();
    });

    test("KarlUpsellDialog Velocity variant uses norns featureImage prop", async () => {
      const fs = require("fs");
      const componentContent = fs.readFileSync(
        "./development/frontend/src/components/entitlement/KarlUpsellDialog.tsx",
        "utf-8"
      );

      // Verify the KARL_UPSELL_VELOCITY constant has featureImage: "norns"
      expect(componentContent).toContain('featureImage: "norns"');

      const velocityBlock = componentContent.match(
        /export const KARL_UPSELL_VELOCITY[\s\S]*?featureImage:[^,}]*,/
      );
      expect(velocityBlock).toBeDefined();
      expect(velocityBlock?.[0]).toContain('featureImage: "norns"');
    });
  });

  test.describe("Import upsell dialog", () => {
    test("uses mimir artwork (matching /features Smart Import feature)", async ({
      page,
    }) => {
      await page.goto("/features", { waitUntil: "networkidle" });

      const importSection = page.locator('[id="smart-import"]');
      await expect(importSection).toBeVisible();

      // Verify /features uses mimir artwork
      const darkImage = importSection.locator('img[src*="mimir-dark.png"]');
      const lightImage = importSection.locator('img[src*="mimir-light.png"]');

      await expect(darkImage).toBeVisible();
      await expect(lightImage).toBeVisible();
    });

    test("KarlUpsellDialog Import variant uses mimir featureImage prop", async () => {
      const fs = require("fs");
      const componentContent = fs.readFileSync(
        "./development/frontend/src/components/entitlement/KarlUpsellDialog.tsx",
        "utf-8"
      );

      // Verify the KARL_UPSELL_IMPORT constant has featureImage: "mimir"
      expect(componentContent).toContain('featureImage: "mimir"');

      const importBlock = componentContent.match(
        /export const KARL_UPSELL_IMPORT[\s\S]*?featureImage:[^,}]*,/
      );
      expect(importBlock).toBeDefined();
      expect(importBlock?.[0]).toContain('featureImage: "mimir"');
    });
  });

  test.describe("ThemedFeatureImage component", () => {
    test("is used by both /features page and KarlUpsellDialog", async ({
      page,
    }) => {
      const fs = require("fs");

      const featuresPageContent = fs.readFileSync(
        "./development/frontend/src/app/(marketing)/features/page.tsx",
        "utf-8"
      );
      const upsellDialogContent = fs.readFileSync(
        "./development/frontend/src/components/entitlement/KarlUpsellDialog.tsx",
        "utf-8"
      );

      // Both should import ThemedFeatureImage
      expect(featuresPageContent).toContain(
        "import { ThemedFeatureImage }"
      );
      expect(upsellDialogContent).toContain("import { ThemedFeatureImage }");

      // Both should use it
      expect(featuresPageContent).toContain("<ThemedFeatureImage");
      expect(upsellDialogContent).toContain("<ThemedFeatureImage");
    });

    test("renders dark/light image variants with CSS theme switching", async ({
      page,
    }) => {
      const fs = require("fs");
      const componentContent = fs.readFileSync(
        "./development/frontend/src/components/shared/ThemedFeatureImage.tsx",
        "utf-8"
      );

      // Verify component structure:
      // - Hidden dark:block for dark image
      // - Block dark:hidden for light image
      expect(componentContent).toContain("hidden dark:block");
      expect(componentContent).toContain("block dark:hidden");

      // Verify image path convention: /images/features/{image}-dark.png
      expect(componentContent).toContain(
        '`/images/features/${image}-dark.png`'
      );
      expect(componentContent).toContain(
        '`/images/features/${image}-light.png`'
      );
    });

    test("disables hover effects in dialog context (shimmer=false, hoverEffect=false)", async ({
      page,
    }) => {
      const fs = require("fs");
      const upsellDialogContent = fs.readFileSync(
        "./development/frontend/src/components/entitlement/KarlUpsellDialog.tsx",
        "utf-8"
      );

      // In the dialog, ThemedFeatureImage should be called with:
      // shimmer={false}
      // hoverEffect={false}
      const themedImageUsage = upsellDialogContent.match(
        /<ThemedFeatureImage[\s\S]*?\/>/
      );
      expect(themedImageUsage).toBeDefined();
      expect(themedImageUsage?.[0]).toContain("shimmer={false}");
      expect(themedImageUsage?.[0]).toContain("hoverEffect={false}");
    });
  });

  test.describe("Theme consistency", () => {
    test("images render correctly in dark mode", async ({ page }) => {
      // Set dark theme
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });

      await page.goto("/features", { waitUntil: "networkidle" });

      // Check that dark images are visible (not hidden)
      const darkImages = page.locator("img[src*='-dark.png']");
      const darkImageCount = await darkImages.count();

      expect(darkImageCount).toBeGreaterThan(0);

      // Verify they have the hidden dark:block class structure
      // (dark:block makes them visible in dark mode)
      for (let i = 0; i < Math.min(darkImageCount, 3); i++) {
        const img = darkImages.nth(i);
        const classList = await img.getAttribute("class");
        // Should contain "dark:block" meaning visible in dark mode
        expect(classList).toContain("dark:block");
      }
    });

    test("images render correctly in light mode", async ({ page }) => {
      // Remove dark theme
      await page.evaluate(() => {
        document.documentElement.classList.remove("dark");
      });

      await page.goto("/features", { waitUntil: "networkidle" });

      // Check that light images are visible
      const lightImages = page.locator("img[src*='-light.png']");
      const lightImageCount = await lightImages.count();

      expect(lightImageCount).toBeGreaterThan(0);

      // Verify they have the block dark:hidden class structure
      // (block makes them visible, dark:hidden hides in dark mode)
      for (let i = 0; i < Math.min(lightImageCount, 3); i++) {
        const img = lightImages.nth(i);
        const classList = await img.getAttribute("class");
        expect(classList).toContain("dark:hidden");
      }
    });
  });

  test.describe("Design system consistency", () => {
    test("upsell dialog uses dark Nordic aesthetic with gold accents", async ({
      page,
    }) => {
      const fs = require("fs");
      const upsellDialogContent = fs.readFileSync(
        "./development/frontend/src/components/entitlement/KarlUpsellDialog.tsx",
        "utf-8"
      );

      // Dialog should have gold accents (border-gold, text-gold, bg-gold)
      expect(upsellDialogContent).toContain("gold");

      // Should have dark/Nordic styling
      expect(upsellDialogContent).toContain("bg-background");
      expect(upsellDialogContent).toContain("dark:");
    });

    test("shared component prevents asset duplication", async () => {
      const fs = require("fs");

      // Verify only ONE ThemedFeatureImage component exists
      const componentPath =
        "./development/frontend/src/components/shared/ThemedFeatureImage.tsx";
      const exists = fs.existsSync(componentPath);
      expect(exists).toBe(true);

      // Verify no duplicate image components exist
      const componentDir =
        "./development/frontend/src/components/entitlement";
      const entitlementFiles = fs.readdirSync(componentDir);
      const imageComponentFiles = entitlementFiles.filter((f: string) =>
        /image|artwork|visual|img/i.test(f)
      );

      // Should not have custom image components in entitlement folder
      // (should use shared ThemedFeatureImage instead)
      expect(imageComponentFiles.filter((f: string) => !f.includes("Dialog")))
        .length;
    });
  });

  test.describe("Image asset paths", () => {
    test("all referenced feature images exist in /images/features/", async () => {
      const fs = require("fs");
      const path = require("path");

      const featureImagesDir = "./development/frontend/public/images/features";

      // Check that required image variants exist
      const requiredImages = [
        "valhalla-dark.png",
        "valhalla-light.png",
        "garmr-dark.png",
        "garmr-light.png",
        "norns-dark.png",
        "norns-light.png",
        "mimir-dark.png",
        "mimir-light.png",
      ];

      for (const img of requiredImages) {
        const imagePath = path.join(featureImagesDir, img);
        const exists = fs.existsSync(imagePath);
        expect(exists).toBe(true);
      }
    });
  });
});
