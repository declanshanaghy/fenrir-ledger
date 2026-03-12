#!/usr/bin/env node
/**
 * coverage.mjs — Collect Playwright code coverage via V8 and generate reports.
 *
 * Usage:
 *   node quality/scripts/coverage.mjs [--skip-build] [--skip-tests] [--unit-only] [-- playwright args...]
 *
 * Flow:
 *   1. Build the Next.js app (unless --skip-build)
 *   2. Start the production server with NODE_V8_COVERAGE (V8 writes coverage on exit)
 *   3. Run Playwright tests
 *   4. Stop server (SIGTERM triggers V8 coverage write)
 *   5. Use c8 to generate reports from collected V8 data
 *
 * Reports are written to: quality/reports/coverage/
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const FRONTEND_DIR = path.join(REPO_ROOT, "development/frontend");
const REPORTS_DIR = path.join(REPO_ROOT, "quality/reports/coverage");
const V8_COVERAGE_DIR = path.join(REPO_ROOT, "quality/.coverage-tmp");

const args = process.argv.slice(2);
const unitOnly = args.includes("--unit-only");
const skipBuild = args.includes("--skip-build");
const skipTests = args.includes("--skip-tests");
const dashDashIdx = args.indexOf("--");
const playwrightArgs = dashDashIdx >= 0 ? args.slice(dashDashIdx + 1) : [];

function ts() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}
function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

function run(cmd, opts = {}) {
  log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function clean() {
  for (const d of [V8_COVERAGE_DIR, REPORTS_DIR]) {
    if (existsSync(d)) rmSync(d, { recursive: true });
  }
  mkdirSync(V8_COVERAGE_DIR, { recursive: true });
  mkdirSync(REPORTS_DIR, { recursive: true });
}

function build() {
  if (skipBuild) {
    log("Skipping build (--skip-build)");
    return;
  }
  log("Building Next.js app...");
  run("npm run build", { cwd: FRONTEND_DIR });
}

function startServer() {
  log("Starting Next.js production server with V8 coverage enabled...");

  // NODE_V8_COVERAGE tells Node.js to write V8 coverage JSON files to this
  // directory when the process exits. No wrapper tool needed.
  const serverProc = spawn(
    "npx",
    ["next", "start", "-p", "9653"],
    {
      cwd: FRONTEND_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_V8_COVERAGE: V8_COVERAGE_DIR,
        NODE_ENV: "production",
      },
    },
  );

  serverProc.stdout.on("data", (d) => process.stdout.write(d));
  serverProc.stderr.on("data", (d) => process.stderr.write(d));

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server did not start within 60s"));
    }, 60_000);

    const check = setInterval(async () => {
      try {
        // Use AbortController to avoid hanging fetch
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch("http://localhost:9653/ledger/sign-in", {
          signal: controller.signal,
          redirect: "manual", // Don't follow redirects — any response means server is up
        });
        clearTimeout(fetchTimeout);
        // Any response (200, 301, 302, 404, etc.) means server is running
        clearTimeout(timeout);
        clearInterval(check);
        log(`Server is ready on port 9653 (status: ${resp.status})`);
        resolve(serverProc);
      } catch {
        // not ready yet
      }
    }, 1000);

    serverProc.on("error", (err) => {
      clearTimeout(timeout);
      clearInterval(check);
      reject(err);
    });

    serverProc.on("exit", (code) => {
      clearTimeout(timeout);
      clearInterval(check);
      if (code !== null && code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

function runTests(extraArgs = []) {
  if (skipTests) {
    log("Skipping tests (--skip-tests)");
    return;
  }
  log("Running Playwright tests...");
  const pwArgs = ["playwright", "test", "--config", "playwright.config.ts", ...extraArgs];
  try {
    run(`npx ${pwArgs.join(" ")}`, { cwd: FRONTEND_DIR });
  } catch {
    log("Some tests failed — continuing to generate coverage report from partial data");
  }
}

function stopServer(serverProc) {
  return new Promise((resolve) => {
    log("Stopping server (SIGTERM → triggers V8 coverage write)...");
    serverProc.on("exit", () => {
      log("Server stopped");
      resolve();
    });
    serverProc.kill("SIGTERM");
    // Force kill after 10s if graceful shutdown hangs
    setTimeout(() => {
      if (!serverProc.killed) {
        log("Force killing server (SIGKILL)...");
        serverProc.kill("SIGKILL");
      }
      resolve();
    }, 10_000);
  });
}

function generateReports() {
  log("Generating coverage reports via c8...");

  // c8 report reads NODE_V8_COVERAGE data and generates Istanbul-format reports
  const c8Args = [
    "c8", "report",
    "--temp-directory", V8_COVERAGE_DIR,
    "--reporter", "text",
    "--reporter", "text-summary",
    "--reporter", "html",
    "--reporter", "lcov",
    "--reports-dir", REPORTS_DIR,
    "--all",
    "--src", path.join(FRONTEND_DIR, "src"),
    "--include", "src/**/*.ts",
    "--include", "src/**/*.tsx",
    "--exclude", "src/**/*.test.*",
    "--exclude", "src/**/*.spec.*",
    "--exclude", "node_modules/**",
  ];

  try {
    run(`npx ${c8Args.join(" ")}`, { cwd: FRONTEND_DIR });
  } catch {
    log("c8 report generation had warnings (non-zero exit) — reports may still be valid");
  }

  log(`Reports written to ${REPORTS_DIR}`);
  log("  - HTML:  quality/reports/coverage/index.html");
  log("  - LCOV:  quality/reports/coverage/lcov.info");
}

function runUnitCoverage() {
  log("Running Vitest unit tests with V8 coverage...");
  const vitestReportsDir = path.join(REPORTS_DIR, "vitest");
  mkdirSync(vitestReportsDir, { recursive: true });
  run("npm run test:unit:coverage", { cwd: FRONTEND_DIR });
  log(`Vitest coverage reports written to ${vitestReportsDir}`);
  log("  - HTML:  quality/reports/coverage/vitest/index.html");
  log("  - LCOV:  quality/reports/coverage/vitest/lcov.info");
}

async function main() {
  if (unitOnly) {
    log("Running in --unit-only mode (Vitest coverage only)");
    runUnitCoverage();
    log("Done! Open quality/reports/coverage/vitest/index.html to view the report.");
    return;
  }

  let serverProc;
  try {
    clean();
    build();
    serverProc = await startServer();
    runTests(playwrightArgs);
  } catch (err) {
    log(`Error: ${err.message}`);
  }

  if (serverProc) {
    await stopServer(serverProc);
    // Brief pause to let V8 finish writing coverage files
    await new Promise((r) => setTimeout(r, 2000));
  }

  generateReports();

  // Clean up temp coverage data
  if (existsSync(V8_COVERAGE_DIR)) {
    rmSync(V8_COVERAGE_DIR, { recursive: true });
  }

  log("Done! Open quality/reports/coverage/index.html to view the report.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
