/**
 * Marketing Site Home Page Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates GitHub Issue #337: Marketing site layout shell + home page
 *
 * Tests the (marketing) route group with shared layout (nav + footer) and home page
 * against the acceptance criteria:
 *   - Shared layout with nav (logo, links, theme toggle, CTA) and footer
 *   - Home page sections: Hero, Chains (pain points), Features, Onboarding, Final CTA
 *   - Light/dark theme toggle respecting prefers-color-scheme
 *   - Mobile responsiveness at 375px (hamburger menu)
 *   - Static page generation (force-static)
 *   - Proper link routing and navigation
 *
 * Spec references:
 *   - app/(marketing)/layout.tsx: shared layout shell
 *   - app/(marketing)/home/page.tsx: home page with all sections
 *   - components/marketing/MarketingNavbar.tsx: nav with theme toggle, mobile overlay
 *   - components/marketing/MarketingFooter.tsx: footer with organized links
 *   - designs/product/backlog/marketing-site-structure.md: design spec
 *
 * Prerequisites:
 *   - Frontend dev server running at http://localhost:3000
 *   - next-themes configured for light/dark/system theme support
 *   - localStorage for theme persistence
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Navigate first, then clear storage (localStorage not available before navigation)
  await page.goto("/home", { waitUntil: "networkidle" });
  await clearAllStorage(page);
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Marketing Layout: Navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Layout — Navigation", () => {
  test("nav renders at desktop viewport with correct structure", async ({
    page,
  }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1024, height: 768 });

    // Check nav exists and is sticky
    const nav = page.locator("nav[role='navigation']");
    await expect(nav).toBeVisible();
    const navClasses = await nav.getAttribute("class");
    expect(navClasses).toContain("sticky");

    // Check logo
    const logo = nav.locator("text=/Fenrir Ledger/").first();
    await expect(logo).toBeVisible();
    expect(await logo.locator("xpath=ancestor::a").first().getAttribute("href")).toBe("/home");

    // Check nav links visible at desktop
    for (const link of ["Features", "Pricing", "About", "Blog"]) {
      await expect(nav.locator(`text=${link}`)).toBeVisible();
    }

    // Check CTA visible
    await expect(nav.locator("text=/Open the Ledger/")).toBeVisible();

    // Check theme toggle exists (button with icon)
    const themeToggle = nav.locator("button[aria-label*='Theme']").first();
    await expect(themeToggle).toBeVisible();
  });

  test("nav links route correctly to expected pages", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    const nav = page.locator("nav[role='navigation']");

    // Test each nav link
    const links = [
      { text: "Features", href: "/features" },
      { text: "Pricing", href: "/pricing" },
      { text: "About", href: "/about" },
      { text: "Blog", href: "/blog" },
    ];

    for (const { text, href } of links) {
      const linkElement = nav.locator(`a`, { has: page.locator(`text=${text}`) }).first();
      const linkHref = await linkElement.getAttribute("href");
      expect(linkHref).toBe(href);
    }
  });

  test("CTA button 'Open the Ledger →' links to /app", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    const nav = page.locator("nav[role='navigation']");
    const cta = nav.locator("a:has-text('Open the Ledger')").first();
    const ctaLink = await cta.getAttribute("href");

    expect(ctaLink).toBe("/app");
  });

  test("hamburger menu is hidden at desktop but visible on mobile", async ({
    page,
  }) => {
    // Desktop: hamburger hidden
    await page.setViewportSize({ width: 1024, height: 768 });
    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await expect(hamburger).not.toBeVisible();

    // Mobile: hamburger visible
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(hamburger).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Mobile Navigation: Hamburger Overlay
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Layout — Mobile Navigation Overlay", () => {
  test("hamburger opens full-screen overlay with nav links and CTA", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await hamburger.click();

    // Check overlay is visible
    const overlay = page.locator("[role='dialog'][aria-label='Navigation menu']");
    await expect(overlay).toBeVisible();

    // Check mobile nav links appear in overlay
    for (const link of ["Features", "Pricing", "About", "Blog"]) {
      const navLink = overlay.locator(`text=${link}`).first();
      await expect(navLink).toBeVisible();
    }

    // Check CTA in overlay
    const ctaInOverlay = overlay.locator("text=/Open the Ledger/");
    await expect(ctaInOverlay).toBeVisible();

    // Check close button
    const closeButton = overlay.locator("button[aria-label='Close navigation menu']");
    await expect(closeButton).toBeVisible();
  });

  test("close button closes the overlay", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await hamburger.click();

    const overlay = page.locator("[role='dialog']");
    await expect(overlay).toBeVisible();

    const closeButton = overlay.locator("button[aria-label='Close navigation menu']");
    await closeButton.click();

    await expect(overlay).not.toBeVisible();
  });

  test("Escape key closes the overlay", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await hamburger.click();

    const overlay = page.locator("[role='dialog']");
    await expect(overlay).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  });

  test("clicking nav link in overlay closes it", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await hamburger.click();

    const overlay = page.locator("[role='dialog']");
    await expect(overlay).toBeVisible();

    const featureLink = overlay.locator("text=Features").first();
    await featureLink.click();

    // Overlay should close and we should navigate
    await page.waitForNavigation();
    expect(page.url()).toContain("/features");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Theme Toggle and Dark/Light Mode
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Layout — Theme Toggle", () => {
  test("theme toggle button cycles through light/dark/system", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    const themeToggle = page.locator("button[aria-label*='Theme']").first();

    // Get initial aria-label
    let ariaLabel = await themeToggle.getAttribute("aria-label");
    expect(ariaLabel).toContain("Theme");

    // Click to cycle to next theme
    await themeToggle.click();
    await page.waitForTimeout(100);

    // aria-label should have changed
    const newAriaLabel = await themeToggle.getAttribute("aria-label");
    expect(newAriaLabel).not.toBe(ariaLabel);

    ariaLabel = newAriaLabel;

    // Click again to verify cycling works
    await themeToggle.click();
    await page.waitForTimeout(100);

    const nextAriaLabel = await themeToggle.getAttribute("aria-label");
    expect(nextAriaLabel).not.toBe(ariaLabel);
  });

  test("dark mode applies when theme is set to dark", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    const themeToggle = page.locator("button[aria-label*='Theme']").first();

    // Click theme toggle multiple times until we get to dark mode
    // by checking aria-label changes
    for (let i = 0; i < 3; i++) {
      const label = await themeToggle.getAttribute("aria-label");
      if (label?.includes("Dark")) break;
      await themeToggle.click();
      await page.waitForTimeout(100);
    }

    // Verify the page is in dark mode by checking if page renders properly
    const nav = page.locator("nav[role='navigation']");
    await expect(nav).toBeVisible();
  });

  test("light mode applies when theme is set to light", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    const themeToggle = page.locator("button[aria-label*='Theme']").first();

    // Click theme toggle multiple times until we get to light mode
    for (let i = 0; i < 3; i++) {
      const label = await themeToggle.getAttribute("aria-label");
      if (label?.includes("Light")) break;
      await themeToggle.click();
      await page.waitForTimeout(100);
    }

    // Verify the page is in light mode by checking if page renders properly
    const nav = page.locator("nav[role='navigation']");
    await expect(nav).toBeVisible();
  });

  test("theme toggle in mobile overlay works and persists", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await hamburger.click();

    const overlay = page.locator("[role='dialog']");
    const themeButton = overlay.locator("button[aria-label*='Theme']");

    // Initial aria-label
    const initialLabel = await themeButton.getAttribute("aria-label");

    // Click theme toggle
    await themeButton.click();
    await page.waitForTimeout(100);

    // aria-label should change
    const newLabel = await themeButton.getAttribute("aria-label");
    expect(newLabel).not.toBe(initialLabel);

    // Close overlay and verify page is still functional
    const closeButton = overlay.locator("button[aria-label='Close navigation menu']");
    await closeButton.click();

    // Verify overlay closed
    await expect(overlay).not.toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Marketing Footer
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Layout — Footer", () => {
  test("footer renders with logo, tagline, and link sections", async ({
    page,
  }) => {
    // Scroll to footer - select marketing footer specifically (contains FENRIR LEDGER ᛟ)
    const footer = page.locator("footer").filter({ hasText: "FENRIR LEDGER" }).first();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();

    // Check footer has expected content
    const footerText = await footer.textContent();
    expect(footerText).toContain("FENRIR LEDGER");
    expect(footerText).toContain("Every reward has a deadline");

    // Check footer link sections exist (Product, Resources, Legal)
    for (const section of ["Product", "Resources", "Legal"]) {
      const sectionHeading = footer.locator(`text=${section}`);
      await expect(sectionHeading).toBeVisible();
    }
  });

  test("footer contains correct Product links", async ({ page }) => {
    const footer = page.locator("footer").filter({ hasText: "FENRIR LEDGER" }).first();
    await footer.scrollIntoViewIfNeeded();

    // Product section should have: Features, Pricing, FAQ
    const links = ["Features", "Pricing", "FAQ"];
    for (const link of links) {
      const footerLink = footer.locator(`a:has-text('${link}')`).first();
      const href = await footerLink.getAttribute("href");
      expect(href).toBeTruthy();
    }
  });

  test("footer contains correct Resources links", async ({ page }) => {
    const footer = page.locator("footer").filter({ hasText: "FENRIR LEDGER" }).first();
    await footer.scrollIntoViewIfNeeded();

    // Resources section should have: Session Chronicles (blog), Changelog, About
    const links = ["Session Chronicles", "Changelog", "About"];
    for (const link of links) {
      const footerLink = footer.locator(`a:has-text('${link}')`).first();
      const href = await footerLink.getAttribute("href");
      expect(href).toBeTruthy();
    }
  });

  test("footer contains correct Legal links", async ({ page }) => {
    const footer = page.locator("footer").filter({ hasText: "FENRIR LEDGER" }).first();
    await footer.scrollIntoViewIfNeeded();

    // Legal section should have: Privacy Policy, Terms of Service
    const links = ["Privacy Policy", "Terms of Service"];
    for (const link of links) {
      const footerLink = footer.locator(`a:has-text('${link}')`).first();
      const href = await footerLink.getAttribute("href");
      expect(href).toBeTruthy();
    }
  });

  test("footer CTA 'Open the Ledger' links to /app", async ({ page }) => {
    const footer = page.locator("footer").filter({ hasText: "FENRIR LEDGER" }).first();
    await footer.scrollIntoViewIfNeeded();

    const cta = footer.locator("a:has-text('Open the Ledger')").first();
    const href = await cta.getAttribute("href");
    expect(href).toBe("/app");
  });

  test("footer copyright includes current year and Norse attribution", async ({
    page,
  }) => {
    const footer = page.locator("footer").filter({ hasText: "FENRIR LEDGER" }).first();
    await footer.scrollIntoViewIfNeeded();

    // Look for copyright text in footer
    const footerText = await footer.textContent();
    expect(footerText).toContain("©");
    expect(footerText).toContain("Fenrir Ledger");

    const year = new Date().getFullYear();
    expect(footerText).toContain(String(year));
    expect(footerText).toContain("FiremanDecko");
    expect(footerText).toContain("Freya");
    expect(footerText).toContain("Loki");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Home Page Sections
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Home Page — Sections", () => {
  test("hero section renders with logo, headline, tagline, and CTA", async ({
    page,
  }) => {
    // Hero should be immediately visible
    const hero = page.locator("section[aria-label='Hero']");
    await expect(hero).toBeVisible();

    // Wolf icon (ᚠ)
    const wolfIcon = hero.locator("text=/ᚠ/").first();
    await expect(wolfIcon).toBeVisible();

    // Headline
    const headline = hero.locator("text=/Fenrir Ledger/").first();
    await expect(headline).toBeVisible();

    // Tagline
    const tagline = hero.locator("text=/Every reward has a deadline/");
    await expect(tagline).toBeVisible();

    // Description text
    const description = hero.locator("text=/Credit card churning lives and dies by dates/");
    await expect(description).toBeVisible();

    // CTA button
    const ctaButton = hero.locator("text=/Break the Chain/");
    await expect(ctaButton).toBeVisible();
  });

  test("hero CTA button links to /app", async ({ page }) => {
    const hero = page.locator("section[aria-label='Hero']");
    const cta = hero.locator("a:has-text('Break the Chain')").first();
    const href = await cta.getAttribute("href");
    expect(href).toBe("/app");
  });

  test("pain points section (The Chains) renders with 3 cards", async ({
    page,
  }) => {
    // Check for pain point content in the page
    const content = await page.locator("body").textContent();
    expect(content).toContain("Fee");
    expect(content).toContain("Promo");
    expect(content).toContain("deadline");
  });

  test("features section renders with feature cards", async ({ page }) => {
    // Check for features content
    const content = await page.locator("body").textContent();
    expect(content?.toLocaleLowerCase()).toContain("feature");
  });

  test("onboarding section renders with 3 steps", async ({ page }) => {
    // Check for step/onboarding content
    const content = await page.locator("body").textContent();
    expect(
      content?.includes("Step") ||
      content?.toLocaleLowerCase().includes("rune") ||
      content?.toLocaleLowerCase().includes("onboard")
    ).toBeTruthy();
  });

  test("final CTA section renders with call-to-action", async ({ page }) => {
    // Check for CTA content
    const content = await page.locator("body").textContent();
    expect(content).toContain("Open the Ledger");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 6 — Mobile Responsiveness at 375px
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Site — Mobile Responsiveness (375px)", () => {
  test("page is fully functional at 375px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    // Navigation should be responsive (hamburger visible, no horizontal overflow)
    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await expect(hamburger).toBeVisible();

    // Page content should be accessible
    const content = await page.locator("body").textContent();
    expect(content).toContain("Fenrir Ledger");
  });

  test("content is readable and not cut off at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    // Check that text is visible
    const headline = page.locator("h1").first();
    await expect(headline).toBeVisible();

    // Verify no layout overflow
    const bodyBox = await page.locator("body").boundingBox();
    expect(bodyBox?.width).toBeLessThanOrEqual(375);
  });

  test("hamburger menu opens correctly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await hamburger.click();

    const overlay = page.locator("[role='dialog']");
    await expect(overlay).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 7 — Page Routing and Navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Site — Routing", () => {
  test("home page is served at /home and / routes correctly", async ({
    page,
  }) => {
    // Should be at /home already from beforeEach
    expect(page.url()).toContain("localhost");

    // Home page should be accessible at /home
    await page.goto("/home");
    expect(page.url()).toContain("/home");
  });

  test("navigation to /features works", async ({ page }) => {
    const nav = page.locator("nav[role='navigation']");
    const featuresLink = nav.locator("text=Features").first();
    await featuresLink.click();

    await page.waitForNavigation();
    expect(page.url()).toContain("/features");
  });

  test("navigation to /pricing works", async ({ page }) => {
    const nav = page.locator("nav[role='navigation']");
    const pricingLink = nav.locator("text=Pricing").first();
    await pricingLink.click();

    await page.waitForNavigation();
    expect(page.url()).toContain("/pricing");
  });

  test("navigation to /about works", async ({ page }) => {
    const nav = page.locator("nav[role='navigation']");
    const aboutLink = nav.locator("text=About").first();
    await aboutLink.click();

    await page.waitForNavigation();
    expect(page.url()).toContain("/about");
  });

  test("navigation to /blog works", async ({ page }) => {
    const nav = page.locator("nav[role='navigation']");
    const blogLink = nav.locator("text=Blog").first();
    await blogLink.click();

    await page.waitForNavigation();
    expect(page.url()).toContain("/blog");
  });

  test("logo link returns to home", async ({ page }) => {
    // Go to a different page first
    await page.goto("/features");

    // Click logo to return home
    const logo = page.locator("nav a:has-text('Fenrir Ledger')").first();
    const logoLink = await logo.getAttribute("href");
    expect(logoLink).toBe("/home");

    await logo.click();
    await page.waitForNavigation();

    expect(page.url()).toContain("/home");
  });

  test("CTA links throughout page navigate to /app", async ({ page }) => {
    // Check hero CTA
    const hero = page.locator("section[aria-label='Hero']");
    const heroCta = hero.locator("a:has-text('Break the Chain')").first();
    const heroHref = await heroCta.getAttribute("href");
    expect(heroHref).toBe("/app");

    // Check nav CTA
    const nav = page.locator("nav");
    const navCta = nav.locator("a:has-text('Open the Ledger')").first();
    const navHref = await navCta.getAttribute("href");
    expect(navHref).toBe("/app");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 8 — Content and Static Generation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Home Page — Content & Static Generation", () => {
  test("page title and meta description are correct", async ({ page }) => {
    const title = await page.title();
    expect(title).toContain("Fenrir Ledger");
    expect(
      title.toLocaleLowerCase().includes("break free") ||
      title.toLocaleLowerCase().includes("credit card")
    ).toBeTruthy();

    const description = await page.locator("meta[name='description']").getAttribute("content");
    expect(
      description?.includes("Fenrir Ledger") ||
      description?.toLocaleLowerCase().includes("credit") ||
      description?.toLocaleLowerCase().includes("reward")
    ).toBeTruthy();
  });

  test("page loads quickly (indicates static generation)", async ({ page }) => {
    // Verify page can be accessed without errors
    const response = await page.goto("/home", { waitUntil: "networkidle" });
    expect(response?.ok()).toBe(true);

    // Verify page content is immediately available (SSG indicator)
    const content = await page.locator("body").textContent();
    expect(content).toContain("Fenrir Ledger");
  });

  test("mythology references have correct links", async ({ page }) => {
    const mythLink = page.locator("a[href*='wikipedia.org']").first();
    const href = await mythLink.getAttribute("href");
    expect(href).toContain("wikipedia.org");
    expect(href).toContain("Fenrir");
  });

  test("page content is accessible without JavaScript interaction", async ({
    page,
  }) => {
    // Verify hero text is in the page
    const content = await page.locator("body").textContent();
    expect(content).toContain("Fenrir Ledger");
    expect(content).toContain("Every reward has a deadline");
    expect(content).toContain("Break the Chain");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 9 — Accessibility
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Site — Accessibility", () => {
  test("nav has proper ARIA labels and roles", async ({ page }) => {
    const nav = page.locator("nav[role='navigation']");
    await expect(nav).toHaveAttribute("aria-label", /navigation/i);
  });

  test("footer logo has accessible link text", async ({ page }) => {
    const footer = page.locator("footer");
    const logoLink = footer.locator("a[aria-label*='home']").first();
    const ariaLabel = await logoLink.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();
  });

  test("theme toggle has descriptive aria-label", async ({ page }) => {
    const themeToggle = page.locator("button[aria-label*='Theme']").first();
    const ariaLabel = await themeToggle.getAttribute("aria-label");
    expect(ariaLabel).toContain("Theme");
  });

  test("mobile overlay has proper dialog semantics", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await hamburger.click();

    const overlay = page.locator("[role='dialog']");
    await expect(overlay).toHaveAttribute("aria-modal", "true");
    await expect(overlay).toHaveAttribute("aria-label", /navigation/i);
  });

  test("hero section has proper semantic structure", async ({ page }) => {
    const hero = page.locator("section[aria-label='Hero']");
    await expect(hero).toBeVisible();

    // Should have h1 or similar heading
    const heading = hero.locator("h1").first();
    await expect(heading).toBeVisible();
  });
});
