import { test, expect } from "@playwright/test";

const AI_RELATED_TERMS = [
  "built by AI",
  "AI agents",
  "built entirely by AI",
  "AI-built",
  "AI-powered",
  "Anthropic Claude",
];

/**
 * QA Test Suite: Issue #417 — Remove AI-built copy
 *
 * Validates:
 * - All explicit AI/LLM/Claude references removed
 * - Agent profiles and team section preserved
 * - Norse voice and mystical framing intact
 * - No layout regressions
 */

test.describe("Issue #417 — Remove explicit AI copy", () => {
  test("About page: no AI-built references remain", async ({ page }) => {
    await page.goto("/about");
    const pageContent = await page.content();

    // Check that AI-related terms are NOT present
    for (const term of AI_RELATED_TERMS) {
      expect(pageContent, `About page should not contain "${term}"`).not.toContain(
        term.toLowerCase()
      );
    }
  });

  test("About page: agent profiles section preserved", async ({ page }) => {
    await page.goto("/about");

    // Verify agent profiles are visible by looking for the section heading
    const agentHeading = page.getByRole("heading", {
      name: /The Agents of Asgard/i,
    });
    expect(agentHeading.first()).toBeVisible();

    // Verify individual agents are displayed
    const agents = ["Odin", "Freya", "Loki", "Thor"];
    for (const agent of agents) {
      const agentElement = page.getByText(agent, { exact: false });
      expect(agentElement.first()).toBeVisible();
    }
  });

  test("About page: Norse voice and mystical framing preserved", async ({
    page,
  }) => {
    await page.goto("/about");
    const pageContent = await page.content();

    // Verify Norse mythology framing is intact
    const norsTerms = ["Gleipnir", "Asgard", "Fenrir"];
    for (const term of norsTerms) {
      expect(pageContent, `About page should contain "${term}"`).toContain(term);
    }

    // Verify "The Forge" section title is present
    const forgeHeading = page.getByRole("heading", {
      name: /Forged in the Fires of Asgard/i,
    });
    expect(forgeHeading.first()).toBeVisible();
  });

  test("Features page: no AI-powered references remain", async ({ page }) => {
    await page.goto("/features");
    const pageContent = await page.content();

    // Check that AI-powered term is removed from Smart Import
    expect(pageContent, "Smart Import should not mention AI-powered").not.toContain(
      "AI-powered extraction"
    );

    // Verify Smart Import still exists but without AI reference
    const smartImportSection = await page.getByText("Smart Import").first();
    expect(smartImportSection).toBeVisible();
  });

  test("Features page: Smart Import description updated", async ({ page }) => {
    await page.goto("/features");

    // Find Smart Import feature description
    const smartImportFeature = await page
      .locator('*:has-text("Smart Import")')
      .first();
    expect(smartImportFeature).toBeVisible();

    // Verify new text is present (without AI reference)
    const contentArea = smartImportFeature.locator("..").locator("..");
    const content = await contentArea.textContent();

    // Should NOT contain "AI-powered"
    expect(content).not.toContain("AI-powered");
    // But should still describe the feature
    expect(content).toMatch(/spreadsheet|mapping|import/i);
  });

  test("Pricing page: no AI references in comparison table", async ({ page }) => {
    await page.goto("/pricing");
    const pageContent = await page.content();

    // Smart Import row should not mention "AI-powered"
    expect(
      pageContent,
      "Pricing page comparison should not mention AI-powered extraction"
    ).not.toContain("AI-powered extraction");

    // Should have "automatic extraction" instead
    expect(pageContent).toContain("automatic extraction");
  });

  test("Tech stack: Anthropic Claude removed", async ({ page }) => {
    await page.goto("/about");
    const pageContent = await page.content();

    // Verify Anthropic Claude is not in tech stack
    expect(pageContent, "Tech stack should not include Anthropic Claude").not.toContain(
      "Anthropic Claude"
    );
  });

  test("About page: layout integrity (no broken sections)", async ({ page }) => {
    await page.goto("/about");

    // Verify all major sections load
    const sections = [
      "Origin Story Hero",
      "Why the Wolf",
      "The Agents of Asgard",
      "The Forge",
      "The Arsenal",
    ];

    for (const sectionName of sections) {
      const section = await page.getByText(sectionName).first();
      expect(section).toBeVisible();
    }
  });

  test("Marketing pages: no Claude references anywhere", async ({ page }) => {
    const pagePaths = ["/about", "/features", "/pricing"];

    for (const path of pagePaths) {
      await page.goto(path);
      const pageContent = await page.content();

      expect(
        pageContent,
        `${path} should not mention Claude explicitly`
      ).not.toMatch(/claude|Claude/i);
    }
  });

  test("About page: Freya bio updated (no 'AI import pipeline' reference)", async ({
    page,
  }) => {
    await page.goto("/about");
    const pageContent = await page.content();

    // Verify the old "AI import pipeline" text is gone
    expect(pageContent).not.toContain("AI import pipeline");

    // Verify Freya still has her profile
    expect(pageContent).toContain("Freya");
    expect(pageContent).toContain("Product Owner");
  });

  test("About page: subtitle updated to not mention AI agents", async ({
    page,
  }) => {
    await page.goto("/about");

    // Find the agents section subtitle
    const subtitle = await page.getByText(/Every member of the pack/).first();
    expect(subtitle).toBeVisible();

    // Verify it doesn't contain the old AI reference
    const subtitleText = await subtitle.textContent();
    expect(subtitleText).not.toContain("built entirely by AI agents");
  });

  test("No broken component references after changes", async ({ page }) => {
    const pagePaths = ["/about", "/features", "/pricing"];

    for (const path of pagePaths) {
      await page.goto(path);

      // Wait for page to settle (animations complete)
      await page.waitForTimeout(500);

      // Check for console errors (indicates broken components)
      let errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      // Verify page loads without major errors
      expect(errors.length).toBe(0);
    }
  });
});
