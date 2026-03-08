/**
 * Audio Autoplay Test Suite — Issue #219
 *
 * Validates audio playback in EasterEggModal handles browser autoplay policy:
 * - No NotAllowedError in console when easter egg modals open
 * - Audio plays when browser autoplay policy allows it
 * - Graceful fallback when autoplay is blocked — no error logged
 *
 * Browser autoplay policy requires a user gesture (like a keypress) to play
 * audio. Our modals are triggered via keyboard shortcuts, which count as
 * user gestures. However, in headless environments or when autoplay is
 * explicitly blocked, the audio.play() promise may reject with:
 * - NotAllowedError: autoplay policy blocked the request
 * - AbortError: playback was aborted (e.g., by browser navigation)
 *
 * The fix in EasterEggModal.tsx silently ignores these errors, preventing
 * console spam while allowing graceful fallback.
 */

import { test, expect } from "@playwright/test";

// ── Helper: Clear localStorage for Forgemaster egg ──────────────────────

async function clearForgemasterStorage(page: any) {
  await page.evaluate(() => {
    localStorage.removeItem("egg:forgemaster");
  });
}

// ── Test Suite ──────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Navigate to the app root — baseURL is set in playwright.config.ts
  await page.goto("/");
  // Clear forgemaster storage before each test
  await clearForgemasterStorage(page);
  // Wait for app to hydrate
  await page.waitForLoadState("networkidle");
});

