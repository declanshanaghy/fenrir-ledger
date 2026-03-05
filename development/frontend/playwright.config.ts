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
});
