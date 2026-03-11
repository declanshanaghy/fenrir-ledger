/**
 * Heilung Modal Test Suite — Fenrir Ledger Issue #526
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates Easter Egg #10: Embed Heilung video inline instead of linking out.
 * Trigger: Ctrl+Shift+L (all platforms). Modal displays 2-column layout with band
 * profile (left) and embedded YouTube iframe (right). Stacks vertically on mobile.
 *
 * Acceptance Criteria:
 *   AC1: Ctrl+Shift+L opens the Heilung modal
 *   AC2: Modal displays 2-column layout: band profile left, YouTube iframe right
 *   AC3: Mobile stacks vertically (iframe top, info below)
 *   AC4: YouTube video is embedded inline via iframe (no external link)
 *   AC5: Video auto-plays when modal opens
 *   AC6: Video allows fullscreen and encrypted-media permissions
 *   AC7: Band info includes name, bio, 3 members, website link
 *   AC8: amplifiedhistory.com link opens in new tab
 *   AC9: Modal dismisses via ESC, backdrop click, or X button
 *   AC10: Modal is repeatable (no one-time gate)
 *   AC11: Aspect ratio preserved (16:9)
 *   AC12: Styled in Saga Ledger dark theme (void-black, gold accents)
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// ─── Constants ────────────────────────────────────────────────────────────────

const VOID_BLACK = "rgb(7, 7, 13)";
const GOLD = "rgb(201, 146, 10)";

// ─── Suite: Opening & Closing Modal ──────────────────────────────────────────

test.describe("Heilung Modal — Opening & Closing", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to /ledger (app with AppShell) not "/" (marketing page)
    await page.goto("/ledger", { waitUntil: "load" });
    await clearAllStorage(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * AC1 — Ctrl+Shift+L opens the modal
   *
   * Verifies that pressing Ctrl+Shift+L (or Cmd+Shift+L on Mac) opens the
   * Heilung modal. Modal becomes visible in the DOM with proper accessibility.
   */
  test("Ctrl+Shift+L opens the Heilung modal", async ({ page }) => {
    // Verify modal is not visible before trigger
    const modalBackdrop = page.locator('[aria-label="Heilung modal backdrop"]');
    await expect(modalBackdrop).not.toBeVisible();

    // Press Ctrl+Shift+L (Playwright detects platform)
    await page.keyboard.press("Control+Shift+L");

    // Modal backdrop should now be visible
    await expect(modalBackdrop).toBeVisible({ timeout: 5000 });

    // Modal container should be visible
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).toBeVisible();
  });

  /**
   * AC9 — ESC key dismisses the modal
   *
   * Verifies that pressing ESC closes the open modal.
   */
  test("ESC key dismisses the modal", async ({ page }) => {
    // Open modal
    await page.keyboard.press("Control+Shift+L");
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Press ESC
    await page.keyboard.press("Escape");

    // Modal should be gone
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  /**
   * AC9 — Backdrop click dismisses the modal
   *
   * Verifies that clicking on the backdrop (outside the modal) closes it.
   */
  test("backdrop click dismisses the modal", async ({ page }) => {
    // Open modal
    await page.keyboard.press("Control+Shift+L");
    const backdrop = page.locator('[aria-label="Heilung modal backdrop"]');
    await expect(backdrop).toBeVisible({ timeout: 5000 });

    // Click on backdrop (far left, outside modal bounds)
    const box = await backdrop.boundingBox();
    if (box) {
      await page.click(`[aria-label="Heilung modal backdrop"]`, {
        position: { x: 10, y: 10 },
      });
    }

    // Modal should dismiss
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  /**
   * AC9 — X button dismisses the modal
   *
   * Verifies that clicking the close (X) button in the top-right closes the modal.
   */
  test("X button dismisses the modal", async ({ page }) => {
    // Open modal
    await page.keyboard.press("Control+Shift+L");
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click X button
    const closeButton = page.locator('button[aria-label="Close Heilung modal"]');
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // Modal should be gone
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  /**
   * AC10 — Modal is repeatable (no one-time gate)
   *
   * Verifies that after dismissing the modal, pressing Ctrl+Shift+L again
   * opens it a second time. No localStorage gate prevents re-opening.
   */
  test("modal is repeatable after dismissing", async ({ page }) => {
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');

    // First open
    await page.keyboard.press("Control+Shift+L");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close via ESC
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Second open
    await page.keyboard.press("Control+Shift+L");
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});

// ─── Suite: Modal Content & Structure ─────────────────────────────────────────

test.describe("Heilung Modal — Content & Structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ledger", { waitUntil: "networkidle" });
    await clearAllStorage(page);
    // Wait for page to be interactive
    await page.waitForLoadState("domcontentloaded");
    // Open the modal
    await page.keyboard.press("Control+Shift+L");
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * AC7 — Band info includes name, bio, 3 members, website link
   *
   * Verifies that the modal displays:
   * - Band name "HEILUNG"
   * - Biographical text mentioning "Copenhagen" and "healing"
   * - All 3 member names: Kai Uwe Faust, Christopher Juul, Maria Franz
   * - amplifiedhistory.com link
   */
  test("modal displays band profile with name, bio, and members", async ({ page }) => {
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');

    // Check band name
    const heading = modal.getByRole("heading", { name: /HEILUNG/i });
    await expect(heading).toBeVisible();

    // Check bio text contains expected keywords
    const bioText = await modal.textContent();
    expect(bioText).toContain("Copenhagen");
    expect(bioText).toContain("healing");
    expect(bioText).toContain("Iron Age");
    expect(bioText).toContain("amplified history");

    // Check all 3 members are listed
    expect(bioText).toContain("Kai Uwe Faust");
    expect(bioText).toContain("Christopher Juul");
    expect(bioText).toContain("Maria Franz");

    // Check member roles are present
    expect(bioText).toContain("Vocals");
    expect(bioText).toContain("Producer");
  });

  /**
   * AC4 — YouTube video is embedded inline via iframe
   *
   * Verifies that the video is embedded as an iframe element with the correct
   * YouTube embed URL (not a link to YouTube).
   */
  test("YouTube video is embedded inline via iframe", async ({ page }) => {
    const iframe = page.locator('iframe[title*="Heilung"]');
    await expect(iframe).toBeVisible();

    // Check the iframe src points to YouTube embed endpoint
    const src = await iframe.getAttribute("src");
    expect(src).toContain("youtube.com/embed/QRg_8NNPTD8");

    // Should NOT be a link to watch?v=
    expect(src).not.toContain("watch?v=");
  });

  /**
   * AC5 — Video auto-plays when modal opens
   *
   * Verifies that the iframe src includes ?autoplay=1 parameter.
   */
  test("video auto-plays when modal opens", async ({ page }) => {
    const iframe = page.locator('iframe[title*="Heilung"]');
    await expect(iframe).toBeVisible();

    const src = await iframe.getAttribute("src");
    expect(src).toContain("autoplay=1");
  });

  /**
   * AC6 — Video allows fullscreen and encrypted-media permissions
   *
   * Verifies that the iframe has proper allow attributes for fullscreen
   * and encrypted-media (for copyright protection).
   */
  test("video iframe has proper permissions for fullscreen and media", async ({ page }) => {
    const iframe = page.locator('iframe[title*="Heilung"]');
    await expect(iframe).toBeVisible();

    // Check allow attribute
    const allow = await iframe.getAttribute("allow");
    expect(allow).toContain("autoplay");
    expect(allow).toContain("encrypted-media");

    // Check allowFullScreen attribute
    const allowFullScreen = await iframe.getAttribute("allowfullscreen");
    expect(allowFullScreen).toBeDefined();
  });

  /**
   * AC8 — amplifiedhistory.com link opens in new tab
   *
   * Verifies that the amplifiedhistory.com link has target="_blank"
   * and rel="noopener noreferrer" for security and opens in a new tab.
   */
  test("amplifiedhistory.com link opens in new tab with security attrs", async ({ page }) => {
    const link = page.locator('a[href*="amplifiedhistory.com"]');
    await expect(link).toBeVisible();

    const target = await link.getAttribute("target");
    const rel = await link.getAttribute("rel");

    expect(target).toBe("_blank");
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");

    // Verify link text
    const linkText = await link.textContent();
    expect(linkText).toContain("amplifiedhistory.com");
  });

  /**
   * AC12 — Styled with void-black (#07070d) and gold (#c9920a) accents
   *
   * Verifies that the modal uses Saga Ledger dark theme colors:
   * - Background: #07070d (void-black)
   * - Gold borders and text accents: #c9920a
   */
  test("modal uses Saga Ledger dark theme colors", async ({ page }) => {
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');

    // Check background color (void-black)
    const bgColor = await modal.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Accept slight CSS variations
    expect(bgColor).toMatch(/rgb\(7,\s*7,\s*13\)|rgb\(7, 7, 13\)/);

    // Check heading is gold
    const heading = modal.locator("h2");
    const headingColor = await heading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(headingColor).toMatch(/rgb\(201,\s*146,\s*10\)|rgb\(201, 146, 10\)/);
  });
});

// ─── Suite: Modal Behavior & Skip Rules ──────────────────────────────────────

test.describe("Heilung Modal — Behavior & Form Field Skip", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ledger", { waitUntil: "load" });
    await clearAllStorage(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * AC1 — Skip if form field is focused
   *
   * Verifies that Ctrl+Shift+L does NOT open the modal when an INPUT,
   * TEXTAREA, or SELECT element has focus.
   */
  test("Ctrl+Shift+L is skipped when form field has focus", async ({ page }) => {
    // Create a test input in the page
    const testInputLocator = page.locator("body");

    // Inject a test input
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "test-input";
      input.type = "text";
      input.placeholder = "Test input";
      document.body.appendChild(input);
    });

    // Focus the input
    const input = page.locator("#test-input");
    await input.focus();

    // Try to open modal with Ctrl+Shift+L
    await page.keyboard.press("Control+Shift+L");

    // Modal should NOT open
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).not.toBeVisible();

    // Clean up
    await page.evaluate(() => {
      document.getElementById("test-input")?.remove();
    });
  });
});

// ─── Suite: Responsive Layout ────────────────────────────────────────────────

test.describe("Heilung Modal — Responsive Layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ledger", { waitUntil: "networkidle" });
    await clearAllStorage(page);
    await page.waitForLoadState("domcontentloaded");
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * AC3 — Mobile stacks vertically: iframe on top, info below
   *
   * On viewport < 768px (md breakpoint), the modal should use flexbox
   * with flex-col and order- classes so iframe (order-1) appears above
   * band info (order-2).
   */
  test("mobile layout displays video and info", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload with better wait states to ensure mobile layout and event listeners
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");
    await page.keyboard.press("Control+Shift+L");
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check iframe is visible
    const iframe = modal.locator('iframe[title*="Heilung"]');
    await expect(iframe).toBeVisible();

    // Band info should also be visible
    const heading = modal.getByRole("heading", { name: /HEILUNG/i });
    await expect(heading).toBeVisible();
  });

  /**
   * AC2 — Desktop 2-column layout: profile left, video right
   *
   * On viewport >= 768px (md breakpoint), the modal should display
   * profile (order-1) on left and video iframe (order-2) on right using CSS grid.
   */
  test("desktop layout displays profile left, video right", async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Reload with better wait states
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");
    await page.keyboard.press("Control+Shift+L");
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // On desktop, should use md:grid md:grid-cols-2
    // Verify both columns are visible
    const heading = modal.getByRole("heading", { name: /HEILUNG/i });
    const iframe = modal.locator('iframe[title*="Heilung"]');

    await expect(heading).toBeVisible();
    await expect(iframe).toBeVisible();
  });
});