test.describe("Audio Autoplay — Issue #219", () => {
  test("should not log NotAllowedError when autoplay is blocked", async ({
    page,
  }) => {
    // Collect console warnings/errors
    const consoleLogs: Array<{ type: string; text: string }> = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
        });
      }
    });

    // Open the Forgemaster egg modal (has audioSrc)
    // This is triggered via Shift+/ (the ? key)
    await page.keyboard.press("Shift+Slash");

    // Wait for modal to appear
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText("The Forgemaster's Signature");

    // Wait a moment for any audio playback attempts to complete
    await page.waitForTimeout(1000);

    // Dismiss the modal
    const dismissButton = dialog.locator('button:has-text("So it is written")');
    await dismissButton.click();

    // Assert: No NotAllowedError was logged
    // (Note: AbortError is OK, NotAllowedError from autoplay policy should be silently ignored)
    const notAllowedErrors = consoleLogs.filter(
      (log) =>
        log.type === "error" &&
        log.text.includes("NotAllowedError") &&
        log.text.includes("audio")
    );

    expect(notAllowedErrors).toHaveLength(0);
  });

  test("should silently handle autoplay blocks without console warnings", async ({
    page,
  }) => {
    // Collect all console output
    const consoleMessages: string[] = [];

    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    // Navigate with explicit focus (simulates user interaction)
    await page.keyboard.press("Shift+Slash");

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText("The Forgemaster's Signature");

    // Wait for audio attempts
    await page.waitForTimeout(500);

    // Dismiss
    const dismissButton = dialog.locator('button:has-text("So it is written")');
    await dismissButton.click();

    // Assert: No warning logs about audio playback errors
    const warningLogs = consoleMessages.filter(
      (msg) =>
        msg.includes("[EasterEggModal] audio playback error") ||
        msg.includes("NotAllowedError")
    );

    expect(warningLogs).toHaveLength(0);
  });

  test("should attempt audio playback when modal with audioSrc opens", async ({
    page,
  }) => {
    // Listen for audio element creation and play attempts
    let audioPlayAttempted = false;

    await page.evaluate(() => {
      // Patch Audio.prototype.play to track calls
      const originalPlay = HTMLMediaElement.prototype.play;
      (window as any).audioPlayAttempts = 0;

      HTMLMediaElement.prototype.play = function () {
        (window as any).audioPlayAttempts++;
        audioPlayAttempted = true;
        // Don't actually try to play to avoid autoplay errors in test
        return Promise.resolve();
      };
    });

    // Open the Forgemaster egg (has audioSrc: "/sounds/fenrir-growl.mp3")
    await page.keyboard.press("Shift+Slash");

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText("The Forgemaster's Signature");

    // Check if play was attempted
    const playAttempts = await page.evaluate(() => (window as any).audioPlayAttempts);
    expect(playAttempts).toBeGreaterThan(0);

    // Dismiss
    const dismissButton = dialog.locator('button:has-text("So it is written")');
    await dismissButton.click();
  });

  test("should handle AbortError gracefully when audio is paused", async ({
    page,
  }) => {
    const consoleLogs: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleLogs.push(msg.text());
      }
    });

    // Open modal
    await page.keyboard.press("Shift+Slash");

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText("The Forgemaster's Signature");

    // Immediately dismiss (which pauses audio)
    const dismissButton = dialog.locator('button:has-text("So it is written")');
    await dismissButton.click();

    await page.waitForTimeout(500);

    // Assert: No errors logged even though audio was paused mid-play
    const errorLogs = consoleLogs.filter(
      (msg) =>
        msg.includes("error") ||
        msg.includes("[EasterEggModal]") ||
        msg.includes("AbortError")
    );

    expect(errorLogs.length).toBeLessThanOrEqual(0);
  });

  test("should show modal content correctly regardless of audio playback", async ({
    page,
  }) => {
    // Clear storage
    await clearForgemasterStorage(page);

    // Open the Forgemaster egg
    await page.keyboard.press("Shift+Slash");

    const dialog = page.locator('[role="dialog"]').first();

    // Assert: Modal content is fully rendered
    await expect(dialog).toContainText("The Forgemaster's Signature");
    await expect(dialog).toContainText("Freya");
    await expect(dialog).toContainText("Luna");
    await expect(dialog).toContainText("FiremanDecko");
    await expect(dialog).toContainText("Loki");

    // Assert: Image is loaded
    const modalImage = dialog.locator("img").first();
    await expect(modalImage).toHaveAttribute("src", /forgemaster\.svg/);

    // Assert: Dismiss button is present and clickable
    const dismissButton = dialog.locator('button:has-text("So it is written")');
    await expect(dismissButton).toBeVisible();

    // Verify the modal closes successfully
    await dismissButton.click();
    await expect(dialog).not.toBeVisible();
  });

  test("should not re-open modal on second trigger after audio playback", async ({
    page,
  }) => {
    // First open
    await page.keyboard.press("Shift+Slash");

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText("The Forgemaster's Signature");

    // Wait for audio to finish
    await page.waitForTimeout(1000);

    // Dismiss
    const dismissButton = dialog.locator('button:has-text("So it is written")');
    await dismissButton.click();
    await expect(dialog).not.toBeVisible();

    // Second trigger (should NOT open due to localStorage gate)
    await page.keyboard.press("Shift+Slash");
    await page.waitForTimeout(500);

    const dialogAgain = page.locator('[role="dialog"]').first();
    await expect(dialogAgain).not.toBeVisible({ timeout: 2000 });
  });

  test("should handle missing or invalid audio file gracefully", async ({
    page,
  }) => {
    const consoleLogs: string[] = [];

    page.on("console", (msg) => {
      consoleLogs.push(msg.text());
    });

    // Navigate to trigger egg
    await page.keyboard.press("Shift+Slash");

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();

    await page.waitForTimeout(500);

    // Assert: Modal is still interactive despite potential audio issues
    const dismissButton = dialog.locator('button:has-text("So it is written")');
    await expect(dismissButton).toBeVisible();
    await expect(dismissButton).toBeEnabled();

    // Dismiss successfully
    await dismissButton.click();
    await expect(dialog).not.toBeVisible();

    // Assert: No unhandled errors in console
    const errorCount = consoleLogs.filter((msg) => msg.includes("error")).length;
    // Allow 0-1 errors (network error for audio file is acceptable)
    expect(errorCount).toBeLessThanOrEqual(1);
  });

  test.describe("Error Handling Edge Cases", () => {
    test("should handle NotAllowedError specifically (not other DOMExceptions)", async ({
      page,
    }) => {
      const consoleLogs: { type: string; text: string }[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error" || msg.type() === "warning") {
          consoleLogs.push({
            type: msg.type(),
            text: msg.text(),
          });
        }
      });

      // Mock audio.play to reject with NotAllowedError
      await page.evaluate(() => {
        HTMLMediaElement.prototype.play = function () {
          const error = new DOMException(
            "Autoplay blocked",
            "NotAllowedError"
          );
          return Promise.reject(error);
        };
      });

      // This should open without logging
      await page.keyboard.press("Shift+Slash");

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();

      await page.waitForTimeout(500);

      // The catch block should silently ignore NotAllowedError
      const notAllowedLogs = consoleLogs.filter(
        (log) =>
          log.type === "warning" &&
          log.text.includes("[EasterEggModal] audio playback error") &&
          log.text.includes("NotAllowedError")
      );

      expect(notAllowedLogs).toHaveLength(0);

      // Dismiss
      const dismissButton = dialog.locator(
        'button:has-text("So it is written")'
      );
      await dismissButton.click();
    });

    test("should log other DOMException errors (not NotAllowedError or AbortError)", async ({
      page,
    }) => {
      const consoleWarnings: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "warning") {
          consoleWarnings.push(msg.text());
        }
      });

      // Mock audio.play to reject with a different DOMException
      await page.evaluate(() => {
        HTMLMediaElement.prototype.play = function () {
          const error = new DOMException(
            "Something unexpected",
            "SecurityError"
          );
          return Promise.reject(error);
        };
      });

      // Open modal
      await page.keyboard.press("Shift+Slash");

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();

      await page.waitForTimeout(500);

      // SecurityError SHOULD be logged (only NotAllowedError and AbortError are silently ignored)
      const securityErrorLogs = consoleWarnings.filter(
        (msg) =>
          msg.includes("[EasterEggModal] audio playback error") &&
          msg.includes("SecurityError")
      );

      // We expect the error to be logged
      expect(securityErrorLogs.length).toBeGreaterThan(0);

      // Dismiss
      const dismissButton = dialog.locator(
        'button:has-text("So it is written")'
      );
      await dismissButton.click();
    });

    test("should ignore non-DOMException errors silently", async ({ page }) => {
      const consoleWarnings: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "warning") {
          consoleWarnings.push(msg.text());
        }
      });

      // Mock audio.play to reject with a plain Error (not DOMException)
      await page.evaluate(() => {
        HTMLMediaElement.prototype.play = function () {
          return Promise.reject(new Error("Network error"));
        };
      });

      // Open modal
      await page.keyboard.press("Shift+Slash");

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();

      await page.waitForTimeout(500);

      // Non-DOMException errors should be ignored (caught by the instanceof check)
      const networkErrorLogs = consoleWarnings.filter(
        (msg) =>
          msg.includes("[EasterEggModal] audio playback error") &&
          msg.includes("Network error")
      );

      expect(networkErrorLogs).toHaveLength(0);

      // Dismiss
      const dismissButton = dialog.locator(
        'button:has-text("So it is written")'
      );
      await dismissButton.click();
    });
  });
});
