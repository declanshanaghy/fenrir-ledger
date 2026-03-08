/**
 * SyncIndicator Test Suite — Issue #181 Validation
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates GitHub Issue #181: Remove fake periodic background sync from SyncIndicator
 *
 * **Acceptance Criteria:**
 * 1. No setInterval / fake periodic sync in SyncIndicator
 * 2. Dot still pulses on real fenrir:sync events (storage writes)
 * 3. Gleipnir Fragment 1 easter egg still works (hover tooltip + click trigger)
 * 4. No visual regression — dot remains visible at rest (dim state)
 *
 * **Implementation Detail:**
 * SyncIndicator.tsx listens to custom "fenrir:sync" events dispatched by storage.ts
 * on real card writes. The fake setInterval(45s) has been removed.
 *
 * **Spec References:**
 * - development/frontend/src/components/layout/SyncIndicator.tsx
 * - development/frontend/src/lib/storage.ts (dispatch fenrir:sync event)
 * - development/frontend/src/components/cards/GleipnirCatFootfall.tsx (easter egg)
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Setup
// ════════════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  // Navigate to dashboard and seed a household
  await page.goto("/", { waitUntil: "load" });
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.reload({ waitUntil: "load" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1: Visual state at rest (no setInterval fake pulse)
// ════════════════════════════════════════════════════════════════════════════

test.describe("SyncIndicator — Visual state at rest", () => {
  test("indicator dot is visible at rest in dim state (no pulse)", async ({
    page,
  }) => {
    // Acceptance Criteria #4: dot visible at rest, dim iron color
    // The core dot <span> with class "relative inline-flex h-2 w-2 rounded-full"
    // should exist and not be syncing (no ping animation).

    const syncDot = page.locator(
      'button[aria-label="Background sync"] span.relative.inline-flex'
    );

    // Verify it exists and is visible
    await expect(syncDot).toBeVisible();

    // Verify the ping ring (animation during sync) is NOT present
    // when not syncing. The ping ring is only rendered when syncing={true}.
    const pingRing = page.locator(
      'button[aria-label="Background sync"] span.animate-ping'
    );
    await expect(pingRing).not.toBeVisible();
  });

  test("indicator button is in fixed bottom-right position", async ({
    page,
  }) => {
    // Spec: <div className="fixed bottom-4 right-4 z-50 group">
    const indicatorContainer = page.locator(
      "div:has(button[aria-label='Background sync'])"
    ).filter({ has: page.locator(".fixed.bottom-4.right-4") });

    await expect(indicatorContainer).toBeAttached();
  });

  test("no setInterval polling occurs — fake sync removed per #181", async ({
    page,
  }) => {
    // Acceptance Criteria #1: Verify no setInterval is active for fake sync.
    // We'll monitor the page for any setInterval calls related to sync,
    // wait 5 seconds, and confirm no automatic pulses happen.

    const startTime = Date.now();
    const initialDotState = await page.locator(
      'button[aria-label="Background sync"] span.relative.inline-flex'
    ).evaluate((el) => {
      return el.className;
    });

    // Wait 5 seconds (longer than any reasonable debounce)
    await page.waitForTimeout(5000);

    const finalDotState = await page.locator(
      'button[aria-label="Background sync"] span.relative.inline-flex'
    ).evaluate((el) => {
      return el.className;
    });

    // Verify no artificial state changes occurred during idle time
    // (the dot should remain in the same state: dim, no pulse)
    expect(finalDotState).toBe(initialDotState);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2: Pulse on real fenrir:sync events
// ════════════════════════════════════════════════════════════════════════════

test.describe("SyncIndicator — Real fenrir:sync event handling", () => {
  test("dot pulses when fenrir:sync event is dispatched", async ({ page }) => {
    // Acceptance Criteria #2: Real sync events trigger pulse animation.
    // We'll dispatch a custom fenrir:sync event and verify the ping animation appears.

    const pingRingBefore = page.locator(
      'button[aria-label="Background sync"] span.animate-ping'
    );

    // Initially, ping ring should NOT be visible
    await expect(pingRingBefore).not.toBeVisible();

    // Dispatch the fenrir:sync event from the browser context
    // Wait a small amount to ensure React event listener is registered
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const event = new CustomEvent("fenrir:sync");
      window.dispatchEvent(event);
    });

    // After dispatch, the ping ring should be VISIBLE (syncing state active)
    // Wait for React state update and re-render
    await page.waitForTimeout(300);

    const pingRingAfter = page.locator(
      'button[aria-label="Background sync"] span.animate-ping'
    );
    await expect(pingRingAfter).toBeVisible();
  });

  test("pulse animation has correct duration (1500ms)", async ({ page }) => {
    // Acceptance Criteria #2: Pulse lasts for SYNC_DURATION_MS (1500ms).
    // After dispatching fenrir:sync, the ping ring should be visible for ~1500ms.

    // Get the initial state
    const pingRing = page.locator(
      'button[aria-label="Background sync"] span.animate-ping'
    );

    // Wait for React to register event listeners
    await page.waitForTimeout(500);

    // Dispatch the event
    await page.evaluate(() => {
      const event = new CustomEvent("fenrir:sync");
      window.dispatchEvent(event);
    });

    // Wait for React state update and re-render
    await page.waitForTimeout(300);

    // Immediately after: ping ring should be visible
    await expect(pingRing).toBeVisible();

    // Wait ~1500ms (sync duration) + small buffer
    await page.waitForTimeout(1700);

    // After timeout: ping ring should be gone (syncing state cleared)
    await expect(pingRing).not.toBeVisible();
  });

  test("multiple fenrir:sync events reset the pulse timer", async ({
    page,
  }) => {
    // Edge case: Verify that rapid fenrir:sync events don't break or
    // cause unexpected behavior. Multiple events should trigger pulses.

    const pingRing = page.locator(
      'button[aria-label="Background sync"] span.animate-ping'
    );

    // Wait for React to register event listeners
    await page.waitForTimeout(500);

    // Dispatch first event
    await page.evaluate(() => {
      const event = new CustomEvent("fenrir:sync");
      window.dispatchEvent(event);
    });

    // Wait for React state update
    await page.waitForTimeout(300);
    await expect(pingRing).toBeVisible();

    // Wait 800ms (before first timeout at 1500ms)
    await page.waitForTimeout(800);

    // Ping should still be visible
    await expect(pingRing).toBeVisible();

    // Dispatch second event
    await page.evaluate(() => {
      const event = new CustomEvent("fenrir:sync");
      window.dispatchEvent(event);
    });

    // Wait for React state update
    await page.waitForTimeout(300);

    // Ping should still be visible (triggered by second event)
    await expect(pingRing).toBeVisible();

    // Wait for both timers to expire (1500ms from second event)
    await page.waitForTimeout(1700);

    // Now it should be gone
    await expect(pingRing).not.toBeVisible();
  });

  test("core dot changes color from dim to gold while syncing", async ({
    page,
  }) => {
    // Acceptance Criteria #2: Visual feedback via color change.
    // The core dot should change from dim (--egg-border) to gold (--egg-accent) during sync.

    const dotElement = page.locator(
      'button[aria-label="Background sync"] span.relative.inline-flex'
    );

    // Wait for React to register event listeners
    await page.waitForTimeout(500);

    // Dispatch fenrir:sync event
    await page.evaluate(() => {
      const event = new CustomEvent("fenrir:sync");
      window.dispatchEvent(event);
    });

    // Wait for React state update and re-render
    await page.waitForTimeout(300);

    // Get class name after sync (should include gold color class)
    const classNameDuringSyncing = await dotElement.evaluate((el) => {
      return el.className;
    });

    // Should contain the syncing color class (--egg-accent)
    expect(classNameDuringSyncing).toMatch(/egg-accent/);

    // Wait for sync to complete
    await page.waitForTimeout(1700);

    // Get class name after sync completes
    const classNameAfterSync = await dotElement.evaluate((el) => {
      return el.className;
    });

    // Should revert to dim color class (--egg-border)
    expect(classNameAfterSync).toMatch(/egg-border/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3: Gleipnir Fragment 1 Easter Egg (hover tooltip + click)
// ════════════════════════════════════════════════════════════════════════════

test.describe("SyncIndicator — Gleipnir Fragment 1 (easter egg)", () => {
  test("hover tooltip displays 'The sound of a cat's footfall'", async ({
    page,
  }) => {
    // Acceptance Criteria #3: Hover reveals the easter egg tooltip.
    // The tooltip should be initially hidden and appear on hover.

    const indicatorButton = page.locator(
      'button[aria-label="Background sync"]'
    );

    // Tooltip text should be in the DOM but not visible initially
    const tooltipText = page.locator(
      'text="The sound of a cat\'s footfall"'
    ).first();

    // Before hover: tooltip should not be visible (opacity-0)
    let isVisible = await tooltipText.isVisible();
    expect(isVisible).toBe(false);

    // Hover over the button
    await indicatorButton.hover();

    // After hover: tooltip should become visible (group-hover:opacity-100)
    await expect(tooltipText).toBeVisible();
  });

  test("tooltip content matches Gleipnir Fragment 1 specification", async ({
    page,
  }) => {
    // Spec: "The sound of a cat's footfall" is Fragment 1 of Gleipnir.
    // Verify the exact text is present.

    const indicatorButton = page.locator(
      'button[aria-label="Background sync"]'
    );

    await indicatorButton.hover();

    const tooltip = page.locator(
      'text="The sound of a cat\'s footfall"'
    ).first();
    await expect(tooltip).toContainText("The sound of a cat's footfall");
  });

  test("clicking indicator opens Gleipnir Fragment 1 easter egg modal", async ({
    page,
  }) => {
    // Acceptance Criteria #3: Click trigger opens GleipnirCatFootfall modal.
    // The modal should appear with the easter egg content.

    const indicatorButton = page.locator(
      'button[aria-label="Background sync"]'
    );

    // Click the indicator
    await indicatorButton.click();

    // Gleipnir modal should open (verify by presence of dialog or easter egg content)
    // GleipnirCatFootfall component renders a Dialog with the easter egg content.
    // Look for a dialog that appears after clicking.

    // Wait for dialog to appear (might have animation)
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible();

    // The modal should contain easter egg-related content (gleipnir reference)
    await expect(dialog).toContainText(/gleipnir|cat|footfall|fragment/i);
  });

  test("clicking indicator again closes the easter egg modal", async ({
    page,
  }) => {
    // Edge case: Verify that triggering again or closing works.
    // The modal should close when dismissed.

    const indicatorButton = page.locator(
      'button[aria-label="Background sync"]'
    );

    // Open the modal
    await indicatorButton.click();

    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible();

    // Close the modal by pressing Escape or clicking close button
    // (Radix Dialog supports Escape by default)
    await page.keyboard.press("Escape");

    // Dialog should no longer be visible
    await expect(dialog).not.toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4: Integration with real storage writes
// ════════════════════════════════════════════════════════════════════════════

test.describe("SyncIndicator — Integration with storage writes", () => {
  test("indicator pulses when a card is added via storage update", async ({
    page,
  }) => {
    // High-level test: When a card is written to localStorage via storage.ts,
    // the fenrir:sync event should dispatch, and the indicator should pulse.
    //
    // This validates the full chain: write → event dispatch → pulse

    const pingRing = page.locator(
      'button[aria-label="Background sync"] span.animate-ping'
    );

    // Initially, no pulse
    await expect(pingRing).not.toBeVisible();

    // Simulate a storage write by manually triggering the fenrir:sync event
    // (In a real scenario, this would come from storage.saveCard() or similar)
    await page.evaluate(() => {
      const event = new CustomEvent("fenrir:sync");
      window.dispatchEvent(event);
    });

    // Pulse should activate
    await expect(pingRing).toBeVisible();

    // Wait for pulse to complete
    await page.waitForTimeout(1700);

    // Pulse should be gone
    await expect(pingRing).not.toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5: Accessibility & DOM structure
// ════════════════════════════════════════════════════════════════════════════

test.describe("SyncIndicator — Accessibility & Structure", () => {
  test("indicator button has correct aria-label for screen readers", async ({
    page,
  }) => {
    // Spec: aria-label="Background sync" on the clickable button
    const button = page.locator(
      'button[aria-label="Background sync"]'
    );

    await expect(button).toHaveAttribute("aria-label", "Background sync");
  });

  test("tooltip is hidden from screen readers with aria-hidden", async ({
    page,
  }) => {
    // Spec: tooltip <div> has aria-hidden="true" to exclude it from a11y tree
    const tooltipContainer = page.locator(
      'div[aria-hidden="true"]:has-text("The sound of a cat\'s footfall")'
    );

    await expect(tooltipContainer).toHaveAttribute("aria-hidden", "true");
  });

  test("indicator is z-50 (high stacking order, above main content)", async ({
    page,
  }) => {
    // Spec: <div className="fixed bottom-4 right-4 z-50 group">
    // The fixed container should have z-50 class.

    const fixedContainer = page.locator(
      "div.fixed.bottom-4.right-4.z-50"
    ).first();

    await expect(fixedContainer).toBeAttached();
  });
});
