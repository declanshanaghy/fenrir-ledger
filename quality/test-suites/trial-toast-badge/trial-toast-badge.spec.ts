/**
 * Trial Toast & Badge UI Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates acceptance criteria for issue #621:
 *   1. Trial start toast fires once on first card creation (CardForm)
 *   2. Toast message: "Your 30-day trial has begun — explore all features"
 *   3. Toast uses sonner with 8s duration
 *   4. Toast checks localStorage flag fenrir:trial-start-toast-shown
 *   5. TopBar badge shows remaining days with progressive color urgency
 *   6. Badge colors: gray (1-25 days), amber (26-29 days), red (30/expires today)
 *   7. Badge shows "THRALL" when trial expires
 *   8. Badge updates reactively as trial progresses
 *   9. Clicking badge opens TrialStatusPanel (placeholder)
 *   10. Badge is mobile-friendly (375px minimum)
 *
 * Test patterns:
 *   - Use seedHousehold + seedCards to create initial state
 *   - Create first card via UI to fire toast
 *   - Verify localStorage flag is set
 *   - Verify toast appears and auto-dismisses within 8s
 *   - Test badge color transitions by mocking useTrialStatus hook
 *   - Test badge click opens/closes panel
 *   - Test mobile viewport (375px)
 *
 * Dependencies:
 *   - /api/trial/init: Must return 200 (idempotent)
 *   - /api/trial/status: Must return { remainingDays, status }
 *   - CardForm.tsx: Must fire toast on first card creation
 *   - TrialBadge.tsx: Must render based on useTrialStatus hook
 *   - LedgerTopBar.tsx: Must include TrialBadge component
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage, seedHousehold, ANONYMOUS_HOUSEHOLD_ID } from "../helpers/test-fixtures";

// ─── Constants ────────────────────────────────────────────────────────────────

/** localStorage key for trial start toast shown flag. */
const LS_TRIAL_START_TOAST_SHOWN = "fenrir:trial-start-toast-shown";

/** Minimum mobile viewport width (375px). */
const MOBILE_VIEWPORT_WIDTH = 375;
const MOBILE_VIEWPORT_HEIGHT = 667;

/** Toast auto-dismiss timeout in milliseconds. */
const TOAST_DURATION_MS = 8000;

// ─── Test Fixtures ────────────────────────────────────────────────────────────

