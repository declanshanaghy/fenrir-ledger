import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: path.resolve(__dirname, "../../quality/test-suites"),
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: process.env.CI ? 2 : (process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4),
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../quality/reports/test-report-playwright", open: "never" }],
  ],
  use: {
    baseURL: process.env.SERVER_URL || "http://localhost:9653",
    trace: "off",
    extraHTTPHeaders: {},
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start a production server when no SERVER_URL is provided.
  // Uses `npm start` (serves pre-built .next output) — no on-demand compilation.
  // Reuses an existing server if one is already running.
  // Skipped entirely when SERVER_URL is set (CI hitting GKE prod).
  ...(!process.env.SERVER_URL
    ? {
        webServer: {
          command: "npm start",
          url: "http://localhost:9653",
          reuseExistingServer: true,
          timeout: 30_000,
        },
      }
    : {}),
});
