/**
 * Easter Egg Test Suite — Fenrir Ledger
 *
 * Comprehensive validation of all implemented easter eggs:
 *   #2 — Konami Howl (Konami Code sequence)
 *   #3 — The Roots of a Mountain (first sidebar collapse)
 *   #5 — The Breath of a Fish (footer © hover)
 *   #9 — The Forgemaster's Signature (? key)
 *   #3 (variant) — Loki Mode (click "Loki" 7 times)
 *
 * Each egg test:
 * 1. Clears localStorage gates before triggering
 * 2. Executes the trigger mechanism
 * 3. Asserts the correct modal/overlay appears
 * 4. Validates content (title, image, text)
 * 5. Tests one-time gate: second trigger should NOT re-open
 * 6. Asserts dismiss closes the modal
 *
 * Test isolation: localStorage is reset before each egg test to ensure
 * no cross-test contamination from fragment count state.
 */

import { test, expect } from "@playwright/test";

// ── Test Configuration ──────────────────────────────────────────────────────

const BASE_URL = process.env.SERVER_URL || "http://localhost:3000";

// Easter egg localStorage keys
const EGG_STORAGE_KEYS = {
  gleipnir_3: "egg:gleipnir-3",
  gleipnir_5: "egg:gleipnir-5",
  forgemaster: "egg:forgemaster",
};

// ── Helper: Clear localStorage for a specific egg ─────────────────────────

async function clearEggStorage(page: any, keys: string[]) {
  await page.evaluate((keysToRemove) => {
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }, keys);
}

// ── Helper: Clear all egg storage ────────────────────────────────────────

async function clearAllEggStorage(page: any) {
  await page.evaluate(() => {
    localStorage.removeItem(EGG_STORAGE_KEYS.gleipnir_3);
    localStorage.removeItem(EGG_STORAGE_KEYS.gleipnir_5);
    localStorage.removeItem(EGG_STORAGE_KEYS.forgemaster);
  });
}

// ── Helper: Simulate keyboard sequence ──────────────────────────────────

async function typeKeySequence(page: any, keys: string[]) {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

// ── Test Suite ──────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Navigate to the app
  await page.goto(BASE_URL);
  // Clear all egg storage before each test
  await clearAllEggStorage(page);
  // Wait for app to hydrate
  await page.waitForLoadState("networkidle");
});

