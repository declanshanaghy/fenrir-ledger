/**
 * Homepage Logo Rendering Test — Issue #406: Restore Fenrir wolf logo on hero
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates:
 *   - Wolf logo renders in hero section
 *   - Image alt text is correct
 *   - Logo has correct responsive width class (120px mobile, 160px desktop)
 */

import { test, expect } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────

const LOGO_ALT = "Fenrir Ledger wolf logo";
const HERO_SECTION = '[aria-label="Hero"]';

// ════════════════════════════════════════════════════════════════════════════
// TC-LOG-001: Wolf logo renders in hero section
// ════════════════════════════════════════════════════════════════════════════

test("Hero section displays Fenrir wolf logo image with correct alt text", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const hero = page.locator(HERO_SECTION);
  await expect(hero).toBeVisible();

  const logo = hero.locator("img");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("alt", LOGO_ALT);
  await expect(logo).toHaveAttribute("src", /fenrir-logo\.png/);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-LOG-002: Logo has responsive width on mobile (120px)
// ════════════════════════════════════════════════════════════════════════════

test("Hero logo scales to 120px width on mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); // Mobile

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const hero = page.locator(HERO_SECTION);
  const logo = hero.locator("img");
  await expect(logo).toBeVisible();

  const width = await logo.evaluate(
    (el: HTMLImageElement) => window.getComputedStyle(el).width
  );
  expect(width).toBe("120px");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-LOG-003: Logo has responsive width on desktop (160px)
// ════════════════════════════════════════════════════════════════════════════

test("Hero logo scales to 160px width on desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 }); // Desktop

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const hero = page.locator(HERO_SECTION);
  const logo = hero.locator("img");
  await expect(logo).toBeVisible();

  const width = await logo.evaluate(
    (el: HTMLImageElement) => window.getComputedStyle(el).width
  );
  expect(width).toBe("160px");
});