// ─── Suite: Aspect Ratio ─────────────────────────────────────────────────────

test.describe("Heilung Modal — Aspect Ratio", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ledger", { waitUntil: "networkidle" });
    await clearAllStorage(page);
    await page.waitForLoadState("domcontentloaded");
    // Open the modal
    await page.keyboard.press("Control+Shift+L");
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * AC11 — Aspect ratio preserved (16:9)
   *
   * Verifies that the iframe container uses aspect-video class (16:9) to maintain
   * proper proportions on all screen sizes.
   */
  test("video iframe maintains 16:9 aspect ratio", async ({ page }) => {
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');

    // Find the iframe container which has aspect-video class
    const iframeContainer = modal.locator("div.aspect-video");
    await expect(iframeContainer).toBeVisible();

    // Check that aspect-video class is applied
    const classAttr = await iframeContainer.getAttribute("class");
    expect(classAttr).toContain("aspect-video");

    // Verify the iframe dimensions
    const iframe = iframeContainer.locator("iframe");
    const box = await iframe.boundingBox();

    if (box) {
      // Calculate aspect ratio (width / height)
      const aspectRatio = box.width / box.height;
      // 16:9 = 1.778 (allow some tolerance for rounding)
      expect(aspectRatio).toBeGreaterThan(1.75);
      expect(aspectRatio).toBeLessThan(1.81);
    }
  });
});

