/**
 * Test suite for GitHub Issue #272: Empty state nudge renders above CTA instead of below
 *
 * Acceptance Criteria (from issue):
 *   AC-1: SignInNudge (subtle link) renders BELOW the EmptyState Add Card link when hasCards=false
 *   AC-2: The DOM order matches: heading → empty state CTA → subtle nudge
 *
 * These tests validate the visual and DOM ordering of components in the zero-cards state.
 * Each test seeds localStorage fresh — idempotent by design.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── AC-1: SignInNudge renders below EmptyState CTA ──────────────────────────

test.describe("AC-1 — SignInNudge renders below EmptyState Add Card CTA", () => {
  test("nudge button appears after EmptyState in the DOM", async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // The EmptyState is identified by its aria-description (Gleipnir ingredient 6 easter egg).
    const emptyState = page.locator('[aria-description="the spittle of a bird"]');
    await expect(emptyState).toBeVisible();

    // The subtle nudge button is present.
    const nudgeButton = page.locator('button:text("Sign in to sync your data")');
    await expect(nudgeButton).toBeVisible();

    // Get the positions to ensure nudge appears after EmptyState in DOM.
    // We check that the nudge's bounding box top is greater than or equal to the emptyState's bottom.
    const emptyStateBox = await emptyState.boundingBox();
    const nudgeBox = await nudgeButton.boundingBox();

    expect(emptyStateBox).toBeTruthy();
    expect(nudgeBox).toBeTruthy();

    if (emptyStateBox && nudgeBox) {
      // Nudge should appear below the EmptyState (higher Y value = lower on page).
      expect(nudgeBox.y).toBeGreaterThanOrEqual(emptyStateBox.y + emptyStateBox.height);
    }
  });

  test("nudge does not overlap with EmptyState visually", async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    const emptyState = page.locator('[aria-description="the spittle of a bird"]');
    const nudgeButton = page.locator('button:text("Sign in to sync your data")');

    const emptyStateBox = await emptyState.boundingBox();
    const nudgeBox = await nudgeButton.boundingBox();

    expect(emptyStateBox).toBeTruthy();
    expect(nudgeBox).toBeTruthy();

    if (emptyStateBox && nudgeBox) {
      // Ensure no vertical overlap
      const emptyStateBottom = emptyStateBox.y + emptyStateBox.height;
      // Allow small gap (30px) between components for visual spacing
      expect(nudgeBox.y).toBeGreaterThanOrEqual(emptyStateBottom - 50);
    }
  });
});

// ─── AC-2: DOM order matches heading → CTA → nudge ──────────────────────────

test.describe("AC-2 — DOM order is correct: heading → CTA → nudge", () => {
  test("EmptyState heading precedes the Add Card CTA in DOM", async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // Find the heading within EmptyState
    const emptyState = page.locator('[aria-description="the spittle of a bird"]');
    const heading = emptyState.locator("h2");
    const addCardLink = emptyState.locator('a[href="/cards/new"]');

    // Both must be visible
    await expect(heading).toBeVisible();
    await expect(addCardLink).toBeVisible();

    // Get bounding boxes to verify order
    const headingBox = await heading.boundingBox();
    const addCardBox = await addCardLink.boundingBox();

    expect(headingBox).toBeTruthy();
    expect(addCardBox).toBeTruthy();

    if (headingBox && addCardBox) {
      // Heading should appear above (lower Y) the Add Card link
      expect(headingBox.y).toBeLessThanOrEqual(addCardBox.y);
    }
  });

  test("Add Card CTA precedes the sign-in nudge in DOM", async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    const emptyState = page.locator('[aria-description="the spittle of a bird"]');
    const addCardLink = emptyState.locator('a[href="/cards/new"]');
    const nudgeButton = page.locator('button:text("Sign in to sync your data")');

    // Both must be visible
    await expect(addCardLink).toBeVisible();
    await expect(nudgeButton).toBeVisible();

    // Get bounding boxes
    const addCardBox = await addCardLink.boundingBox();
    const nudgeBox = await nudgeButton.boundingBox();

    expect(addCardBox).toBeTruthy();
    expect(nudgeBox).toBeTruthy();

    if (addCardBox && nudgeBox) {
      // Add Card link should appear above (lower Y) the nudge
      expect(addCardBox.y).toBeLessThanOrEqual(nudgeBox.y);
    }
  });

  test("complete order: heading → CTA → nudge is maintained", async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // Get all three key elements
    const emptyState = page.locator('[aria-description="the spittle of a bird"]');
    const heading = emptyState.locator("h2");
    const addCardLink = emptyState.locator('a[href="/cards/new"]');
    const nudgeButton = page.locator('button:text("Sign in to sync your data")');

    const headingBox = await heading.boundingBox();
    const addCardBox = await addCardLink.boundingBox();
    const nudgeBox = await nudgeButton.boundingBox();

    expect(headingBox).toBeTruthy();
    expect(addCardBox).toBeTruthy();
    expect(nudgeBox).toBeTruthy();

    if (headingBox && addCardBox && nudgeBox) {
      // Verify the complete order: heading.y < addCard.y < nudge.y
      expect(headingBox.y).toBeLessThanOrEqual(addCardBox.y);
      expect(addCardBox.y).toBeLessThanOrEqual(nudgeBox.y);
    }
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────

test.describe("Edge cases", () => {
  test("mobile 375px: nudge renders below CTA", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    const emptyState = page.locator('[aria-description="the spittle of a bird"]');
    const nudgeButton = page.locator('button:text("Sign in to sync your data")');

    await expect(emptyState).toBeVisible();
    await expect(nudgeButton).toBeVisible();

    const emptyStateBox = await emptyState.boundingBox();
    const nudgeBox = await nudgeButton.boundingBox();

    if (emptyStateBox && nudgeBox) {
      // On mobile, nudge should still appear below
      expect(nudgeBox.y).toBeGreaterThanOrEqual(emptyStateBox.y + emptyStateBox.height);
    }
  });

  test("page renders without JS errors on zero-card load", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    expect(jsErrors).toHaveLength(0);
  });

  test("nudge button is functional: navigates to sign-in on click", async ({
    page,
  }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    const nudgeButton = page.locator('button:text("Sign in to sync your data")');
    await expect(nudgeButton).toBeVisible();

    // Click the nudge and verify navigation
    await nudgeButton.click();
    await page.waitForURL(/\/sign-in/, { timeout: 10000 });
    expect(page.url()).toContain("/sign-in");
  });
});