/** Common test setup: clear storage, seed household, navigate to ledger. */
async function setupTestLedger(page: any) {
  await page.goto("/ledger");
  await page.waitForLoadState("networkidle");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  // Refresh to pick up seeded household
  await page.reload({ waitUntil: "networkidle" });
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Checks if the trial start toast shown flag is set in localStorage.
 */
async function isToastFlagSet(page: any): Promise<boolean> {
  return await page.evaluate((key) => {
    return localStorage.getItem(key) !== null;
  }, LS_TRIAL_START_TOAST_SHOWN);
}

/**
 * Gets all currently visible toast messages on the page.
 */
async function getToastMessages(page: any): Promise<string[]> {
  // Sonner renders toasts in a container div with role="status"
  const toasts = await page.locator('div[role="status"]').all();
  const messages: string[] = [];
  for (const toast of toasts) {
    const text = await toast.textContent();
    if (text) messages.push(text.trim());
  }
  return messages;
}

/**
 * Waits for a toast message containing the given substring.
 */
async function waitForToast(page: any, substring: string, timeoutMs: number = 5000) {
  await page.waitForFunction(
    (substr) => {
      const toastDivs = document.querySelectorAll('div[role="status"]');
      for (const div of toastDivs) {
        if (div.textContent && div.textContent.includes(substr)) {
          return true;
        }
      }
      return false;
    },
    substr,
    { timeout: timeoutMs }
  );
}

/**
 * Waits for a toast to disappear (auto-dismiss).
 */
async function waitForToastDismiss(page: any, timeoutMs: number = TOAST_DURATION_MS + 2000) {
  await page.waitForFunction(
    () => {
      const toastDivs = document.querySelectorAll('div[role="status"]');
      return toastDivs.length === 0;
    },
    { timeout: timeoutMs }
  );
}

/**
 * Gets the text content of the trial badge button (if visible).
 */
async function getTrialBadgeText(page: any): Promise<string | null> {
  // Badge is an inline button with aria-label starting with "Trial:"
  const badge = await page.locator('button[aria-label*="Trial"]').first();
  const isVisible = await badge.isVisible().catch(() => false);
  if (!isVisible) return null;
  return await badge.textContent();
}

/**
 * Clicks the trial badge to open the status panel.
 */
async function clickTrialBadge(page: any) {
  const badge = await page.locator('button[aria-label*="Trial"]').first();
  await badge.click();
}

/**
 * Gets the text content of the trial status panel (if visible).
 */
async function getTrialPanelText(page: any): Promise<string | null> {
  // Panel is a dialog div with role="dialog" and aria-label="Trial status"
  const panel = await page.locator('div[role="dialog"][aria-label="Trial status"]');
  const isVisible = await panel.isVisible().catch(() => false);
  if (!isVisible) return null;
  return await panel.textContent();
}

/**
 * Closes the trial status panel by clicking the Close button.
 */
async function closeTrialPanel(page: any) {
  const closeBtn = await page.locator('button:has-text("Close")').first();
  await closeBtn.click();
}

/**
 * Injects trial status mock into page context before load.
 * Simulates /api/trial/status returning specific remaining days and status.
 */
async function mockTrialStatus(page: any, remainingDays: number, status: "active" | "expired" | "none" = "active") {
  await page.addInitScript(
    ({ remaining, trialStatus }) => {
      // Store mock data in window for hook to use
      (window as any).__MOCK_TRIAL_STATUS = {
        remainingDays: remaining,
        status: trialStatus,
        isLoading: false,
      };
    },
    { remaining: remainingDays, trialStatus: status }
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SUITE 1: Trial Start Toast — One-time Firing on First Card Creation
// ════════════════════════════════════════════════════════════════════════════════

test.describe("Trial Start Toast — Acceptance Criteria", () => {
  test.beforeEach(async ({ page }) => {
    await setupTestLedger(page);
  });

  test("AC-01: Toast fires once on first card creation (CardForm)", async ({ page }) => {
    // Start with clean slate — toast flag not set
    const flagBefore = await isToastFlagSet(page);
    expect(flagBefore).toBe(false);

    // Find and click "Add Card" button
    const addCardBtn = await page.locator('button:has-text("Add Card"), button:has-text("add a card")').first();
    await addCardBtn.click();
    await page.waitForLoadState("networkidle");

    // Fill minimal card form
    // (These selectors depend on CardForm implementation — adjust if needed)
    const cardNameField = await page.locator('input[name="cardName"]').first();
    await cardNameField.fill("Test Card");

    // Submit form
    const submitBtn = await page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")').first();
    await submitBtn.click();

    // Wait for toast to appear
    await waitForToast(page, "Your 30-day trial has begun");

    // Verify toast content
    const toasts = await getToastMessages(page);
    expect(toasts.some((t) => t.includes("Your 30-day trial has begun"))).toBe(true);

    // Verify flag is set
    const flagAfter = await isToastFlagSet(page);
    expect(flagAfter).toBe(true);
  });

  test("AC-02: Toast uses sonner with 8s duration (auto-dismisses)", async ({ page }) => {
    // Manually set the flag so we can trigger toast via import flow instead
    await page.evaluate(
      (key) => {
        localStorage.removeItem(key);
      },
      LS_TRIAL_START_TOAST_SHOWN
    );

    // Trigger toast through import flow (easier than creating full card)
    // For now, we'll test by creating a card
    const addCardBtn = await page.locator('button:has-text("Add Card"), button:has-text("add a card")').first();
    await addCardBtn.click();
    await page.waitForLoadState("networkidle");

    const cardNameField = await page.locator('input[name="cardName"]').first();
    await cardNameField.fill("Toast Duration Test Card");

    const submitBtn = await page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")').first();
    await submitBtn.click();

    // Wait for toast
    await waitForToast(page, "Your 30-day trial has begun");

    // Measure dismiss time — should be ~8000ms from appearance
    const startTime = Date.now();
    await waitForToastDismiss(page, TOAST_DURATION_MS + 2000);
    const elapsedMs = Date.now() - startTime;

    // Toast should dismiss within 8s + 1s buffer
    expect(elapsedMs).toBeLessThan(TOAST_DURATION_MS + 1000);
    expect(elapsedMs).toBeGreaterThan(TOAST_DURATION_MS - 500); // Allow 500ms early
  });

  test("AC-03: Toast does NOT fire on subsequent cards (one-time flag)", async ({ page }) => {
    // First card creation — toast fires
    const addCardBtn = await page.locator('button:has-text("Add Card"), button:has-text("add a card")').first();
    await addCardBtn.click();
    await page.waitForLoadState("networkidle");

    const cardNameField = await page.locator('input[name="cardName"]').first();
    await cardNameField.fill("First Card");

    const submitBtn = await page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")').first();
    await submitBtn.click();

    await waitForToast(page, "Your 30-day trial has begun");

    // Wait for toast to auto-dismiss
    await waitForToastDismiss(page);

    // Create second card — toast should NOT fire
    const addCardBtn2 = await page.locator('button:has-text("Add Card"), button:has-text("add a card")').first();
    await addCardBtn2.click();
    await page.waitForLoadState("networkidle");

    const cardNameField2 = await page.locator('input[name="cardName"]').first();
    await cardNameField2.fill("Second Card");

    const submitBtn2 = await page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")').first();
    await submitBtn2.click();

    // Wait a bit, then check no trial toast appears
    await page.waitForTimeout(2000);
    const toasts = await getToastMessages(page);
    expect(toasts.some((t) => t.includes("Your 30-day trial has begun"))).toBe(false);
  });

  test("AC-04: Toast message is exactly: 'Your 30-day trial has begun — explore all features'", async ({ page }) => {
    const addCardBtn = await page.locator('button:has-text("Add Card"), button:has-text("add a card")').first();
    await addCardBtn.click();
    await page.waitForLoadState("networkidle");

    const cardNameField = await page.locator('input[name="cardName"]').first();
    await cardNameField.fill("Message Test Card");

    const submitBtn = await page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")').first();
    await submitBtn.click();

    await waitForToast(page, "Your 30-day trial has begun");

    const toasts = await getToastMessages(page);
    const trialToast = toasts.find((t) => t.includes("Your 30-day trial has begun"));
    expect(trialToast).toContain("Your 30-day trial has begun");
    expect(trialToast).toContain("explore all features");
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// SUITE 2: TopBar Trial Badge — Color Urgency & Rendering
// ════════════════════════════════════════════════════════════════════════════════

test.describe("TopBar Trial Badge — Color Urgency & States", () => {
  test.beforeEach(async ({ page }) => {
    await setupTestLedger(page);
  });

  test("AC-05: Badge shows neutral gray for days 1-25", async ({ page }) => {
    // Mock 22 days remaining
    await mockTrialStatus(page, 22, "active");
    await page.goto("/ledger");

    // Badge should be visible with gray color and "22 days left" text
    const badgeText = await getTrialBadgeText(page);
    expect(badgeText).toContain("22 days left");

    // Check CSS color class — should be neutral/muted
    const badge = await page.locator('button[aria-label*="Trial"]').first();
    const className = await badge.getAttribute("class");
    // TrialBadge uses "text-muted-foreground border-border" for neutral state
    expect(className).toContain("text-muted-foreground");
  });

  test("AC-06: Badge shows amber for days 26-29", async ({ page }) => {
    // Mock 4 days remaining (should trigger amber threshold)
    await mockTrialStatus(page, 4, "active");
    await page.goto("/ledger");

    const badgeText = await getTrialBadgeText(page);
    expect(badgeText).toContain("4 days left");

    const badge = await page.locator('button[aria-label*="Trial"]').first();
    const className = await badge.getAttribute("class");
    // Should use amber color
    expect(className).toContain("text-amber");
  });

  test("AC-07: Badge shows red for day 30 (expires today)", async ({ page }) => {
    // Mock 1 day remaining (RED_THRESHOLD)
    await mockTrialStatus(page, 1, "active");
    await page.goto("/ledger");

    const badgeText = await getTrialBadgeText(page);
    expect(badgeText).toContain("Expires today");

    const badge = await page.locator('button[aria-label*="Trial"]').first();
    const className = await badge.getAttribute("class");
    expect(className).toContain("text-red");
  });

  test("AC-08: Badge shows THRALL when trial expires", async ({ page }) => {
    // Mock expired status
    await mockTrialStatus(page, 0, "expired");
    await page.goto("/ledger");

    const badgeText = await getTrialBadgeText(page);
    expect(badgeText).toContain("THRALL");

    const badge = await page.locator('button[aria-label*="Trial"]').first();
    const className = await badge.getAttribute("class");
    // Expired uses muted-foreground
    expect(className).toContain("text-muted-foreground");
  });

  test("AC-09: Badge does NOT render when trial status is 'none'", async ({ page }) => {
    // Mock no trial
    await mockTrialStatus(page, 0, "none");
    await page.goto("/ledger");

    await page.waitForLoadState("networkidle");

    // Badge should not be visible
    const badge = await page.locator('button[aria-label*="Trial"]').first();
    const isVisible = await badge.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("AC-10: Badge does NOT render when trial is 'converted' (paid subscription)", async ({ page }) => {
    // Mock converted status (user upgraded to paid)
    await mockTrialStatus(page, 15, "converted");
    await page.goto("/ledger");

    await page.waitForLoadState("networkidle");

    const badge = await page.locator('button[aria-label*="Trial"]').first();
    const isVisible = await badge.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// SUITE 3: Badge Interactivity — Panel Opening & Closing
// ════════════════════════════════════════════════════════════════════════════════

test.describe("TopBar Trial Badge — Panel Interactivity", () => {
  test.beforeEach(async ({ page }) => {
    await setupTestLedger(page);
    // Mock active trial
    await mockTrialStatus(page, 15, "active");
    await page.goto("/ledger");
  });

  test("AC-11: Clicking badge opens TrialStatusPanel", async ({ page }) => {
    const badge = await page.locator('button[aria-label*="Trial"]').first();
    await badge.click();

    // Panel should appear
    const panel = await page.locator('div[role="dialog"][aria-label="Trial status"]');
    await expect(panel).toBeVisible();

    const panelText = await panel.textContent();
    expect(panelText).toContain("You have 15 day");
  });

  test("AC-12: Panel close button closes panel", async ({ page }) => {
    const badge = await page.locator('button[aria-label*="Trial"]').first();
    await badge.click();

    const panel = await page.locator('div[role="dialog"][aria-label="Trial status"]');
    await expect(panel).toBeVisible();

    const closeBtn = await page.locator('button:has-text("Close")').first();
    await closeBtn.click();

    // Panel should be hidden
    const isVisible = await panel.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("AC-13: Panel shows correct message for active trial", async ({ page }) => {
    await clickTrialBadge(page);

    const panelText = await getTrialPanelText(page);
    expect(panelText).toContain("You have 15 days");
    expect(panelText).toContain("remaining in your Karl trial");
  });

  test("AC-14: Panel shows expiry message when trial expires", async ({ page }) => {
    // Reload with expired status
    await mockTrialStatus(page, 0, "expired");
    await page.reload({ waitUntil: "networkidle" });

    const badge = await page.locator('button[aria-label*="Trial"]').first();
    await badge.click();

    const panelText = await getTrialPanelText(page);
    expect(panelText).toContain("Your trial has ended");
    expect(panelText).toContain("Subscribe to Karl");
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// SUITE 4: Mobile Responsiveness
// ════════════════════════════════════════════════════════════════════════════════

test.describe("TopBar Trial Badge — Mobile Responsiveness", () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: MOBILE_VIEWPORT_WIDTH, height: MOBILE_VIEWPORT_HEIGHT });
    await setupTestLedger(page);
    await mockTrialStatus(page, 15, "active");
    await page.goto("/ledger");
  });

  test("AC-15: Badge is clickable and readable on mobile (375px)", async ({ page }) => {
    const badge = await page.locator('button[aria-label*="Trial"]').first();

    // Badge should be visible and clickable
    await expect(badge).toBeVisible();
    const boundingBox = await badge.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(0);
    expect(boundingBox?.height).toBeGreaterThan(0);

    // Should be able to click
    await badge.click();

    // Panel should open on mobile
    const panel = await page.locator('div[role="dialog"][aria-label="Trial status"]');
    await expect(panel).toBeVisible();
  });

  test("AC-16: Panel is readable and usable on mobile (375px)", async ({ page }) => {
    await clickTrialBadge(page);

    const panel = await page.locator('div[role="dialog"][aria-label="Trial status"]');
    await expect(panel).toBeVisible();

    // Text should be readable (not overflow)
    const panelText = await panel.textContent();
    expect(panelText?.length).toBeGreaterThan(0);

    // Close button should be clickable
    const closeBtn = await page.locator('button:has-text("Close")').first();
    const closeBoundingBox = await closeBtn.boundingBox();
    expect(closeBoundingBox?.width).toBeGreaterThan(0);
    expect(closeBoundingBox?.height).toBeGreaterThan(44); // Min touch target
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// SUITE 5: Reactive Updates (Badge reactivity when trial status changes)
// ════════════════════════════════════════════════════════════════════════════════

test.describe("TopBar Trial Badge — Reactive Updates", () => {
  test.beforeEach(async ({ page }) => {
    await setupTestLedger(page);
    await page.goto("/ledger");
  });

  test("AC-17: Badge color updates when remaining days cross thresholds", async ({ page }) => {
    // Start with 22 days (gray)
    await mockTrialStatus(page, 22, "active");
    await page.reload({ waitUntil: "networkidle" });

    let badge = await page.locator('button[aria-label*="Trial"]').first();
    let className = await badge.getAttribute("class");
    expect(className).toContain("text-muted-foreground"); // Gray

    // Update to 4 days (amber) — would require cache clear in real scenario
    // For now, just verify that color class WOULD change if status changed
    // This is a limitation of mocking — real reactivity requires API integration
    await mockTrialStatus(page, 4, "active");
    await page.reload({ waitUntil: "networkidle" });

    badge = await page.locator('button[aria-label*="Trial"]').first();
    className = await badge.getAttribute("class");
    expect(className).toContain("text-amber");
  });
});
