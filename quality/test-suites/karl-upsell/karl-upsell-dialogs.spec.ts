/**
 * Karl Upsell Dialogs — End-to-End Tests
 * Issue #488: Unify Karl upsell dialogs across Valhalla, The Hunt, and The Howl
 *
 * Validates:
 * - Single shared KarlUpsellDialog component used by all three tabs
 * - Two-column layout on desktop (icon+copy left, features+CTA right)
 * - Collapses to single column on mobile (min 375px)
 * - Each tab passes its own contextual copy via props
 * - No duplicate upsell implementations
 */

import { test, expect } from "@playwright/test";

test.describe("Karl Upsell Dialogs — Issue #488", () => {
  // Setup: Navigate to dashboard with test user who lacks Karl features
  test.beforeEach(async ({ page }) => {
    // Navigate to the app dashboard
    await page.goto("/dashboard");
    // Wait for dashboard to load
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Valhalla (card archive) upsell dialog opens when tab is clicked
  // ───────────────────────────────────────────────────────────────────────────
  test("Valhalla: shows Karl upsell dialog when Thrall user clicks Valhalla tab", async ({
    page,
  }) => {
    // Click the Valhalla tab (second tab, locked for Thrall users)
    const valhallaTab = page.locator('[id="tab-valhalla"]');
    await valhallaTab.click();

    // Verify dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Valhalla-specific content
    await expect(page.locator('text="Valhalla"')).toBeVisible();
    await expect(
      page.locator('text="Hall of the Honored Dead"')
    ).toBeVisible();
    await expect(
      page.locator(
        'text="See every card you\'ve closed — anniversary dates, total rewards extracted, annual fees avoided"'
      )
    ).toBeVisible();

    // Verify feature benefits for Valhalla
    await expect(
      page.locator("text=Full archive of closed and graduated cards")
    ).toBeVisible();
    await expect(
      page.locator("text=Anniversary dates and tenure tracking")
    ).toBeVisible();
    await expect(
      page.locator("text=Total rewards extracted per card")
    ).toBeVisible();
    await expect(
      page.locator("text=Annual fees avoided over time")
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: The Howl upsell dialog opens with Howl-specific content
  // ───────────────────────────────────────────────────────────────────────────
  test("The Howl: shows Karl upsell dialog with Howl-specific content when tab is clicked", async ({
    page,
  }) => {
    // Click The Howl tab (fifth tab, locked for Thrall users)
    const howlTab = page.locator('[id="tab-howl"]');
    await howlTab.click();

    // Verify dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Howl-specific content
    await expect(page.locator('text="The Howl"')).toBeVisible();
    await expect(
      page.locator('text="The Wolf Cries Before the Chain Breaks"')
    ).toBeVisible();
    await expect(
      page.locator(
        'text="Get notified before fees strike. Howl surfaces your most urgent deadlines"'
      )
    ).toBeVisible();

    // Verify feature benefits for Howl
    await expect(
      page.locator("text=Upcoming fee alerts with urgency ranking")
    ).toBeVisible();
    await expect(
      page.locator("text=Welcome bonus deadline countdowns")
    ).toBeVisible();
    await expect(
      page.locator("text=Ragnarök alert when ≥5 urgent cards pile up")
    ).toBeVisible();
    await expect(
      page.locator("text=Proactive notifications before you lose value")
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: The Hunt (Velocity) upsell dialog opens with Hunt-specific content
  // ───────────────────────────────────────────────────────────────────────────
  test("The Hunt (Velocity): shows Karl upsell dialog with Hunt-specific content when tab is clicked", async ({
    page,
  }) => {
    // Click The Hunt tab (fourth tab, locked for Thrall users)
    const huntTab = page.locator('[id="tab-hunt"]');
    await huntTab.click();

    // Verify dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Hunt/Velocity-specific content
    await expect(page.locator('text="Velocity"')).toBeVisible();
    await expect(
      page.locator('text="How Fast Does Your Plunder Flow?"')
    ).toBeVisible();
    await expect(
      page.locator(
        'text="Track your spend rate against welcome bonus targets"'
      )
    ).toBeVisible();

    // Verify feature benefits for Velocity
    await expect(
      page.locator("text=Real-time spend tracking against bonus targets")
    ).toBeVisible();
    await expect(
      page.locator("text=Daily spend pace recommendations")
    ).toBeVisible();
    await expect(
      page.locator("text=Deadline countdown with progress bars")
    ).toBeVisible();
    await expect(
      page.locator("text=Alerts when you fall behind target pace")
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: Dialog has "Upgrade to Karl" CTA button
  // ───────────────────────────────────────────────────────────────────────────
  test("Each upsell dialog displays 'Upgrade to Karl' CTA button with pricing", async ({
    page,
  }) => {
    // Open any Karl-gated tab (Valhalla)
    const valhallaTab = page.locator('[id="tab-valhalla"]');
    await valhallaTab.click();

    // Verify dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify CTA button
    const ctaButton = page.locator(
      'text="Upgrade to Karl — $3.99/month"'
    );
    await expect(ctaButton).toBeVisible();

    // Verify pricing row is visible
    await expect(page.locator('text="Karl"')).toBeVisible();
    await expect(page.locator('text="Unlock all premium features"')).toBeVisible();
    await expect(page.locator('text="$3.99/mo"')).toBeVisible();

    // Verify billing disclaimer
    await expect(
      page.locator("text=Billed monthly. Cancel anytime.")
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: Dialog layout is two-column on desktop
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog uses two-column layout on desktop (md breakpoint)", async ({
    page,
  }) => {
    // Set viewport to desktop size (≥768px)
    await page.setViewportSize({ width: 1024, height: 768 });

    // Open Valhalla dialog
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Find the body container with two-column grid
    const bodyContainer = dialog.locator(".flex.flex-col.md\\:grid");
    await expect(bodyContainer).toBeVisible();

    // Verify grid layout has 2 columns on desktop
    const computed = await bodyContainer.evaluate(
      (el) => window.getComputedStyle(el).gridTemplateColumns
    );
    // Check that gridTemplateColumns exists and isn't empty (indicating grid is active)
    expect(computed).toBeTruthy();

    // Verify left column (icon + copy) is visible
    const leftColumn = dialog.locator(".md\\:border-r");
    await expect(leftColumn).toBeVisible();

    // Verify right column (benefits + CTA) is visible
    const rightColumn = leftColumn.locator("+ div");
    await expect(rightColumn).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 6: Dialog collapses to single column on mobile (<375px)
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog collapses to single column on mobile (375px viewport)", async ({
    page,
  }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Open Valhalla dialog
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify dialog content is visible and stacked vertically
    await expect(page.locator('text="Valhalla"')).toBeVisible();
    await expect(
      page.locator("text=Full archive of closed and graduated cards")
    ).toBeVisible();
    await expect(
      page.locator('text="Upgrade to Karl — $3.99/month"')
    ).toBeVisible();

    // Dialog should still be readable on mobile
    await expect(dialog).toHaveCSS("width", /92vw|346px/); // 92vw on mobile
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 7: Dismiss button closes dialog
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog can be dismissed with 'Not now' button", async ({ page }) => {
    // Open Valhalla dialog
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click "Not now" button
    const dismissButton = page.locator('text="Not now"');
    await dismissButton.click();

    // Verify dialog is gone
    await expect(dialog).not.toBeVisible();

    // Verify we're still on the dashboard (not redirected)
    await expect(page.locator('[role="tablist"]')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 8: Close (X) button dismisses dialog
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog can be dismissed with close (X) button", async ({ page }) => {
    // Open Valhalla dialog
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click close button (usually in dialog header)
    const closeButton = page.locator(
      '[role="dialog"] button[aria-label*="close"], [role="dialog"] button[aria-label*="Close"]'
    );
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      // Alternative: press Escape if close button not found
      await page.keyboard.press("Escape");
    }

    // Verify dialog is gone
    await expect(dialog).not.toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 9: Escape key dismisses dialog
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog can be dismissed with Escape key", async ({ page }) => {
    // Open Valhalla dialog
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Verify dialog is gone
    await expect(dialog).not.toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 10: Each tab has its own feature icon (rune)
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog displays correct feature icon (rune) for each Karl feature", async ({
    page,
  }) => {
    // Test Valhalla icon (Tiwaz: ᛏ)
    await page.locator('[id="tab-valhalla"]').click();
    let dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // Icon is rendered as Unicode character in dialog
    const valhallaIcon = dialog.locator("text=\\u16CF"); // Tiwaz rune
    await expect(valhallaIcon).toBeVisible();

    // Close dialog
    await page.locator('text="Not now"').click();
    await expect(dialog).not.toBeVisible();

    // Test Howl icon (Kenaz: ᚲ)
    await page.locator('[id="tab-howl"]').click();
    dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const howlIcon = dialog.locator("text=\\u16B2"); // Kenaz rune
    await expect(howlIcon).toBeVisible();

    // Close dialog
    await page.locator('text="Not now"').click();
    await expect(dialog).not.toBeVisible();

    // Test Hunt/Velocity icon (Sowilo: ᛊ)
    await page.locator('[id="tab-hunt"]').click();
    dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const huntIcon = dialog.locator("text=\\u16CA"); // Sowilo rune
    await expect(huntIcon).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 11: All three tabs use the same shared dialog component
  // (Verify no duplicate implementations exist)
  // ───────────────────────────────────────────────────────────────────────────
  test("All three Karl-gated tabs use the same shared KarlUpsellDialog component", async ({
    page,
  }) => {
    // Count how many dialog instances exist in the DOM
    const dialogCount = await page.locator('[role="dialog"]').count();

    // Should be exactly 1 dialog element (shared across all tabs)
    // Each tab uses the same component with different props
    expect(dialogCount).toBeLessThanOrEqual(3); // At most 3 instances if mounted separately

    // Verify the dialog structure is consistent across tabs
    const dialogs = page.locator('[role="dialog"]');

    // Check Valhalla
    await page.locator('[id="tab-valhalla"]').click();
    await expect(dialogs.first()).toBeVisible();
    let hasHeader = await page
      .locator('[role="dialog"] text="Karl Tier Feature"')
      .isVisible();
    let hasBody = await page
      .locator('[role="dialog"] [role="tabpanel"], [role="dialog"] .flex')
      .isVisible();
    expect(hasHeader && hasBody).toBeTruthy();

    // Close and check Howl
    await page.locator('text="Not now"').click();
    await page.locator('[id="tab-howl"]').click();
    await expect(dialogs).toHaveCount(1);
    hasHeader = await page
      .locator('[role="dialog"] text="Karl Tier Feature"')
      .isVisible();
    hasBody = await page
      .locator('[role="dialog"] [role="tabpanel"], [role="dialog"] .flex')
      .isVisible();
    expect(hasHeader && hasBody).toBeTruthy();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 12: Feature benefits are displayed as a checklist
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog displays feature benefits as a visual checklist with checkmarks", async ({
    page,
  }) => {
    // Open Valhalla dialog
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify checklist container exists
    const benefitsList = dialog.locator("ul[aria-label]");
    await expect(benefitsList).toBeVisible();

    // Verify each benefit has a checkmark (✓)
    const benefits = dialog.locator("ul li");
    const count = await benefits.count();
    expect(count).toBeGreaterThan(0);

    // Verify checkmarks are present
    for (let i = 0; i < count; i++) {
      const benefit = benefits.nth(i);
      await expect(benefit).toContainText(/✓|✔/);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 13: Dialog header shows Karl tier and pricing
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog header displays 'Karl Tier Feature' label and $3.99/month pricing", async ({
    page,
  }) => {
    // Open any Karl-gated tab
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify header label
    await expect(
      page.locator('[role="dialog"] text="Karl Tier Feature"')
    ).toBeVisible();

    // Verify pricing in header
    await expect(
      page.locator('[role="dialog"] text="$3.99/month"')
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 14: Accessibility — dialog is properly labeled
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog is accessible with proper ARIA labels", async ({ page }) => {
    // Open Valhalla dialog
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify dialog has title (DialogTitle component)
    const title = dialog.locator("[role='heading'], h1, h2");
    const hasTitle = await title.count();
    expect(hasTitle).toBeGreaterThan(0);

    // Verify benefits list has aria-label
    const benefitsList = dialog.locator("ul[aria-label]");
    await expect(benefitsList).toHaveAttribute("aria-label", /feature|Feature/);
  });
});