test.describe("Easter Eggs — Fenrir Ledger", () => {
  test.describe("Egg #2: Konami Howl", () => {
    test("should trigger Konami Code sequence and show FENRIR AWAKENS overlay", async ({
      page,
    }) => {
      // Type the full Konami sequence: ↑ ↑ ↓ ↓ ← → ← → B A
      await typeKeySequence(page, [
        "ArrowUp",
        "ArrowUp",
        "ArrowDown",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowLeft",
        "ArrowRight",
        "b",
        "a",
      ]);

      // Assert: FENRIR AWAKENS status band appears at the top
      const statusBand = page.locator('[role="status"]');
      await expect(statusBand).toContainText("FENRIR AWAKENS");

      // Assert: Status band has correct styling (blood orange text)
      await expect(statusBand).toHaveCSS(
        "color",
        /rgb\(201,\s*64,\s*32\)|#c94020/i
      );

      // Assert: Wolf silhouette role and label exist
      const wolfImg = page.locator('[role="img"]');
      await expect(wolfImg).toHaveAttribute(
        "aria-label",
        /wolf.*silhouette/i
      );

      // Wait for the overlay to fade out (3s display + 400ms fade)
      await page.waitForTimeout(3500);
    });

    test("should reset sequence on wrong key", async ({ page }) => {
      // Type partial sequence: up, up, down
      await typeKeySequence(page, ["ArrowUp", "ArrowUp", "ArrowDown"]);

      // Press a wrong key (e.g., "x") to break the sequence
      await page.keyboard.press("x");

      // Type partial again: up, up
      await typeKeySequence(page, ["ArrowUp", "ArrowUp"]);

      // The status band should NOT appear because the sequence was reset
      const statusBand = page.locator('[role="status"]');
      await expect(statusBand).not.toContainText("FENRIR AWAKENS");
    });

    test("should not trigger when input field has focus", async ({ page }) => {
      // Focus an input field (create one or use an existing form field)
      const testInput = page.locator('[placeholder*="card"]').first();
      if (await testInput.isVisible()) {
        await testInput.focus();

        // Type the Konami sequence while focused
        await typeKeySequence(page, [
          "ArrowUp",
          "ArrowUp",
          "ArrowDown",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "ArrowLeft",
          "ArrowRight",
          "b",
          "a",
        ]);

        // Assert: FENRIR AWAKENS should NOT appear
        const statusBand = page.locator('[role="status"]');
        await expect(statusBand).not.toContainText("FENRIR AWAKENS");
      }
    });
  });

  test.describe("Egg #3: The Roots of a Mountain (Sidebar Collapse)", () => {
    test("should open modal on first sidebar collapse", async ({ page }) => {
      // Clear the gleipnir-3 key to ensure fresh state
      await clearEggStorage(page, [EGG_STORAGE_KEYS.gleipnir_3]);

      // Find and click the sidebar collapse button (usually in the TopBar or SideNav)
      const collapseButton = page.locator('button[aria-label*="collapse"], button[aria-label*="toggle"]')
        .first();

      if (await collapseButton.isVisible()) {
        await collapseButton.click();

        // Assert: EasterEggModal dialog opens with correct title
        const modalTitle = page.locator('[role="dialog"]').first();
        await expect(modalTitle).toContainText("The Roots of a Mountain");

        // Assert: Image src contains gleipnir-3.svg
        const modalImage = modalTitle.locator("img").first();
        await expect(modalImage).toHaveAttribute(
          "src",
          /gleipnir-3\.svg/
        );

        // Assert: Alt text describes the artifact
        await expect(modalImage).toHaveAttribute(
          "alt",
          /Roots of a Mountain|Gleipnir artifact/i
        );

        // Assert: SVG artifact has transparent background (no inline background style creating black box)
        const svgContainer = modalImage.locator('xpath=..');
        const bgColor = await svgContainer.evaluate((el) =>
          window.getComputedStyle(el).backgroundColor
        );
        // Background should be the modal section color (#13151f), not black or opaque
        expect(bgColor).toMatch(/transparent|rgba?\(19,\s*21,\s*31/i);

        // Assert: Fragment count text appears
        await expect(modalTitle).toContainText(/of 6/);

        // Dismiss the modal
        const dismissButton = modalTitle.locator(
          'button:has-text("So it is written")'
        );
        await dismissButton.click();

        // Assert: Modal closes
        await expect(modalTitle).not.toBeVisible();
      }
    });

    test("should NOT re-open modal on second sidebar collapse (one-time gate)", async ({
      page,
    }) => {
      // Trigger and dismiss the modal on first collapse
      const collapseButton = page
        .locator('button[aria-label*="collapse"], button[aria-label*="toggle"]')
        .first();

      if (await collapseButton.isVisible()) {
        // First collapse
        await collapseButton.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toContainText("The Roots of a Mountain");

        // Dismiss
        const dismissButton = dialog.locator(
          'button:has-text("So it is written")'
        );
        await dismissButton.click();
        await expect(dialog).not.toBeVisible();

        // Second collapse: re-expand the sidebar
        await collapseButton.click();

        // Assert: Modal does NOT open again (localStorage gate prevents it)
        const dialogAgain = page.locator('[role="dialog"]').first();
        await expect(dialogAgain).not.toContainText(
          "The Roots of a Mountain"
        );
      }
    });
  });

  test.describe("Egg #5: The Breath of a Fish (Footer © Hover)", () => {
    test("should open modal on copyright symbol hover", async ({ page }) => {
      // Clear the gleipnir-5 key
      await clearEggStorage(page, [EGG_STORAGE_KEYS.gleipnir_5]);

      // Find the © symbol in the footer
      const copyrightSymbol = page.locator(
        '[data-gleipnir="breath-of-a-fish"]'
      );

      if (await copyrightSymbol.isVisible()) {
        // Hover the © symbol
        await copyrightSymbol.hover();

        // Assert: Modal opens with correct title
        const modalTitle = page.locator('[role="dialog"]').first();
        await expect(modalTitle).toContainText("The Breath of a Fish");

        // Assert: Image src contains gleipnir-5.svg
        const modalImage = modalTitle.locator("img").first();
        await expect(modalImage).toHaveAttribute(
          "src",
          /gleipnir-5\.svg/
        );

        // Assert: Alt text describes the artifact
        await expect(modalImage).toHaveAttribute(
          "alt",
          /Breath of a Fish|Gleipnir artifact/i
        );

        // Assert: SVG artifact points to .svg file (not baked-in PNG/JPG with opaque background)
        await expect(modalImage).toHaveAttribute("src", /\.svg$/);

        // Assert: SVG artifact has transparent background
        const svgContainer = modalImage.locator('xpath=..');
        const bgColor = await svgContainer.evaluate((el) =>
          window.getComputedStyle(el).backgroundColor
        );
        // Background should be the modal section color (#13151f), not black or opaque
        expect(bgColor).toMatch(/transparent|rgba?\(19,\s*21,\s*31/i);

        // Assert: Fragment count text appears
        await expect(modalTitle).toContainText(/of 6/);

        // Dismiss the modal
        const dismissButton = modalTitle.locator(
          'button:has-text("So it is written")'
        );
        await dismissButton.click();

        // Assert: Modal closes
        await expect(modalTitle).not.toBeVisible();
      }
    });

    test("should NOT re-open modal on second hover (one-time gate)", async ({
      page,
    }) => {
      const copyrightSymbol = page.locator(
        '[data-gleipnir="breath-of-a-fish"]'
      );

      if (await copyrightSymbol.isVisible()) {
        // First hover and dismiss
        await copyrightSymbol.hover();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toContainText("The Breath of a Fish");

        const dismissButton = dialog.locator(
          'button:has-text("So it is written")'
        );
        await dismissButton.click();
        await expect(dialog).not.toBeVisible();

        // Move away from the symbol
        await page.mouse.move(0, 0);
        await page.waitForTimeout(100);

        // Second hover: should NOT re-open
        await copyrightSymbol.hover();
        await page.waitForTimeout(500); // Wait for any potential modal

        const dialogAgain = page.locator('[role="dialog"]').first();
        await expect(dialogAgain).not.toContainText("The Breath of a Fish");
      }
    });
  });

  test.describe("Egg #9: The Forgemaster's Signature (? Key)", () => {
    test("should open modal when pressing ? key", async ({ page }) => {
      // Clear the forgemaster key
      await clearEggStorage(page, [EGG_STORAGE_KEYS.forgemaster]);

      // Press ? (Shift+/)
      await page.keyboard.press("Shift+Slash");

      // Assert: Modal opens with correct title
      const modalTitle = page.locator('[role="dialog"]').first();
      await expect(modalTitle).toContainText("The Forgemaster's Signature");

      // Assert: Image src contains forgemaster.svg
      const modalImage = modalTitle.locator("img").first();
      await expect(modalImage).toHaveAttribute(
        "src",
        /forgemaster\.svg/
      );

      // Assert: Alt text describes the artifact
      await expect(modalImage).toHaveAttribute(
        "alt",
        /Forgemaster|forge.*anvil|artifact/i
      );

      // Assert: SVG artifact points to .svg file (not baked-in PNG/JPG with opaque background)
      await expect(modalImage).toHaveAttribute("src", /\.svg$/);

      // Assert: SVG artifact has transparent background (no black box)
      const svgContainer = modalImage.locator('xpath=..');
      const bgColor = await svgContainer.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );
      // Background should be the modal section color (#13151f), not black or opaque
      expect(bgColor).toMatch(/transparent|rgba?\(19,\s*21,\s*31/i);

      // Assert: Fragment count text appears
      await expect(modalTitle).toContainText(/of 6/);

      // Assert: Team members are listed (Freya, Luna, FiremanDecko, Loki)
      await expect(modalTitle).toContainText("Freya");
      await expect(modalTitle).toContainText("Luna");
      await expect(modalTitle).toContainText("FiremanDecko");
      await expect(modalTitle).toContainText("Loki");

      // Assert: Role titles appear
      await expect(modalTitle).toContainText("Product Owner");
      await expect(modalTitle).toContainText("UX Designer");
      await expect(modalTitle).toContainText("Principal Engineer");
      await expect(modalTitle).toContainText("QA Tester");

      // Dismiss the modal
      const dismissButton = modalTitle.locator(
        'button:has-text("So it is written")'
      );
      await dismissButton.click();

      // Assert: Modal closes
      await expect(modalTitle).not.toBeVisible();
    });

    test("should NOT re-open modal on second ? press (one-time gate)", async ({
      page,
    }) => {
      // First ? press
      await page.keyboard.press("Shift+Slash");

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toContainText("The Forgemaster's Signature");

      // Dismiss
      const dismissButton = dialog.locator(
        'button:has-text("So it is written")'
      );
      await dismissButton.click();
      await expect(dialog).not.toBeVisible();

      // Second ? press: should NOT re-open
      await page.keyboard.press("Shift+Slash");
      await page.waitForTimeout(500); // Wait for any potential modal

      const dialogAgain = page.locator('[role="dialog"]').first();
      await expect(dialogAgain).not.toContainText(
        "The Forgemaster's Signature"
      );
    });

    test("should not trigger when input field has focus", async ({ page }) => {
      // Focus an input field if available
      const testInput = page.locator('[placeholder*="card"]').first();
      if (await testInput.isVisible()) {
        await testInput.focus();

        // Press ? while focused
        await page.keyboard.press("Shift+Slash");

        // Assert: Modal should NOT open
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).not.toContainText("The Forgemaster's Signature");
      }
    });
  });

  test.describe("Egg #3 Variant: Loki Mode (7 Clicks)", () => {
    test("should show Loki Mode toast after 7 clicks on 'Loki' text", async ({
      page,
    }) => {
      // Find the "Loki" link in the footer
      const lokiLink = page.locator('[data-loki-trigger]');

      if (await lokiLink.isVisible()) {
        // Click 7 times
        for (let i = 0; i < 7; i++) {
          await lokiLink.click();
        }

        // Assert: Toast appears with correct message
        const toast = page.locator('[role="status"]').filter({
          hasText: /Loki was here/,
        });
        await expect(toast).toContainText(
          "Loki was here. Your data is fine. Probably."
        );

        // Assert: Toast has gold color
        await expect(toast).toHaveCSS("color", /f0c040|rgb\(240,\s*192,\s*64\)/i);

        // Wait for the toast to fade after 5 seconds
        await page.waitForTimeout(5500);
      }
    });

    test("should not trigger Loki Mode with fewer than 7 clicks", async ({
      page,
    }) => {
      const lokiLink = page.locator('[data-loki-trigger]');

      if (await lokiLink.isVisible()) {
        // Click only 5 times
        for (let i = 0; i < 5; i++) {
          await lokiLink.click();
        }

        // Assert: Toast should NOT appear
        const toast = page.locator('[role="status"]').filter({
          hasText: /Loki was here/,
        });
        await expect(toast).not.toBeVisible();
      }
    });
  });

  test.describe("Modal UI & Interactions", () => {
    test("should close modal when clicking the X button", async ({ page }) => {
      // Clear storage and open any modal
      await clearEggStorage(page, [EGG_STORAGE_KEYS.forgemaster]);

      await page.keyboard.press("Shift+Slash");

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();

      // Click the X close button
      const closeButton = dialog.locator('button[aria-label="Close"]').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        // Fallback: click the "So it is written" button
        const dismissButton = dialog.locator(
          'button:has-text("So it is written")'
        );
        await dismissButton.click();
      }

      // Assert: Modal closes
      await expect(dialog).not.toBeVisible();
    });

    test("should have correct modal styling (dark theme, gold text)", async ({
      page,
    }) => {
      await clearEggStorage(page, [EGG_STORAGE_KEYS.forgemaster]);

      await page.keyboard.press("Shift+Slash");

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();

      // Assert: Modal has dark background
      await expect(dialog).toHaveCSS(
        "background-color",
        /rgb\(15,\s*16,\s*24\)|#0f1018/i
      );

      // Assert: Title is gold colored
      const title = dialog.locator('[role="dialog"] h2').first();
      await expect(title).toHaveCSS("color", /f0b429|rgb\(240,\s*180,\s*41\)/i);
    });

    test("should be responsive on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await clearEggStorage(page, [EGG_STORAGE_KEYS.forgemaster]);

      await page.keyboard.press("Shift+Slash");

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();

      // Assert: Modal uses full width minus small margin (92vw)
      const boundingBox = await dialog.boundingBox();
      expect(boundingBox?.width).toBeGreaterThan(300);
      expect(boundingBox?.width).toBeLessThan(375);
    });
  });

  test.describe("Fragment Count Tracking", () => {
    test("should track multiple fragments found across eggs", async ({
      page,
    }) => {
      // Clear all storage
      await clearAllEggStorage(page);

      // Trigger egg #3 (Roots of a Mountain)
      const collapseButton = page
        .locator('button[aria-label*="collapse"], button[aria-label*="toggle"]')
        .first();
      if (await collapseButton.isVisible()) {
        await collapseButton.click();

        let dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toContainText("The Roots of a Mountain");
        // Fragment count should be "1 of 6"
        await expect(dialog).toContainText(/1 of 6/);

        // Dismiss
        const dismissButton = dialog.locator(
          'button:has-text("So it is written")'
        );
        await dismissButton.click();
        await expect(dialog).not.toBeVisible();
      }

      // Now trigger egg #5 (Breath of a Fish)
      const copyrightSymbol = page.locator(
        '[data-gleipnir="breath-of-a-fish"]'
      );
      if (await copyrightSymbol.isVisible()) {
        await copyrightSymbol.hover();

        dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toContainText("The Breath of a Fish");
        // Fragment count should now be "2 of 6"
        await expect(dialog).toContainText(/2 of 6/);

        // Dismiss
        const dismissButton = dialog.locator(
          'button:has-text("So it is written")'
        );
        await dismissButton.click();
        await expect(dialog).not.toBeVisible();
      }

      // Verify egg #9 also sees the count
      await clearEggStorage(page, [EGG_STORAGE_KEYS.forgemaster]);
      await page.keyboard.press("Shift+Slash");

      dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toContainText("The Forgemaster's Signature");
      // Fragment count should be "2 of 6"
      await expect(dialog).toContainText(/2 of 6/);
    });

    test("should show special message when all 6 fragments are found", async ({
      page,
    }) => {
      // Manually set all 6 fragments to found
      await page.evaluate(() => {
        for (let i = 1; i <= 6; i++) {
          localStorage.setItem(`egg:gleipnir-${i}`, "1");
        }
      });

      // Open any egg modal
      await page.keyboard.press("Shift+Slash");

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();

      // Assert: Special message appears for complete collection
      await expect(dialog).toContainText(/6 of 6|Gleipnir is complete/i);
    });
  });

  test.describe("SVG Artifact Transparency Validation", () => {
    test("should render gleipnir-3.svg with transparent background (Mountain Roots)", async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/easter-eggs/gleipnir-3.svg`);
      await page.waitForLoadState("networkidle");

      // Assert: SVG loads successfully
      const svg = page.locator("svg").first();
      await expect(svg).toBeVisible();

      // Assert: No background rect with fill="#07070d" (void-black color)
      const backgroundRect = svg.locator(
        'rect[fill="#07070d"], rect[fill="07070d"], rect[width="1024"][height="1024"]'
      );
      await expect(backgroundRect).toHaveCount(0);

      // Assert: SVG renders (take screenshot to confirm visual rendering)
      const screenshot = await page.screenshot();
      expect(screenshot.length).toBeGreaterThan(1000); // Sanity check: not empty
    });

    test("should render gleipnir-4.svg with transparent background (Bear Sinews)", async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/easter-eggs/gleipnir-4.svg`);
      await page.waitForLoadState("networkidle");

      // Assert: SVG loads successfully
      const svg = page.locator("svg").first();
      await expect(svg).toBeVisible();

      // Assert: No background rect with void-black fill
      const backgroundRect = svg.locator(
        'rect[fill="#07070d"], rect[fill="07070d"]'
      );
      await expect(backgroundRect).toHaveCount(0);

      // Assert: SVG renders
      const screenshot = await page.screenshot();
      expect(screenshot.length).toBeGreaterThan(1000);
    });

    test("should render gleipnir-5.svg with transparent background (Fish Breath)", async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/easter-eggs/gleipnir-5.svg`);
      await page.waitForLoadState("networkidle");

      // Assert: SVG loads successfully
      const svg = page.locator("svg").first();
      await expect(svg).toBeVisible();

      // Assert: No background rect with void-black fill
      const backgroundRect = svg.locator(
        'rect[fill="#07070d"], rect[fill="07070d"]'
      );
      await expect(backgroundRect).toHaveCount(0);

      // Assert: SVG renders
      const screenshot = await page.screenshot();
      expect(screenshot.length).toBeGreaterThan(1000);
    });

    test("should render gleipnir-6.svg with transparent background (Bird Spittle)", async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/easter-eggs/gleipnir-6.svg`);
      await page.waitForLoadState("networkidle");

      // Assert: SVG loads successfully
      const svg = page.locator("svg").first();
      await expect(svg).toBeVisible();

      // Assert: No background rect with void-black fill
      const backgroundRect = svg.locator(
        'rect[fill="#07070d"], rect[fill="07070d"]'
      );
      await expect(backgroundRect).toHaveCount(0);

      // Assert: SVG renders
      const screenshot = await page.screenshot();
      expect(screenshot.length).toBeGreaterThan(1000);
    });

    test("should render forgemaster.svg with transparent background (Forgemaster)", async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/easter-eggs/forgemaster.svg`);
      await page.waitForLoadState("networkidle");

      // Assert: SVG loads successfully
      const svg = page.locator("svg").first();
      await expect(svg).toBeVisible();

      // Note: forgemaster.svg has internal hardie/pritchel holes with #07070d fill
      // (intentional design element), but should NOT have a full 1024x1024 background rect.
      // Assert: No background rect with width="1024" and height="1024" (which would be a cover rect)
      const coverRect = svg.locator('rect[width="1024"][height="1024"]');
      await expect(coverRect).toHaveCount(0);

      // Assert: SVG renders
      const screenshot = await page.screenshot();
      expect(screenshot.length).toBeGreaterThan(1000);
    });
  });
});
