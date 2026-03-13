/**
 * Free Trial Page Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the /free-trial route against Issue #636 acceptance criteria:
 *   - Hero section with "I Hunt For 30 Days. Free." headline
 *   - 7-feature showcase grid with wolf-voice titles (all starting with "I")
 *   - "Yours Free" tags on all feature cards
 *   - 30-day timeline: Day 1, Day 15 (milestone), Day 30
 *   - Thrall vs Karl tier comparison (Thrall: 5 cards NOT 3)
 *   - CTAs: "Let Me Rest" and "Keep Me Unleashed"
 *   - "I Never Forget" data safety block
 *   - Framer Motion animations with prefers-reduced-motion support
 *   - Mobile-first responsive design
 *   - Nav and footer links to /free-trial
 *
 * Issue: #636
 */

import { test, expect } from "@playwright/test";

test("free-trial page loads and has correct title", async ({ page }) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const title = await page.title();
  expect(title).toContain("Free Trial");
  expect(title).toContain("Fenrir");
});

test("hero section displays wolf-voice headline correctly", async ({ page }) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const h1 = page.locator("h1");
  const headlineText = await h1.textContent();
  expect(headlineText).toContain("I Hunt");
  expect(headlineText).toContain("For 30 Days");
  expect(headlineText).toContain("Free");
});

test("hero contains 'No credit card. No chains.' trust line", async ({
  page,
}) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const heroContent = page.locator('[aria-label="Free trial hero"]');
  const text = await heroContent.textContent();
  expect(text).toContain("No credit card");
  expect(text).toContain("No chains");
});

test("feature showcase displays exactly 6 cards with 'Yours Free' tags", async ({
  page,
}) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const featureList = page.locator('[aria-label="Trial features"]');
  const items = page.locator('[aria-label="Trial features"] li');
  const count = await items.count();
  expect(count).toBe(6);

  // Verify "Yours Free" tags
  const tags = page.locator('text="Yours Free"');
  const tagCount = await tags.count();
  expect(tagCount).toBe(6);
});

test("all 6 feature card titles start with 'I' (wolf-voice)", async ({
  page,
}) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const expectedTitles = [
    "I Watch Every Card",
    "I Count Down Every Fee",
    "I Guard the Whole Pack",
    "I Devour Your Spreadsheets",
    "I Remember the Fallen",
    "I Follow You Everywhere",
  ];

  for (const title of expectedTitles) {
    const element = page.locator(`text="${title}"`);
    await expect(element).toBeVisible();
  }
});

test("feature showcase heading is 'What I Bring to the Hunt'", async ({
  page,
}) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const heading = page.locator("text=What I Bring to the Hunt");
  await expect(heading).toBeVisible();
});

test("timeline section displays Day 1, Day 15, and Day 30", async ({
  page,
}) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const timeline = page.locator('[aria-label="30-day trial timeline"]').first();
  await expect(timeline).toBeVisible();

  // Check for timeline steps (may appear twice: desktop + mobile)
  const day1 = page.locator("p:has-text('Day 1')");
  const day15 = page.locator("p:has-text('Day 15')");
  const day30 = page.locator("p:has-text('Day 30')");

  expect(await day1.count()).toBeGreaterThanOrEqual(1);
  expect(await day15.count()).toBeGreaterThanOrEqual(1);
  expect(await day30.count()).toBeGreaterThanOrEqual(1);
});

test("timeline heading is 'How I Hunt for You'", async ({ page }) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const heading = page.locator("text=How I Hunt for You");
  await expect(heading).toBeVisible();
});

test("tier comparison section heading is 'After 30 Days, You Choose'", async ({
  page,
}) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const heading = page.locator("text=After 30 Days, You Choose");
  await expect(heading).toBeVisible();
});

test("tier comparison shows Thrall and Karl cards", async ({ page }) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const thrallTitle = page.locator("text=Thrall").first();
  const karlTitle = page.locator("text=Karl").first();

  await expect(thrallTitle).toBeVisible();
  await expect(karlTitle).toBeVisible();
});

test("Thrall tier shows '5 cards in my jaws' (not 3)", async ({ page }) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const card = page.locator("text=Up to 5 cards in my jaws");
  await expect(card).toBeVisible();
});

test("Karl card has 'Full Fury' badge label", async ({ page }) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const badge = page.locator("text=Full Fury");
  await expect(badge).toBeVisible();
});

test("tier CTAs say 'Let Me Rest' and 'Keep Me Unleashed'", async ({
  page,
}) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const letMeRest = page.locator("a:has-text('Let Me Rest')");
  const keepUnleashed = page.locator("a:has-text('Keep Me Unleashed')");

  await expect(letMeRest).toBeVisible();
  await expect(keepUnleashed).toBeVisible();
});

test("'I Never Forget' data safety block is visible", async ({ page }) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const block = page.locator("text=I Never Forget");
  await expect(block).toBeVisible();

  const safetyNote = page.locator('[aria-label="Data safety guarantee"]');
  await expect(safetyNote).toBeVisible();
});

test("final CTA section renders 'Unleash Me' heading", async ({ page }) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const heading = page.locator("h2", { hasText: "Unleash Me" });
  await expect(heading).toBeVisible();
});

test("all main CTA buttons link to /ledger or /features", async ({ page }) => {
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const ledgerLinks = page.locator('a[href="/ledger"]');
  const featureLinks = page.locator('a[href="/features"]');

  expect(await ledgerLinks.count()).toBeGreaterThan(0);
  expect(await featureLinks.count()).toBeGreaterThan(0);
});

test("page is responsive at mobile viewport (375px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/free-trial", { waitUntil: "networkidle" });
  const h1 = page.locator("h1");
  await expect(h1).toBeVisible();

  // Check timeline switches to mobile layout (vertical stack)
  const mobileTimeline = page.locator("div.md\\:hidden").first();
  const isVisible = await mobileTimeline.isVisible();
  expect(isVisible).toBe(true);
});

test("page respects prefers-reduced-motion accessibility setting", async ({
  page,
}) => {
  // Set the media query preference before navigation
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/free-trial", { waitUntil: "networkidle" });

  // Verify page still renders without errors
  const h1 = page.locator("h1");
  await expect(h1).toBeVisible();

  const heading = page.locator("text=What I Bring to the Hunt");
  await expect(heading).toBeVisible();
});
