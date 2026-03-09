import { test, expect } from "@playwright/test";

const AI_RELATED_TERMS = [
  "built by AI",
  "AI agents",
  "built entirely by AI",
  "AI-built",
  "AI-powered",
  "Anthropic Claude",
  "no human wrote",
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
  test("About page: no AI-built references remain in content", async ({
    page,
  }) => {
    await page.goto("/about");
    const pageContent = await page.textContent("body");

    // Check that AI-related terms are NOT present in visible text
    for (const term of AI_RELATED_TERMS) {
      if (pageContent) {
        expect(
          pageContent.toLowerCase(),
          `About page should not contain "${term}"`
        ).not.toContain(term.toLowerCase());
      }
    }
  });

  test("About page: agent profiles section still present", async ({ page }) => {
    await page.goto("/about");
    const pageContent = await page.textContent("body");

    // Verify that agent names and roles are still present
    const agents = [
      "Odin",
      "Freya",
      "Loki",
      "Thor",
      "Product Owner",
      "Principal Engineer",
    ];
    for (const agent of agents) {
      if (pageContent) {
        expect(pageContent).toContain(agent);
      }
    }
  });

  test("About page: Norse voice and mystical framing preserved", async ({
    page,
  }) => {
    await page.goto("/about");
    const pageContent = await page.textContent("body");

    // Verify Norse mythology framing is intact
    const norseTerms = ["Gleipnir", "Asgard", "Fenrir", "Odin", "Loki"];
    for (const term of norseTerms) {
      if (pageContent) {
        expect(pageContent).toContain(term);
      }
    }

    // Verify "The Forge" section terminology is present
    if (pageContent) {
      expect(pageContent).toContain("Forged in the Fires of Asgard");
    }
  });

  test("About page: old 'Built by AI' section renamed to 'The Forge'", async ({
    page,
  }) => {
    await page.goto("/about");
    const pageContent = await page.textContent("body");

    if (pageContent) {
      // New title should be present
      expect(pageContent).toContain("Forged in the Fires of Asgard");

      // Old title should not be present
      expect(pageContent).not.toContain("Built by AI, for Humans");
    }
  });

  test("About page: Freya bio updated (no 'AI import pipeline')", async ({
    page,
  }) => {
    await page.goto("/about");
    const pageContent = await page.textContent("body");

    if (pageContent) {
      // Old text about AI import pipeline should be gone
      expect(pageContent).not.toContain("AI import pipeline");

      // But her profile should still exist
      expect(pageContent).toContain("Freya");
      expect(pageContent).toContain("Product Owner");
      expect(pageContent).toContain("import pipeline");
    }
  });

  test("About page: agent autonomy text updated without AI reference", async ({
    page,
  }) => {
    await page.goto("/about");
    const pageContent = await page.textContent("body");

    if (pageContent) {
      // Should have the updated text
      expect(pageContent).toContain("Each member of the pack has autonomy");
    }
  });

  test("About page: closing statement updated to Norse theme", async ({
    page,
  }) => {
    await page.goto("/about");
    const pageContent = await page.textContent("body");

    if (pageContent) {
      // New Norse-themed closing
      expect(pageContent).toContain("The forge never cools");
      expect(pageContent).toContain("Bugs slain before");

      // Old tech-focused closing should be gone
      expect(pageContent).not.toContain("This changes everything");
      expect(pageContent).not.toContain("Development velocity unconstrained");
    }
  });

  test("Features page: no AI-powered references in Smart Import", async ({
    page,
  }) => {
    await page.goto("/features");
    const pageContent = await page.textContent("body");

    if (pageContent) {
      // Old text should be gone
      expect(pageContent).not.toContain("AI-powered extraction");

      // But Smart Import feature should still exist
      expect(pageContent).toContain("Smart Import");
    }
  });

  test("Features page: Smart Import description updated", async ({ page }) => {
    await page.goto("/features");
    const pageContent = await page.textContent("body");

    if (pageContent) {
      // Should have new description without AI reference
      expect(pageContent).not.toContain("Fenrir's AI extracts");

      // But should mention the functionality
      expect(pageContent).toContain("spreadsheet");
    }
  });

  test("Pricing page: Smart Import comparison updated", async ({ page }) => {
    await page.goto("/pricing");
    const pageContent = await page.textContent("body");

    if (pageContent) {
      // Old text should be gone
      expect(pageContent).not.toContain("AI-powered extraction");

      // New text should be present
      expect(pageContent).toContain("automatic extraction");
    }
  });

  test("Tech stack: Anthropic Claude removed", async ({ page }) => {
    await page.goto("/about");
    const pageContent = await page.textContent("body");

    if (pageContent) {
      // Verify Anthropic Claude is not in tech stack
      expect(pageContent).not.toContain("Anthropic Claude");
    }
  });

  test("Pages load without errors", async ({ page }) => {
    const pagePaths = ["/about", "/features", "/pricing"];
    let consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    for (const path of pagePaths) {
      consoleErrors = [];
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(
        consoleErrors,
        `${path} should not have console errors`
      ).toEqual([]);
    }
  });

  test("About page: Agents section subtitle updated", async ({ page }) => {
    await page.goto("/about");
    const pageContent = await page.textContent("body");

    if (pageContent) {
      // New subtitle about the pack
      expect(pageContent).toContain(
        "Every member of the pack has their domain, their purpose, their saga"
      );

      // Old subtitle explicitly mentioning AI should be gone
      expect(pageContent).not.toContain("built entirely by AI agents");
    }
  });
});