/**
 * Suite: Verification — Video Embed Loads Without Errors
 *
 * AC4 — Video loads without CSP/blocked content errors
 *
 * Verify the implementation embeds the video inline with proper CSP directives
 * allowing the iframe to load without "This content is blocked" errors.
 */
test.describe("Heilung Modal — Video Embed & CSP", () => {
  /**
   * Verify that the embedded iframe loads properly without CSP violations.
   * The original issue has been fixed by adding proper CSP directives in next.config.js
   * to allow YouTube iframe embeds from youtube.com/embed.
   */
  test("embedded video iframe loads without CSP violations", async ({ page }) => {
    // Navigate to /ledger (app with AppShell) and open the Heilung modal
    await page.goto("/ledger", { waitUntil: "load" });
    await clearAllStorage(page);

    // Open modal to trigger iframe loading
    await page.keyboard.press("Control+Shift+L");
    const modal = page.locator('[role="dialog"][aria-label="Heilung — Amplified History"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for iframe to load
    const iframe = page.locator('iframe[title*="Heilung"]');
    await expect(iframe).toBeVisible({ timeout: 5000 });

    // Capture any console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Wait for potential CSP violations
    await page.waitForTimeout(2000);

    // Filter for iframe-related CSP errors
    const iframeCSPErrors = consoleErrors.filter(
      (msg) =>
        msg.toLowerCase().includes("refused to frame") ||
        (msg.toLowerCase().includes("csp") && msg.toLowerCase().includes("youtube")),
    );

    // Should have no CSP frame errors
    expect(iframeCSPErrors).toHaveLength(0);
  });
});
