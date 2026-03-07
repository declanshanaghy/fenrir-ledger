import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: path.resolve(__dirname, "../../quality/test-suites"),
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL: process.env.SERVER_URL || "http://localhost:9653",
    trace: "on-first-retry",
    // Pass Vercel's automation bypass secret as a header so tests can reach
    // preview deployments that are behind deployment protection.
    extraHTTPHeaders: process.env.VERCEL_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS_SECRET }
      : {},
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start the dev server automatically when no SERVER_URL is provided.
  // Reuses an existing server if one is already running (local dev).
  // Skipped entirely when SERVER_URL is set (CI hitting a Vercel preview).
  ...(!process.env.SERVER_URL
    ? {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:9653",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
});
