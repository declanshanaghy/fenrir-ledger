/**
 * TopBar Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the TopBar component against the design spec:
 *   - Anonymous state: ᛟ rune avatar visible; no email shown
 *   - Logo link: href="/static" + target="_blank" (marketing site)
 *   - Brand name: "Fenrir Ledger" visible in header
 *   - Tagline: "Break free. Harvest every reward." visible
 *
 * Spec references:
 *   - development/frontend/src/components/layout/TopBar.tsx
 *   - See ADR-006 for the anonymous-first model
 *   - ux/wireframes/topbar.html for the full wireframe spec
 *
 * All assertions derived from the spec — not from observed code output.
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
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.reload({ waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Brand identity
// ════════════════════════════════════════════════════════════════════════════

test.describe("TopBar — Brand identity", () => {
  test("'Fenrir Ledger' brand name is visible in the header", async ({ page }) => {
    // Spec: logo link contains "Fenrir Ledger" in the display span
    const header = page.locator("header").first();
    await expect(header).toContainText("Fenrir Ledger");
  });

  test("tagline 'Break free. Harvest every reward.' is visible in the header", async ({
    page,
  }) => {
    // Spec: the tagline span beneath the brand name
    const header = page.locator("header").first();
    await expect(header).toContainText("Break free. Harvest every reward.");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Logo link to marketing site
// ════════════════════════════════════════════════════════════════════════════

test.describe("TopBar — Logo link", () => {
  test("header contains a link with href='/static' that opens in a new tab", async ({
    page,
  }) => {
    // Spec: the logo link must resolve to /static (not /static/)
    // and must have target="_blank" so it opens the marketing site
    const logoLink = page.locator('header a[href="/static"]').first();
    await expect(logoLink).toBeAttached();
    await expect(logoLink).toHaveAttribute("target", "_blank");
  });

  test("logo link has rel='noopener noreferrer' for security", async ({ page }) => {
    // Spec: external links opened with target="_blank" must declare
    // noopener noreferrer to prevent tab-nabbing
    const logoLink = page.locator('header a[href="/static"]').first();
    const rel = await logoLink.getAttribute("rel");
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
  });

  test("logo link aria-label mentions marketing site", async ({ page }) => {
    // Spec: aria-label="Fenrir Ledger — visit the marketing site (opens in new tab)"
    const logoLink = page.locator('header a[href="/static"]').first();
    const ariaLabel = await logoLink.getAttribute("aria-label");
    expect(ariaLabel).not.toBeNull();
    expect(ariaLabel!.toLowerCase()).toContain("marketing site");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Anonymous state — ᛟ rune avatar
// ════════════════════════════════════════════════════════════════════════════

test.describe("TopBar — Anonymous state", () => {
  test("ᛟ rune character is visible in the header avatar area when anonymous", async ({
    page,
  }) => {
    // Spec: anonymous state renders the ᛟ Othalan rune as avatar fallback.
    // The Avatar component renders this as a <span> with aria-hidden="true"
    // inside the avatar button.
    const header = page.locator("header").first();
    await expect(header).toContainText("ᛟ");
  });

  test("anonymous avatar button has aria-label 'Sign in to sync your data'", async ({
    page,
  }) => {
    // Spec: button for anonymous avatar must describe its action
    const avatarButton = page.locator(
      'header button[aria-label="Sign in to sync your data"]'
    );
    await expect(avatarButton).toBeVisible();
  });

  test("no email address is displayed in the header when anonymous", async ({
    page,
  }) => {
    // Spec: email shown only in signed-in state (hidden sm:block mr-3)
    // In anonymous state there is no user.email to render
    const header = page.locator("header").first();
    // Verify no obvious email pattern exists in the header text
    const headerText = await header.textContent();
    expect(headerText).not.toMatch(/@\w+\.\w+/);
  });

  test("clicking anonymous avatar opens the upsell prompt panel", async ({
    page,
  }) => {
    // Spec: clicking the anonymous avatar button opens role="dialog" UpsellPromptPanel
    const avatarButton = page.locator(
      'header button[aria-label="Sign in to sync your data"]'
    );
    await avatarButton.click();

    const upsellPanel = page.locator('[role="dialog"][aria-label="Sign in to sync"]');
    await expect(upsellPanel).toBeVisible();
  });

  test("upsell panel contains 'Sign in to Google' and 'Not now' buttons", async ({
    page,
  }) => {
    // Spec: UpsellPromptPanel CTAs — Sign in to Google + Not now
    const avatarButton = page.locator(
      'header button[aria-label="Sign in to sync your data"]'
    );
    await avatarButton.click();

    await expect(page.locator('button:has-text("Sign in to Google")')).toBeVisible();
    await expect(page.locator('button:has-text("Not now")')).toBeVisible();
  });

  test("'Not now' dismisses the upsell panel", async ({ page }) => {
    // Spec: "Not now" click → onClose() → panel dismissed
    const avatarButton = page.locator(
      'header button[aria-label="Sign in to sync your data"]'
    );
    await avatarButton.click();

    const notNow = page.locator('button:has-text("Not now")');
    await expect(notNow).toBeVisible();
    await notNow.click();

    const upsellPanel = page.locator('[role="dialog"][aria-label="Sign in to sync"]');
    await expect(upsellPanel).not.toBeVisible();
  });

  test("pressing Escape dismisses the upsell panel", async ({ page }) => {
    // Spec: Escape key → onClose() called in UpsellPromptPanel useEffect
    const avatarButton = page.locator(
      'header button[aria-label="Sign in to sync your data"]'
    );
    await avatarButton.click();

    await expect(
      page.locator('[role="dialog"][aria-label="Sign in to sync"]')
    ).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(
      page.locator('[role="dialog"][aria-label="Sign in to sync"]')
    ).not.toBeVisible();
  });
});
