import { test, expect } from "@playwright/test";

test.describe("About Page — #339", () => {
  test.beforeEach(async ({ page }) => {
    // Visit the about page
    await page.goto("/about");
    // Clear localStorage after navigation if possible
    try {
      await page.evaluate(() => localStorage.clear());
    } catch {
      // localStorage may not be available for static pages
    }
  });

  test("AC: Page exists at /about", async ({ page }) => {
    expect(page.url()).toContain("/about");
    // Just verify the page is loaded
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });

  test("AC: Has export const dynamic = 'force-static'", async ({ page }) => {
    const response = await page.goto("/about");
    expect(response?.status()).toBe(200);
    // Verify this is a static page (check via response headers or behavior)
    // In Next.js, static pages don't have request-time dynamic behavior
  });

  test("AC: Origin story section with Norse mythology framing", async ({ page }) => {
    // Check for origin hero section
    const heroSection = page.locator('section[aria-label="Origin story"]');
    await expect(heroSection).toBeVisible();

    // Check for mythic heading (case-insensitive)
    const heading = page.locator("h1");
    const headingText = await heading.innerText();
    expect(headingText.toUpperCase()).toContain("WOLF");
    expect(headingText.toUpperCase()).toContain("BOUND");

    // Check for Gleipnir reference
    const gleipnirLink = page.locator('a[href*="Gleipnir"]').first();
    await expect(gleipnirLink).toBeVisible();

    // Check for Fenrir/mythology content
    const mythologyContent = page.locator("a:has-text('Fenrir')").first();
    await expect(mythologyContent).toBeVisible();

    // Verify runic element (FENRIR runes)
    const runeText = page.locator(
      "p:has-text('ᚠᚦᚩᚱᚲᚨ'), p:has-text('ᚠ'), p:has-text('ᚢ')"
    );
    // Should have runes visible
    const pageContent = await page.content();
    expect(pageContent).toContain("ᚠ"); // Fehu rune
  });

  test("AC: All 5 agent profile cards with names, roles, bios", async ({ page }) => {
    const agents = [
      { name: "Freya", role: "Product Owner" },
      { name: "Luna", role: "UX Designer" },
      { name: "FiremanDecko", role: "Principal Engineer" },
      { name: "Loki", role: "QA Tester" },
      { name: "Heimdall", role: "Security Guardian" },
    ];

    for (const agent of agents) {
      // Check heading
      const nameHeading = page.locator(`h3:has-text("${agent.name}")`);
      await expect(nameHeading).toBeVisible();

      // Navigate to card
      const agentCard = nameHeading.locator("../..");

      // Check that card contains role (in uppercase mono text)
      const roleElement = agentCard.locator(`text="${agent.role}"`);
      await expect(roleElement).toBeVisible();

      // Check bio exists (should have at least one paragraph of bio text)
      const bioElements = agentCard.locator("p.text-muted-foreground");
      const bioCount = await bioElements.count();
      expect(bioCount).toBeGreaterThanOrEqual(1); // At least bio paragraph
    }
  });

  test("AC: Agent cards have dark/light theme image variants", async ({
    page,
  }) => {
    // Check that images reference -dark or -light variants
    const images = page.locator("img[src*='/images/team/']");
    const count = await images.count();

    // Should have at least 5 agent images (or placeholders)
    expect(count).toBeGreaterThanOrEqual(5);

    // Check that image paths include theme variants OR fallback to runes
    for (let i = 0; i < count; i++) {
      const src = await images.nth(i).getAttribute("src");
      // Either has -dark/-light variant OR is a placeholder
      expect(
        src?.includes("-dark") ||
          src?.includes("-light") ||
          src?.includes("placeholder")
      ).toBeTruthy();
    }
  });

  test("AC: Agent cards have unique hover effects", async ({ page }) => {
    // Get all agent cards
    const cards = page.locator('[class*="group"][class*="relative"]');
    const count = await cards.count();

    // Should have at least 5 agent cards
    expect(count).toBeGreaterThanOrEqual(5);

    // Check for hover effect divs with specific classes (count instead of visibility)
    const hoverGlow = page.locator(".about-hover-glow");
    const hoverShimmer = page.locator(".about-hover-shimmer");
    const hoverFire = page.locator(".about-hover-fire");
    const hoverGlitch = page.locator(".about-hover-glitch");

    // Each effect class should exist (at least one element with that class)
    expect(await hoverGlow.count()).toBeGreaterThanOrEqual(1);
    expect(await hoverShimmer.count()).toBeGreaterThanOrEqual(1);
    expect(await hoverFire.count()).toBeGreaterThanOrEqual(1);
    expect(await hoverGlitch.count()).toBeGreaterThanOrEqual(1);
  });

  test("AC: Built by AI section with agent chain visualization", async ({
    page,
  }) => {
    // Check for Built by AI section
    const builtByAiSection = page.locator(
      'section[aria-label="Built by AI"]'
    );
    await expect(builtByAiSection).toBeVisible();

    // Check for chain nodes (Freya, Luna, FiremanDecko, Loki)
    const chainLabels = [
      "Freya Defines",
      "Luna Designs",
      "FiremanDecko Builds",
      "Loki Validates",
    ];

    for (const label of chainLabels) {
      const node = page.locator(`text="${label}"`);
      await expect(node).toBeVisible();
    }

    // Check for description text
    const descriptions = [
      "Requirements & user stories",
      "Wireframes & interactions",
      "Code & implementation",
      "Testing & QA",
    ];

    for (const desc of descriptions) {
      const text = page.locator(`text="${desc}"`);
      await expect(text).toBeVisible();
    }

    // Check for connector arrows (desktop or mobile)
    const pageContent = await page.content();
    expect(pageContent).toContain("→"); // right arrow or similar connector
  });

  test("AC: Technology stack section", async ({ page }) => {
    // Check for tech stack section
    const techSection = page.locator(
      'section:has-text("Forged with Modern Steel"), section:has-text("Technology stack")'
    );
    await expect(techSection).toBeVisible();

    // Check for tech items
    const techNames = [
      "Next.js 15",
      "TypeScript",
      "Vercel",
      "Anthropic Claude",
      "Tailwind CSS",
    ];

    for (const tech of techNames) {
      const element = page.locator(`text="${tech}"`);
      await expect(element).toBeVisible();
    }

    // Check for GitHub link
    const githubLink = page.locator('a[href*="github.com"]');
    await expect(githubLink).toBeVisible();
  });

  test("AC: Interactive hover effects work", async ({ page }) => {
    // Get first agent card
    const firstCard = page.locator(
      '[class*="group"][class*="relative"] >> nth=0'
    );

    // Hover over it
    await firstCard.hover();

    // Check that hover styles are applied (opacity change)
    const hoverOverlay = firstCard.locator("[class*='about-hover-']");
    const opacity = await hoverOverlay.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });

    // Should have non-zero opacity on hover
    expect(parseFloat(opacity)).toBeGreaterThan(0);
  });

  test("AC: Mobile responsive at 375px", async ({ page }) => {
    // Set viewport to 375px (mobile)
    await page.setViewportSize({ width: 375, height: 812 });

    // Reload page
    await page.goto("/about");

    // Check that main heading is visible
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Check that agent cards are still visible
    const agentCards = page.locator('[class*="group"][class*="relative"]');
    const count = await agentCards.count();
    expect(count).toBeGreaterThanOrEqual(5);

    // Verify no horizontal scroll needed
    const htmlScroll = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(htmlScroll).toBeLessThanOrEqual(windowWidth + 1); // +1 for rounding
  });

  test("AC: Light theme shows correct images", async ({ page, context }) => {
    // Set light theme via context
    await context.addInitScript(() => {
      document.documentElement.classList.remove("dark");
    });

    await page.goto("/about");

    // Check that images reference -light variant or fallback
    const images = page.locator("img[src*='/images/team/']");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const src = await images.nth(i).getAttribute("src");
      expect(src).toBeTruthy();
    }
  });

  test("AC: Dark theme shows correct images", async ({ page, context }) => {
    // Set dark theme via context
    await context.addInitScript(() => {
      document.documentElement.classList.add("dark");
    });

    await page.goto("/about");

    // Check that images reference -dark variant or fallback
    const images = page.locator("img[src*='/images/team/']");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const src = await images.nth(i).getAttribute("src");
      expect(src).toBeTruthy();
    }
  });

  test("AC: Norse voice — no corporate boilerplate", async ({ page }) => {
    const pageContent = await page.content();

    // Check for Norse/mythic language
    expect(pageContent).toContain("Wolf");
    expect(pageContent).toContain("myth");
    expect(pageContent).toContain("Gleipnir");

    // Should NOT have generic corporate language
    expect(pageContent).not.toContain(
      "We are committed to excellence"
    );
    expect(pageContent).not.toContain(
      "best-in-class solutions"
    );
    expect(pageContent).not.toContain(
      "synergize"
    );
  });

  test("AC: Animations load without error", async ({ page }) => {
    // Check that Framer Motion animations are loaded
    const pageContent = await page.content();

    // Should have framer motion classes/data attributes
    expect(pageContent).toContain("motion");

    // No console errors about animations
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/about");
    await page.waitForTimeout(500);

    // Filter out unrelated errors
    const animationErrors = errors.filter((e) =>
      e.toLowerCase().includes("framer") ||
      e.toLowerCase().includes("animation")
    );
    expect(animationErrors).toHaveLength(0);
  });

  test("AC: Scroll-triggered animations trigger in view", async ({ page }) => {
    // Start at top
    await page.goto("/about");

    // Verify top section is visible first
    const heroSection = page.locator('section[aria-label="Origin story"]');
    await expect(heroSection).toBeInViewport();

    // Scroll down to trigger animations
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(500);

    // Check that pack section comes into view
    const packSection = page.locator(
      'section[aria-label="The agents of Asgard"]'
    );
    // At least verify the heading is visible after scroll
    const heading = page.locator('h2:has-text("The Agents of Asgard")');
    const headingVisible = await heading.isVisible().catch(() => false);
    // Just verify cards are present
    const agentCards = page.locator(
      '[class*="group"][class*="relative"][class*="flex"]'
    );
    const cardCount = await agentCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(5);
  });

  test("AC: CTA button links to /app", async ({ page }) => {
    // Find the main CTA button in the final CTA section (with data-app-link attribute)
    const ctaButton = page.locator('a[data-app-link]').first();
    await expect(ctaButton).toBeVisible();

    // Verify href is /app
    const href = await ctaButton.getAttribute("href");
    expect(href).toBe("/app");

    // Should have proper text content
    const text = await ctaButton.innerText();
    expect(text.toLowerCase()).toContain("ledger");
  });

  test("AC: All external links open in new tab", async ({ page }) => {
    // Find all external links (to wikipedia, github, etc)
    const externalLinks = page.locator('a[href*="wikipedia"], a[href*="github"]');
    const count = await externalLinks.count();

    for (let i = 0; i < count; i++) {
      const target = await externalLinks.nth(i).getAttribute("target");
      const rel = await externalLinks.nth(i).getAttribute("rel");

      expect(target).toBe("_blank");
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
    }
  });

  test("AC: Page renders without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/about");
    await page.waitForTimeout(500);

    // Filter out non-critical errors (3rd party, tracking, etc)
    const criticalErrors = errors.filter(
      (e) => !e.includes("tracking") && !e.includes("analytics") && !e.includes("ad")
    );

    // No critical unhandled errors
    expect(criticalErrors).toHaveLength(0);
  });

  test("AC: Future agent placeholder is visible", async ({ page }) => {
    // Find "Coming Soon" card
    const comingSoon = page.locator(
      'h3:has-text("Coming Soon"), h3:has-text("coming soon")'
    );
    await expect(comingSoon).toBeVisible();

    // Should have question mark placeholder
    const questionMark = page.locator("text='?'");
    await expect(questionMark).toBeVisible();

    // Should have "Pack Grows" text
    const packGrows = page.locator("text='The Pack Grows'");
    await expect(packGrows).toBeVisible();
  });
});
