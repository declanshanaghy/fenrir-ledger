/**
 * Vitest tests for Playwright config — Issue #734
 *
 * Validates that the Playwright configuration has been updated to remove
 * Vercel-specific references (bypass secrets, preview URLs) and correctly
 * targets GKE prod via SERVER_URL.
 *
 * @ref #734
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

let configContent: string;

beforeAll(() => {
  const repoRoot = path.resolve(__dirname, "../../../../..");
  const configPath = path.join(
    repoRoot,
    "development/frontend/playwright.config.ts"
  );

  if (!fs.existsSync(configPath)) {
    throw new Error(`Playwright config not found at ${configPath}`);
  }

  configContent = fs.readFileSync(configPath, "utf-8");
});

describe("Playwright config (GKE migration)", () => {
  it("reads SERVER_URL for baseURL", () => {
    expect(configContent).toContain("process.env.SERVER_URL");
  });

  it("does not reference VERCEL_BYPASS_SECRET", () => {
    expect(configContent).not.toContain("VERCEL_BYPASS_SECRET");
  });

  it("does not reference x-vercel-protection-bypass header", () => {
    expect(configContent).not.toContain("x-vercel-protection-bypass");
  });

  it("does not mention Vercel preview in comments", () => {
    expect(configContent.toLowerCase()).not.toContain("vercel preview");
  });

  it("mentions GKE prod in comments", () => {
    expect(configContent).toContain("GKE prod");
  });

  it("falls back to localhost:9653 when SERVER_URL is not set", () => {
    expect(configContent).toContain("http://localhost:9653");
  });
});
